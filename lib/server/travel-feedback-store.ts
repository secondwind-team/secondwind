// 서버 전용: travel 피드백과 버그리포트를 Upstash Redis 에 저장한다.

import { Redis } from "@upstash/redis";
import { randomBytes } from "crypto";
import {
  isTravelPlan,
  normalizeTravelInput,
  type TravelInput,
  type TravelPlan,
} from "@/lib/common/services/travel";

export const TRAVEL_FEEDBACK_TTL_SECONDS = 30 * 24 * 60 * 60;
export const TRAVEL_FEEDBACK_SCHEMA_VERSION = 1;

const ID_LENGTH = 8;
const MAX_ID_ATTEMPTS = 12;
const ID_CHARS = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const INDEX_KEY = "sw:travel:feedback:index";
const INDEX_LIMIT = 500;

export type TravelFeedbackCategory = "bug" | "quality" | "other";

export type TravelFeedbackInput = {
  category: TravelFeedbackCategory;
  message: string;
  input?: TravelInput;
  draftInput?: TravelFeedbackDraftInput;
  plan?: TravelPlan;
  model?: string;
  pagePath?: string;
  context?: string;
  userAgent?: string;
};

export type TravelFeedbackDraftInput = {
  destination?: string;
  startDate?: string;
  endDate?: string;
  prompt?: string;
  planningModel?: string;
  budgetKrw?: number;
  budgetScope?: string;
  budgetIncludes?: string[];
  stayName?: string;
};

export type TravelFeedbackRecord = {
  schemaVersion: typeof TRAVEL_FEEDBACK_SCHEMA_VERSION;
  category: TravelFeedbackCategory;
  message: string;
  input?: TravelInput;
  draftInput?: TravelFeedbackDraftInput;
  plan?: TravelPlan;
  model?: string;
  pagePath?: string;
  context?: string;
  userAgent?: string;
  createdAt: string;
  expiresAt: string;
};

let cachedClient: Redis | null | undefined;

function getClient(): Redis | null {
  if (cachedClient === undefined) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;
    cachedClient = url && token ? new Redis({ url, token }) : null;
  }
  return cachedClient;
}

export function isTravelFeedbackConfigured(): boolean {
  return getClient() !== null;
}

export function normalizeFeedbackCategory(raw: unknown): TravelFeedbackCategory | null {
  return raw === "bug" || raw === "quality" || raw === "other" ? raw : null;
}

export function normalizeFeedbackMessage(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const message = raw.trim().slice(0, 1000);
  return message.length >= 3 ? maskSensitiveText(message) : null;
}

export function normalizeFeedbackDraftInput(raw: unknown): TravelFeedbackDraftInput | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const out: TravelFeedbackDraftInput = {};
  if (typeof r.destination === "string") out.destination = maskSensitiveText(r.destination.trim().slice(0, 80));
  if (typeof r.startDate === "string") out.startDate = r.startDate.slice(0, 20);
  if (typeof r.endDate === "string") out.endDate = r.endDate.slice(0, 20);
  if (typeof r.prompt === "string") out.prompt = maskSensitiveText(r.prompt.trim().slice(0, 1000));
  if (typeof r.planningModel === "string") out.planningModel = r.planningModel.slice(0, 30);
  if (typeof r.budgetKrw === "number" && Number.isFinite(r.budgetKrw) && r.budgetKrw > 0) {
    out.budgetKrw = Math.round(r.budgetKrw);
  }
  if (typeof r.budgetScope === "string") out.budgetScope = r.budgetScope.slice(0, 30);
  if (Array.isArray(r.budgetIncludes)) {
    const budgetIncludes = r.budgetIncludes
      .filter((item): item is string => typeof item === "string")
      .map((item) => item.slice(0, 30))
      .slice(0, 10);
    if (budgetIncludes.length > 0) out.budgetIncludes = budgetIncludes;
  }
  const stay = typeof r.stay === "object" && r.stay !== null ? (r.stay as Record<string, unknown>) : undefined;
  if (typeof stay?.name === "string") out.stayName = maskSensitiveText(stay.name.trim().slice(0, 120));
  return Object.keys(out).length > 0 ? out : undefined;
}

export async function createTravelFeedback(feedback: TravelFeedbackInput): Promise<{
  id: string;
  record: TravelFeedbackRecord;
} | null> {
  const redis = getClient();
  if (!redis) return null;

  const input = feedback.input ? normalizeTravelInput(feedback.input) : null;
  if (feedback.input && !input) {
    throw new Error("invalid-feedback-snapshot");
  }
  if (feedback.plan !== undefined && !isTravelPlan(feedback.plan)) {
    throw new Error("invalid-feedback-snapshot");
  }
  const draftInput = feedback.draftInput ? normalizeFeedbackDraftInput(feedback.draftInput) : undefined;

  const now = Date.now();
  const record: TravelFeedbackRecord = {
    schemaVersion: TRAVEL_FEEDBACK_SCHEMA_VERSION,
    category: feedback.category,
    message: feedback.message,
    input: input
      ? {
          ...input,
          prompt: maskSensitiveText(input.prompt),
        }
      : undefined,
    draftInput,
    plan: feedback.plan,
    model: feedback.model,
    pagePath: feedback.pagePath,
    context: feedback.context ? maskSensitiveText(feedback.context) : undefined,
    userAgent: feedback.userAgent,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + TRAVEL_FEEDBACK_TTL_SECONDS * 1000).toISOString(),
  };

  for (let attempt = 0; attempt < MAX_ID_ATTEMPTS; attempt += 1) {
    const id = generateFeedbackId();
    const key = feedbackKey(id);
    const exists = await redis.exists(key);
    if (exists) continue;
    await redis.set(key, JSON.stringify(record), { ex: TRAVEL_FEEDBACK_TTL_SECONDS });
    await redis.lpush(INDEX_KEY, id);
    await redis.ltrim(INDEX_KEY, 0, INDEX_LIMIT - 1);
    return { id, record };
  }

  throw new Error("feedback-id-collision");
}

function feedbackKey(id: string): string {
  return `sw:travel:feedback:${id}`;
}

function generateFeedbackId(): string {
  const bytes = randomBytes(ID_LENGTH);
  let out = "";
  for (const byte of bytes) {
    out += ID_CHARS[byte % ID_CHARS.length];
  }
  return out;
}

function maskSensitiveText(value: string): string {
  return value
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email]")
    .replace(/(?:\+?82[-.\s]?)?0?1[016789][-\s.]?\d{3,4}[-\s.]?\d{4}/g, "[phone]");
}
