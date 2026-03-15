import nodemailer from "nodemailer";
import { getUpcomingReminders } from "@two-birds/shared";
import { createSupabaseServerClient } from "@two-birds/api";
import { env, hasNotificationEmailEnv, hasServerSyncEnv } from "./env";
import { getServerSyncApi } from "./server-sync";

type DeliveryRow = {
  reminder_id: string;
  recipient_email: string;
};

function getServiceClient() {
  if (!hasServerSyncEnv() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    throw new Error("Reminder delivery requires Supabase server configuration.");
  }

  return createSupabaseServerClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey
  });
}

function getTransporter() {
  if (!hasNotificationEmailEnv() || !env.smtpHost || !env.smtpUser || !env.smtpPass || !env.smtpFromEmail) {
    throw new Error("SMTP settings are missing for reminder delivery.");
  }

  return nodemailer.createTransport({
    host: env.smtpHost,
    port: env.smtpPort,
    secure: env.smtpPort === 465,
    auth: {
      user: env.smtpUser,
      pass: env.smtpPass
    }
  });
}

async function getWorkspaceRecipientEmails(workspaceId: string) {
  const client = getServiceClient();
  const { data, error } = await client
    .from("workspace_memberships")
    .select("user_id")
    .eq("workspace_id", workspaceId);

  if (error) {
    throw error;
  }

  const emails = new Set<string>();

  for (const membership of data ?? []) {
    const { data: userResult, error: userError } = await client.auth.admin.getUserById(membership.user_id);
    if (userError) {
      throw userError;
    }

    if (userResult.user?.email) {
      emails.add(userResult.user.email);
    }
  }

  return [...emails];
}

async function getExistingDeliveries(workspaceId: string, reminderIds: string[]) {
  if (!reminderIds.length) {
    return new Set<string>();
  }

  const client = getServiceClient();
  const { data, error } = await client
    .from("notification_deliveries")
    .select("reminder_id,recipient_email")
    .eq("workspace_id", workspaceId)
    .in("reminder_id", reminderIds);

  if (error) {
    throw error;
  }

  return new Set(
    (data as DeliveryRow[] | null | undefined)?.map((row) => `${row.reminder_id}:${row.recipient_email}`) ?? []
  );
}

async function recordDelivery(workspaceId: string, reminder: { id: string; itemId: string; scheduledFor: string; reason: string }, recipientEmail: string) {
  const client = getServiceClient();
  const { error } = await client.from("notification_deliveries").insert({
    reminder_id: reminder.id,
    workspace_id: workspaceId,
    item_id: reminder.itemId,
    recipient_email: recipientEmail,
    scheduled_for: reminder.scheduledFor,
    reason: reminder.reason
  });

  if (error) {
    throw error;
  }
}

function formatReminderEmail(reminder: { itemTitle: string; scheduledFor: string; reason: string }) {
  const scheduled = new Date(reminder.scheduledFor).toLocaleString();

  return {
    subject: `2Birds1Stone reminder: ${reminder.itemTitle}`,
    text: `${reminder.itemTitle}\n\n${reminder.reason}\nScheduled for: ${scheduled}`,
    html: `<h2>${reminder.itemTitle}</h2><p>${reminder.reason}</p><p><strong>Scheduled for:</strong> ${scheduled}</p>`
  };
}

export async function sendReminderEmails(options?: { workspaceId?: string; windowMinutes?: number }) {
  if (!hasNotificationEmailEnv()) {
    throw new Error("SMTP settings are missing. Add SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and SMTP_FROM_EMAIL.");
  }

  const client = getServiceClient();
  const transporter = getTransporter();
  const api = getServerSyncApi();
  const now = new Date();
  const windowMinutes = options?.windowMinutes ?? 15;
  const lowerBound = new Date(now.getTime() - windowMinutes * 60_000);
  const upperBound = new Date(now.getTime() + windowMinutes * 60_000);

  const workspaceIds = options?.workspaceId
    ? [options.workspaceId]
    : await (async () => {
        const { data, error } = await client.from("workspaces").select("id").order("created_at", { ascending: true });
        if (error) {
          throw error;
        }

        return (data ?? []).map((workspace) => workspace.id);
      })();

  let sentCount = 0;
  let reminderCount = 0;

  for (const workspaceId of workspaceIds) {
    const snapshot = await api.getWorkspaceSnapshot(workspaceId);
    const candidateReminders = getUpcomingReminders(snapshot.items, lowerBound, 200).filter((reminder) => {
      const scheduled = new Date(reminder.scheduledFor).getTime();
      return scheduled <= upperBound.getTime();
    });
    const recipients = await getWorkspaceRecipientEmails(workspaceId);
    const existing = await getExistingDeliveries(
      workspaceId,
      candidateReminders.map((reminder) => reminder.id)
    );

    for (const reminder of candidateReminders) {
      reminderCount += 1;
      for (const recipientEmail of recipients) {
        const deliveryKey = `${reminder.id}:${recipientEmail}`;
        if (existing.has(deliveryKey)) {
          continue;
        }

        const email = formatReminderEmail(reminder);
        await transporter.sendMail({
          from: `"${env.smtpFromName}" <${env.smtpFromEmail}>`,
          to: recipientEmail,
          subject: email.subject,
          text: email.text,
          html: email.html
        });

        await recordDelivery(workspaceId, reminder, recipientEmail);
        sentCount += 1;
      }
    }
  }

  return {
    sentCount,
    reminderCount,
    windowMinutes
  };
}
