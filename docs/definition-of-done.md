# Definition of Done — Virtual Engineer

## P0 (Non-Negotiable)

- [x] Success criteria documented and mapped to demo flows
- [x] Hard gates approved and logged in `docs/gates.md`
- [x] `docs/build-plan.md` and `docs/test-plan.md` current
- [x] `docs/phase-status.md` includes test commands and results
- [x] Connectivity smoke tests pass (`npm run test:connectivity`)
- [x] No secrets committed; `.env.example` accurate
- [x] Data model review with pattern mapping (`docs/schema-review.md`)

## P1 (Strongly Recommended)

- [x] Architecture includes Atlas service mapping (`docs/architecture.md`)
- [x] README with setup, run steps, and expected outcomes
- [x] `docs/runbook.md` with reseed and troubleshooting
- [x] Non-MongoDB dependencies documented (LLM provider, Vite/React)
- [ ] Atlas Search / Vector Search indexes provisioned in Atlas UI

## P2 (Optional)

- [ ] Additional synthetic data scenarios for ad-hoc Q&A
- [ ] Backup demo path for partial outage scenarios
- [ ] Performance benchmarks (p50/p95 latency per retrieval pattern)

## Sign-Off

- Final reviewer:
- Date:
- Residual risks accepted:
