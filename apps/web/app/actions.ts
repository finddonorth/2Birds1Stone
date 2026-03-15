"use server";

import { Buffer } from "node:buffer";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@two-birds/api";
import { env, hasServerSyncEnv } from "../lib/env";
import { getServerSyncApi } from "../lib/server-sync";
import { createSupabaseServerAuthClient } from "../lib/supabase/server";
import { ensureWorkspaceForUser } from "../lib/workspaces";
import {
  addRankedEntry,
  addTag,
  deleteRankedEntry,
  deleteTag,
  moveRankedEntry,
  updateWorkspaceSettings
} from "../lib/setup-admin";
import { sendReminderEmails } from "../lib/notifications";

async function resolveActionWorkspaceId() {
  if (!hasServerSyncEnv()) {
    return env.defaultWorkspaceId;
  }

  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?error=Please sign in first.");
  }

  return ensureWorkspaceForUser(user.id);
}

function sanitizeFileName(value: string) {
  const trimmed = value.trim();
  return trimmed.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "") || "file";
}

async function fallbackFilesToAttachments(formData: FormData) {
  const files = formData.getAll("attachmentFiles");
  const customNames = formData
    .getAll("attachmentCustomNames")
    .map((value) => String(value ?? "").trim());

  const attachments = await Promise.all(
    files.map(async (entry, index) => {
      if (!(entry instanceof File) || entry.size === 0) {
        return null;
      }

      const arrayBuffer = await entry.arrayBuffer();
      const mimeType = entry.type || "application/octet-stream";
      const fileName = customNames[index] || entry.name;
      const encoded = Buffer.from(arrayBuffer).toString("base64");

      return {
        fileName,
        mimeType,
        url: `data:${mimeType};base64,${encoded}`
      };
    })
  );

  return attachments.filter((attachment): attachment is NonNullable<(typeof attachments)[number]> => Boolean(attachment));
}

async function filesToAttachments(workspaceId: string, formData: FormData) {
  if (!hasServerSyncEnv() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return fallbackFilesToAttachments(formData);
  }

  const client = createSupabaseServerClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey
  });
  const bucket = env.storageBucket;
  const files = formData.getAll("attachmentFiles");
  const customNames = formData
    .getAll("attachmentCustomNames")
    .map((value) => String(value ?? "").trim());

  const uploaded = await Promise.all(
    files.map(async (entry, index) => {
      if (!(entry instanceof File) || entry.size === 0) {
        return null;
      }

      const arrayBuffer = await entry.arrayBuffer();
      const mimeType = entry.type || "application/octet-stream";
      const originalName = sanitizeFileName(entry.name);
      const path = `${workspaceId}/${Date.now().toString(36)}-${index}-${originalName}`;

      const { error } = await client.storage.from(bucket).upload(path, arrayBuffer, {
        contentType: mimeType,
        upsert: false
      });

      if (error) {
        throw error;
      }

      const { data } = client.storage.from(bucket).getPublicUrl(path);
      return {
        fileName: customNames[index] || entry.name,
        mimeType,
        url: data.publicUrl
      };
    })
  );

  return uploaded.filter((attachment): attachment is NonNullable<(typeof uploaded)[number]> => Boolean(attachment));
}

function linksToAttachments(formData: FormData) {
  const urls = formData
    .getAll("attachmentLinkUrls")
    .map((value) => String(value ?? "").trim())
    .filter(Boolean);
  const customNames = formData
    .getAll("attachmentLinkNames")
    .map((value) => String(value ?? "").trim());

  return urls.map((url, index) => ({
    fileName: customNames[index] || `Linked file ${index + 1}`,
    mimeType: "text/uri-list",
    url
  }));
}

