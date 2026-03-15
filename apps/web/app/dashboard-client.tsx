"use client";

import { useEffect, useState, type ChangeEvent } from "react";
import { createHttpSyncApi } from "@two-birds/api";
import {
  getUpcomingReminders,
  shouldShowGentleLock,
  sortByDeadline,
  sortIdeas,
  sortRelativePriority,
  type EntryKind,
  type WorkspaceSnapshot
} from "@two-birds/shared";
import styles from "./page.module.css";
import type {
  addSetupEntryAction,
  captureItemAction,
  deleteSetupEntryAction,
  moveSetupEntryAction,
  sendReminderEmailsAction,
  updateItemAction as updateItemActionType,
  updateSetupSettingsAction
} from "./actions";

type CaptureForm = {
  kind: EntryKind;
  title: string;
  notes: string;
  dueAt: string;
  isMultiDay: boolean;
  tags: string;
  followUpName: string;
  followUpEmail: string;
  followUpPhone: string;
};

const initialForm: CaptureForm = {
  kind: "task",
  title: "",
  notes: "",
  dueAt: "",
  isMultiDay: false,
  tags: "",
  followUpName: "",
  followUpEmail: "",
  followUpPhone: ""
};

type PendingAttachment = {
  id: string;
  originalName: string;
  customName: string;
};

type PendingLinkAttachment = {
  id: string;
  url: string;
  customName: string;
};

