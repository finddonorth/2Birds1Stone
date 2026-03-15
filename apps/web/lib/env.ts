export const env = {
  supabaseUrl: process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseServiceRoleKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  storageBucket: process.env.SUPABASE_STORAGE_BUCKET ?? "attachments",
  smtpHost: process.env.SMTP_HOST,
  smtpPort: Number(process.env.SMTP_PORT ?? 465),
  smtpUser: process.env.SMTP_USER,
  smtpPass: process.env.SMTP_PASS,
  smtpFromEmail: process.env.SMTP_FROM_EMAIL,
  smtpFromName: process.env.SMTP_FROM_NAME ?? "2Birds1Stone",
  notificationCronSecret: process.env.NOTIFICATION_CRON_SECRET,
  openAIApiKey: process.env.OPENAI_API_KEY,
  openAIModel: process.env.OPENAI_MODEL ?? "gpt-5-mini",
  defaultWorkspaceId: process.env.NEXT_PUBLIC_DEFAULT_WORKSPACE_ID ?? "demo-workspace",
  publicApiBaseUrl: process.env.NEXT_PUBLIC_API_BASE_URL ?? ""
};

export function hasServerSyncEnv(): boolean {
  return Boolean(env.supabaseUrl && env.supabaseServiceRoleKey && env.supabaseAnonKey);
}

export function hasNotificationEmailEnv(): boolean {
  return Boolean(env.smtpHost && env.smtpPort && env.smtpUser && env.smtpPass && env.smtpFromEmail);
}
