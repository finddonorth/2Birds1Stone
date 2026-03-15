import type { InboxItem, RelativePriority, ReminderEvent } from "./models";

const priorityWeights: Record<RelativePriority, number> = {
  p1: 100,
  p2: 75,
  p3: 50,
  p4: 10
};

export function hasDeadline(item: InboxItem): boolean {
  return Boolean(item.dueAt);
}

function isOpen(item: InboxItem): boolean {
  return item.status === "open";
}

export function getRelativePriorityScore(item: InboxItem): number {
  const base = priorityWeights[item.relativePriority];
  if (item.orderingMode === "manual" && typeof item.manualRank === "number") {
    return 1000 - item.manualRank;
  }
  return typeof item.aiRank === "number" ? base + item.aiRank : base;
}

export function sortRelativePriority(items: InboxItem[]): InboxItem[] {
  return [...items]
    .filter((item) => isOpen(item) && item.kind === "task" && !hasDeadline(item))
    .sort((left, right) => getRelativePriorityScore(right) - getRelativePriorityScore(left));
}

export function sortByDeadline(items: InboxItem[]): InboxItem[] {
  return [...items]
    .filter((item) => isOpen(item) && item.kind === "task" && hasDeadline(item))
    .sort((left, right) => {
      const leftTime = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      const rightTime = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
      return leftTime - rightTime;
    });
}

export function sortIdeas(items: InboxItem[]): InboxItem[] {
  return [...items]
    .filter((item) => isOpen(item) && item.kind === "idea")
    .sort((left, right) => getRelativePriorityScore(right) - getRelativePriorityScore(left));
}

export function shouldShowGentleLock(items: InboxItem[]): boolean {
  return items.some((item) => isOpen(item) && item.kind === "task" && item.relativePriority === "p1");
}

function cloneDate(date: Date) {
  return new Date(date.getTime());
}

function setLocalTime(date: Date, hour: number, minute: number) {
  const next = cloneDate(date);
  next.setHours(hour, minute, 0, 0);
  return next;
}

function addDays(date: Date, days: number) {
  const next = cloneDate(date);
  next.setDate(next.getDate() + days);
  return next;
}

function startOfNextHour(date: Date) {
  const next = cloneDate(date);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  return next;
}

function isBeforeOrEqual(left: Date, right: Date) {
  return left.getTime() <= right.getTime();
}

function createReminder(item: InboxItem, scheduledFor: Date, reason: string): ReminderEvent {
  return {
    id: `${item.id}-${reason}-${scheduledFor.toISOString()}`,
    itemId: item.id,
    itemTitle: item.title,
    scheduledFor: scheduledFor.toISOString(),
    reason
  };
}

function getRelativePriorityReminders(item: InboxItem, now: Date): ReminderEvent[] {
  if (!isOpen(item) || item.kind !== "task" || item.dueAt) {
    return [];
  }

  if (item.relativePriority === "p1") {
    const reminders: ReminderEvent[] = [];
    let cursor = startOfNextHour(now);
    const dayEnd = setLocalTime(now, 23, 0);

    while (reminders.length < 3 && isBeforeOrEqual(cursor, dayEnd)) {
      reminders.push(createReminder(item, cursor, "P1 hourly reminder"));
      cursor = addDays(cursor, 0);
      cursor.setHours(cursor.getHours() + 1);
    }

    return reminders;
  }

  if (item.relativePriority === "p2") {
    const reminders: ReminderEvent[] = [];
    let cursor = setLocalTime(now, 16, 0);
    if (cursor.getTime() <= now.getTime()) {
      cursor = addDays(cursor, 1);
    }

    for (let count = 0; count < 3; count += 1) {
      reminders.push(createReminder(item, cursor, "P2 daily 4pm reminder"));
      cursor = addDays(cursor, 1);
    }

    return reminders;
  }

  if (item.relativePriority === "p3") {
    const reminders: ReminderEvent[] = [];
    const cursor = setLocalTime(now, 8, 0);
    const day = cursor.getDay();
    const daysUntilFriday = (5 - day + 7) % 7;
    let firstFriday = addDays(cursor, daysUntilFriday);

    if (firstFriday.getTime() <= now.getTime()) {
      firstFriday = addDays(firstFriday, 7);
    }

    reminders.push(createReminder(item, firstFriday, "P3 Friday 8am reminder"));
    reminders.push(createReminder(item, addDays(firstFriday, 7), "P3 Friday 8am reminder"));
    return reminders;
  }

  return [];
}

function getDueDateReminders(item: InboxItem): ReminderEvent[] {
  if (!isOpen(item) || !item.dueAt) {
    return [];
  }

  const due = new Date(item.dueAt);
  if (Number.isNaN(due.getTime())) {
    return [];
  }

  const dayBefore = addDays(due, -1);
  return [
    createReminder(item, setLocalTime(dayBefore, 15, 0), "Due date reminder: 3pm the day before"),
    createReminder(item, setLocalTime(due, 9, 0), "Due date reminder: 9am the day of"),
    createReminder(item, setLocalTime(due, 15, 0), "Due date reminder: 3pm the day of")
  ];
}

export function getUpcomingReminders(items: InboxItem[], now = new Date(), limit = 10): ReminderEvent[] {
  return items
    .flatMap((item) => [...getRelativePriorityReminders(item, now), ...getDueDateReminders(item)])
    .filter((reminder) => new Date(reminder.scheduledFor).getTime() > now.getTime())
    .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime())
    .slice(0, limit);
}
