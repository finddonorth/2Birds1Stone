import OpenAI from "openai";
import type { RankedEntity, WorkspaceSnapshot } from "@two-birds/shared";
import type { AIClassificationResult, CreateInboxItemInput } from "./index";

function asPriorityList(items: RankedEntity[]): string[] {
  return items
    .sort((left, right) => left.priorityRank - right.priorityRank)
    .map((item) => `${item.priorityRank}. ${item.title}`);
}

export async function classifyWithOpenAI(options: {
  apiKey: string;
  model?: string;
  input: CreateInboxItemInput;
  snapshot: WorkspaceSnapshot;
}): Promise<AIClassificationResult> {
  const client = new OpenAI({ apiKey: options.apiKey });
  const model = options.model ?? "gpt-5-mini";

  const response = await client.responses.create({
    model,
    reasoning: {
      effort: "low"
    },
    input: [
      {
        role: "developer",
        content: [
          {
            type: "input_text",
            text:
              "You classify captures for a productivity app. Return JSON only. Respect existing goals, projects, topics, tags, urgency, and whether the user marked this as an idea or task."
          }
        ]
      },
      {
        role: "user",
        content: [
          {
            type: "input_text",
            text: JSON.stringify({
              capture: options.input,
              goals: asPriorityList(options.snapshot.goals),
              projects: asPriorityList(options.snapshot.projects),
              topics: asPriorityList(options.snapshot.topics),
              tags: options.snapshot.tags,
              priorityGuidance: options.snapshot.settings.priorityGuidance
            })
          }
        ]
      }
    ],
    text: {
      format: {
        type: "json_schema",
        name: "capture_classification",
        strict: true,
        schema: {
          type: "object",
          additionalProperties: false,
          properties: {
            kind: {
              type: "string",
              enum: ["idea", "task"]
            },
            suggestedPriority: {
              type: "string",
              enum: ["p1", "p2", "p3", "p4"]
            },
            projectId: {
              type: ["string", "null"]
            },
            topicId: {
              type: ["string", "null"]
            },
            tags: {
              type: "array",
              items: {
                type: "string"
              }
            },
            reasoning: {
              type: "string"
            }
          },
          required: ["kind", "suggestedPriority", "projectId", "topicId", "tags", "reasoning"]
        }
      }
    }
  });

  const outputText = response.output_text;
  if (!outputText) {
    throw new Error("OpenAI classification returned no output text.");
  }

  const parsed = JSON.parse(outputText) as {
    kind: "idea" | "task";
    suggestedPriority: "p1" | "p2" | "p3" | "p4";
    projectId: string | null;
    topicId: string | null;
    tags: string[];
    reasoning: string;
  };

  return {
    kind: parsed.kind,
    suggestedPriority: parsed.suggestedPriority,
    projectId: parsed.projectId ?? undefined,
    topicId: parsed.topicId ?? undefined,
    tags: parsed.tags,
    reasoning: parsed.reasoning
  };
}
