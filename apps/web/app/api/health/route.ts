import { NextResponse } from "next/server";
import { hasServerSyncEnv } from "../../../lib/env";

export async function GET() {
  return NextResponse.json({
    ok: true,
    mode: hasServerSyncEnv() ? "supabase-auth-ready" : "mock"
  });
}
