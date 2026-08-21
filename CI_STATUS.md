# CI status and known failures

Every quality step in this repo's CI previously ended in `|| true`, so type
errors, lint failures and failing tests all reported green. That is how 546 type
errors accumulated, including modules that could not compile at all.

Nothing in `test.yml` swallows an exit code any more. Where a gate cannot be
green today, it is **excluded explicitly and documented here** rather than
silenced.

## Blocking gates (must pass to merge)

| Gate | Covers | Status |
|---|---|---|
| `typecheck:api` | `tsc --noEmit` on the API | **0 errors** |
| `typecheck:frontend:ratchet` | Real frontend typecheck; fails on any increase | **64 errors, baseline held** |
| `test` | 321 tests: `features`, `integration`, `routeAuth`, `encryption`, `translationEgress` | **321 passing** |
| `auth-contract` | Every protected route rejects unauthenticated requests | **23 passing** |
| `encryption` | AES-256-GCM envelopes, tamper detection, keyed blind index, PHI absence | **20 passing** |
| `translationEgress` | Privileged text cannot be sent to DeepL/Google/OpenAI | **13 passing** |
| `build` | Frontend production build | **passing** |
| `lint-changed` | ESLint on files changed in the PR | **0 errors** |

## Advisory (reported, not blocking)

### DB-backed test suites

| Suite | Result | Cause |
|---|---|---|
| `auditLogger.test.ts` | 32 fail / 32 | Test passes `'test-user-123'` into `audit_log.user_id`, typed `UUID` |
| `pushNotifications.test.ts` | 25 fail / 29 | Same class of schema mismatch |
| `userSegmentation.test.ts` | 19 fail / 27 | Same class of schema mismatch |
| `piiRedaction.test.ts` | 6 fail / 40 | Assertion drift |
| `load.test.ts` | 5 fail / 43 | Performance thresholds; does not belong in a correctness gate |

These are **pre-existing** and unrelated to application logic. They were never
green — they failed with `role "transcend_admin" does not exist` before the test
database was provisioned, and now fail on the schema mismatch underneath.

There are also **two conflicting audit tables**: `audit_log` (from
`schema.sql`) and `audit_logs` (created at runtime by
`auditLogger.initializeAuditTables()`). That needs reconciling before these
suites can pass.

### Frontend type errors

The frontend typecheck **was checking nothing**:

1. `transcend-frontend/tsconfig.json` is solution-style — `"files": []` with only
   project references — so `tsc --noEmit -p transcend-frontend/tsconfig.json`
   compiled zero files and always reported success.
2. `tsconfig.app.json` set `"ignoreDeprecations": "6.0"`, invalid on TypeScript
   5.9, so even pointing at the right project made `tsc` bail with one config
   error and never reach the code.

With both fixed the real count was **122**. Driven to **64** so far. Fixed along
the way, all previously invisible:

- `antiCopyProtection.ts` contained JSX but had a `.ts` extension — renamed `.tsx`.
- `NotificationPreferences.tsx` called `this.getChannelIcon(...)` inside a
  **function component**, with the methods attached via
  `NotificationPreferences.prototype`. `this` is undefined there, so every one of
  those 8 calls threw at runtime. Converted to module functions.
- `services/notificationFatigue.ts` did not exist; created, with shapes derived
  from the component's actual usage.
- `components/ui/{alert,badge,button,card,table,tabs}.tsx` did not exist.
- `SecondaryButton`, `LoadingSpinner`, `StatCard` were imported from the UI
  barrel but never defined.

`scripts/typecheck-ratchet.mjs` holds the line at 64 and fails on any increase.
Lower `BASELINE` as errors are fixed; never raise it.

### Lint backlog

808 errors across the repo, dominated by the class that has caused real bugs:

| Rule | Count |
|---|---|
| `no-misused-promises` | 184 |
| `no-unnecessary-type-assertion` | 170 |
| `no-floating-promises` | 168 |
| `require-await` | 123 |

A full-repo lint gate is therefore not achievable today. `lint-changed` blocks
new violations while this is paid down. Do not convert it to advisory.

## Local setup

The test database must exist before running DB-backed suites:

```bash
psql postgres -c "CREATE ROLE transcend_admin LOGIN PASSWORD 'local' SUPERUSER"
psql postgres -c "CREATE DATABASE transcend_law_test OWNER transcend_admin"
psql transcend_law_test -f transcend-api/src/database/schema.sql
psql transcend_law_test -f transcend-api/database/schema-p2p-messaging.sql
for m in 008_translation_cache 009_encrypt_privileged_content 010_encrypt_case_documents; do
  psql transcend_law_test -f "transcend-api/src/database/migrations/$m.sql"
done
```

Then:

```bash
DB_HOST=localhost DB_USER=transcend_admin DB_PASSWORD=local DB_NAME=transcend_law_test npm test
```
