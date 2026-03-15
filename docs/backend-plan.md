# Backend Plan

## Recommended production backend

- Supabase Auth for user accounts and shared workspaces
- Postgres for goals, projects, topics, tags, contacts, and inbox items
- Supabase Storage for attachments
- Supabase Realtime for multi-device sync
- Edge Functions or a small API service for OpenAI-powered classification and notification fan-out

## Sync responsibilities

- Persist every capture immediately before AI processing
- Return a workspace snapshot for app startup
- Accept manual reordering and preserve it from future AI reshuffles
- Publish changes to connected web/mobile clients
- Generate reminders from relative priority and due-date rules

## OpenAI responsibilities

- Suggest whether the capture is a task or idea
- Map it to existing projects and topics
- Suggest priority and tags
- Explain the recommendation in plain language so users trust it

## Suggested next implementation slice

1. Add Supabase client packages and environment setup
2. Replace mock API with a real repository layer
3. Add auth and a single-user workspace bootstrap
4. Save captures to the database and subscribe to realtime updates
