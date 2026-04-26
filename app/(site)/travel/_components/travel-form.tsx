"use client";

import { useEffect, useState } from "react";
import { BedDouble, Bus, Car, ShoppingBag, Soup, Ticket } from "lucide-react";
import {
  BUDGET_CATEGORIES,
  DEFAULT_BUDGET_INCLUDES,
  DEFAULT_PLANNING_MODEL,
  PLANNING_MODELS,
  USER_PROMPT_MAX,
  parsePlanningModel,
  validateTravelInput,
  type BudgetCategory,
  type PlaceStats,
  type PlanningModel,
  type Stay,
  type TravelInput,
  type TravelInputValidationReason,
  type TravelPlan,
} from "@/lib/common/services/travel";
import { PlanCard } from "./plan-card";
import { PromptToolbar } from "./prompt-toolbar";
import { QuotaDebug, type LastCall } from "./quota-debug";
import { StayPicker } from "./stay-picker";

type FormState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; plan: TravelPlan; model?: string; planningModel: PlanningModel; placeStats?: PlaceStats }
  | { kind: "error"; message: string };

const ERROR_COOLDOWN_MS = 10_000;

export function TravelForm({
  initialInput,
  initialPlan,
  initialModel,
}: {
  initialInput?: TravelInput;
  initialPlan?: TravelPlan;
  initialModel?: string;
}) {
  const [destination, setDestination] = useState(initialInput?.destination ?? "");
  const [startDate, setStartDate] = useState(initialInput?.startDate ?? "");
  const [endDate, setEndDate] = useState(initialInput?.endDate ?? "");
  const [prompt, setPrompt] = useState(initialInput?.prompt ?? "");
  const [planningModel, setPlanningModel] = useState<PlanningModel>(
    initialInput?.planningModel ?? DEFAULT_PLANNING_MODEL,
  );
  const [budgetInput, setBudgetInput] = useState(
    initialInput?.budgetKrw ? String(initialInput.budgetKrw) : "",
  );
  const [budgetIncludes, setBudgetIncludes] = useState<BudgetCategory[]>(
    initialInput?.budgetIncludes ?? DEFAULT_BUDGET_INCLUDES,
  );
  const [stay, setStay] = useState<Stay | undefined>(initialInput?.stay);
  const [state, setState] = useState<FormState>(
    initialPlan
      ? {
          kind: "ok",
          plan: initialPlan,
          model: initialModel,
          planningModel: initialInput?.planningModel ?? DEFAULT_PLANNING_MODEL,
        }
      : { kind: "idle" },
  );
  const [planInput, setPlanInput] = useState<TravelInput | undefined>(
    initialPlan && initialInput ? initialInput : undefined,
  );
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
    const budgetKrw = parseBudgetField(budgetInput);
    const input: TravelInput = {
      destination,
      startDate,
      endDate,
      prompt,
      planningModel,
      ...(stay ? { stay } : {}),
      ...(budgetKrw !== undefined ? { budgetKrw, budgetIncludes } : {}),
    };
    const validation = validateTravelInput(input);
    if (!validation.ok) {
      setState({
        kind: "error",
        message: travelInputErrorMessage(validation.reason) ?? "입력값을 다시 확인해주세요.",
      });
      return;
    }
    const checkedInput = validation.input;
    setState({ kind: "loading" });

    try {
      const res = await fetch("/api/gemini", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ service: "travel", input: checkedInput }),
      });
      const json = (await res.json()) as Record<string, unknown>;

      if (!res.ok || json.status !== "ok") {
        setState({ kind: "error", message: friendlyErrorMessage(res.status, json) });
        startCooldown();
        return;
      }
      const model = typeof json.model === "string" ? json.model : undefined;
      const responsePlanningModel = parsePlanningModel(json.planningModel);
      const placeStats = extractPlaceStats(json.placeStats);
      const usage = extractUsage(json.usage);
      if (model && usage) setLastCall({ model, ...usage });
      setPlanInput(checkedInput);
      setState({
        kind: "ok",
        plan: json.plan as TravelPlan,
        model,
        planningModel: responsePlanningModel,
        placeStats,
      });
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
      <form onSubmit={onSubmit} className="rounded-2xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
        <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">
              brief
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight text-[var(--ink)]">
              여행 브리핑
            </h2>
          </div>
          <p className="max-w-sm text-sm leading-relaxed text-[var(--muted)]">
            누구와, 어떤 속도로, 무엇을 피하고 싶은지만 알려주세요. 나머지는 하나의 실행안으로 정리합니다.
          </p>
        </div>

        <div className="space-y-5">
          <Field label="어디로">
            <input
              required
              maxLength={80}
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              placeholder="예: 제주, 부산, 강릉"
              className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="출발">
              <input
                required
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </Field>
            <Field label="도착">
              <input
                required
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
              />
            </Field>
          </div>

          <details
            open={Boolean(budgetInput) || planningModel !== DEFAULT_PLANNING_MODEL || Boolean(stay)}
            className="rounded-2xl border border-[var(--line)] bg-white"
          >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-medium text-[var(--ink)]">
              <span>선택 옵션</span>
              <span className="text-xs font-normal text-[var(--muted)]">
                예산 · 숙소 · 추천 방식
              </span>
            </summary>
            <div className="space-y-5 border-t border-[var(--line)] p-4">
              <section className="space-y-3">
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between">
                  <div>
                    <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                      budget
                    </span>
                    <p className="mt-1 text-sm font-medium text-[var(--ink)]">
                      예산 <span className="text-xs font-normal text-[var(--muted)]">(선택)</span>
                    </p>
                  </div>
                  <p className="text-xs text-[var(--muted)]">초과되면 결과 화면에서 알려드려요</p>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formatBudgetDisplay(budgetInput)}
                    onChange={(e) => setBudgetInput(e.target.value.replace(/[^0-9]/g, ""))}
                    placeholder="예: 1,000,000"
                    className="w-full rounded-xl border border-[var(--line)] bg-white px-4 py-3 text-sm outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
                  />
                  <span className="shrink-0 text-sm text-[var(--muted)]">원</span>
                </div>
                <fieldset className="space-y-2">
                  <legend className="text-xs font-semibold text-[var(--muted)]">이 예산에 포함되는 것</legend>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
                    {BUDGET_CATEGORIES.map((opt) => (
                      <label
                        key={opt.id}
                        className={`flex cursor-pointer flex-col items-center gap-1 rounded-xl border p-2.5 text-center text-xs transition ${
                          budgetIncludes.includes(opt.id)
                            ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
                            : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)]"
                        }`}
                      >
                        <input
                          type="checkbox"
                          name="budgetIncludes"
                          value={opt.id}
                          checked={budgetIncludes.includes(opt.id)}
                          onChange={() => setBudgetIncludes((current) => toggleBudgetInclude(current, opt.id))}
                          className="sr-only"
                        />
                        <BudgetIcon id={opt.id} />
                        <span className="font-semibold">{opt.label}</span>
                        <span className="text-[10px]">{opt.hint}</span>
                      </label>
                    ))}
                  </div>
                </fieldset>
              </section>

              <StayPicker destination={destination} value={stay} onChange={setStay} />

              <section className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-[var(--muted)]">추천 방식</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    기본값은 속도와 장소 검증의 균형을 맞춘 방식입니다.
                  </p>
                </div>
                <div className="grid overflow-hidden rounded-xl border border-[var(--line)] bg-white md:grid-cols-3">
                  {PLANNING_MODELS.map((option) => (
                    <label
                      key={option.id}
                      className={`block cursor-pointer border-b border-[var(--line)] p-3 transition last:border-b-0 md:border-b-0 md:border-r md:last:border-r-0 ${
                        planningModel === option.id
                          ? "bg-[var(--accent-soft)]"
                          : "hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="radio"
                        name="planningModel"
                        value={option.id}
                        checked={planningModel === option.id}
                        onChange={() => setPlanningModel(option.id)}
                        className="sr-only"
                      />
                      <span className="block text-sm font-semibold text-[var(--ink)]">{option.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-[var(--muted)]">
                        {option.description}
                      </span>
                    </label>
                  ))}
                </div>
              </section>
            </div>
          </details>

          <div className="rounded-2xl border border-[var(--line)] bg-slate-50/70 p-4">
            <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <span className="block text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
                  context
                </span>
                <p className="mt-1 text-sm font-medium text-[var(--ink)]">요청사항</p>
              </div>
              <p className="text-xs text-[var(--muted)]">구성원 · 이동수단 · 피하고 싶은 것</p>
            </div>
            <PromptToolbar value={prompt} onChange={setPrompt} maxLength={USER_PROMPT_MAX} />
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value.slice(0, USER_PROMPT_MAX))}
              maxLength={USER_PROMPT_MAX}
              rows={6}
              placeholder="인원·이동수단·스타일·꼭 하고 싶은 것 등을 자유롭게 써주세요. 숙소는 위 선택 옵션에서 고를 수 있어요."
              className="mt-3 w-full resize-y rounded-xl border border-[var(--line)] bg-[var(--paper-strong)] px-4 py-3 text-sm leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <div className="mt-1 text-right text-xs text-[var(--muted)]">
              {prompt.length} / {USER_PROMPT_MAX}
            </div>
          </div>

          <button
            type="submit"
            disabled={state.kind === "loading" || isCoolingDown}
            className="w-full rounded-xl bg-[var(--accent)] px-4 py-3.5 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:translate-y-0 disabled:opacity-60"
          >
            {state.kind === "loading"
              ? "계획 맞추는 중…"
              : isCoolingDown
                ? `잠시만요 (${cooldownRemainingSec}초 뒤 다시 시도)`
                : "계획 만들기"}
          </button>
        </div>
      </form>

      {state.kind === "error" && (
        <p role="status" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-800">
          {state.message}
        </p>
      )}

      {state.kind === "ok" && (
        <PlanCard
          plan={state.plan}
          model={state.model}
          planningModel={state.planningModel}
          placeStats={state.placeStats}
          shareInput={planInput}
        />
      )}

      <QuotaDebug lastCall={lastCall} />
    </div>
  );
}

function toggleBudgetInclude(current: BudgetCategory[], id: BudgetCategory): BudgetCategory[] {
  return current.includes(id)
    ? current.filter((item) => item !== id)
    : [...current, id];
}

function BudgetIcon({ id }: { id: BudgetCategory }) {
  const className = "h-4 w-4";
  if (id === "lodging") return <BedDouble className={className} aria-hidden />;
  if (id === "rental") return <Car className={className} aria-hidden />;
  if (id === "transport") return <Bus className={className} aria-hidden />;
  if (id === "admission") return <Ticket className={className} aria-hidden />;
  if (id === "food") return <Soup className={className} aria-hidden />;
  return <ShoppingBag className={className} aria-hidden />;
}

function extractPlaceStats(raw: unknown): PlaceStats | undefined {
  if (typeof raw !== "object" || raw === null) return undefined;
  const r = raw as Record<string, unknown>;
  const totalPlaceQueries = typeof r.totalPlaceQueries === "number" ? r.totalPlaceQueries : undefined;
  const verifiedPlaces = typeof r.verifiedPlaces === "number" ? r.verifiedPlaces : undefined;
  const warnings = typeof r.warnings === "number" ? r.warnings : undefined;
  const destinationMismatches = typeof r.destinationMismatches === "number" ? r.destinationMismatches : undefined;
  const outlierRejects = typeof r.outlierRejects === "number" ? r.outlierRejects : undefined;
  const repairedPlaces = typeof r.repairedPlaces === "number" ? r.repairedPlaces : undefined;
  if (
    totalPlaceQueries === undefined ||
    verifiedPlaces === undefined ||
    warnings === undefined ||
    destinationMismatches === undefined ||
    outlierRejects === undefined ||
    repairedPlaces === undefined
  ) {
    return undefined;
  }
  return { totalPlaceQueries, verifiedPlaces, warnings, destinationMismatches, outlierRejects, repairedPlaces };
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
  if (reason === "all-models-blocked") {
    return rateLimitMessage(json) ?? "현재 모든 모델이 한도 초과 상태예요. 잠시 후 다시 시도해주세요.";
  }
  if (reason.includes("429")) {
    return rateLimitMessage(json) ?? "지금 많이 이용되고 있어요. 1~2분 뒤 다시 시도해주세요.";
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
  const inputMessage = travelInputErrorMessage(reason);
  if (inputMessage) return inputMessage;
  if (reason === "invalid-json" || reason === "invalid-input" || reason === "unknown-service") {
    return "입력값을 다시 확인해주세요.";
  }
  return `계획 생성 실패 (${reason || httpStatus || "unknown"})`;
}

type ParsedRateLimitHit = { dim: "rpm" | "tpm" | "rpd"; retryMs: number };

function parseRateLimitHits(raw: unknown): ParsedRateLimitHit[] {
  if (!Array.isArray(raw)) return [];
  const out: ParsedRateLimitHit[] = [];
  for (const item of raw) {
    if (typeof item !== "object" || item === null) continue;
    const r = item as Record<string, unknown>;
    const dim = r.dim;
    const retryMs = r.retryMs;
    if (
      (dim === "rpm" || dim === "tpm" || dim === "rpd") &&
      typeof retryMs === "number" &&
      Number.isFinite(retryMs)
    ) {
      out.push({ dim, retryMs });
    }
  }
  return out;
}

// dim 별로 사용자에게 다른 안내. RPD 는 retryMs 가 부정확할 수 있어 (Google ↔ Pacific 자정 차이)
// 한국시간 16-17시 복구로 안내한다.
function rateLimitMessage(json: Record<string, unknown>): string | undefined {
  const hits = parseRateLimitHits(json.rateLimitHits);
  if (hits.length === 0) return undefined;
  // 가장 영향이 큰 dim 우선: rpd > tpm > rpm
  const priority = { rpd: 3, tpm: 2, rpm: 1 } as const;
  const worst = hits.reduce((a, b) => (priority[a.dim] >= priority[b.dim] ? a : b));
  if (worst.dim === "rpd") {
    return "오늘 무료 한도가 모두 소진되었어요. 한국시간 16~17시 이후 자동 복구됩니다.";
  }
  if (worst.dim === "tpm") {
    return `토큰 한도를 일시 초과했어요. ${formatRetryWindow(worst.retryMs)} 뒤 다시 시도해주세요.`;
  }
  return `호출 빈도가 일시 초과됐어요. ${formatRetryWindow(worst.retryMs)} 뒤 다시 시도해주세요.`;
}

function formatRetryWindow(ms: number): string {
  if (ms < 60_000) return `${Math.max(1, Math.ceil(ms / 1000))}초`;
  if (ms < 60 * 60_000) return `${Math.ceil(ms / 60_000)}분`;
  const hours = Math.floor(ms / (60 * 60_000));
  return `${hours}시간`;
}

function travelInputErrorMessage(reason: unknown): string | undefined {
  const messages: Record<TravelInputValidationReason, string> = {
    "invalid-shape": "입력값을 다시 확인해주세요.",
    "missing-destination": "목적지를 입력해주세요.",
    "missing-start-date": "출발일을 선택해주세요.",
    "missing-end-date": "도착일을 선택해주세요.",
    "invalid-start-date": "출발일 형식을 다시 확인해주세요.",
    "invalid-end-date": "도착일 형식을 다시 확인해주세요.",
    "end-before-start": "도착일은 출발일과 같거나 더 늦어야 합니다.",
  };
  return typeof reason === "string" && reason in messages
    ? messages[reason as TravelInputValidationReason]
    : undefined;
}

function parseBudgetField(raw: string): number | undefined {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return undefined;
  const n = Number(digits);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function formatBudgetDisplay(raw: string): string {
  const digits = raw.replace(/[^0-9]/g, "");
  if (!digits) return "";
  return Number(digits).toLocaleString("ko-KR");
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1.5">
      <span className="text-xs font-semibold text-[var(--muted)]">{label}</span>
      {children}
    </label>
  );
}
