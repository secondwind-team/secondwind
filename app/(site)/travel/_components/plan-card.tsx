"use client";

import { Fragment, useEffect, useMemo, useState } from "react";
import { Bug, CheckCircle2, MessageSquare, Send } from "lucide-react";
import {
  computeBudget,
  enumeratePoints,
  evaluateBudget,
  getBudgetScopeInfo,
  getPlanningModelInfo,
  type BudgetCheck,
  type PlaceStats,
  type PlanningModel,
  type TravelInput,
  type TransitInfo,
  type TravelItem,
  type TravelPlan,
} from "@/lib/common/services/travel";
import { MapView, type LegsByItem, type OsrmLeg } from "./map-view";
import { PlacePopup } from "./place-popup";

const DAY_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#c026d3"];

export function PlanCard({
  plan,
  model,
  planningModel,
  placeStats,
  shareInput,
}: {
  plan: TravelPlan;
  model?: string;
  planningModel?: PlanningModel;
  placeStats?: PlaceStats;
  shareInput?: TravelInput;
}) {
  const budget = computeBudget(plan);
  const budgetCheck = evaluateBudget(budget, shareInput?.budgetKrw, shareInput?.budgetScope);
  const labelByItem = new Map(enumeratePoints(plan).map((p) => [p.item, p.label]));
  const [legsByItem, setLegsByItem] = useState<LegsByItem | null>(null);
  const [mapItem, setMapItem] = useState<TravelItem | null>(null);
  const firstDay = plan.days[0]?.label ?? "여행";
  const confirmationKey = useMemo(() => buildConfirmationKey(plan, shareInput), [plan, shareInput]);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    try {
      setConfirmed(window.localStorage.getItem(confirmationKey) === "true");
    } catch {
      setConfirmed(false);
    }
  }, [confirmationKey]);

  function confirmPlan() {
    try {
      window.localStorage.setItem(confirmationKey, "true");
    } catch {
      // 저장이 막힌 브라우저에서도 현재 화면의 확정 상태는 보여준다.
    }
    setConfirmed(true);
  }

  return (
    <article className="space-y-7 rounded-3xl border border-[var(--line)] bg-white p-5 shadow-[var(--shadow-soft)] sm:p-7">
      {budgetCheck && <BudgetOverageBanner check={budgetCheck} />}

      <header className="rounded-2xl border border-[var(--line)] bg-slate-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-[0.22em] text-[var(--accent)]">
          {budgetCheck ? "확인이 필요합니다" : "이 정도면 됩니다"}
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <SummaryPill label="일정" value={`${firstDay}부터 ${plan.days.length}일`} />
          <SummaryPill label="장소" value={`${enumeratePoints(plan).length}곳`} />
          <SummaryPill label="예상 경비" value={`₩${budget.total.toLocaleString("ko-KR")}`} />
        </div>
        {(planningModel || placeStats) && (
          <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-[var(--muted)]">
            {planningModel && (
              <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1">
                추천 방식: {getPlanningModelInfo(planningModel).shortLabel}
              </span>
            )}
            {placeStats && (
              <span className="rounded-full border border-[var(--line)] bg-white px-2 py-1">
                장소 확인: {placeStats.verifiedPlaces}/{placeStats.totalPlaceQueries}
                {placeStats.warnings > 0 ? ` · 확인 필요 ${placeStats.warnings}` : ""}
              </span>
            )}
          </div>
        )}
        {plan.stay && (
          <p className="mt-4 text-sm text-[var(--muted)]">
            <span className="font-medium text-[var(--ink)]">숙소 기준점</span> · {plan.stay.name}
            {plan.stay.place?.name && plan.stay.place.name !== plan.stay.name && (
              <span className="text-[var(--muted)]"> · {plan.stay.place.name}</span>
            )}
          </p>
        )}
        <p className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-[var(--muted)]">
          {plan.rationale}
        </p>
      </header>

      <DecisionPanel
        plan={plan}
        budget={budget}
        budgetCheck={budgetCheck}
        confirmed={confirmed}
        onConfirm={confirmPlan}
      />

      {shareInput && (
        <>
          <ShareSection input={shareInput} plan={plan} model={model} />
          <FeedbackSection input={shareInput} plan={plan} model={model} />
        </>
      )}

      <MapView plan={plan} onLegsLoaded={setLegsByItem} />

      <ol className="space-y-6">
        {plan.days.map((day, dayIdx) => (
          <li key={dayIdx} className="space-y-2">
            <h3 className="flex items-center gap-2 text-sm font-semibold text-[var(--ink)]">
              <span
                aria-hidden
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: DAY_COLORS[dayIdx % DAY_COLORS.length] }}
              />
              {day.label}
            </h3>
            <ol className="space-y-1.5">
              {day.items.map((item, j) => (
                <Fragment key={j}>
                  {j > 0 && item.transit && (
                    <TransitRow transit={item.transit} osrmLeg={legsByItem?.get(item)} />
                  )}
                  <li>
                    <ItemCard
                      item={item}
                      label={labelByItem.get(item)}
                      dayIndex={dayIdx}
                      onShowMap={setMapItem}
                    />
                  </li>
                </Fragment>
              ))}
            </ol>
          </li>
        ))}
      </ol>

      <BudgetSection plan={plan} budget={budget} />

      {plan.caveats.length > 0 && (
        <ul className="rounded-xl border border-amber-200 bg-amber-50/80 p-3 text-xs leading-relaxed text-amber-900">
          {plan.caveats.map((c, i) => (
            <li key={i}>· {c}</li>
          ))}
        </ul>
      )}

      <SourcesLegend />

      {model && (
        <p className="text-right text-[10px] text-[var(--muted)]">
          LLM 모델: {model}
        </p>
      )}

      <PlacePopup item={mapItem} onClose={() => setMapItem(null)} />
    </article>
  );
}

