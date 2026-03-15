import { useEffect, useState } from "react";
import { ActivityIndicator, Linking, Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from "react-native";
import {
  demoWorkspaceSnapshot,
  getUpcomingReminders,
  shouldShowGentleLock,
  sortByDeadline,
  sortIdeas,
  sortRelativePriority,
  type EntryKind,
  type RankedEntity,
  type SetupEntryType,
  type WorkspaceSettingsInput,
  type WorkspaceSnapshot
} from "@two-birds/shared";
import { createMobileSyncApi, mobileWorkspaceId } from "../lib/sync";
import { mobileRedirectUrl, mobileSupabase } from "../lib/supabase";

type RankedSetupType = Exclude<SetupEntryType, "tags">;

const emptySetupEntryDrafts = {
  goals: "",
  projects: "",
  topics: "",
  tags: ""
};

function createSetupDraft(snapshot: WorkspaceSnapshot): WorkspaceSettingsInput {
  return {
    priorityGuidance: snapshot.settings.priorityGuidance,
    p1Label: snapshot.settings.p1Label,
    p2Label: snapshot.settings.p2Label,
    p3Label: snapshot.settings.p3Label,
    p4Label: snapshot.settings.p4Label,
    gentleLockEnabled: snapshot.settings.gentleLockEnabled
  };
}

export default function HomeScreen() {
  const [snapshot, setSnapshot] = useState<WorkspaceSnapshot>(demoWorkspaceSnapshot);
  const [kind, setKind] = useState<EntryKind>("task");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [multiDay, setMultiDay] = useState(false);
  const [followUpName, setFollowUpName] = useState("");
  const [followUpEmail, setFollowUpEmail] = useState("");
  const [followUpPhone, setFollowUpPhone] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [email, setEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(!mobileSupabase));
  const [isBusy, setIsBusy] = useState(false);
  const [setupDraft, setSetupDraft] = useState<WorkspaceSettingsInput>(() => createSetupDraft(demoWorkspaceSnapshot));
  const [setupEntryDrafts, setSetupEntryDrafts] = useState<Record<SetupEntryType, string>>(emptySetupEntryDrafts);
  const [lastAIMessage, setLastAIMessage] = useState(
    "AI will recommend where a new capture belongs based on your goals and urgency."
  );
  const api = createMobileSyncApi();

  const relativeTasks = sortRelativePriority(snapshot.items);
  const deadlineTasks = sortByDeadline(snapshot.items);
  const ideas = sortIdeas(snapshot.items);
  const reminders = getUpcomingReminders(snapshot.items);
  const completedItems = snapshot.items.filter((item) => item.status === "done");
  const archivedItems = snapshot.items.filter((item) => item.status === "archived");
  const attachments = snapshot.items.flatMap((item) =>
    item.attachments.map((attachment) => ({
      ...attachment,
      itemTitle: item.title
    }))
  );
  const gentleLock = shouldShowGentleLock(snapshot.items) && snapshot.settings.gentleLockEnabled;

  useEffect(() => {
    async function bootstrap() {
      if (!mobileSupabase) {
        await refreshSnapshot();
        return;
      }

      const {
        data: { session }
      } = await mobileSupabase.auth.getSession();

      setIsAuthenticated(Boolean(session));

      if (session) {
        await refreshSnapshot();
      }

      const { data } = mobileSupabase.auth.onAuthStateChange((_event, nextSession) => {
        setIsAuthenticated(Boolean(nextSession));
        if (nextSession) {
          void refreshSnapshot();
        } else {
          setSnapshot(demoWorkspaceSnapshot);
          setSetupDraft(createSetupDraft(demoWorkspaceSnapshot));
        }
      });

      return () => {
        data.subscription.unsubscribe();
      };
    }

    void bootstrap();
  }, []);

  async function refreshSnapshot() {
    try {
      const nextSnapshot = await api.getWorkspaceSnapshot(mobileWorkspaceId);
      setSnapshot(nextSnapshot);
      setSetupDraft(createSetupDraft(nextSnapshot));
    } catch (error) {
      setLastAIMessage(error instanceof Error ? error.message : "Unable to refresh your workspace.");
    }
  }

  async function handleSendMagicLink() {
    if (!mobileSupabase || !email.trim()) {
      return;
    }

    setIsBusy(true);
    const { error } = await mobileSupabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: mobileRedirectUrl
      }
    });
    setIsBusy(false);

    if (error) {
      setLastAIMessage(error.message);
      return;
    }

    setOtpSent(true);
    setLastAIMessage("Sign-in email sent. Enter the code from the email here to avoid the Safari redirect flow.");
  }

  async function handleVerifyCode() {
    if (!mobileSupabase || !email.trim() || !otpCode.trim()) {
      return;
    }

    setIsBusy(true);
    const { error } = await mobileSupabase.auth.verifyOtp({
      email: email.trim(),
      token: otpCode.trim(),
      type: "email"
    });
    setIsBusy(false);

    if (error) {
      setLastAIMessage(error.message);
      return;
    }

    setLastAIMessage("Signed in on mobile.");
    setOtpCode("");
  }

  async function handleSignOut() {
    if (!mobileSupabase) {
      return;
    }

    await mobileSupabase.auth.signOut();
    setLastAIMessage("Signed out.");
  }

  async function runBusyAction(action: () => Promise<void>) {
    try {
      setIsBusy(true);
      await action();
    } catch (error) {
      setLastAIMessage(error instanceof Error ? error.message : "Something went wrong.");
    } finally {
      setIsBusy(false);
    }
  }

  async function handleCapture() {
    if (!title.trim()) {
      setLastAIMessage("Add a title first.");
      return;
    }

    await runBusyAction(async () => {
      const created = await api.createInboxItem(mobileWorkspaceId, {
        kind,
        title: title.trim(),
        notes: notes.trim(),
        isMultiDay: multiDay,
        followUpContact: followUpName.trim()
          ? {
              fullName: followUpName.trim(),
              email: followUpEmail.trim() || undefined,
              phone: followUpPhone.trim() || undefined
          }
          : undefined,
        attachments: attachmentUrl.trim()
          ? [
              {
                fileName: attachmentName.trim() || "Linked file",
                url: attachmentUrl.trim(),
                mimeType: "text/uri-list"
              }
            ]
          : []
      });

      await refreshSnapshot();
      setTitle("");
      setNotes("");
      setMultiDay(false);
      setFollowUpName("");
      setFollowUpEmail("");
      setFollowUpPhone("");
      setAttachmentUrl("");
      setAttachmentName("");
      setLastAIMessage(created.aiSuggestedSummary?.reasoning ?? "Item captured.");
    });
  }

  async function handleUpdateItemStatus(itemId: string, status: "open" | "done" | "archived") {
    await runBusyAction(async () => {
      await api.updateInboxItem(mobileWorkspaceId, itemId, { status });
      await refreshSnapshot();
      setLastAIMessage(status === "open" ? "Item reopened." : `Item marked ${status}.`);
    });
  }

  function renderItemMeta(item: WorkspaceSnapshot["items"][number]) {
    return (
      <>
        {item.followUpContact ? (
          <View style={styles.metaGroup}>
            <Text style={styles.metaText}>Follow up: {item.followUpContact.fullName}</Text>
            {item.followUpContact.email ? (
              <Pressable onPress={() => Linking.openURL(`mailto:${item.followUpContact?.email}`)}>
                <Text style={styles.metaLink}>{item.followUpContact.email}</Text>
              </Pressable>
            ) : null}
            {item.followUpContact.phone ? (
              <Pressable onPress={() => Linking.openURL(`tel:${item.followUpContact?.phone}`)}>
                <Text style={styles.metaLink}>{item.followUpContact.phone}</Text>
              </Pressable>
            ) : null}
          </View>
        ) : null}
        {item.attachments.map((attachment) => (
          <Text key={attachment.id} style={styles.metaLink}>
            {attachment.fileName}: {attachment.url}
          </Text>
        ))}
      </>
    );
  }

  async function handleSaveSetup() {
    await runBusyAction(async () => {
      await api.updateWorkspaceSettings(mobileWorkspaceId, setupDraft);
      await refreshSnapshot();
      setLastAIMessage("Setup saved from mobile.");
    });
  }

  async function handleAddSetupEntry(type: SetupEntryType) {
    const value = setupEntryDrafts[type].trim();
    if (!value) {
      setLastAIMessage(`Add a ${type === "tags" ? "tag" : type.slice(0, -1)} name first.`);
      return;
    }

    await runBusyAction(async () => {
      await api.addSetupEntry(mobileWorkspaceId, type, value);
      await refreshSnapshot();
      setSetupEntryDrafts((current) => ({ ...current, [type]: "" }));
      setLastAIMessage(`${type === "tags" ? "Tag" : type.slice(0, -1)} added.`);
    });
  }

  async function handleDeleteSetupEntry(type: SetupEntryType, identifier: { id?: string; label?: string }) {
    await runBusyAction(async () => {
      await api.deleteSetupEntry(mobileWorkspaceId, type, identifier);
      await refreshSnapshot();
      setLastAIMessage(`${type === "tags" ? "Tag" : type.slice(0, -1)} removed.`);
    });
  }

  async function handleMoveSetupEntry(type: RankedSetupType, id: string, direction: "up" | "down") {
    await runBusyAction(async () => {
      await api.moveSetupEntry(mobileWorkspaceId, type, id, direction);
      await refreshSnapshot();
      setLastAIMessage(`${type.slice(0, -1)} moved ${direction}.`);
    });
  }

  function renderRankedSection(type: RankedSetupType, entries: RankedEntity[]) {
    return (
      <View style={styles.setupSection}>
        <Text style={styles.sectionTitle}>{type[0].toUpperCase() + type.slice(1)}</Text>
        {entries.map((entry) => (
          <View key={entry.id} style={styles.stackRow}>
            <View style={styles.rankMeta}>
              <Text style={styles.rankNumber}>#{entry.priorityRank}</Text>
              <Text style={styles.itemTitle}>{entry.title}</Text>
            </View>
            <View style={styles.inlineActions}>
              <Pressable
                onPress={() => handleMoveSetupEntry(type, entry.id, "up")}
                style={styles.smallGhostButton}
                disabled={isBusy}
              >
                <Text style={styles.smallGhostButtonText}>Up</Text>
              </Pressable>
              <Pressable
                onPress={() => handleMoveSetupEntry(type, entry.id, "down")}
                style={styles.smallGhostButton}
                disabled={isBusy}
              >
                <Text style={styles.smallGhostButtonText}>Down</Text>
              </Pressable>
              <Pressable
                onPress={() => handleDeleteSetupEntry(type, { id: entry.id })}
                style={styles.smallGhostButton}
                disabled={isBusy}
              >
                <Text style={styles.smallGhostButtonText}>Remove</Text>
              </Pressable>
            </View>
          </View>
        ))}
        <TextInput
          value={setupEntryDrafts[type]}
          onChangeText={(value) => setSetupEntryDrafts((current) => ({ ...current, [type]: value }))}
          placeholder={`Add ${type.slice(0, -1)}`}
          placeholderTextColor="#8a8f95"
          style={styles.input}
        />
        <Pressable onPress={() => handleAddSetupEntry(type)} style={styles.secondaryButton} disabled={isBusy}>
          <Text style={styles.secondaryButtonText}>Add {type.slice(0, -1)}</Text>
        </Pressable>
      </View>
    );
  }

  if (mobileSupabase && !isAuthenticated) {
    return (
      <ScrollView contentContainerStyle={styles.screen}>
        <Text style={styles.kicker}>2Birds1Stone</Text>
        <Text style={styles.title}>Sign in on your phone to sync with the web app.</Text>
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Mobile Sign-In</Text>
          <Text style={styles.body}>
            Use the same email you used on the web app. Enter the code from the email right here.
          </Text>
          <TextInput
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            placeholderTextColor="#8a8f95"
            style={styles.input}
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <Pressable onPress={handleSendMagicLink} style={styles.primaryButton} disabled={isBusy}>
            {isBusy ? <ActivityIndicator color="#fffaf4" /> : <Text style={styles.primaryButtonText}>Send sign-in email</Text>}
          </Pressable>
          {otpSent ? (
            <>
              <TextInput
                value={otpCode}
                onChangeText={setOtpCode}
                placeholder="6-digit code"
                placeholderTextColor="#8a8f95"
                style={styles.input}
                keyboardType="number-pad"
              />
              <Pressable onPress={handleVerifyCode} style={styles.secondaryButton} disabled={isBusy}>
                {isBusy ? <ActivityIndicator color="#17212b" /> : <Text style={styles.secondaryButtonText}>Verify code</Text>}
              </Pressable>
            </>
          ) : null}
          <View style={styles.messageBox}>
            <Text style={styles.messageTitle}>Status</Text>
            <Text style={styles.body}>{lastAIMessage}</Text>
          </View>
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.screen}>
      <Text style={styles.kicker}>2Birds1Stone</Text>
      <Text style={styles.title}>A calm home for fast-moving ideas.</Text>
      {mobileSupabase ? (
        <Pressable onPress={handleSignOut} style={styles.signOutButton}>
          <Text style={styles.signOutText}>Sign out</Text>
        </Pressable>
      ) : null}

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Quick Capture</Text>
        <Text style={styles.body}>Voice or text, then let AI suggest where it belongs.</Text>
        <View style={styles.toggleRow}>
          <Pressable onPress={() => setKind("task")} style={kind === "task" ? styles.activePill : styles.pill}>
            <Text style={kind === "task" ? styles.activePillText : styles.pillText}>Task</Text>
          </Pressable>
          <Pressable onPress={() => setKind("idea")} style={kind === "idea" ? styles.activePill : styles.pill}>
            <Text style={kind === "idea" ? styles.activePillText : styles.pillText}>Idea</Text>
          </Pressable>
        </View>
        <TextInput
          value={title}
          onChangeText={setTitle}
          placeholder="Title"
          placeholderTextColor="#8a8f95"
          style={styles.input}
        />
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Notes or voice transcript"
          placeholderTextColor="#8a8f95"
          style={styles.textarea}
          multiline
        />
        <TextInput
          value={followUpName}
          onChangeText={setFollowUpName}
          placeholder="Follow-up name"
          placeholderTextColor="#8a8f95"
          style={styles.input}
        />
        <TextInput
          value={followUpEmail}
          onChangeText={setFollowUpEmail}
          placeholder="Follow-up email"
          placeholderTextColor="#8a8f95"
          style={styles.input}
          autoCapitalize="none"
          keyboardType="email-address"
        />
        <TextInput
          value={followUpPhone}
          onChangeText={setFollowUpPhone}
          placeholder="Follow-up phone"
          placeholderTextColor="#8a8f95"
          style={styles.input}
          keyboardType="phone-pad"
        />
        <TextInput
          value={attachmentUrl}
          onChangeText={setAttachmentUrl}
          placeholder="Attachment URL"
          placeholderTextColor="#8a8f95"
          style={styles.input}
          autoCapitalize="none"
        />
        <TextInput
          value={attachmentName}
          onChangeText={setAttachmentName}
          placeholder="Custom attachment name"
          placeholderTextColor="#8a8f95"
          style={styles.input}
        />
        <View style={styles.switchRow}>
          <Text style={styles.body}>Multi-day task</Text>
          <Switch value={multiDay} onValueChange={setMultiDay} />
        </View>
        <Pressable onPress={handleCapture} style={styles.primaryButton} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color="#fffaf4" /> : <Text style={styles.primaryButtonText}>Capture and sort</Text>}
        </Pressable>
        <View style={styles.messageBox}>
          <Text style={styles.messageTitle}>AI sorter</Text>
          <Text style={styles.body}>{lastAIMessage}</Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Relative Priority</Text>
        {relativeTasks.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.itemBlock}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {renderItemMeta(item)}
              <View style={styles.inlineActions}>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "done")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Done</Text>
                </Pressable>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "archived")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Archive</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.badge}>{item.relativePriority.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Deadline Tasks</Text>
        {deadlineTasks.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.itemBlock}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {renderItemMeta(item)}
              <View style={styles.inlineActions}>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "done")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Done</Text>
                </Pressable>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "archived")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Archive</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.badge}>{item.dueAt?.slice(5, 10)}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Ideas to Tackle</Text>
        {ideas.map((item) => (
          <View key={item.id} style={styles.row}>
            <View style={styles.itemBlock}>
              <Text style={styles.itemTitle}>{item.title}</Text>
              {renderItemMeta(item)}
              <View style={styles.inlineActions}>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "done")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Done</Text>
                </Pressable>
                <Pressable onPress={() => handleUpdateItemStatus(item.id, "archived")} style={styles.smallGhostButton}>
                  <Text style={styles.smallGhostButtonText}>Archive</Text>
                </Pressable>
              </View>
            </View>
            <Text style={styles.badge}>{item.relativePriority.toUpperCase()}</Text>
          </View>
        ))}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Completed</Text>
        {completedItems.length ? (
          completedItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.itemBlock}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {renderItemMeta(item)}
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => handleUpdateItemStatus(item.id, "open")} style={styles.smallGhostButton}>
                    <Text style={styles.smallGhostButtonText}>Reopen</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.badge}>DONE</Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No completed items yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Archived</Text>
        {archivedItems.length ? (
          archivedItems.map((item) => (
            <View key={item.id} style={styles.row}>
              <View style={styles.itemBlock}>
                <Text style={styles.itemTitle}>{item.title}</Text>
                {renderItemMeta(item)}
                <View style={styles.inlineActions}>
                  <Pressable onPress={() => handleUpdateItemStatus(item.id, "open")} style={styles.smallGhostButton}>
                    <Text style={styles.smallGhostButtonText}>Restore</Text>
                  </Pressable>
                </View>
              </View>
              <Text style={styles.badge}>ARCH</Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No archived items yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>All Attachments</Text>
        {attachments.length ? (
          attachments.map((attachment) => (
            <View key={attachment.id} style={styles.row}>
              <View style={styles.itemBlock}>
                <Text style={styles.itemTitle}>{attachment.fileName}</Text>
                <Text style={styles.metaText}>Attached to {attachment.itemTitle}</Text>
              </View>
              <Pressable onPress={() => Linking.openURL(attachment.url)}>
                <Text style={styles.metaLink}>Open</Text>
              </Pressable>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No attachments saved yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Upcoming Reminders</Text>
        {reminders.length ? (
          reminders.map((reminder) => (
            <View key={reminder.id} style={styles.row}>
              <View style={styles.itemBlock}>
                <Text style={styles.itemTitle}>{reminder.itemTitle}</Text>
                <Text style={styles.metaText}>{reminder.reason}</Text>
              </View>
              <Text style={styles.badge}>{new Date(reminder.scheduledFor).toLocaleDateString()}</Text>
            </View>
          ))
        ) : (
          <Text style={styles.body}>No upcoming reminders yet.</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Setup</Text>
        <Text style={styles.body}>Edit the rules that guide sorting from your phone too.</Text>
        <Text style={styles.sectionTitle}>Priority guidance</Text>
        <TextInput
          value={setupDraft.priorityGuidance}
          onChangeText={(value) => setSetupDraft((current) => ({ ...current, priorityGuidance: value }))}
          placeholder="Describe what should matter most when the app sorts."
          placeholderTextColor="#8a8f95"
          style={styles.textarea}
          multiline
        />
        <View style={styles.labelGrid}>
          <TextInput
            value={setupDraft.p1Label}
            onChangeText={(value) => setSetupDraft((current) => ({ ...current, p1Label: value }))}
            placeholder="P1 label"
            placeholderTextColor="#8a8f95"
            style={styles.halfInput}
          />
          <TextInput
            value={setupDraft.p2Label}
            onChangeText={(value) => setSetupDraft((current) => ({ ...current, p2Label: value }))}
            placeholder="P2 label"
            placeholderTextColor="#8a8f95"
            style={styles.halfInput}
          />
          <TextInput
            value={setupDraft.p3Label}
            onChangeText={(value) => setSetupDraft((current) => ({ ...current, p3Label: value }))}
            placeholder="P3 label"
            placeholderTextColor="#8a8f95"
            style={styles.halfInput}
          />
          <TextInput
            value={setupDraft.p4Label}
            onChangeText={(value) => setSetupDraft((current) => ({ ...current, p4Label: value }))}
            placeholder="P4 label"
            placeholderTextColor="#8a8f95"
            style={styles.halfInput}
          />
        </View>
        <View style={styles.switchRow}>
          <Text style={styles.body}>Gentle lock when P1 work is unfinished</Text>
          <Switch
            value={setupDraft.gentleLockEnabled}
            onValueChange={(value) => setSetupDraft((current) => ({ ...current, gentleLockEnabled: value }))}
          />
        </View>
        <Pressable onPress={handleSaveSetup} style={styles.primaryButton} disabled={isBusy}>
          {isBusy ? <ActivityIndicator color="#fffaf4" /> : <Text style={styles.primaryButtonText}>Save setup</Text>}
        </Pressable>

        {renderRankedSection("goals", snapshot.goals)}
        {renderRankedSection("projects", snapshot.projects)}
        {renderRankedSection("topics", snapshot.topics)}

        <View style={styles.setupSection}>
          <Text style={styles.sectionTitle}>Tags</Text>
          {snapshot.tags.map((tag) => (
            <View key={tag} style={styles.stackRow}>
              <Text style={styles.itemTitle}>{tag}</Text>
              <Pressable
                onPress={() => handleDeleteSetupEntry("tags", { label: tag })}
                style={styles.smallGhostButton}
                disabled={isBusy}
              >
                <Text style={styles.smallGhostButtonText}>Remove</Text>
              </Pressable>
            </View>
          ))}
          <TextInput
            value={setupEntryDrafts.tags}
            onChangeText={(value) => setSetupEntryDrafts((current) => ({ ...current, tags: value }))}
            placeholder="Add tag"
            placeholderTextColor="#8a8f95"
            style={styles.input}
          />
          <Pressable onPress={() => handleAddSetupEntry("tags")} style={styles.secondaryButton} disabled={isBusy}>
            <Text style={styles.secondaryButtonText}>Add tag</Text>
          </Pressable>
        </View>

        {gentleLock ? <Text style={styles.lockText}>Gentle lock active while P1 work is unfinished.</Text> : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: {
    padding: 20,
    gap: 16,
    backgroundColor: "#f6f0e8"
  },
  kicker: {
    marginTop: 32,
    textTransform: "uppercase",
    letterSpacing: 2,
    color: "#d96b2b",
    fontSize: 12
  },
  title: {
    fontSize: 34,
    lineHeight: 36,
    color: "#17212b",
    fontWeight: "700"
  },
  card: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: "#fffaf4",
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)"
  },
  cardTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 8,
    color: "#17212b"
  },
  body: {
    color: "#5f6b75"
  },
  toggleRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
    marginBottom: 14
  },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)"
  },
  activePill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#d96b2b"
  },
  pillText: {
    color: "#17212b",
    fontWeight: "600"
  },
  activePillText: {
    color: "#fffaf4",
    fontWeight: "700"
  },
  input: {
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
    color: "#17212b"
  },
  halfInput: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: "#17212b"
  },
  textarea: {
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)",
    backgroundColor: "#ffffff",
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 96,
    textAlignVertical: "top",
    marginBottom: 12,
    color: "#17212b"
  },
  labelGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginBottom: 12
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
    gap: 12
  },
  primaryButton: {
    backgroundColor: "#d96b2b",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center"
  },
  primaryButtonText: {
    color: "#fffaf4",
    fontWeight: "700"
  },
  secondaryButton: {
    marginTop: 4,
    backgroundColor: "#ffffff",
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)"
  },
  secondaryButtonText: {
    color: "#17212b",
    fontWeight: "700"
  },
  signOutButton: {
    alignSelf: "flex-start",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)"
  },
  signOutText: {
    color: "#17212b",
    fontWeight: "600"
  },
  messageBox: {
    marginTop: 14,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "#ffffff"
  },
  messageTitle: {
    color: "#17212b",
    fontWeight: "700",
    marginBottom: 4
  },
  row: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23, 33, 43, 0.08)",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12
  },
  itemBlock: {
    flex: 1,
    gap: 6
  },
  stackRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(23, 33, 43, 0.08)",
    gap: 10
  },
  rankMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10
  },
  rankNumber: {
    color: "#d96b2b",
    fontWeight: "700"
  },
  inlineActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  smallGhostButton: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#ffffff",
    borderWidth: 1,
    borderColor: "rgba(23, 33, 43, 0.12)",
    alignItems: "center"
  },
  smallGhostButtonText: {
    color: "#17212b",
    fontWeight: "600"
  },
  itemTitle: {
    flex: 1,
    color: "#17212b"
  },
  metaText: {
    color: "#5f6b75",
    fontSize: 13
  },
  metaGroup: {
    gap: 4
  },
  metaLink: {
    color: "#d96b2b",
    fontSize: 13
  },
  badge: {
    color: "#d96b2b",
    fontWeight: "700"
  },
  setupSection: {
    marginTop: 18,
    gap: 8
  },
  sectionTitle: {
    color: "#17212b",
    fontWeight: "700",
    marginBottom: 4
  },
  lockText: {
    marginTop: 14,
    color: "#d96b2b",
    fontWeight: "600"
  }
});
