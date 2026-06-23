# Jappy

Jappy is a Japanese vocabulary study app built with React, TypeScript, Vite, and Vercel serverless APIs. It supports student study sessions, admin-managed lesson/card data, spaced repetition review scheduling, and Neon Postgres persistence.

## Features

- Student authentication with a dedicated student login and registration flow.
- Separate admin login at `/admin-jappy` with protected admin routes.
- Role-based route protection for student and admin dashboards.
- JLPT lesson organization from N5 through N1.
- Flashcard study sessions with SM-2-style spaced repetition.
- Review summaries, XP feedback, and session history.
- Vercel API routes backed by Neon Postgres.
- Light/dark theme support.

## Tech Stack

- React 19
- TypeScript
- Vite
- React Router
- Tailwind CSS
- Neon Postgres
- Vercel serverless/edge functions
- bcryptjs

## Project Structure

```text
api/                 Vercel API handlers
src/api/             Frontend API client
src/algorithms/      Spaced repetition logic
src/components/      Shared UI components
src/contexts/        Auth and theme providers
src/db/              Database client and schema migrations
src/hooks/           Data and session hooks
src/pages/           Route pages
src/types/           Shared TypeScript types
src/utils/           Utility helpers
```

## Environment Variables

Create local environment files from `.env.example` and configure the same variables in Vercel production.

```env
DATABASE_URL=postgresql://user:password@host/dbname?sslmode=require
ADMIN_SECRET=your-admin-secret-here
```

- `DATABASE_URL` is required for API routes and Neon Postgres migrations.
- `ADMIN_SECRET` is required for protected admin registration flows when enabled by the API.

## Local Development

Install dependencies:

```bash
npm install
```

Start the development server:

```bash
npm run dev
```

Run lint checks:

```bash
npm run lint
```

Build for production:

```bash
npm run build
```

Preview the production build locally:

```bash
npm run preview
```

## Routes

- `/` redirects authenticated users by role and unauthenticated users to login.
- `/login` handles student login and registration.
- `/admin-jappy` handles admin login.
- `/student` shows the student dashboard.
- `/admin` shows the admin dashboard.
- `/lessons/:id` shows lesson details.
- `/study` runs a study session.
- `/summary` shows session results.

## API

The Vercel API routes live in `api/` and are served under `/api/*`.

- `/api/auth/*` handles login, registration, sessions, and logout.
- `/api/lessons` handles lesson data.
- `/api/cards` handles card data.
- `/api/review` handles review records and session progress.

## Deployment

The app is configured for Vercel. Production deployment expects the Vercel project to have the required environment variables set.

```bash
npm run lint
npm run build
vercel --prod
```

`vercel.json` rewrites non-API routes to `index.html` so React Router can handle client-side navigation.