function buildConfirmationKey(plan: TravelPlan, input?: TravelInput): string {
  const source = JSON.stringify({
    path: typeof window === "undefined" ? "" : window.location.pathname,
    input,
    rationale: plan.rationale,
    days: plan.days.map((day) => ({
      label: day.label,
      items: day.items.map((item) => [item.time, item.text, item.place_query]),
    })),
  });
  return `secondwind:travel:confirmed:${stableHash(source)}`;
}

function stableHash(value: string): string {
  let hash = 5381;
  for (let i = 0; i < value.length; i++) {
    hash = (hash * 33) ^ value.charCodeAt(i);
  }
  return (hash >>> 0).toString(36);
}

function BudgetOverageBanner({ check }: { check: BudgetCheck }) {
  const requested = check.requested.toLocaleString("ko-KR");
  const scoped = check.scopedTotal.toLocaleString("ko-KR");
  const over = check.overage.toLocaleString("ko-KR");
  const scopeInfo = getBudgetScopeInfo(check.scope);
  return (
    <section
      role="status"
      className="rounded-2xl border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 sm:p-5"
    >
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700">
        예산 초과
      </p>
      <p className="mt-1.5 text-base font-semibold leading-snug text-amber-900">
        요청 ₩{requested} · 예상 ₩{scoped} <span className="text-amber-700">(₩{over} 초과)</span>
      </p>
      <p className="mt-1 text-xs leading-relaxed text-amber-800">
        예산 기준: <span className="font-medium">{scopeInfo.label}</span>{" "}
        <span className="text-amber-700">({scopeInfo.hint})</span>
      </p>
      <p className="mt-2 text-xs leading-relaxed text-amber-800">
        아래 일정과 비용 항목을 확인하고, 줄일 항목을 직접 골라주세요. 가격은 AI 추정값이라 실제와 다를 수 있어요.
      </p>
    </section>
  );
}

