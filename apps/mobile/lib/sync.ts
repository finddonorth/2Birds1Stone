import { createHttpSyncApi, createMockSyncApi, type SyncApi } from "@two-birds/api";
import { demoWorkspaceSnapshot } from "@two-birds/shared";
import { mobileSupabase } from "./supabase";

export const mobileWorkspaceId = process.env.EXPO_PUBLIC_DEFAULT_WORKSPACE_ID ?? "demo-workspace";

export function createMobileSyncApi(): SyncApi {
  const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;

  if (!baseUrl) {
    return createMockSyncApi(demoWorkspaceSnapshot);
  }

  return createHttpSyncApi({
    baseUrl,
    workspaceId: mobileWorkspaceId,
    getAccessToken: async () => {
      if (!mobileSupabase) {
        return undefined;
      }

      const {
        data: { session }
      } = await mobileSupabase.auth.getSession();

      return session?.access_token;
    }
  });
}
