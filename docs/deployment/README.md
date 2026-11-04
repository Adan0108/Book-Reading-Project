# Local deployment and production handoff

Prerequisites: Docker Engine/Desktop with Compose v2, available localhost ports 8080 and 8025, and Git. Native development additionally needs Node.js 24+ and npm. On Windows use `npm.cmd` if PowerShell blocks npm.ps1. Node 24 is an LTS line; see the [Node release schedule](https://nodejs.org/en/about/previous-releases).

## Complete local application

From the repository root:

```powershell
Copy-Item .env.compose.example .env.compose
# Edit .env.compose: use two different random database passwords.
docker compose --env-file .env.compose config --quiet
docker compose --env-file .env.compose up --build -d
docker compose --env-file .env.compose ps
```

On Unix use `cp` for the first command. Open `http://localhost:8080`, `/api-docs/` and `/health/ready`. Mailpit at `http://localhost:8025` captures development verification/reset mail. It sends nothing to external users. MySQL and Redis have no host port mapping. Database and Redis volumes survive `docker compose --env-file .env.compose down`; do not add a volume deletion flag when preserving data.

The application uses built frontend assets served by an unprivileged Nginx process. Nginx proxies API and Socket.IO upgrades to one backend instance. Backend/migration containers also run as a non-root user with read-only filesystems. Configuration is runtime environment, excluded from Docker build contexts. No `.env` is copied into an image. MySQL 8.4 and Redis 8 run on the internal Compose network. Dependency health and a successful one-shot migration gate backend/frontend startup, using [Compose's documented dependency conditions](https://docs.docker.com/compose/how-tos/startup-order).

The local stack defaults to HTTP development mode and Mailpit. Cloudinary/Stripe are optional configuration: missing credentials show unavailable upload/checkout behavior. Text-only publishing needs neither provider. Never enable a production payment fixture; fixture routes are absent from built application source.

## First administrator and author

Register normally and complete the emailed verification/profile flow. Then the local database operator may grant the registered account ADMIN:

```powershell
docker compose --env-file .env.compose exec backend node dist/operations/grantAdmin.js admin@example.invalid
```

Use the actual verified account email, then sign in again. The CLI refuses inactive/incomplete accounts and appends an operator audit record. There is no shared initial password. A reader submits a writing sample through Become an author; an administrator reviews/approves it. Approval creates the author profile and role together.

## Native development

Configure a private `backend/.env` from `.env.example` with intended MySQL/Redis, frontend origin and SMTP settings. Keep cloud/billing fields empty until configured. From `backend/`, run `npm ci`, `npm run build`, review/backup the target, run `npm run migrate`, then `npm start`. From `frontend/`, run `npm ci` and `npm run dev` (port 8000). Set backend `FRONTEND_URL=http://localhost:8000`. A fresh native schema must exist before migration; Compose creates it automatically. The old infrastructure-only compose remains for compatibility and must not be started on conflicting ports.

## Production handoff

1. Configure real HTTPS ingress/domain, production frontend origin, `NODE_ENV=production`, exact trusted proxy CIDRs and validated TLS SMTP. The local HTTP configuration is not a production security profile.
2. Store server secrets outside source/images; configure backups, encrypted storage and a separate migration operator. Review and test pending migrations on an isolated restored copy before deployment.
3. Run the migration service explicitly after backup/review. The server uses `MIGRATIONS_AUTO_APPLY=false` and refuses pending/mismatched files. See [DDL failure and recovery policy](../database/README.md).
4. Configure a signed Cloudinary preset and perform the [external Stripe sandbox procedure](../mvp/PAYMENT_SETUP.md). Current billing intentionally refuses live keys; payouts, fees/tax and disputes are not implemented.
5. Verify health, real mail, origin/cookies, reader/member gates, socket upgrades, failure recovery and logs. Readiness covers local dependencies, not all external integrations. Keep the single-backend chat topology until an adapter is deliberately implemented/tested.

No normal database migration, public hosting deployment or live-money activation has been performed. The fresh isolated Compose verification and its exact results are recorded in [testing](../testing/README.md); deployment claims must follow that evidence.
