import type { WorkspaceSnapshot } from "./models";

export const demoWorkspaceSnapshot: WorkspaceSnapshot = {
  goals: [
    { id: "goal-1", title: "Reduce mental clutter by capturing everything fast", priorityRank: 1 },
    { id: "goal-2", title: "Spend more time on the top leverage projects", priorityRank: 2 },
    { id: "goal-3", title: "Keep follow-ups and obligations from falling through the cracks", priorityRank: 3 }
  ],
  projects: [
    { id: "project-1", title: "2Birds1Stone MVP", priorityRank: 1 },
    { id: "project-2", title: "Speaking and content pipeline", priorityRank: 2 },
    { id: "project-3", title: "Operations and admin", priorityRank: 3 }
  ],
  topics: [
    { id: "topic-1", title: "Product", priorityRank: 1 },
    { id: "topic-2", title: "Growth", priorityRank: 2 },
    { id: "topic-3", title: "Personal systems", priorityRank: 3 }
  ],
  tags: ["voice-note", "deep-work", "quick-win", "follow-up", "admin", "idea-bank"],
  settings: {
    priorityGuidance:
      "Favor items tied to the top goals, time-sensitive commitments, and items that unblock momentum. Keep speculative ideas available but not distracting.",
    p1Label: "Today",
    p2Label: "End of Day",
    p3Label: "End of Week",
    p4Label: "Parking Lot",
    gentleLockEnabled: true
  },
  items: [
    {
      id: "item-1",
      kind: "task",
      status: "open",
      title: "Design first-run capture flow",
      notes: "Should feel possible in under ten seconds and support voice first.",
      tags: ["deep-work"],
      relativePriority: "p1",
      orderingMode: "ai",
      aiRank: 0.92,
      projectId: "project-1",
      topicId: "topic-1",
      isMultiDay: false,
      followUpContact: {
        id: "contact-1",
        fullName: "Mia Reynolds",
        email: "mia@example.com"
      },
      attachments: [
        {
          id: "attachment-1",
          fileName: "onboarding-sketch.pdf",
          mimeType: "application/pdf",
          url: "https://example.com/onboarding-sketch.pdf"
        }
      ]
    },
    {
      id: "item-2",
      kind: "task",
      status: "open",
      title: "Renew annual business filing",
      notes: "Needs to be done before the state deadline.",
      tags: ["admin", "quick-win"],
      relativePriority: "p2",
      orderingMode: "ai",
      aiRank: 0.44,
      projectId: "project-3",
      topicId: "topic-3",
      isMultiDay: true,
      dueAt: "2026-03-17T17:00:00.000Z",
      attachments: []
    },
    {
      id: "item-3",
      kind: "idea",
      status: "open",
      title: "Weekly AI review that summarizes unfinished work",
      notes: "Could help turn backlog into a calmer ritual.",
      tags: ["idea-bank"],
      relativePriority: "p3",
      orderingMode: "ai",
      aiRank: 0.71,
      projectId: "project-1",
      topicId: "topic-3",
      isMultiDay: false,
      attachments: []
    }
  ]
};
