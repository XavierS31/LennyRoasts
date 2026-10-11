"""Synthetic transport replay field; never exported as live provider evidence."""
import copy
from backend.app.contracts import FIXTURES, GENERAL_IDS
from backend.app.judge_config import load_config, config_hash
from backend.app.judging import aggregate


def replay_results(submission, ids):
    out=[]
    for cid in ids:
        keys=['originality','tech_understanding','functionality','wow']+([] if cid=='overall' else ['relevance'])
        raw={**{k:3 for k in keys},'rationale':'Synthetic transport replay only.', 'evidence':{k:'not described' for k in keys},
             'improvements':['Synthetic replay improvement.']}
        out.append(aggregate(cid,[copy.deepcopy(raw) for _ in range(3)],submission))
    return out


def replay_field():
    config=load_config();config['judge_version']='test-replay-qwen-config-v1'
    submission=copy.deepcopy(FIXTURES['request']['submission'])
    pool_version='test-replay-field-v1'
    project=dict(project_id='synthetic-campus',submission=submission,
        meta=dict(seed_ids=['synthetic-seed'],source_urls=['https://example.org/synthetic'],mutation='light',
            persona=dict(skill_focus='web',completion='partial',writing_style='average'),fit={'gemini':'strong'},
            pool_version=pool_version,prompt_version='synthetic-generation-v1',model='synthetic-replay',rng_seed=1,created_at='2026-10-10T12:00:00Z'),
        challenge_results=replay_results(submission,submission['challenges']+list(GENERAL_IDS)))
    return dict(contract_version='1.0.0',judge_version=config['judge_version'],pool_version=pool_version,
        judge_config_sha256=config_hash(config),projects=[project]),config
