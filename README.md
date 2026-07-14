# SafeStreet — AI-Powered Community Incident Reporting Platform

Full-stack platform for citizens to report municipal issues (potholes, streetlight
outages, illegal dumping, etc.), with Google Gemini handling classification/routing,
duplicate detection, empathetic response drafting, and hotspot prediction.

**Stack:** React (Vite + TS) · NestJS · PostgreSQL (Prisma) · Redis · Google Gemini (`gemini-flash-latest`) · Socket.io

## Architecture

```
safestreet/
├── docker-compose.yml        # Postgres (PostGIS-ready image) + Redis + backend + frontend
├── backend/                  # NestJS API
│   ├── prisma/schema.prisma  # User/Department/Incident/IncidentTimeline/AuditLog
│   ├── prisma/seed.ts        # Seeds departments + a default ADMIN account
│   └── src/
│       ├── auth/             # JWT login/register/refresh, guards, @Roles()/@Public()
│       ├── ai-proxy/         # Gemini integration: classify, duplicate-detect, draft, hotspots
│       ├── incidents/        # CRUD + SLA cron + state machine
│       ├── notifications/    # Socket.io gateway (per-user, per-role, per-department rooms)
│       ├── users/ departments/
│       └── prisma/           # PrismaService/Module
└── frontend/                 # React app
    └── src/
        ├── store/useIncidentStore.ts  # Zustand: auth + incidents + realtime
        ├── lib/               # axios client (with refresh-token retry), socket client
        ├── components/        # LeafletMap, AIFeedback, DuplicateModal, ProtectedRoute
        └── pages/              # Login, CitizenDash, WorkerDash, SupervisorDash, AdminDash
```

## Getting started

### 1. Environment variables

Copy the example env files and fill in your secrets (**never commit real secrets**):

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

At minimum, set a real `GEMINI_API_KEY` in `backend/.env` (get one at
https://aistudio.google.com/app/apikey) and strong random values for
`JWT_ACCESS_SECRET` / `JWT_REFRESH_SECRET`.

### 2. Run with Docker Compose

```bash
docker compose up --build
```

This starts Postgres, Redis, the API (http://localhost:3000, Swagger docs at
`/api/docs`), and the frontend (http://localhost:5173).

### 3. Database migration + seed (first run)

```bash
docker compose exec backend npx prisma migrate dev --name init
docker compose exec backend npm run prisma:seed
```

The seed creates the department taxonomy the AI classifier routes into, plus a
default admin: `admin@safestreet.local` / `ChangeMe123!` — **change this password
immediately** in a real deployment.

### 4. Local development (without Docker)

```bash
# Backend
cd backend
npm install
npm run prisma:generate
npm run prisma:migrate
npm run prisma:seed
npm run start:dev

# Frontend (separate terminal)
cd frontend
npm install
npm run dev
```

## Key design notes

- **AI calls are never hardcoded to a model version.** `GEMINI_MODEL` is read from
  env (default `gemini-flash-latest`) so it can be swapped without a code change.
- **Duplicate detection** does a cheap Postgres bounding-box pre-filter, an exact
  Haversine distance check (50m radius), then asks Gemini to semantically compare
  the surviving candidates' free text — catching cases where two people describe
  the same pothole in completely different words.
- **SLA monitoring** runs hourly via `@Cron(CronExpression.EVERY_HOUR)`, computing
  deadlines from priority-specific env-configured minutes, and pushes AMBER (at
  risk) / RED (breached) alerts over WebSockets to the relevant department's
  supervisors and to all admins.
- **Realtime rooms**: `user:<id>`, `role:<ROLE>`, `dept:<departmentId>:<ROLE>` —
  e.g. workers in the Roads department only receive new-assignment pings scoped
  to their own department.
- **No secrets in source.** All keys/URLs are read via `ConfigService` /
  `import.meta.env`, sourced from `.env` files that are gitignored.

## Security checklist before production

- Rotate the seeded admin password immediately.
- Put real TLS in front of both the API and frontend.
- Set `CORS_ORIGIN` to your real frontend origin (not `*`).
- Consider adding rate limiting (`@nestjs/throttler`) on `/auth/*` endpoints.
- Swap the mock Base64 image storage for real object storage (S3/GCS) once
  volume grows — Base64 in Postgres text columns won't scale indefinitely.