function DecisionPanel({
  plan,
  budget,
  budgetCheck,
  confirmed,
  onConfirm,
}: {
  plan: TravelPlan;
  budget: ReturnType<typeof computeBudget>;
  budgetCheck: BudgetCheck | null;
  confirmed: boolean;
  onConfirm: () => void;
}) {
  const summary = buildDecisionSummary(plan, budget, budgetCheck);

  return (
    <section className="rounded-2xl border border-[var(--line)] bg-[var(--paper-strong)] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">
              decision
            </p>
            {confirmed && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
                <CheckCircle2 aria-hidden className="h-3 w-3" />
                확정됨
              </span>
            )}
          </div>
          <h3 className="mt-1 text-lg font-semibold tracking-tight text-[var(--ink)]">
            이 일정으로 가도 되는 이유
          </h3>
          <p className="mt-1 text-sm leading-relaxed text-[var(--muted)]">
            긴 일정을 다시 훑기 전에, 결정에 필요한 것만 먼저 확인하세요.
          </p>
        </div>

        <button
          type="button"
          onClick={onConfirm}
          disabled={confirmed}
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-900/15 transition hover:-translate-y-0.5 hover:bg-[var(--accent-strong)] disabled:translate-y-0 disabled:bg-emerald-600 disabled:opacity-90"
        >
          <CheckCircle2 aria-hidden className="h-4 w-4" />
          {confirmed ? "확정 완료" : "이 일정으로 확정"}
        </button>
      </div>

      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        <DecisionColumn title="좋은 점" items={summary.goodReasons} />
        <DecisionColumn title="확인 필요" items={summary.checkBeforeConfirming} tone="warning" />
        <DecisionColumn title="확정 후 할 일" items={summary.todoAfterConfirming} checklist={confirmed} />
      </div>

      {!confirmed && (
        <p className="mt-4 text-xs text-[var(--muted)]">
          확정하면 이 브라우저에서 완료 상태가 저장되고, 출발 전 확인할 일을 체크리스트로 볼 수 있어요.
        </p>
      )}
    </section>
  );
}

