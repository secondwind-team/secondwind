"use client";

import { useEffect, useState } from "react";
import {
  USER_PROMPT_MAX,
  type TravelInput,
  type TravelPlan,
} from "@/lib/common/services/travel";
import { PlanCard } from "./plan-card";
import { PromptToolbar } from "./prompt-toolbar";
import { QuotaDebug, type LastCall } from "./quota-debug";

type FormState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; plan: TravelPlan; model?: string }
  | { kind: "error"; message: string };

const ERROR_COOLDOWN_MS = 10_000;

export function TravelForm() {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [lastCall, setLastCall] = useState<LastCall | undefined>(undefined);

  useEffect(() => {
    if (cooldownUntil <= Date.now()) return;
    const id = setInterval(() => {
      const t = Date.now();
      setNow(t);
      if (t >= cooldownUntil) clearInterval(id);
    }, 500);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  const cooldownRemainingSec = Math.max(0, Math.ceil((cooldownUntil - now) / 1000));
  const isCoolingDown = cooldownRemainingSec > 0;

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isCoolingDown) return;
    const input: TravelInput = { destination, startDate, endDate, prompt };
    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: "travel", input }),
      });
      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok || json.status !== "ok") {
        setState({ kind: "error", message: friendlyErrorMessage(res.status, json) });
        startCooldown();
        return;
      }
      const model = typeof json.model === "string" ? json.model : undefined;
      const usage = extractUsage(json.usage);
      if (model && usage) setLastCall({ model, ...usage });
      setState({ kind: "ok", plan: json.plan as TravelPlan, model });
    } catch (err) {
      setState({
        kind: "error",
        message: `네트워크 오류: ${err instanceof Error ? err.message : "unknown"}`,
      });
      startCooldown();
    }
  }

  function startCooldown() {
    const until = Date.now() + ERROR_COOLDOWN_MS;
    setCooldownUntil(until);
    setNow(Date.now());
  }

  return (
    <div className="space-y-8">
      <form onSubmit={onSubmit} className="space-y-5">
        <Field label="어디로">
          <input
            required
            maxLength={80}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder="예: 제주, 부산, 강릉"
            className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="출발">
            <input
              required
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </Field>
          <Field label="도착">
            <input
              required
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
            />
          </Field>
        </div>

        <div className="space-y-1.5">
          <span className="block text-xs font-medium text-neutral-500">요청사항</span>
          <PromptToolbar value={prompt} onChange={setPrompt} maxLength={USER_PROMPT_MAX} />
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, USER_PROMPT_MAX))}
            maxLength={USER_PROMPT_MAX}
            rows={6}
            placeholder="인원·이동수단·숙소·스타일·꼭 하고 싶은 것 등을 자유롭게 써주세요. 빈 상자가 막막하면 위의 '가이드 양식' 또는 '예시 보기' 를 눌러보세요."
            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="text-right text-xs text-neutral-400">
            {prompt.length} / {USER_PROMPT_MAX}
          </div>
        </div>

        <button
          type="submit"
          disabled={state.kind === "loading" || isCoolingDown}
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {state.kind === "loading"
            ? "계획 맞추는 중…"
            : isCoolingDown
              ? `잠시만요 (${cooldownRemainingSec}초 뒤 다시 시도)`
              : "계획 만들기"}
        </button>
      </form>

      {state.kind === "error" && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
          {state.message}
        </p>
      )}

      {state.kind === "ok" && <PlanCard plan={state.plan} model={state.model} />}

      <QuotaDebug lastCall={lastCall} />
    </div>
  );
}

function extractUsage(raw: unknown): Omit<LastCall, "model"> | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const prompt = typeof r.prompt === "number" ? r.prompt : undefined;
  const output = typeof r.output === "number" ? r.output : undefined;
  const total = typeof r.total === "number" ? r.total : undefined;
  if (prompt === undefined || output === undefined || total === undefined) return undefined;
  const thoughts = typeof r.thoughts === "number" ? r.thoughts : undefined;
  return thoughts !== undefined ? { prompt, output, thoughts, total } : { prompt, output, total };
}

function friendlyErrorMessage(httpStatus: number, json: Record<string, unknown>): string {
  const status = typeof json.status === "string" ? json.status : "";
  const reason = typeof json.reason === "string" ? json.reason : "";

  if (status === "not-configured") {
    return "Gemini API 키가 아직 연결되지 않았습니다 (서버 환경변수 설정 필요).";
  }
  if (status === "disabled") {
    return "점검 중입니다. 잠시 후 다시 시도해주세요.";
  }
  if (reason.includes("429")) {
    return "지금 많이 이용되고 있어요. 1~2분 뒤 다시 시도해주세요.";
  }
  if (reason.includes("timeout")) {
    return "응답이 늦어 중단됐어요. 다시 시도해주세요.";
  }
  if (reason.startsWith("upstream")) {
    return "Gemini 응답에 문제가 있었습니다. 잠시 후 다시 시도해주세요.";
  }
  if (status === "invalid-response") {
    return "받은 플랜을 이해하지 못했어요. 요청 사항을 조금 구체화하고 다시 시도해주세요.";
  }
  if (reason === "invalid-json" || reason === "invalid-input" || reason === "unknown-service") {
    return "입력값을 다시 확인해주세요.";
  }
  return `계획 생성 실패 (${reason || httpStatus || "unknown"})`;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
