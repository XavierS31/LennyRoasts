"""Private persisted jobs; one bounded instance, GET never starts inference."""
import asyncio
import copy
from contextlib import asynccontextmanager
import json
import os
import secrets
import time
from urllib.parse import urlsplit

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .contracts import FIXTURES, GENERAL_IDS, SPEC, validate, validator, ROOT
from .database import Store, make_engine
from .feedback import add_feedback
from .field_import import field_counts
from .judging import score_submission, expire_diagnostics
from .ranking import rank_results
from .settings import load_environment

COOKIE='lenny_session'
MAX_BODY=128_000


def api_error(status,code,message,details=None):
    body=dict(code=code,message=message,details=details or [])
    validate('APIError',body)
    return JSONResponse(body,status_code=status)


def create_live_app(*, store=None, scorer=score_submission):
    queue=asyncio.Queue(maxsize=8)
    live_store=store
    ready=False
    tasks=[]
    admissions={}

    async def execute(identifier):
        job=await asyncio.to_thread(live_store.claim,identifier)
        if job is None: return
        try:
            async with asyncio.timeout(420):
                captured=await asyncio.to_thread(live_store.field,job['pool_version'])
                pool,config=captured
                if config['judge_version']!=job['judge_version']:
                    raise ValueError('Captured config mismatch')
                submission=job['submission']
                scores=await scorer(submission,submission['challenges']+list(GENERAL_IDS),config)
                ranked=add_feedback(rank_results(scores,pool,judge_version=config['judge_version']))
                report={'challenge_results':ranked}
                validate('EvaluationResult',report)
                await asyncio.to_thread(live_store.finish,identifier,result=report)
        except asyncio.CancelledError:
            await asyncio.to_thread(live_store.finish,identifier,error=dict(code='INTERRUPTED',message='The server stopped during evaluation. Please submit again.',details=[]))
            raise
        except Exception:
            # Never log exception repr: DB/provider exceptions can include private payloads.
            await asyncio.to_thread(live_store.finish,identifier,error=dict(code='JUDGE_UNAVAILABLE',message='The live evaluation could not complete. No partial scores were published.',details=[]))

    async def worker():
        nonlocal ready
        while True:
            identifier=await queue.get()
            try:
                await asyncio.to_thread(live_store.check_worker)
                await execute(identifier)
            except Exception:
                # Fail closed after a storage/worker-lock loss; restart marks work interrupted.
                ready=False
                return
            finally:
                queue.task_done()

    async def cleanup():
        nonlocal ready
        while True:
            await asyncio.sleep(60)
            try:
                await asyncio.to_thread(live_store.check_worker)
                await asyncio.to_thread(live_store.expire)
                await asyncio.to_thread(expire_diagnostics)
            except Exception:
                ready=False
                for task in tasks:
                    if task is not asyncio.current_task(): task.cancel()
                return

    @asynccontextmanager
    async def lifespan(app):
        nonlocal live_store,ready
        load_environment()
        try:
            if live_store is None:
                live_store=Store(make_engine())
            await asyncio.to_thread(live_store.acquire_worker)
            await asyncio.to_thread(live_store.recover)
            await asyncio.to_thread(expire_diagnostics)
            ready=True
            tasks.extend([asyncio.create_task(worker()),asyncio.create_task(cleanup())])
        except Exception:
            ready=False
            print('Live storage unavailable; API remains fail-closed. Check Neon migrations/settings privately.')
        yield
        for task in tasks: task.cancel()
        await asyncio.gather(*tasks,return_exceptions=True)
        if live_store:
            try: await asyncio.to_thread(live_store.release_worker)
            finally:
                if store is None: live_store.engine.dispose()

    app=FastAPI(title='LennyRoasts practice API',lifespan=lifespan)
    app.openapi=lambda:copy.deepcopy(SPEC)

    async def active_pair():
        if not ready or not os.getenv('HF_TOKEN') and store is None: return None
        try: return await asyncio.to_thread(live_store.field)
        except Exception: return None

    @app.exception_handler(RequestValidationError)
    async def invalid_framework(request,exc):
        return api_error(422,'INVALID_SUBMISSION','Request validation failed.')

    @app.get('/api/challenges')
    async def challenges():
        pair=await active_pair()
        body=copy.deepcopy(FIXTURES['challenges'])
        body.update(field_ready=pair is not None,judge_version=pair[1]['judge_version'] if pair else 'unconfigured',pool_version=pair[0]['pool_version'] if pair else 'unconfigured')
        # Live briefs belong to Dev2; retain synthetic/mock descriptions unchanged elsewhere.
        descriptions=json.loads((ROOT/'backend/config/challenges.json').read_text())
        for challenge in body['challenges']:
            challenge['description']=descriptions[challenge['id']]['description']
            challenge['name']=descriptions[challenge['id']]['name']
            if pair:
                counts=field_counts(pair[0])[challenge['id']]
                challenge['description']+=f" Simulated practice field: {len(pair[0]['projects'])} projects; {counts['considered']} considered, {counts['eligible']} eligible. Based on write-ups; software execution is unverified."
        validate('ChallengeList',body)
        return body

    @app.post('/api/evaluations',status_code=202)
    async def post(request:Request):
        origin=request.headers.get('origin')
        if origin and (urlsplit(origin).netloc != request.url.netloc or urlsplit(origin).scheme != request.url.scheme):
            return api_error(422,'INVALID_SUBMISSION','Use the same-origin API proxy.')
        try:
            async with asyncio.timeout(10):
                chunks=bytearray()
                async for chunk in request.stream():
                    chunks.extend(chunk)
                    if len(chunks)>MAX_BODY:
                        return api_error(422,'INVALID_SUBMISSION','Request exceeds the demo size limit.')
                body=json.loads(chunks)
        except (ValueError,UnicodeDecodeError,TimeoutError):
            return api_error(422,'INVALID_SUBMISSION','Request must contain bounded valid JSON.')
        failures=sorted(validator('EvaluationRequest').iter_errors(body),key=lambda e:str(e.path))
        if failures:
            return api_error(422,'INVALID_SUBMISSION','Submission validation failed.',[f"{'.'.join(map(str,e.path)) or 'request'}: {e.validator} constraint failed" for e in failures[:20]])
        pair=await active_pair()
        if pair is None:
            return api_error(503,'FIELD_NOT_READY','The live judge and complete frozen field are unavailable.')
        if queue.full():
            return api_error(503,'DEMO_LIMIT','The demo queue is full. Try again later.')
        now=time.monotonic()
        admissions_keys=list(admissions)
        for key in admissions_keys:
            admissions[key]=[t for t in admissions[key] if t>now-600]
            if not admissions[key]: del admissions[key]
        # Do not trust forwarded headers for admission limits. Configure the hosting proxy correctly.
        from .database import session_hash
        address=session_hash(request.client.host if request.client else 'unknown')
        if len(admissions.get(address,[]))>=5 or len(admissions)>=4096:
            return api_error(503,'DEMO_LIMIT','The demo request limit was reached. Try again later.')
        cookie=request.cookies.get(COOKIE)
        owner=cookie if cookie and 32<=len(cookie)<=100 else secrets.token_urlsafe(32)
        try:
            job=await asyncio.to_thread(live_store.create_job,owner,*pair,body['submission'])
        except ValueError:
            return api_error(503,'DEMO_LIMIT','One active evaluation and three submissions per session per ten minutes are allowed.')
        except Exception:
            return api_error(503,'STORAGE_UNAVAILABLE','Evaluation storage is unavailable.')
        admissions.setdefault(address,[]).append(now)
        queue.put_nowait(job['evaluation_id'])
        validate('EvaluationJob',job)
        response=JSONResponse(job,status_code=202)
        response.set_cookie(COOKIE,owner,httponly=True,secure=request.url.scheme=='https',samesite='lax',max_age=3600)
        return response

    @app.get('/api/evaluations/{evaluation_id}')
    async def get(evaluation_id:str,request:Request):
        owner=request.cookies.get(COOKIE)
        if not ready or not owner or len(evaluation_id)>100:
            return api_error(404,'NOT_FOUND','Evaluation not found.')
        try: job=await asyncio.to_thread(live_store.read_job,evaluation_id,owner)
        except Exception:
            return api_error(503,'STORAGE_UNAVAILABLE','Evaluation storage is unavailable.')
        if job is None: return api_error(404,'NOT_FOUND','Evaluation not found.')
        validate('EvaluationJob',job)
        return job

    return app