function DecisionColumn({
  title,
  items,
  tone = "default",
  checklist = false,
}: {
  title: string;
  items: string[];
  tone?: "default" | "warning";
  checklist?: boolean;
}) {
  return (
    <section className="rounded-xl border border-[var(--line)] bg-white p-3">
      <h4 className="text-sm font-semibold text-[var(--ink)]">{title}</h4>
      <ul className="mt-2 space-y-2 text-xs leading-relaxed text-[var(--muted)]">
        {items.map((item, i) => (
          <li key={`${title}-${i}`} className="flex gap-2">
            {checklist ? (
              <input
                type="checkbox"
                aria-label={item}
                className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-[var(--line)] text-[var(--accent)]"
              />
            ) : (
              <span
                aria-hidden
                className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                  tone === "warning" ? "bg-amber-400" : "bg-[var(--accent)]"
                }`}
              />
            )}
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

function buildDecisionSummary(
  plan: TravelPlan,
  budget: ReturnType<typeof computeBudget>,
  budgetCheck: BudgetCheck | null,
): {
  goodReasons: string[];
  checkBeforeConfirming: string[];
  todoAfterConfirming: string[];
} {
  const allItems = plan.days.flatMap((day) => day.items);
  const locatedCount = allItems.filter((item) => item.place).length;
  const warningCount = allItems.filter((item) => item.place_warning).length;
  const transitCount = allItems.filter((item) => item.transit).length;
  const mealCount = allItems.filter((item) => /점심|저녁|식사|브런치|맛집|식당|카페/.test(item.text)).length;

  const llmGoodReasons = budgetCheck
    ? (plan.decision?.good_reasons ?? []).filter((r) => !mentionsBudgetCompliance(r))
    : (plan.decision?.good_reasons ?? []);

  const goodReasons = uniqueNonEmpty([
    ...llmGoodReasons,
    plan.stay ? `숙소 기준점 "${plan.stay.name}"을 중심으로 동선을 판단할 수 있습니다.` : "",
    mealCount > 0 ? `식사와 휴식 지점을 일정 안에 함께 배치했습니다.` : "",
    transitCount > 0 ? `장소 사이 이동 시간과 수단을 함께 표시합니다.` : "",
  ]).slice(0, 3);

  const overageNotice = budgetCheck ? buildOverageNotice(budgetCheck) : "";
  const checkBeforeConfirming = uniqueNonEmpty([
    overageNotice,
    ...(plan.decision?.check_before_confirming ?? []),
    warningCount > 0 ? `위치 확인 필요 표시가 있는 장소 ${warningCount}곳은 방문 전 지도에서 다시 확인하세요.` : "",
    locatedCount > 0 ? `주소와 전화는 ${locatedCount}곳이 Naver 지역검색으로 확인되었습니다.` : "",
    budget.total > 0 ? `예상 총 경비 ₩${budget.total.toLocaleString("ko-KR")}는 참고용입니다.` : "",
    ...plan.caveats,
  ]).slice(0, 4);

  const todoAfterConfirming = uniqueNonEmpty([
    ...(plan.decision?.todo_after_confirming ?? []),
    plan.stay ? "숙소 예약 여부와 체크인 시간을 확인하기" : "숙소 예약 여부를 확인하기",
    "첫 식사 장소의 영업시간과 휴무일 확인하기",
    "이동편, 렌터카, 주차 같은 교통 준비 상태 확인하기",
    "동행자에게 공유 링크 보내기",
  ]).slice(0, 5);

  return {
    goodReasons: goodReasons.length > 0 ? goodReasons : ["요청한 목적지와 기간에 맞춰 하나의 실행 가능한 일정으로 정리했습니다."],
    checkBeforeConfirming: checkBeforeConfirming.length > 0 ? checkBeforeConfirming : ["영업시간, 가격, 메뉴는 방문 전 한 번 더 확인하세요."],
    todoAfterConfirming,
  };
}

// LLM 이 예산 초과인데도 "예산 내", "100만원 안에서" 같은 자축을 내뱉는 경우를 차단한다.
// "예산" 키워드를 직접 칭찬 맥락에서 쓴 경우만 매칭 — "예산 초과" 같은 경고 표현은 살린다.
function mentionsBudgetCompliance(text: string): boolean {
  if (/(예산|비용)\s*(내|이내|안에서|범위|맞춰|충족|준수|아래|아래로|미만)/.test(text)) return true;
  if (/(예산|경비)\s*(에|을|를)?\s*(맞췄|지켰|충족|만족)/.test(text)) return true;
  return false;
}

function buildOverageNotice(check: BudgetCheck): string {
  const requested = check.requested.toLocaleString("ko-KR");
  const scoped = check.scopedTotal.toLocaleString("ko-KR");
  const over = check.overage.toLocaleString("ko-KR");
  return `요청 예산 ₩${requested} · 예상 ₩${scoped} (₩${over} 초과) — 비용 항목 재검토 필요`;
}

function uniqueNonEmpty(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    const normalized = item.trim();
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(normalized);
  }
  return out;
}

function SummaryPill({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-[var(--line)] bg-white px-3 py-2">
      <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[var(--muted)]">
        {label}
      </p>
      <p className="mt-0.5 text-sm font-semibold text-[var(--ink)]">{value}</p>
    </div>
  );
}

type ShareState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; url: string; expiresAt: string; copied: boolean }
  | { kind: "error"; message: string };

function ShareSection({
  input,
  plan,
  model,
}: {
  input: TravelInput;
  plan: TravelPlan;
  model?: string;
}) {
  const [state, setState] = useState<ShareState>({ kind: "idle" });

  async function createShare() {
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/travel/share", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ input, plan, model }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.status !== "ok" || typeof json.url !== "string") {
        setState({ kind: "error", message: friendlyShareError(json) });
        return;
      }
      const url = new URL(json.url, window.location.origin).toString();
      const expiresAt = typeof json.expiresAt === "string" ? json.expiresAt : "";
      setState({ kind: "ok", url, expiresAt, copied: false });
    } catch {
      setState({ kind: "error", message: "공유 링크를 만들지 못했습니다. 잠시 후 다시 시도해주세요." });
    }
  }

  async function copyShare(url: string, expiresAt: string) {
    try {
      await navigator.clipboard.writeText(url);
      setState({ kind: "ok", url, expiresAt, copied: true });
    } catch {
      setState({ kind: "ok", url, expiresAt, copied: false });
    }
  }

  return (
    <section className="space-y-2 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-medium text-[var(--ink)]">공유 링크</p>
          <p className="text-xs text-[var(--muted)]">
            입력값과 여행 계획을 7일 동안 같은 모습으로 복원합니다.
          </p>
        </div>
        <button
          type="button"
          onClick={createShare}
          disabled={state.kind === "saving"}
          className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60"
        >
          {state.kind === "saving" ? "만드는 중..." : "링크 만들기"}
        </button>
      </div>

      {state.kind === "ok" && (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <a
            href={state.url}
            className="min-w-0 flex-1 truncate rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs text-[var(--ink)] underline underline-offset-2"
          >
            {state.url}
          </a>
          <button
            type="button"
            onClick={() => copyShare(state.url, state.expiresAt)}
            className="rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)]"
          >
            {state.copied ? "복사됨" : "복사"}
          </button>
          {state.expiresAt && (
            <span className="text-[11px] text-[var(--muted)]">
              {formatExpiresAt(state.expiresAt)} 만료
            </span>
          )}
        </div>
      )}

      {state.kind === "error" && (
        <p role="status" className="text-xs text-amber-800">
          {state.message}
        </p>
      )}
    </section>
  );
}

function friendlyShareError(json: Record<string, unknown>): string {
  if (json.status === "not-configured") {
    return "공유 저장소가 아직 연결되지 않았습니다.";
  }
  return "공유 링크를 만들지 못했습니다. 잠시 후 다시 시도해주세요.";
}

function formatExpiresAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

type FeedbackCategory = "bug" | "quality" | "other";

type FeedbackState =
  | { kind: "idle" }
  | { kind: "saving" }
  | { kind: "ok"; id: string }
  | { kind: "error"; message: string };

const FEEDBACK_OPTIONS: Array<{
  id: FeedbackCategory;
  label: string;
  description: string;
}> = [
  { id: "quality", label: "품질", description: "일정이 별로예요" },
  { id: "bug", label: "버그", description: "화면이나 데이터가 이상해요" },
  { id: "other", label: "기타", description: "다른 의견이에요" },
];

export type FeedbackDraftInput = {
  destination: string;
  startDate: string;
  endDate: string;
  prompt: string;
  planningModel: PlanningModel;
  budgetKrw?: number;
  budgetScope?: string;
};

export function FeedbackSection({
  input,
  draftInput,
  plan,
  model,
  context,
}: {
  input?: TravelInput;
  draftInput?: FeedbackDraftInput;
  plan?: TravelPlan;
  model?: string;
  context?: string;
}) {
  const [category, setCategory] = useState<FeedbackCategory>("quality");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<FeedbackState>({ kind: "idle" });
  const trimmed = message.trim();
  const canSubmit = trimmed.length >= 3 && state.kind !== "saving";

  async function submitFeedback() {
    if (!canSubmit) return;
    setState({ kind: "saving" });
    try {
      const res = await fetch("/api/travel/feedback", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          category,
          message: trimmed,
          input,
          draftInput,
          plan,
          model,
          context,
          pagePath: window.location.pathname,
        }),
      });
      const json = (await res.json()) as Record<string, unknown>;
      if (!res.ok || json.status !== "ok" || typeof json.id !== "string") {
        setState({ kind: "error", message: friendlyFeedbackError(json) });
        return;
      }
      setMessage("");
      setState({ kind: "ok", id: json.id });
    } catch {
      setState({ kind: "error", message: "피드백을 보내지 못했습니다. 잠시 후 다시 시도해주세요." });
    }
  }

  return (
    <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="flex items-center gap-2 text-sm font-medium text-[var(--ink)]">
            <MessageSquare aria-hidden className="h-4 w-4 text-[var(--accent)]" />
            피드백 · 버그리포트
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--muted)]">
            현재 입력값{plan ? "과 결과 화면 맥락" : "과 오류 상태"}을 함께 보내 개선에 사용합니다. 전화번호와 이메일은 자동으로 가립니다.
          </p>
        </div>
      </div>

      <div className="grid gap-2 sm:grid-cols-3">
        {FEEDBACK_OPTIONS.map((option) => (
          <label
            key={option.id}
            className={`cursor-pointer rounded-xl border bg-white p-3 text-xs transition ${
              category === option.id
                ? "border-[var(--accent)] ring-4 ring-[var(--accent-soft)]"
                : "border-[var(--line)] hover:border-[var(--accent)]"
            }`}
          >
            <input
              type="radio"
              name="travel-feedback-category"
              value={option.id}
              checked={category === option.id}
              onChange={() => setCategory(option.id)}
              className="sr-only"
            />
            <span className="flex items-center gap-1.5 font-semibold text-[var(--ink)]">
              {option.id === "bug" && <Bug aria-hidden className="h-3.5 w-3.5" />}
              {option.label}
            </span>
            <span className="mt-1 block text-[var(--muted)]">{option.description}</span>
          </label>
        ))}
      </div>

      <textarea
        value={message}
        onChange={(e) => {
          setMessage(e.target.value.slice(0, 1000));
          if (state.kind !== "saving") setState({ kind: "idle" });
        }}
        rows={3}
        maxLength={1000}
        placeholder="무엇이 이상했는지, 기대와 실제가 어떻게 달랐는지 적어주세요."
        className="w-full resize-y rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-sm leading-relaxed outline-none transition placeholder:text-slate-400 focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
      />

      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-[11px] text-[var(--muted)]">{message.length} / 1000</p>
        <button
          type="button"
          onClick={submitFeedback}
          disabled={!canSubmit}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] disabled:opacity-60"
        >
          <Send aria-hidden className="h-3.5 w-3.5" />
          {state.kind === "saving" ? "보내는 중..." : "보내기"}
        </button>
      </div>

      {state.kind === "ok" && (
        <p role="status" className="text-xs text-emerald-700">
          피드백을 받았습니다. 기록 ID: {state.id}
        </p>
      )}
      {state.kind === "error" && (
        <p role="status" className="text-xs text-amber-800">
          {state.message}
        </p>
      )}
    </section>
  );
}

function friendlyFeedbackError(json: Record<string, unknown>): string {
  if (json.status === "not-configured") {
    return "피드백 저장소가 아직 연결되지 않았습니다.";
  }
  if (json.reason === "invalid-message") {
    return "피드백을 세 글자 이상 적어주세요.";
  }
  return "피드백을 보내지 못했습니다. 잠시 후 다시 시도해주세요.";
}

// mode 에 "차량"·"택시"·"자동차"·"렌터" 중 하나라도 포함되면 OSRM driving 결과로 덮어쓰기 가능.
function isCarMode(mode: string): boolean {
  return /차량|택시|자동차|렌터/.test(mode);
}

function TransitRow({ transit, osrmLeg }: { transit: TransitInfo; osrmLeg?: OsrmLeg }) {
  const useOsrm = osrmLeg != null && isCarMode(transit.mode);
  const durationMin = useOsrm ? Math.max(1, Math.round(osrmLeg!.durationS / 60)) : transit.duration_min;
  const hasCost = typeof transit.cost_krw === "number" && transit.cost_krw > 0;

  return (
    <li
      aria-label="이동"
      className="flex items-center gap-2 pl-14 pr-3 text-[11px] text-[var(--muted)]"
    >
      <span aria-hidden className="block h-3 w-px bg-[var(--line)]" />
      <span>
        <Estimated>{transit.mode}</Estimated>{" "}
        {useOsrm ? (
          <span>{durationMin}분</span>
        ) : (
          <Estimated>{durationMin}분</Estimated>
        )}
        {useOsrm && ` · ${(osrmLeg!.distanceM / 1000).toFixed(1)}km`}
        {hasCost && (
          <>
            {" · "}
            <Estimated>₩{(transit.cost_krw ?? 0).toLocaleString("ko-KR")}</Estimated>
          </>
        )}
        {transit.note && (
          <>
            {" · "}
            <Estimated>{transit.note}</Estimated>
          </>
        )}
      </span>
    </li>
  );
}

function ItemCard({
  item,
  label,
  dayIndex,
  onShowMap,
}: {
  item: TravelItem;
  label: string | undefined;
  dayIndex: number;
  onShowMap: (item: TravelItem) => void;
}) {
  const addr = item.place?.address;
  const phone = item.place?.phone;
  const category = item.place?.category;
  const placeWarning = item.place_warning;
  const hasLocation = Boolean(item.place || item.place_query);

  const showCost = typeof item.cost_krw === "number" && item.cost_krw > 0;
  const hasDetail = Boolean(addr || phone || category || placeWarning || item.recommended_menu || showCost);

  const costLabel = item.cost_label ?? "비용";
  const pinColor = DAY_COLORS[dayIndex % DAY_COLORS.length];

  return (
    <details className="group rounded-xl border border-[var(--line)] bg-white transition open:border-[var(--accent)]/35 open:bg-slate-50">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-3 text-sm">
        <div className="flex w-12 shrink-0 flex-col items-start gap-1 pt-0.5">
          {item.time && (
            <span className="font-mono text-xs text-[var(--muted)]">{item.time}</span>
          )}
          {label && (
            <span
              aria-label={`지도 위치 ${label}`}
              style={{ background: pinColor }}
              className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold text-white"
            >
              {label}
            </span>
          )}
        </div>
        <span className="flex-1 leading-korean">
          {item.text}
          {item.place?.name && !item.text.includes(item.place.name) && (
            <span className="text-[var(--muted)]"> · {item.place.name}</span>
          )}
          {placeWarning && (
            <span className="ml-2 inline-flex rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-800">
              위치 확인 필요
            </span>
          )}
        </span>
        {hasLocation && (
          <button
            type="button"
            onClick={(e) => {
              // <summary> 기본 toggle 동작 차단 — 상세 펼침과 별개 동작이어야 함
              e.preventDefault();
              e.stopPropagation();
              onShowMap(item);
            }}
            aria-label={item.place ? "지도에서 위치 보기" : "지도 검색 결과 보기"}
            title={item.place ? "지도에서 위치 보기" : "지도 검색 결과 보기"}
            className="shrink-0 rounded-lg border border-[var(--line)] bg-white p-1.5 text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          >
            <MapPinIcon />
          </button>
        )}
        {hasDetail && (
          <span
            aria-hidden
            className="ml-1 shrink-0 pt-0.5 text-xs text-[var(--muted)] transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        )}
      </summary>

      {hasDetail && (
        <dl className="space-y-1 border-t border-[var(--line)] px-3 py-3 pl-16 text-xs text-[var(--muted)]">
          {placeWarning && (
            <Row label="지도">
              <span className="text-amber-800">{placeWarning}</span>
            </Row>
          )}
          {addr && (
            <Row label="주소">
              <span>{addr}</span>
            </Row>
          )}
          {phone && (
            <Row label="전화">
              <a href={`tel:${phone}`} className="underline underline-offset-2">
                {phone}
              </a>
            </Row>
          )}
          {category && (
            <Row label="분류">
              <span>{category}</span>
            </Row>
          )}
          {item.recommended_menu && (
            <Row label="추천 메뉴">
              <Estimated>{item.recommended_menu}</Estimated>
            </Row>
          )}
          {showCost && (
            <Row label={costLabel}>
              <Estimated>₩{(item.cost_krw ?? 0).toLocaleString("ko-KR")}</Estimated>
            </Row>
          )}
        </dl>
      )}
    </details>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="inline w-14 text-[var(--muted)]/75">{label} </dt>
      <dd className="inline">{children}</dd>
    </div>
  );
}

function BudgetSection({
  plan,
  budget,
}: {
  plan: TravelPlan;
  budget: ReturnType<typeof computeBudget>;
}) {
  return (
    <section className="space-y-3 rounded-2xl border border-[var(--line)] bg-slate-50 p-4">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium text-[var(--ink)]">예상 총 경비</p>
        <p className="text-base font-semibold text-[var(--ink)]">₩{budget.total.toLocaleString("ko-KR")}</p>
      </div>

      <dl className="space-y-1 text-xs text-[var(--muted)]">
        <BudgetLine label="활동·식사·입장 합계" amount={budget.activity} />
        <BudgetLine label="이동 비용 합계" amount={budget.transit} />
        {plan.budget.extras.map((e, i) => (
          <BudgetLine key={i} label={e.label} amount={e.krw} />
        ))}
      </dl>

      {(budget.activityItems.length > 0 || budget.transitItems.length > 0 || plan.budget.extras.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-[var(--muted)] underline decoration-dotted underline-offset-4">
            세부 내역 보기
          </summary>
          <div className="mt-2 space-y-3 rounded-xl bg-white p-3">
            {budget.activityItems.length > 0 && (
              <BudgetGroup title="활동·식사·입장">
                {budget.activityItems.map((a, i) => (
                  <BudgetRow
                    key={i}
                    left={`${a.day} ${a.time ?? ""} ${a.text}${a.label ? ` (${a.label})` : ""}`}
                    amount={a.krw}
                  />
                ))}
              </BudgetGroup>
            )}
            {budget.transitItems.length > 0 && (
              <BudgetGroup title="이동">
                {budget.transitItems.map((t, i) => (
                  <BudgetRow
                    key={i}
                    left={`${t.day} → ${t.to} (${t.mode} ${t.duration_min}분)`}
                    amount={t.krw}
                  />
                ))}
              </BudgetGroup>
            )}
            {plan.budget.extras.length > 0 && (
              <BudgetGroup title="기타">
                {plan.budget.extras.map((e, i) => (
                  <BudgetRow key={i} left={e.label} amount={e.krw} />
                ))}
              </BudgetGroup>
            )}
          </div>
        </details>
      )}
    </section>
  );
}

function BudgetLine({ label, amount }: { label: string; amount: number }) {
  if (amount <= 0) return null;
  return (
    <div className="flex items-baseline justify-between">
      <dt className="text-[var(--muted)]">{label}</dt>
      <dd>₩{amount.toLocaleString("ko-KR")}</dd>
    </div>
  );
}

function BudgetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-[var(--muted)]">{title}</p>
      <ul className="space-y-0.5 text-[var(--muted)]">{children}</ul>
    </div>
  );
}

function BudgetRow({ left, amount }: { left: string; amount: number }) {
  return (
    <li className="flex items-baseline justify-between gap-2">
      <span className="flex-1 truncate">{left}</span>
      <span className="shrink-0 tabular-nums">₩{amount.toLocaleString("ko-KR")}</span>
    </li>
  );
}

// AI 추정값 마킹. 점선 밑줄 + 옅은 색 + hover tooltip.
// 전화번호 링크의 솔리드 underline 과 시각적으로 구분.
function Estimated({
  children,
  hint = "AI 추정 — 실제와 다를 수 있어요",
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <span
      title={hint}
      className="text-[var(--muted)] underline decoration-dotted decoration-[var(--accent)] underline-offset-2"
    >
      {children}
    </span>
  );
}

function SourcesLegend() {
  return (
    <details className="rounded-xl border border-[var(--line)] bg-slate-50 p-3 text-[11px] text-[var(--muted)]">
      <summary className="cursor-pointer select-none underline decoration-dotted underline-offset-4">
        정보 출처 · 정확도
      </summary>
      <div className="mt-2 space-y-1.5 rounded-xl bg-white p-3">
        <p>
          <span className="underline decoration-dotted decoration-[var(--accent)] underline-offset-2">
            점선 밑줄
          </span>{" "}
          이 있는 값은 AI 가 추정한 값이에요. 실제와 다를 수 있으니 참고용으로만 보세요.
        </p>
        <ul className="space-y-0.5">
          <li>· 주소·전화·분류: Naver 지역검색 검증</li>
          <li>· 이동 거리 (자동차): OSRM 계산</li>
          <li>· 이동 시간 (자동차): OSRM 계산 (교통상황 미반영)</li>
          <li>· 이동 시간 (지하철·버스·도보): AI 추정</li>
          <li>· 이동 수단·비용·추천 메뉴·영업 정보: AI 추정</li>
        </ul>
      </div>
    </details>
  );
}

function MapPinIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 20 20"
      fill="currentColor"
      aria-hidden
      className="h-3.5 w-3.5"
    >
      <path
        fillRule="evenodd"
        d="M5.05 4.05a7 7 0 1 1 9.9 9.9L10 18.9l-4.95-4.95a7 7 0 0 1 0-9.9zM10 11a2 2 0 1 0 0-4 2 2 0 0 0 0 4z"
        clipRule="evenodd"
      />
    </svg>
  );
}