export async function captureItemAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();

    const title = String(formData.get("title") ?? "").trim();
    if (!title) {
      redirect("/?message=Title is required.");
    }

    const notes = String(formData.get("notes") ?? "").trim();
    const tags = String(formData.get("tags") ?? "")
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean);
    const dueAt = String(formData.get("dueAt") ?? "").trim();
    const followUpName = String(formData.get("followUpName") ?? "").trim();
    const followUpEmail = String(formData.get("followUpEmail") ?? "").trim();
    const followUpPhone = String(formData.get("followUpPhone") ?? "").trim();
    const uploadedAttachments = await filesToAttachments(workspaceId, formData);
    const linkedAttachments = linksToAttachments(formData);
    const attachments = [...uploadedAttachments, ...linkedAttachments];
    const isMultiDay = formData.get("isMultiDay") === "on";
    const kind = formData.get("kind") === "idea" ? "idea" : "task";

    const api = getServerSyncApi();
    const created = await api.createInboxItem(workspaceId, {
      kind,
      title,
      notes,
      dueAt: dueAt || undefined,
      isMultiDay,
      tags,
      followUpContact: followUpName
        ? {
            fullName: followUpName,
            email: followUpEmail || undefined,
            phone: followUpPhone || undefined
          }
        : undefined,
      attachments
    });

    revalidatePath("/");
    redirect(`/?message=${encodeURIComponent(created.aiSuggestedSummary?.reasoning ?? "Item captured.")}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save this item.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function updateSetupSettingsAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    await updateWorkspaceSettings(workspaceId, {
      priorityGuidance: String(formData.get("priorityGuidance") ?? ""),
      p1Label: String(formData.get("p1Label") ?? ""),
      p2Label: String(formData.get("p2Label") ?? ""),
      p3Label: String(formData.get("p3Label") ?? ""),
      p4Label: String(formData.get("p4Label") ?? ""),
      gentleLockEnabled: formData.get("gentleLockEnabled") === "on"
    });
    revalidatePath("/");
    redirect("/?message=Setup saved.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to save setup.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function addSetupEntryAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    const type = String(formData.get("type") ?? "") as "goals" | "projects" | "topics" | "tags";
    const title = String(formData.get("title") ?? "");

    if (type === "tags") {
      await addTag(workspaceId, title);
    } else {
      await addRankedEntry(workspaceId, type, title);
    }

    revalidatePath("/");
    redirect(`/?message=${encodeURIComponent(`Added ${type.slice(0, -1)}.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to add setup item.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function deleteSetupEntryAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    const type = String(formData.get("type") ?? "") as "goals" | "projects" | "topics" | "tags";

    if (type === "tags") {
      await deleteTag(workspaceId, String(formData.get("label") ?? ""));
    } else {
      await deleteRankedEntry(workspaceId, type, String(formData.get("id") ?? ""));
    }

    revalidatePath("/");
    redirect(`/?message=${encodeURIComponent(`Removed ${type === "tags" ? "tag" : type.slice(0, -1)}.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to remove setup item.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function moveSetupEntryAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    const type = String(formData.get("type") ?? "") as "goals" | "projects" | "topics";
    const id = String(formData.get("id") ?? "");
    const direction = String(formData.get("direction") ?? "") as "up" | "down";

    await moveRankedEntry(workspaceId, type, id, direction);

    revalidatePath("/");
    redirect(`/?message=${encodeURIComponent(`Moved ${type.slice(0, -1)} ${direction}.`)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to reorder setup item.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function sendReminderEmailsAction() {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    const result = await sendReminderEmails({
      workspaceId,
      windowMinutes: 60
    });

    redirect(
      `/?message=${encodeURIComponent(
        result.sentCount
          ? `Sent ${result.sentCount} reminder email${result.sentCount === 1 ? "" : "s"}.`
          : "No reminder emails were due right now."
      )}`
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to send reminder emails.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}

export async function updateItemAction(formData: FormData) {
  try {
    const workspaceId = await resolveActionWorkspaceId();
    const itemId = String(formData.get("itemId") ?? "");
    if (!itemId) {
      redirect("/?message=Item id is required.");
    }

    const title = String(formData.get("title") ?? "").trim();
    const status = String(formData.get("status") ?? "").trim() as "open" | "done" | "archived" | "";
    const notes = String(formData.get("notes") ?? "").trim();
    const relativePriority = String(formData.get("relativePriority") ?? "").trim() as "p1" | "p2" | "p3" | "p4" | "";
    const dueAt = String(formData.get("dueAt") ?? "").trim();
    const followUpName = String(formData.get("followUpName") ?? "").trim();
    const followUpEmail = String(formData.get("followUpEmail") ?? "").trim();
    const followUpPhone = String(formData.get("followUpPhone") ?? "").trim();

    const api = getServerSyncApi();
    await api.updateInboxItem(workspaceId, itemId, {
      title: title || undefined,
      notes,
      status: status || undefined,
      relativePriority: relativePriority || undefined,
      dueAt: dueAt || undefined,
      followUpContact:
        formData.has("followUpName") || formData.has("followUpEmail") || formData.has("followUpPhone")
          ? {
              fullName: followUpName,
              email: followUpEmail || undefined,
              phone: followUpPhone || undefined
            }
          : undefined
    });

    revalidatePath("/");
    redirect("/?message=Item updated.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unable to update item.";
    redirect(`/?message=${encodeURIComponent(message)}`);
  }
}
