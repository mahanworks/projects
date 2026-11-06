# ReachInbox – Fresher Starter (Full-stack Email Scheduler)

A runnable learning/MVP implementation of the assignment. It uses:
- React + TypeScript + Vite + plain CSS (dashboard inspired by the supplied screenshots)
- Express + TypeScript
- PostgreSQL + Prisma
- BullMQ + Redis delayed jobs (no cron)
- Ethereal SMTP through Nodemailer
- Elasticsearch indexing (optional service; app degrades gracefully when disabled)
- Google OAuth and Slack OAuth routes (real OAuth when credentials are configured)
- Bull Board queue dashboard

## Important scope / honesty

This is a **starter MVP, not a production-grade bulk-email platform**. It demonstrates the required architecture and core flows. Before claiming full completion, configure OAuth credentials, test with your own accounts, and review security, deliverability, tenant isolation, migrations, retry policy, and provider-specific sender verification. Ethereal captures test messages; it does not deliver real email to recipients. The app has one demo user/session model and is not a hardened multi-tenant SaaS.

## Requirements

- Node.js 20+
- Docker Desktop
- Google OAuth client (optional until you want Google login)
- Slack app OAuth credentials (optional until you want Slack notifications)

## Run

1. Copy `.env.example` to `.env` in the project root and fill values.
2. Start infrastructure:

   ```bash
   docker compose up -d
   ```

3. Backend:

   ```bash
   cd backend
   npm install
   npx prisma generate
   npx prisma migrate dev --name init
   npm run dev
   ```

4. In a second terminal, frontend:

   ```bash
   cd frontend
   npm install
   npm run dev
   ```

5. Open http://localhost:5173

Backend API: http://localhost:4000  
Bull Board: http://localhost:4000/admin/queues  
Health: http://localhost:4000/health

## Environment

See root `.env.example`. The backend loads the root `.env` when run from `backend` too.

- `DATABASE_URL`: PostgreSQL connection.
- `REDIS_HOST`, `REDIS_PORT`: BullMQ Redis.
- `ELASTICSEARCH_URL`: Elasticsearch URL. Leave blank to disable indexing.
- `ETHEREAL_USER`, `ETHEREAL_PASS`: create a test account at https://ethereal.email/create and paste credentials. If blank, backend creates a temporary Ethereal account at startup and logs preview URLs.
- `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`: Google OAuth web client. Authorized redirect URI: `http://localhost:4000/auth/google/callback`.
- `SLACK_CLIENT_ID`, `SLACK_CLIENT_SECRET`: Slack app OAuth. Redirect URI: `http://localhost:4000/auth/slack/callback`. Add `chat:write` scope and install the app to your workspace.
- `FRONTEND_URL`: normally `http://localhost:5173`.
- `SESSION_SECRET`: use a long random secret.
- `WORKER_CONCURRENCY`: worker concurrency.
- `MIN_DELAY_MS`: minimum delay between sends for a sender.
- `MAX_EMAILS_PER_HOUR_PER_SENDER`: hourly sender cap.

## Scheduling and reliability

- `POST /api/emails/schedule` validates and stores each recipient in PostgreSQL, then enqueues one BullMQ delayed job per recipient.
- Each job has a deterministic `jobId` based on the database email row. BullMQ/Redis persistence uses the Docker volume; PostgreSQL remains the source of truth for email status.
- BullMQ delayed jobs survive application restarts when Redis persistence is enabled. `docker-compose.yml` enables AOF and a persistent volume. Do not run `docker compose down -v` if you want to retain demo data.
- Worker concurrency is configurable. A Redis Lua script atomically reserves a sender slot, enforces a minimum sender-to-sender gap, and increments a sender/hour counter across worker instances.
- When the hourly limit is reached, the active job is moved to the next hour boundary using BullMQ `moveToDelayed`; it is not dropped. Jobs are created in recipient order. Multiple jobs due together are processed in queue order as far as BullMQ scheduling allows.
- The worker sends via Ethereal SMTP, updates PostgreSQL, and indexes the email document in Elasticsearch if configured.
- This is at-least-once infrastructure with application-level idempotency. The worker checks DB status before sending and marks a row `sending`; for strict exactly-once external SMTP delivery, a distributed transaction with SMTP is impossible. A crash after SMTP accepts a message but before DB commit can still create an ambiguous delivery. This limitation is documented rather than hidden.

## Slack notifications

Dashboard's **Connect Slack** link starts Slack OAuth. On callback, the backend stores the bot token in the local `User` row. When a sender reaches its hourly cap, the worker sends a real Slack `chat.postMessage` API request if the user has connected Slack. If not connected, it skips notification without failing the email job. Disconnect removes the stored token.

## Google login

Click **Login with Google**. Configure Google OAuth credentials and the exact callback URL above. For local evaluation without credentials, use the demo login button. Demo login is intentionally labelled and is not real OAuth.

## Search

`GET /api/emails?status=scheduled|sent|failed&q=term` searches Elasticsearch when enabled and falls back to PostgreSQL filtering when Elasticsearch is disabled/unavailable.

## Useful API

- `GET /health`
- `GET /auth/google`
- `GET /auth/slack`
- `POST /auth/demo`
- `POST /auth/logout`
- `GET /api/me`
- `POST /api/emails/schedule`
- `GET /api/emails?status=scheduled`
- `GET /api/emails?status=sent`
- `GET /api/emails?status=failed`
- `GET /api/senders`
- `POST /api/senders`
- `GET /admin/queues`

Example schedule payload:

```json
{
  "subject": "Hello",
  "body": "A quick introduction.",
  "startAt": "2026-11-07T10:00:00.000Z",
  "delayBetweenMs": 2000,
  "hourlyLimit": 20,
  "senderEmail": "demo@ethereal.email",
  "recipients": ["person@example.com", "another@example.com"]
}
```

## 1000+ scheduled emails

The API persists records and adds delayed jobs rather than keeping timers in Node memory. Redis stores the queue; workers process with bounded concurrency and shared Redis sender counters. If the hourly cap is reached, jobs are delayed to the next hour. For a real 1000+ recipient production deployment, add batch APIs, pagination, tenant-aware quotas, backpressure, dead-letter handling, metrics, tracing, encryption at rest, and load tests.

## Folder layout

```text
backend/
  prisma/             schema + migration config
  src/
    config/            env and Redis
    routes/            auth, email, sender APIs
    services/          queue, search, mail, Slack
    worker.ts          BullMQ worker
    server.ts          Express + Bull Board
frontend/
  src/                 React app, API client, components, styles
docker-compose.yml
.env.example
```
