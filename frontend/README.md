# Frontend — Person 3

Use Node 24. From this folder:

```sh
npm ci
npm run contracts
npm run dev
```

Open `http://127.0.0.1:5173`. Start the backend mock command in `backend/README.md`; Vite forwards `/api/*` to port 8110. Ports are fixed, and Vite refuses to silently move to another port.

The starter has a Devpost form, sample loader, sponsor selection, submit/poll flow and example result cards. The banner labels mock scoring against 200 synthetic projects. New inputs receive calculated mock placements, not fixed example scores; all mock judgments are for development only. Person 3 owns the final visual layout, richer feedback and real API integration; this page is a starting point rather than a completed product.

`src/api/contract.d.ts` is generated from the authoritative OpenAPI contract. Never edit it manually. The only fetch wrappers belong in `src/api/client.ts`; add no competing routes or schema aliases. Contract changes originate with Person 2, after which Person 3 regenerates and commits these types.

Run `npm run build` before every PR. No HF_TOKEN or database URL belongs in frontend configuration.
