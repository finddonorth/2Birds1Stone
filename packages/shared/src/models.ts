export type EntryKind = "idea" | "task";
export type RelativePriority = "p1" | "p2" | "p3" | "p4";
export type OrderingMode = "ai" | "manual";
export type ItemStatus = "open" | "done" | "archived";

export interface RankedEntity {
  id: string;
  title: string;
  priorityRank: number;
}

export interface WorkspaceSettings {
  priorityGuidance: string;
  p1Label: string;
  p2Label: string;
  p3Label: string;
  p4Label: string;
  gentleLockEnabled: boolean;
}

export interface Contact {
  id: string;
  fullName: string;
  email?: string;
  phone?: string;
}

export interface ContactInput {
  fullName: string;
  email?: string;
  phone?: string;
}

export interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  url: string;
}

export interface AttachmentInput {
  fileName: string;
  mimeType?: string;
  url: string;
}

export interface InboxItem {
  id: string;
  kind: EntryKind;
  status: ItemStatus;
  title: string;
  notes: string;
  tags: string[];
  relativePriority: RelativePriority;
  orderingMode: OrderingMode;
  manualRank?: number;
  aiRank?: number;
  projectId?: string;
  topicId?: string;
  isMultiDay: boolean;
  startAt?: string;
  dueAt?: string;
  followUpContact?: Contact;
  attachments: Attachment[];
  aiSuggestedSummary?: {
    suggestedKind?: EntryKind;
    suggestedProjectId?: string;
    suggestedTopicId?: string;
    suggestedTags?: string[];
    suggestedPriority?: RelativePriority;
    reasoning?: string;
  };
}

export interface WorkspaceSnapshot {
  goals: RankedEntity[];
  projects: RankedEntity[];
  topics: RankedEntity[];
  tags: string[];
  settings: WorkspaceSettings;
  items: InboxItem[];
}

export type SetupEntryType = "goals" | "projects" | "topics" | "tags";

export interface CaptureInput {
  kind: EntryKind;
  title: string;
  notes?: string;
  relativePriority?: RelativePriority;
  tags?: string[];
  projectId?: string;
  topicId?: string;
  isMultiDay?: boolean;
  startAt?: string;
  dueAt?: string;
  followUpContact?: ContactInput;
  attachments?: AttachmentInput[];
}

export interface UpdateInboxItemInput {
  kind?: EntryKind;
  status?: ItemStatus;
  title?: string;
  notes?: string;
  relativePriority?: RelativePriority;
  tags?: string[];
  projectId?: string;
  topicId?: string;
  isMultiDay?: boolean;
  startAt?: string;
  dueAt?: string;
  followUpContact?: ContactInput;
}

export interface WorkspaceSettingsInput {
  priorityGuidance: string;
  p1Label: string;
  p2Label: string;
  p3Label: string;
  p4Label: string;
  gentleLockEnabled: boolean;
}

export interface ReminderEvent {
  id: string;
  itemId: string;
  itemTitle: string;
  scheduledFor: string;
  reason: string;
}