export function DashboardClient({
  initialSnapshot,
  workspaceId,
  initialMessage,
  captureAction,
  updateSettingsAction,
  addSetupEntry,
  deleteSetupEntry,
  moveSetupEntry,
  sendRemindersAction,
  updateItemAction
}: {
  initialSnapshot: WorkspaceSnapshot;
  workspaceId: string;
  initialMessage?: string;
  captureAction: typeof captureItemAction;
  updateSettingsAction: typeof updateSetupSettingsAction;
  addSetupEntry: typeof addSetupEntryAction;
  deleteSetupEntry: typeof deleteSetupEntryAction;
  moveSetupEntry: typeof moveSetupEntryAction;
  sendRemindersAction: typeof sendReminderEmailsAction;
  updateItemAction: typeof updateItemActionType;
}) {
  const [apiBaseUrl, setApiBaseUrl] = useState("");
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(initialSnapshot);
  const [form, setForm] = useState<CaptureForm>(initialForm);
  const [goalTitle, setGoalTitle] = useState("");
  const [projectTitle, setProjectTitle] = useState("");
  const [topicTitle, setTopicTitle] = useState("");
  const [tagTitle, setTagTitle] = useState("");
  const [attachmentInputKey, setAttachmentInputKey] = useState(0);
  const [pendingAttachments, setPendingAttachments] = useState<PendingAttachment[]>([]);
  const [pendingLinkAttachments, setPendingLinkAttachments] = useState<PendingLinkAttachment[]>([]);
  const [linkDraft, setLinkDraft] = useState({ url: "", customName: "" });
  const [setupDraft, setSetupDraft] = useState(() => ({
    priorityGuidance: initialSnapshot.settings.priorityGuidance,
    p1Label: initialSnapshot.settings.p1Label,
    p2Label: initialSnapshot.settings.p2Label,
    p3Label: initialSnapshot.settings.p3Label,
    p4Label: initialSnapshot.settings.p4Label,
    gentleLockEnabled: initialSnapshot.settings.gentleLockEnabled
  }));
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState({
    title: "",
    notes: "",
    relativePriority: "p3" as "p1" | "p2" | "p3" | "p4",
    dueAt: "",
    followUpName: "",
    followUpEmail: "",
    followUpPhone: ""
  });
  const [lastAIMessage, setLastAIMessage] = useState<string>(
    initialMessage ?? "AI suggestions will explain why an item landed in a project, topic, or priority lane."
  );

  const relativeTasks = sortRelativePriority(snapshot.items);
  const deadlineTasks = sortByDeadline(snapshot.items);
  const ideas = sortIdeas(snapshot.items);
  const completedItems = snapshot.items.filter((item) => item.status === "done");
  const archivedItems = snapshot.items.filter((item) => item.status === "archived");
  const reminders = getUpcomingReminders(snapshot.items);
  const attachments = snapshot.items.flatMap((item) =>
    item.attachments.map((attachment) => ({
      ...attachment,
      itemId: item.id,
      itemTitle: item.title
    }))
  );
  const gentleLock = shouldShowGentleLock(snapshot.items) && snapshot.settings.gentleLockEnabled;
  useEffect(() => {
    setApiBaseUrl(window.location.origin);
    void refreshSnapshot();
  }, []);

  async function refreshSnapshot() {
    try {
      const api = createHttpSyncApi({
        baseUrl: window.location.origin,
        workspaceId
      });
      const nextSnapshot = await api.getWorkspaceSnapshot(workspaceId);
      setSnapshot(nextSnapshot);
    } catch (error) {
      setLastAIMessage(error instanceof Error ? error.message : "Unable to refresh your workspace.");
    }
  }

  async function handleReprioritize(itemId: string, manualRank: number) {
    try {
      const api = createHttpSyncApi({
        baseUrl: apiBaseUrl || window.location.origin,
        workspaceId
      });
      await api.reorderInboxItem(workspaceId, itemId, manualRank);
      await refreshSnapshot();
      setLastAIMessage("Manual order applied. AI will no longer override this item’s list placement.");
    } catch (error) {
      setLastAIMessage(error instanceof Error ? error.message : "Unable to update ordering.");
    }
  }

  function handleAttachmentSelection(event: ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(event.target.files ?? []);
    setPendingAttachments(
      selected.map((file, index) => ({
        id: `${file.name}-${file.size}-${index}`,
        originalName: file.name,
        customName: ""
      }))
    );
  }

  function updateAttachmentName(id: string, customName: string) {
    setPendingAttachments((current) =>
      current.map((attachment) => (attachment.id === id ? { ...attachment, customName } : attachment))
    );
  }

  function clearPendingAttachments() {
    setPendingAttachments([]);
    setPendingLinkAttachments([]);
    setLinkDraft({ url: "", customName: "" });
    setAttachmentInputKey((current) => current + 1);
  }

  function addLinkAttachment() {
    if (!linkDraft.url.trim()) {
      return;
    }

    setPendingLinkAttachments((current) => [
      ...current,
      {
        id: `${linkDraft.url}-${current.length}`,
        url: linkDraft.url.trim(),
        customName: linkDraft.customName.trim()
      }
    ]);
    setLinkDraft({ url: "", customName: "" });
  }

  function updateLinkAttachment(id: string, field: "url" | "customName", value: string) {
    setPendingLinkAttachments((current) =>
      current.map((attachment) => (attachment.id === id ? { ...attachment, [field]: value } : attachment))
    );
  }

  function removeLinkAttachment(id: string) {
    setPendingLinkAttachments((current) => current.filter((attachment) => attachment.id !== id));
  }

  function beginEdit(item: WorkspaceSnapshot["items"][number]) {
    setEditingItemId(item.id);
    setItemDraft({
      title: item.title,
      notes: item.notes,
      relativePriority: item.relativePriority,
      dueAt: item.dueAt ? item.dueAt.slice(0, 16) : "",
      followUpName: item.followUpContact?.fullName ?? "",
      followUpEmail: item.followUpContact?.email ?? "",
      followUpPhone: item.followUpContact?.phone ?? ""
    });
  }

  function renderItemMeta(item: WorkspaceSnapshot["items"][number]) {
    return (
      <div className={styles.metaStack}>
        {item.followUpContact ? (
          <p className={styles.metaLine}>
            Follow up: {item.followUpContact.fullName}
            {item.followUpContact.email ? (
              <>
                {" · "}
                <a className={styles.metaLink} href={`mailto:${item.followUpContact.email}`}>
                  {item.followUpContact.email}
                </a>
              </>
            ) : null}
            {item.followUpContact.phone ? (
              <>
                {" · "}
                <a className={styles.metaLink} href={`tel:${item.followUpContact.phone}`}>
                  {item.followUpContact.phone}
                </a>
              </>
            ) : null}
          </p>
        ) : null}
        {item.attachments.length ? (
          <div className={styles.linkList}>
            {item.attachments.map((attachment) => (
              <a key={attachment.id} href={attachment.url} target="_blank" rel="noreferrer" className={styles.metaLink}>
                {attachment.fileName}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    );
  }

  function renderStatusForm(itemId: string, status: "open" | "done" | "archived", label: string) {
    return (
      <form action={updateItemAction}>
        <input type="hidden" name="itemId" value={itemId} />
        <input type="hidden" name="status" value={status} />
        <button type="submit" className={styles.ghostButton}>
          {label}
        </button>
      </form>
    );
  }

  function renderEditForm(itemId: string) {
    if (editingItemId !== itemId) {
      return null;
    }

    return (
      <form action={updateItemAction} className={styles.editorCard}>
        <input type="hidden" name="itemId" value={itemId} />
        <input
          className={styles.input}
          name="title"
          value={itemDraft.title}
          onChange={(event) => setItemDraft((current) => ({ ...current, title: event.target.value }))}
        />
        <textarea
          className={styles.textarea}
          name="notes"
          value={itemDraft.notes}
          onChange={(event) => setItemDraft((current) => ({ ...current, notes: event.target.value }))}
        />
        <div className={styles.inlineFields}>
          <select
            className={styles.input}
            name="relativePriority"
            value={itemDraft.relativePriority}
            onChange={(event) =>
              setItemDraft((current) => ({
                ...current,
                relativePriority: event.target.value as "p1" | "p2" | "p3" | "p4"
              }))
            }
          >
            <option value="p1">P1</option>
            <option value="p2">P2</option>
            <option value="p3">P3</option>
            <option value="p4">P4</option>
          </select>
          <input
            className={styles.input}
            type="datetime-local"
            name="dueAt"
            value={itemDraft.dueAt}
            onChange={(event) => setItemDraft((current) => ({ ...current, dueAt: event.target.value }))}
          />
        </div>
        <div className={styles.inlineFields}>
          <input
            className={styles.input}
            name="followUpName"
            placeholder="Follow-up name"
            value={itemDraft.followUpName}
            onChange={(event) => setItemDraft((current) => ({ ...current, followUpName: event.target.value }))}
          />
          <input
            className={styles.input}
            name="followUpEmail"
            placeholder="Follow-up email"
            value={itemDraft.followUpEmail}
            onChange={(event) => setItemDraft((current) => ({ ...current, followUpEmail: event.target.value }))}
          />
        </div>
        <input
          className={styles.input}
          name="followUpPhone"
          placeholder="Follow-up phone"
          value={itemDraft.followUpPhone}
          onChange={(event) => setItemDraft((current) => ({ ...current, followUpPhone: event.target.value }))}
        />
        <div className={styles.itemActions}>
          <button type="submit" className={styles.primaryButton}>
            Save
          </button>
          <button type="button" className={styles.ghostButton} onClick={() => setEditingItemId(null)}>
            Cancel
          </button>
        </div>
      </form>
    );
  }

  function renderItemRow(item: WorkspaceSnapshot["items"][number], index?: number, label?: string) {
    return (
      <div key={item.id} className={styles.item}>
        <div>
          <strong>{item.title}</strong>
          <p>{item.aiSuggestedSummary?.reasoning && item.kind === "idea" ? item.aiSuggestedSummary.reasoning : item.notes || "No notes yet."}</p>
          {renderItemMeta(item)}
          {renderEditForm(item.id)}
        </div>
        <div className={styles.itemActionStack}>
          <div className={styles.itemActions}>
            <span>{label ?? item.relativePriority.toUpperCase()}</span>
            {typeof index === "number" ? (
              <button type="button" className={styles.ghostButton} onClick={() => handleReprioritize(item.id, index + 1)}>
                Pin here
              </button>
            ) : null}
          </div>
          <div className={styles.itemActions}>
            <button type="button" className={styles.ghostButton} onClick={() => beginEdit(item)}>
              Edit
            </button>
            {item.status === "done"
              ? renderStatusForm(item.id, "open", "Reopen")
              : renderStatusForm(item.id, "done", "Done")}
            {item.status === "archived"
              ? renderStatusForm(item.id, "open", "Restore")
              : renderStatusForm(item.id, "archived", "Archive")}
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className={styles.page}>
      <section className={styles.hero}>
        <div>
          <p className={styles.kicker}>2Birds1Stone</p>
          <h1>Capture fast. Organize later. Focus on what matters now.</h1>
          <p className={styles.lede}>
            A synced phone and web app for creative minds with too many ideas to keep in working memory.
          </p>
          <div className={styles.aiBanner}>
            <strong>AI sorter</strong>
            <p>{lastAIMessage}</p>
          </div>
        </div>

        <form className={styles.captureCard} action={captureAction}>
          <div className={styles.captureHeader}>
            <h2>Quick Capture</h2>
            <div className={styles.toggleRow}>
              <button
                className={form.kind === "task" ? styles.activeToggle : styles.toggle}
                type="button"
                onClick={() => setForm((current) => ({ ...current, kind: "task" }))}
              >
                Task
              </button>
              <button
                className={form.kind === "idea" ? styles.activeToggle : styles.toggle}
                type="button"
                onClick={() => setForm((current) => ({ ...current, kind: "idea" }))}
              >
                Idea
              </button>
            </div>
          </div>

          <input
            className={styles.input}
            placeholder="Title"
            name="title"
            value={form.title}
            onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))}
          />
          <textarea
            className={styles.textarea}
            placeholder="Notes, context, voice transcript, follow-up details..."
            name="notes"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />
          <input
            className={styles.input}
            placeholder="Tags, comma separated"
            name="tags"
            value={form.tags}
            onChange={(event) => setForm((current) => ({ ...current, tags: event.target.value }))}
          />
          <div className={styles.inlineFields}>
            <input
              className={styles.input}
              placeholder="Follow-up name"
              name="followUpName"
              value={form.followUpName}
              onChange={(event) => setForm((current) => ({ ...current, followUpName: event.target.value }))}
            />
            <input
              className={styles.input}
              placeholder="Follow-up email"
              name="followUpEmail"
              value={form.followUpEmail}
              onChange={(event) => setForm((current) => ({ ...current, followUpEmail: event.target.value }))}
            />
          </div>
          <input
            className={styles.input}
            placeholder="Follow-up phone"
            name="followUpPhone"
            value={form.followUpPhone}
            onChange={(event) => setForm((current) => ({ ...current, followUpPhone: event.target.value }))}
          />
          <div className={styles.attachmentCard}>
            <div className={styles.attachmentHeader}>
              <strong>Attachments</strong>
              {pendingAttachments.length ? (
                <button type="button" className={styles.ghostButton} onClick={clearPendingAttachments}>
                  Clear
                </button>
              ) : null}
            </div>
            <input
              key={attachmentInputKey}
              className={styles.fileInput}
              type="file"
              name="attachmentFiles"
              multiple
              onChange={handleAttachmentSelection}
            />
            <p className={styles.helperText}>Choose one or more files, then optionally rename how each appears in the app.</p>
            {pendingAttachments.length ? (
              <div className={styles.attachmentList}>
                {pendingAttachments.map((attachment) => (
                  <div key={attachment.id} className={styles.attachmentRow}>
                    <div className={styles.attachmentMeta}>
                      <span>{attachment.originalName}</span>
                    </div>
                    <input
                      className={styles.input}
                      placeholder="Custom display name"
                      value={attachment.customName}
                      onChange={(event) => updateAttachmentName(attachment.id, event.target.value)}
                    />
                    <input type="hidden" name="attachmentCustomNames" value={attachment.customName} />
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>No uploaded files selected yet.</p>
            )}
            <div className={styles.linkComposer}>
              <strong>Linked file</strong>
              <div className={styles.inlineFields}>
                <input
                  className={styles.input}
                  placeholder="Attachment URL"
                  value={linkDraft.url}
                  onChange={(event) => setLinkDraft((current) => ({ ...current, url: event.target.value }))}
                />
                <input
                  className={styles.input}
                  placeholder="Custom link name"
                  value={linkDraft.customName}
                  onChange={(event) => setLinkDraft((current) => ({ ...current, customName: event.target.value }))}
                />
              </div>
              <button type="button" className={styles.ghostButton} onClick={addLinkAttachment}>
                Add link
              </button>
            </div>
            {pendingLinkAttachments.length ? (
              <div className={styles.attachmentList}>
                {pendingLinkAttachments.map((attachment) => (
                  <div key={attachment.id} className={styles.attachmentRow}>
                    <input
                      className={styles.input}
                      value={attachment.url}
                      onChange={(event) => updateLinkAttachment(attachment.id, "url", event.target.value)}
                    />
                    <input
                      className={styles.input}
                      placeholder="Custom display name"
                      value={attachment.customName}
                      onChange={(event) => updateLinkAttachment(attachment.id, "customName", event.target.value)}
                    />
                    <div className={styles.attachmentActions}>
                      <input type="hidden" name="attachmentLinkUrls" value={attachment.url} />
                      <input type="hidden" name="attachmentLinkNames" value={attachment.customName} />
                      <button
                        type="button"
                        className={styles.ghostButton}
                        onClick={() => removeLinkAttachment(attachment.id)}
                      >
                        Remove link
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className={styles.emptyState}>No linked files added yet.</p>
            )}
          </div>
          <input type="hidden" name="kind" value={form.kind} />
          <label className={styles.checkboxRow}>
            <input
              name="isMultiDay"
              type="checkbox"
              checked={form.isMultiDay}
              onChange={(event) => setForm((current) => ({ ...current, isMultiDay: event.target.checked }))}
            />
            Multi-day task
          </label>
          {form.isMultiDay ? (
            <input
              className={styles.input}
              type="datetime-local"
              name="dueAt"
              value={form.dueAt}
              onChange={(event) => setForm((current) => ({ ...current, dueAt: event.target.value }))}
            />
          ) : null}
          <button className={styles.primaryButton} type="submit">
            Capture and sort
          </button>
        </form>
      </section>

      <section className={styles.grid}>
        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>To Do: Relative Priority</h2>
            <span>
              {snapshot.settings.p1Label} to {snapshot.settings.p4Label}
            </span>
          </div>
          {relativeTasks.length ? relativeTasks.map((item, index) => renderItemRow(item, index)) : <p className={styles.emptyState}>No open relative-priority tasks.</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>To Do: Deadline Based</h2>
            <span>Due-date driven work</span>
          </div>
          {deadlineTasks.length ? deadlineTasks.map((item, index) => renderItemRow(item, index, item.dueAt?.slice(0, 10))) : <p className={styles.emptyState}>No open deadline-based tasks.</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Ideas to Tackle</h2>
            <span>Saved without losing focus</span>
          </div>
          {ideas.length ? ideas.map((item) => renderItemRow(item)) : <p className={styles.emptyState}>No open ideas right now.</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Completed</h2>
            <span>Finished work you can reopen</span>
          </div>
          {completedItems.length ? completedItems.map((item) => renderItemRow(item)) : <p className={styles.emptyState}>No completed items yet.</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Archived</h2>
            <span>Stored out of the way</span>
          </div>
          {archivedItems.length ? archivedItems.map((item) => renderItemRow(item)) : <p className={styles.emptyState}>No archived items yet.</p>}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>All Attachments</h2>
            <span>Every saved file and link</span>
          </div>
          {attachments.length ? (
            attachments.map((attachment) => (
              <div key={attachment.id} className={styles.item}>
                <div>
                  <strong>{attachment.fileName}</strong>
                  <p>Attached to {attachment.itemTitle}</p>
                </div>
                <div className={styles.itemActions}>
                  <a href={attachment.url} target="_blank" rel="noreferrer" className={styles.metaLink}>
                    Open
                  </a>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No attachments saved yet.</p>
          )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Upcoming Reminders</h2>
            <div className={styles.itemActions}>
              <span>Priority and due-date schedule</span>
              <form action={sendRemindersAction}>
                <button type="submit" className={styles.ghostButton}>
                  Send now
                </button>
              </form>
            </div>
          </div>
          {reminders.length ? (
            reminders.map((reminder) => (
              <div key={reminder.id} className={styles.item}>
                <div>
                  <strong>{reminder.itemTitle}</strong>
                  <p>{reminder.reason}</p>
                </div>
                <div className={styles.itemActions}>
                  <span>{new Date(reminder.scheduledFor).toLocaleString()}</span>
                </div>
              </div>
            ))
          ) : (
            <p className={styles.emptyState}>No upcoming reminders yet.</p>
          )}
        </article>

        <article className={styles.card}>
          <div className={styles.cardHeader}>
            <h2>Setup</h2>
            <span>What guides the AI</span>
          </div>

          <form className={styles.setupForm} action={updateSettingsAction}>
            <p className={styles.sectionLabel}>Priority guidance</p>
            <textarea
              className={styles.textarea}
              name="priorityGuidance"
              value={setupDraft.priorityGuidance}
              onChange={(event) =>
                setSetupDraft((current) => ({ ...current, priorityGuidance: event.target.value }))
              }
            />
            <div className={styles.labelGrid}>
              <input
                className={styles.input}
                name="p1Label"
                value={setupDraft.p1Label}
                onChange={(event) => setSetupDraft((current) => ({ ...current, p1Label: event.target.value }))}
              />
              <input
                className={styles.input}
                name="p2Label"
                value={setupDraft.p2Label}
                onChange={(event) => setSetupDraft((current) => ({ ...current, p2Label: event.target.value }))}
              />
              <input
                className={styles.input}
                name="p3Label"
                value={setupDraft.p3Label}
                onChange={(event) => setSetupDraft((current) => ({ ...current, p3Label: event.target.value }))}
              />
              <input
                className={styles.input}
                name="p4Label"
                value={setupDraft.p4Label}
                onChange={(event) => setSetupDraft((current) => ({ ...current, p4Label: event.target.value }))}
              />
            </div>
            <label className={styles.checkboxRow}>
              <input
                type="checkbox"
                name="gentleLockEnabled"
                checked={setupDraft.gentleLockEnabled}
                onChange={(event) =>
                  setSetupDraft((current) => ({ ...current, gentleLockEnabled: event.target.checked }))
                }
              />
              Gentle lock when unfinished P1 items exist
            </label>
            <button className={styles.primaryButton} type="submit">
              Save setup
            </button>
          </form>

          <p className={styles.sectionLabel}>Goals</p>
          {snapshot.goals.map((goal) => (
            <div key={goal.id} className={styles.rankRow}>
              <div className={styles.rankInfo}>
                <span>#{goal.priorityRank}</span>
                <strong>{goal.title}</strong>
              </div>
              <div className={styles.rankControls}>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="goals" />
                  <input type="hidden" name="id" value={goal.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className={styles.ghostButton} type="submit">
                    Up
                  </button>
                </form>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="goals" />
                  <input type="hidden" name="id" value={goal.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className={styles.ghostButton} type="submit">
                    Down
                  </button>
                </form>
                <form action={deleteSetupEntry}>
                  <input type="hidden" name="type" value="goals" />
                  <input type="hidden" name="id" value={goal.id} />
                  <button className={styles.ghostButton} type="submit">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
          <form className={styles.inlineForm} action={addSetupEntry}>
            <input type="hidden" name="type" value="goals" />
            <input
              className={styles.input}
              name="title"
              placeholder="Add goal"
              value={goalTitle}
              onChange={(event) => setGoalTitle(event.target.value)}
            />
            <button className={styles.ghostButton} type="submit">
              Add
            </button>
          </form>

          <p className={styles.sectionLabel}>Projects</p>
          {snapshot.projects.map((project) => (
            <div key={project.id} className={styles.rankRow}>
              <div className={styles.rankInfo}>
                <span>#{project.priorityRank}</span>
                <strong>{project.title}</strong>
              </div>
              <div className={styles.rankControls}>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="projects" />
                  <input type="hidden" name="id" value={project.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className={styles.ghostButton} type="submit">
                    Up
                  </button>
                </form>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="projects" />
                  <input type="hidden" name="id" value={project.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className={styles.ghostButton} type="submit">
                    Down
                  </button>
                </form>
                <form action={deleteSetupEntry}>
                  <input type="hidden" name="type" value="projects" />
                  <input type="hidden" name="id" value={project.id} />
                  <button className={styles.ghostButton} type="submit">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
          <form className={styles.inlineForm} action={addSetupEntry}>
            <input type="hidden" name="type" value="projects" />
            <input
              className={styles.input}
              name="title"
              placeholder="Add project"
              value={projectTitle}
              onChange={(event) => setProjectTitle(event.target.value)}
            />
            <button className={styles.ghostButton} type="submit">
              Add
            </button>
          </form>

          <p className={styles.sectionLabel}>Topics</p>
          {snapshot.topics.map((topic) => (
            <div key={topic.id} className={styles.rankRow}>
              <div className={styles.rankInfo}>
                <span>#{topic.priorityRank}</span>
                <strong>{topic.title}</strong>
              </div>
              <div className={styles.rankControls}>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="topics" />
                  <input type="hidden" name="id" value={topic.id} />
                  <input type="hidden" name="direction" value="up" />
                  <button className={styles.ghostButton} type="submit">
                    Up
                  </button>
                </form>
                <form action={moveSetupEntry}>
                  <input type="hidden" name="type" value="topics" />
                  <input type="hidden" name="id" value={topic.id} />
                  <input type="hidden" name="direction" value="down" />
                  <button className={styles.ghostButton} type="submit">
                    Down
                  </button>
                </form>
                <form action={deleteSetupEntry}>
                  <input type="hidden" name="type" value="topics" />
                  <input type="hidden" name="id" value={topic.id} />
                  <button className={styles.ghostButton} type="submit">
                    Remove
                  </button>
                </form>
              </div>
            </div>
          ))}
          <form className={styles.inlineForm} action={addSetupEntry}>
            <input type="hidden" name="type" value="topics" />
            <input
              className={styles.input}
              name="title"
              placeholder="Add topic"
              value={topicTitle}
              onChange={(event) => setTopicTitle(event.target.value)}
            />
            <button className={styles.ghostButton} type="submit">
              Add
            </button>
          </form>

          <p className={styles.sectionLabel}>Tags</p>
          <div className={styles.tagList}>
            {snapshot.tags.map((tag) => (
              <form key={tag} className={styles.tagChip} action={deleteSetupEntry}>
                <input type="hidden" name="type" value="tags" />
                <input type="hidden" name="label" value={tag} />
                <span>{tag}</span>
                <button type="submit">x</button>
              </form>
            ))}
          </div>
          <form className={styles.inlineForm} action={addSetupEntry}>
            <input type="hidden" name="type" value="tags" />
            <input
              className={styles.input}
              name="title"
              placeholder="Add tag"
              value={tagTitle}
              onChange={(event) => setTagTitle(event.target.value)}
            />
            <button className={styles.ghostButton} type="submit">
              Add
            </button>
          </form>

          {gentleLock ? (
            <div className={styles.lockCard}>Gentle lock is on: unfinished P1 work should be reviewed first.</div>
          ) : null}
        </article>
      </section>
    </main>
  );
}
