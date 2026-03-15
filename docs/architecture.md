# 2Birds1Stone Architecture

## Recommended architecture

- Client apps
  - Expo React Native mobile app
  - Next.js web app
- Shared layer
  - Shared TypeScript domain models and prioritization helpers
- Backend
  - Supabase or Postgres-backed API
  - Object storage for attachments
  - Realtime sync subscriptions
  - Scheduled jobs for notifications
- AI services
  - OpenAI for capture classification, tag suggestions, prioritization suggestions, and weekly review summaries

## Why this shape fits

- Expo gives one mobile codebase for iPhone and Android
- Next.js gives a fast web client for desktop use
- Shared TypeScript keeps business rules aligned across surfaces
- Supabase is a strong fit for auth, file storage, relational data, and realtime sync

## Core entities

- User
- Workspace
- Goal
- Project
- Topic
- Tag
- InboxItem
- Attachment
- Contact
- NotificationRule
- AIRecommendation

## Sync model

- Each item stores `updatedAt`, `version`, and `lastEditedBy`
- Clients optimistically update local state
- Server resolves conflicts with last-write-wins plus protected manual-order fields
- Manual ordering sets `orderingMode = "manual"` so AI suggestions do not overwrite it

## AI flow

1. User captures an item
2. API stores raw capture immediately
3. AI enrichment job classifies the item and returns suggestions
4. User-visible record updates with suggested project, topic, tags, and priority
5. User can accept, edit, or ignore suggestions

## Notification flow

- Recurring priority reminders are generated from item priority class
- Deadline reminders are generated from due date
- Mobile push notifications use Expo push or native APNs/FCM
- Web notifications can be optional, but email reminders are a useful future extension
