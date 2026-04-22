"use client";

import { useState } from "react";
import {
  PARTY_LABELS,
  USER_PROMPT_MAX,
  partyTotal,
  type PartyKey,
  type TravelInput,
  type TravelParty,
  type TravelPlan,
} from "@/lib/common/services/travel";
import { PlanCard } from "./plan-card";

type FormState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; plan: TravelPlan }
  | { kind: "error"; message: string };

const DEFAULT_PARTY: TravelParty = { adults: 2, teens: 0, kids: 0, infants: 0 };
const EXTRA_KEYS: PartyKey[] = ["teens", "kids", "infants"];

export function TravelForm() {
  const [destination, setDestination] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [party, setParty] = useState<TravelParty>(DEFAULT_PARTY);
  const [partyDetailed, setPartyDetailed] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [state, setState] = useState<FormState>({ kind: "idle" });

  const total = partyTotal(party);

  function setPartyCount(k: PartyKey, n: number) {
    setParty((p) => ({ ...p, [k]: Math.max(0, Math.min(20, n)) }));
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (total < 1) {
      setState({ kind: "error", message: "인원을 최소 1명 이상 입력해주세요." });
      return;
    }
    const input: TravelInput = { destination, startDate, endDate, party, prompt };
    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: "travel", input }),
      });
      const json = (await res.json()) as Record<string, unknown>;

      if (res.status === 503 && json.status === "not-configured") {
        setState({
          kind: "error",
          message: "Gemini API 키가 아직 연결되지 않았습니다 (GEMINI_API_KEY 환경변수 설정 필요).",
        });
        return;
      }
      if (!res.ok || json.status !== "ok") {
        setState({
          kind: "error",
          message: `계획 생성 실패: ${String(json.reason ?? res.statusText)}`,
        });
        return;
      }
      setState({ kind: "ok", plan: json.plan as TravelPlan });
    } catch (err) {
      setState({
        kind: "error",
        message: `네트워크 오류: ${err instanceof Error ? err.message : "unknown"}`,
      });
    }
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
            placeholder="예: 제주, 후쿠오카"
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

        <Field label={`인원 (총 ${total}명)`}>
          <div className="space-y-2">
            <PartyRow
              k="adults"
              label={PARTY_LABELS.adults}
              value={party.adults}
              onChange={(n) => setPartyCount("adults", n)}
            />
            {partyDetailed &&
              EXTRA_KEYS.map((k) => (
                <PartyRow
                  key={k}
                  k={k}
                  label={PARTY_LABELS[k]}
                  value={party[k]}
                  onChange={(n) => setPartyCount(k, n)}
                />
              ))}
            <button
              type="button"
              onClick={() => setPartyDetailed((v) => !v)}
              className="text-xs text-neutral-500 underline decoration-dotted underline-offset-4 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              {partyDetailed ? "− 단순화" : "+ 청소년·어린이·영유아 추가"}
            </button>
          </div>
        </Field>

        <Field label="요청사항 (선택)">
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value.slice(0, USER_PROMPT_MAX))}
            maxLength={USER_PROMPT_MAX}
            rows={4}
            placeholder="원하는 스타일·제약·꼭 하고 싶은 것을 자유롭게 써주세요. 예: 아이 둘과 함께, 디저트 카페 많이, 차 없이 대중교통만"
            className="w-full resize-y rounded-md border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          />
          <div className="text-right text-xs text-neutral-400">
            {prompt.length} / {USER_PROMPT_MAX}
          </div>
        </Field>

        <button
          type="submit"
          disabled={state.kind === "loading"}
          className="w-full rounded-md bg-neutral-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:opacity-60 dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-neutral-200"
        >
          {state.kind === "loading" ? "계획 맞추는 중…" : "계획 만들기"}
        </button>
      </form>

      {state.kind === "error" && (
        <p role="status" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-800/40 dark:bg-amber-950/30 dark:text-amber-300">
          {state.message}
        </p>
      )}

      {state.kind === "ok" && <PlanCard plan={state.plan} />}
    </div>
  );
}

function PartyRow({
  k,
  label,
  value,
  onChange,
}: {
  k: PartyKey;
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-16 text-sm text-neutral-600 dark:text-neutral-300">{label}</span>
      <div className="flex items-center gap-1.5">
        <button
          type="button"
          aria-label={`${label} 감소`}
          onClick={() => onChange(value - 1)}
          disabled={value <= 0}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          −
        </button>
        <input
          type="number"
          min={0}
          max={20}
          value={value}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={`${label} 수`}
          className="h-9 w-14 rounded-md border border-neutral-300 bg-white px-2 text-center text-sm outline-none focus:border-neutral-500 dark:border-neutral-700 dark:bg-neutral-900"
          data-party-key={k}
        />
        <button
          type="button"
          aria-label={`${label} 증가`}
          onClick={() => onChange(value + 1)}
          disabled={value >= 20}
          className="flex h-9 w-9 items-center justify-center rounded-md border border-neutral-300 text-sm disabled:opacity-40 dark:border-neutral-700"
        >
          +
        </button>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-medium text-neutral-500">{label}</span>
      {children}
    </label>
  );
}
