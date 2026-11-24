import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { TournamentData } from "./types";

const TABLE_NAME = "tournament_state";
const TOURNAMENT_ID = "winter-tour-26-27";

let client: SupabaseClient | undefined;

export function getSharedStorageConfiguration(): "disabled" | "enabled" | "incomplete" {
  const hasUrl = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const hasKey = Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  if (hasUrl !== hasKey) return "incomplete";
  return hasUrl ? "enabled" : "disabled";
}

function getClient(): SupabaseClient {
  const configuration = getSharedStorageConfiguration();
  if (configuration !== "enabled") {
    throw new Error("Supabase URL and anonymous key must both be configured.");
  }
  if (!client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonymousKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !anonymousKey) throw new Error("Supabase configuration is incomplete.");
    client = createClient(url, anonymousKey);
  }
  return client;
}

async function loadStoredData(): Promise<unknown | null> {
  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .select("data")
    .eq("id", TOURNAMENT_ID)
    .maybeSingle();

  if (error) throw error;
  return data?.data ?? null;
}

export async function loadOrCreateSharedTournamentData(seed: TournamentData): Promise<unknown> {
  const existing = await loadStoredData();
  if (existing !== null) return existing;

  const { data, error } = await getClient()
    .from(TABLE_NAME)
    .insert({ id: TOURNAMENT_ID, data: seed })
    .select("data")
    .single();

  if (!error) return data.data;
  if (error.code !== "23505") throw error;

  const createdByAnotherClient = await loadStoredData();
  if (createdByAnotherClient === null) {
    throw new Error("The shared tournament record was not available after initialization.");
  }
  return createdByAnotherClient;
}

export async function saveSharedTournamentData(data: TournamentData): Promise<void> {
  const { error } = await getClient()
    .from(TABLE_NAME)
    .upsert(
      { id: TOURNAMENT_ID, data, updated_at: new Date().toISOString() },
      { onConflict: "id" },
    );

  if (error) throw error;
}
