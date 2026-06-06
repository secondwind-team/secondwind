import { neon, type NeonQueryFunction } from "@neondatabase/serverless";
import type {
  FinzCharacter,
  FinzDailyPick,
  FinzProfile,
} from "@/lib/common/services/finz";
import { finzProfileKey } from "@/lib/common/services/finz";

export type StoredFinzProfile = FinzProfile & {
  userEmail: string;
  userName: string | null;
  updatedAt: string;
};

export type StoredFinzDailyPick = {
  id: string;
  userEmail: string;
  pickDate: string;
  profileKey: string | null;
  profile: FinzProfile;
  pick: FinzDailyPick;
  model: string | null;
  promptVersion: string | null;
  createdAt: string;
};

let client: NeonQueryFunction<false, false> | null = null;
let schemaReady: Promise<void> | null = null;

function getSql() {
  if (client) return client;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is not configured");
  }
  client = neon(databaseUrl);
  return client;
}

async function ensureSchema() {
  if (!schemaReady) {
    const sql = getSql();
    schemaReady = (async () => {
      await sql`
        CREATE TABLE IF NOT EXISTS finz_profiles (
          user_email TEXT PRIMARY KEY,
          user_name TEXT,
          selected_card_ids JSONB NOT NULL,
          character JSONB NOT NULL,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        )
      `;
      await sql`
        CREATE TABLE IF NOT EXISTS finz_daily_picks (
          id TEXT PRIMARY KEY,
          user_email TEXT NOT NULL,
          pick_date TEXT NOT NULL,
          profile_key TEXT,
          profile_snapshot JSONB NOT NULL,
          pick JSONB NOT NULL,
          model TEXT,
          prompt_version TEXT,
          usage JSONB,
          created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          UNIQUE (user_email, pick_date)
        )
      `;
      await sql`
        ALTER TABLE finz_daily_picks
        ADD COLUMN IF NOT EXISTS profile_key TEXT
      `;
    })();
  }
  return schemaReady;
}

export async function getFinzProfile(userEmail: string): Promise<StoredFinzProfile | null> {
  await ensureSchema();
  const [row] = await getSql()`
    SELECT user_email, user_name, selected_card_ids, character, updated_at
    FROM finz_profiles
    WHERE user_email = ${userEmail}
    LIMIT 1
  `;
  if (!row) return null;

  const selectedCardIds = asStringArray(row.selected_card_ids);
  const character = row.character as FinzCharacter;

  return {
    userEmail: row.user_email as string,
    userName: (row.user_name as string | null) ?? null,
    selectedCardIds,
    selectedCards: [],
    selectedTags: [],
    character,
    updatedAt: toIso(row.updated_at),
  };
}

export async function upsertFinzProfile(input: {
  userEmail: string;
  userName: string | null;
  profile: FinzProfile;
}): Promise<void> {
  await ensureSchema();
  await getSql()`
    INSERT INTO finz_profiles (user_email, user_name, selected_card_ids, character, updated_at)
    VALUES (
      ${input.userEmail},
      ${input.userName},
      ${JSON.stringify(input.profile.selectedCardIds)}::jsonb,
      ${JSON.stringify(input.profile.character)}::jsonb,
      NOW()
    )
    ON CONFLICT (user_email) DO UPDATE SET
      user_name = EXCLUDED.user_name,
      selected_card_ids = EXCLUDED.selected_card_ids,
      character = EXCLUDED.character,
      updated_at = NOW()
  `;
}

export async function getDailyPick(input: {
  userEmail: string;
  pickDate: string;
  profileKey?: string;
}): Promise<StoredFinzDailyPick | null> {
  await ensureSchema();
  const profileKey = input.profileKey ?? null;
  const [row] = await getSql()`
    SELECT id, user_email, pick_date, profile_key, profile_snapshot, pick, model, prompt_version, created_at
    FROM finz_daily_picks
    WHERE
      user_email = ${input.userEmail}
      AND pick_date = ${input.pickDate}
      AND (${profileKey}::text IS NULL OR profile_key = ${profileKey})
    LIMIT 1
  `;
  if (!row) return null;
  return rowToPick(row);
}

export async function upsertDailyPick(input: {
  userEmail: string;
  pickDate: string;
  profile: FinzProfile;
  pick: FinzDailyPick;
  model: string | null;
  promptVersion: string | null;
  usage: unknown;
}): Promise<StoredFinzDailyPick> {
  await ensureSchema();
  const id = crypto.randomUUID();
  const profileKey = finzProfileKey(input.profile);
  const [row] = await getSql()`
    INSERT INTO finz_daily_picks (
      id,
      user_email,
      pick_date,
      profile_key,
      profile_snapshot,
      pick,
      model,
      prompt_version,
      usage
    )
    VALUES (
      ${id},
      ${input.userEmail},
      ${input.pickDate},
      ${profileKey},
      ${JSON.stringify(input.profile)}::jsonb,
      ${JSON.stringify(input.pick)}::jsonb,
      ${input.model},
      ${input.promptVersion},
      ${JSON.stringify(input.usage ?? null)}::jsonb
    )
    ON CONFLICT (user_email, pick_date) DO UPDATE SET
      profile_key = EXCLUDED.profile_key,
      profile_snapshot = EXCLUDED.profile_snapshot,
      pick = EXCLUDED.pick,
      model = EXCLUDED.model,
      prompt_version = EXCLUDED.prompt_version,
      usage = EXCLUDED.usage,
      created_at = NOW()
    RETURNING id, user_email, pick_date, profile_key, profile_snapshot, pick, model, prompt_version, created_at
  `;
  if (!row) {
    throw new Error("finz-daily-pick-upsert-failed");
  }
  return rowToPick(row);
}

function rowToPick(row: Record<string, unknown>): StoredFinzDailyPick {
  return {
    id: row.id as string,
    userEmail: row.user_email as string,
    pickDate: row.pick_date as string,
    profileKey: (row.profile_key as string | null) ?? null,
    profile: row.profile_snapshot as FinzProfile,
    pick: row.pick as FinzDailyPick,
    model: (row.model as string | null) ?? null,
    promptVersion: (row.prompt_version as string | null) ?? null,
    createdAt: toIso(row.created_at),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}

function toIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  if (typeof value === "string") return value;
  return new Date().toISOString();
}
