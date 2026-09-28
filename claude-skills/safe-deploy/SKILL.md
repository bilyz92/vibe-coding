---
name: safe-deploy
description: Deploy to production safely for any project — detect the deploy mechanism, verify DB migrations are non-destructive, trigger the deploy, poll until the new version is actually live, then verify health. Use when the user asks to deploy, ship, release, or push to production.
---

# Safe Deploy

## Overview
Ship to production without breaking it. The risk in a deploy is rarely the code — it's the **migration that drops data** and the **assumption that "pushed" means "live and healthy"**. This skill forces you to verify both: schema changes are additive, and the new version is actually serving traffic after deploy.

Generic across projects: first discover *how this project deploys*, then apply the same safety gates regardless of mechanism (CI push, manual image ship, PaaS, k8s, serverless).

## When to Use
- User says: deploy, ship, release, go live, push to prod, cut a release.
- Any change that will run against production data or serve production traffic.
- Especially when the diff contains DB migrations, env/config changes, or infra changes.

## Process

### 1. Discover the deploy mechanism (never assume)
Find how *this* project deploys before doing anything:
- CI/CD config: `.gitlab-ci.yml`, `.github/workflows/`, `cloudbuild.yaml`, `Jenkinsfile`.
- PaaS/manifests: `vercel.json`, `fly.toml`, `Procfile`, `render.yaml`, k8s manifests, `Dockerfile` + compose.
- Project docs/skills: `DEPLOY.md`, `README`, a project deploy skill, or persisted memory.
- The default branch and whether push-to-branch triggers deploy, vs a manual step.

State the mechanism back to the user in one line before proceeding.

### 2. Verify migration safety (BLOCKING)
List migrations that will run on prod = those in the repo not yet applied to prod (`prisma migrate status`, `alembic history`, Rails `db:migrate:status`, or diff the migrations dir against prod's applied list). For each pending migration, **read the SQL** and classify:

| Safe (additive) | DANGEROUS — stop and confirm with user |
|---|---|
| `ADD COLUMN` nullable, or with `DEFAULT` | `DROP COLUMN` / `DROP TABLE` |
| `CREATE TABLE` / `CREATE INDEX` (concurrently if large) | `ADD COLUMN NOT NULL` without `DEFAULT` (fails / locks on populated table) |
| new enum / new nullable FK | type change / narrowing (`varchar(n)`, `text`→`int`) |
| backfill that's idempotent | `RENAME` (breaks running old code during rollout) |

If any dangerous op is found, do NOT deploy — surface it and confirm intent / propose an expand-contract (backwards-compatible) sequence.

### 3. Pre-flight
- Build/typecheck passes locally (`tsc --noEmit`, `build`, `lint`).
- Required new env/secrets exist in the prod environment (or feature is off-by-default).
- You're deploying the intended commit on the intended branch; confirm hard-to-reverse actions with the user.
- **Record the current prod version** (image id, git SHA, or release tag) so you can detect the swap and roll back.

### 4. Trigger the deploy
Use the discovered mechanism. Don't invent a path the project doesn't use (e.g. don't `docker save | ssh load` if CI builds the image). Note the start time.

### 5. Poll until actually live (don't trust "pushed")
Poll prod until the recorded version changes to the new one: image id / `/version` endpoint / running tag / pod rollout status. Build+deploy is usually minutes — poll at a sane cadence, don't busy-wait. If you can't watch the CI pipeline directly, poll the prod side for the change.

### 6. Verify health (BLOCKING — this is the "done" gate)
- New version confirmed running (id/SHA changed).
- Migrations applied on prod (check the migrations table / a new column exists).
- A real request succeeds: health endpoint or a key route returns 2xx/expected (`curl` login/health).
- Skim logs for startup errors / crash loop.

Only after all four → report deployed. If any fails, report the failure with evidence and the rollback path (redeploy the recorded previous version).

## Rationalizations vs. Reality
| Excuse | Truth |
|--------|-------|
| "The push succeeded, so it's deployed" | Push ≠ built ≠ running ≠ healthy. Verify the version actually swapped and serves traffic. |
| "The migration is probably fine" | Read it. One `DROP COLUMN` or `NOT NULL`-without-default ruins prod data or locks the table. |
| "I'll check the site later" | Verify now, while you still have context and the rollback is one command away. |
| "It worked last deploy, same flow" | Mechanisms drift (manual → CI). Re-discover; don't deploy via a dead path. |
| "No time to record the old version" | Without it you can't confirm the swap or roll back. It's one command. |

## Red Flags — STOP
- A pending migration with `DROP`, `RENAME`, type change, or `NOT NULL` without default.
- Deploying directly to the default/protected branch without the user explicitly asking.
- "Deployed" claimed with no version-changed check and no successful prod request.
- New required env/secret that isn't set in prod (feature will crash on boot).
- No known rollback path before triggering.

## Verification Checklist
- [ ] Deploy mechanism discovered and stated (not assumed)
- [ ] Every pending migration read and classified additive (or dangerous ones confirmed with user)
- [ ] Build/typecheck/lint green; required prod env present
- [ ] Previous prod version recorded for rollback
- [ ] New version confirmed live (id/SHA/tag changed)
- [ ] Migrations confirmed applied on prod
- [ ] A real prod request returns expected status; logs show no boot errors
