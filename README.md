# 2Birds1Stone

2Birds1Stone is a synced phone + web app for quickly capturing ideas and tasks, then organizing them into a system that respects goals, projects, topics, deadlines, and energy.

## Product direction

- Capture ideas and tasks in seconds with voice or text
- Sync across phone and web
- Sort work by both relative priority and hard deadlines
- Use AI to recommend categorization, tags, project/topic placement, and priority
- Support follow-ups, attachments, and notification rules

## Proposed stack

- `apps/mobile`: Expo React Native app for iPhone/Android
- `apps/web`: Next.js web app for desktop capture and review
- `packages/shared`: shared TypeScript models, prioritization rules, and API contracts
- `packages/api`: backend contract and sync service skeleton
- `docs/`: product brief, architecture, and backend schema planning

## Status

This repository currently contains the initial architecture, domain model, and starter app scaffolding. Dependency installation has not been run yet in this workspace.

## Environment

Copy [`.env.example`](/Users/donorth/Documents/App Development/Team Leadership/2Birds1App/.env.example) to `.env.local` for web and `.env` for shared local development.

Required for real sync:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `EXPO_PUBLIC_SUPABASE_URL`
- `EXPO_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_STORAGE_BUCKET` defaults to `attachments`

Optional for OpenAI classification:

- `OPENAI_API_KEY`
- `OPENAI_MODEL` defaults to `gpt-5-mini`

Required for delivered reminder emails:

- `SMTP_HOST`
- `SMTP_PORT`
- `SMTP_USER`
- `SMTP_PASS`
- `SMTP_FROM_EMAIL`
- `SMTP_FROM_NAME` defaults to `2Birds1Stone`

Optional for automated cron-style reminder sending:

- `NOTIFICATION_CRON_SECRET`

## Database bootstrap

1. Create a Supabase project
2. Run [supabase-mvp.sql](/Users/donorth/Documents/App Development/Team Leadership/2Birds1App/docs/supabase-mvp.sql) in the SQL editor
3. Enable email auth in Supabase
4. Confirm the `attachments` storage bucket exists and is public, or set `SUPABASE_STORAGE_BUCKET` to the bucket you want to use
5. Add your site URL and `/auth/callback` redirect URL in Supabase Auth settings
6. Set the environment variables above

## Reminder delivery

- The app can now send reminder emails from `/api/notifications/send`
- From the web dashboard, use `Send now` in the `Upcoming Reminders` card to test delivery for your workspace
- Automated delivery is configured for Vercel cron once daily at 8:00 AM via [apps/web/vercel.json](/Users/donorth/Documents/App Development/Team Leadership/2Birds1App/apps/web/vercel.json)
- Scheduled requests should authenticate with `Authorization: Bearer <NOTIFICATION_CRON_SECRET>` and the route also accepts `x-cron-secret` for local/manual testing
- If your Vercel project root is the repo root, the matching config is also in [vercel.json](/Users/donorth/Documents/App Development/Team Leadership/2Birds1App/vercel.json)
- Re-run [supabase-mvp.sql](/Users/donorth/Documents/App Development/Team Leadership/2Birds1App/docs/supabase-mvp.sql) so the `notification_deliveries` table exists before testing
- After deployment, add `NOTIFICATION_CRON_SECRET` to your Vercel project env vars so the scheduled job can authenticate

## Run

- Web: `pnpm dev:web`
- Mobile: `pnpm dev:mobile`
- Health check: `GET /api/health`

If Supabase env vars are not set, the apps automatically fall back to the local mock sync service.

## Auth behavior

- Web uses Supabase email OTP sign-in at `/login`
- Mobile uses Supabase email OTP sign-in in Expo and stores the session locally
- The first successful sign-in automatically creates and seeds a personal workspace
- API routes resolve the signed-in user’s workspace from either browser cookies or a bearer token before reading or writing data
