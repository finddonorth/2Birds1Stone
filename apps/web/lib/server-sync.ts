import { classifyWithOpenAI, createMockSyncApi, createSupabaseServerClient, createSupabaseSyncApi } from "@two-birds/api";
import { demoWorkspaceSnapshot } from "@two-birds/shared";
import { env, hasServerSyncEnv } from "./env";

export function getServerSyncApi() {
  if (!hasServerSyncEnv() || !env.supabaseUrl || !env.supabaseServiceRoleKey) {
    return createMockSyncApi(demoWorkspaceSnapshot);
  }

  const client = createSupabaseServerClient({
    url: env.supabaseUrl,
    serviceRoleKey: env.supabaseServiceRoleKey
  });

  return createSupabaseSyncApi({
    client,
    classify: async (input, snapshot) => {
      if (!env.openAIApiKey) {
        const mockApi = createMockSyncApi(snapshot);
        const created = await mockApi.createInboxItem(env.defaultWorkspaceId, input);
        return {
          kind: created.kind,
          suggestedPriority: created.relativePriority,
          projectId: created.projectId,
          topicId: created.topicId,
          tags: created.tags,
          reasoning: created.aiSuggestedSummary?.reasoning ?? "Heuristic classifier used because OPENAI_API_KEY is not set."
        };
      }

      try {
        return await classifyWithOpenAI({
          apiKey: env.openAIApiKey,
          model: env.openAIModel,
          input,
          snapshot
        });
      } catch (error) {
        const mockApi = createMockSyncApi(snapshot);
        const created = await mockApi.createInboxItem(env.defaultWorkspaceId, input);
        const fallbackReason =
          error instanceof Error
            ? `OpenAI unavailable, so heuristic sorting was used instead. ${error.message}`
            : "OpenAI unavailable, so heuristic sorting was used instead.";

        return {
          kind: created.kind,
          suggestedPriority: created.relativePriority,
          projectId: created.projectId,
          topicId: created.topicId,
          tags: created.tags,
          reasoning: fallbackReason
        };
      }
    }
  });
}
