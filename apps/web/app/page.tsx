import { redirect } from "next/navigation";
import { demoWorkspaceSnapshot } from "@two-birds/shared";
import {
  addSetupEntryAction,
  captureItemAction,
  deleteSetupEntryAction,
  moveSetupEntryAction,
  sendReminderEmailsAction,
  updateItemAction,
  updateSetupSettingsAction
} from "./actions";
import { DashboardClient } from "./dashboard-client";
import { env, hasServerSyncEnv } from "../lib/env";
import { getServerSyncApi } from "../lib/server-sync";
import { createSupabaseServerAuthClient } from "../lib/supabase/server";
import { ensureWorkspaceForUser } from "../lib/workspaces";

export default async function HomePage({
  searchParams
}: {
  searchParams: Promise<{ message?: string }>;
}) {
  const params = await searchParams;

  if (!hasServerSyncEnv()) {
    return (
      <DashboardClient
        initialSnapshot={demoWorkspaceSnapshot}
        workspaceId={env.defaultWorkspaceId}
        initialMessage={params.message}
        captureAction={captureItemAction}
        updateSettingsAction={updateSetupSettingsAction}
        addSetupEntry={addSetupEntryAction}
        deleteSetupEntry={deleteSetupEntryAction}
        moveSetupEntry={moveSetupEntryAction}
        sendRemindersAction={sendReminderEmailsAction}
        updateItemAction={updateItemAction}
      />
    );
  }

  const supabase = await createSupabaseServerAuthClient();
  const {
    data: { user }
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const workspaceId = await ensureWorkspaceForUser(user.id);
  const api = getServerSyncApi();
  const snapshot = await api.getWorkspaceSnapshot(workspaceId);

  return (
    <DashboardClient
      initialSnapshot={snapshot}
      workspaceId={workspaceId}
      initialMessage={params.message}
      captureAction={captureItemAction}
      updateSettingsAction={updateSetupSettingsAction}
      addSetupEntry={addSetupEntryAction}
      deleteSetupEntry={deleteSetupEntryAction}
      moveSetupEntry={moveSetupEntryAction}
      sendRemindersAction={sendReminderEmailsAction}
      updateItemAction={updateItemAction}
    />
  );
}
