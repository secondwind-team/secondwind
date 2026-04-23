"use client";

import { Fragment, useState } from "react";
import {
  computeBudget,
  enumeratePoints,
  kakaoMapSearchUrl,
  type TransitInfo,
  type TravelItem,
  type TravelPlan,
} from "@/lib/common/services/travel";
import { MapView, type LegsByItem, type OsrmLeg } from "./map-view";

const DAY_COLORS = ["#2563eb", "#059669", "#d97706", "#db2777", "#7c3aed", "#0d9488", "#c026d3"];

export function PlanCard({ plan, model }: { plan: TravelPlan; model?: string }) {
  const budget = computeBudget(plan);
  const labelByItem = new Map(enumeratePoints(plan).map((p) => [p.item, p.label]));
  const [legsByItem, setLegsByItem] = useState<LegsByItem | null>(null);

  return (
    <article className="space-y-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
      <header className="space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-neutral-400">이 정도면 됩니다</p>
        <p className="text-base font-medium leading-korean">{plan.summary_line}</p>
      </header>

      <MapView plan={plan} onLegsLoaded={setLegsByItem} />

      <ol className="space-y-6">
        {plan.days.map((day, dayIdx) => (
          <li key={dayIdx} className="space-y-2">
            <h3 className="text-sm font-semibold">{day.label}</h3>
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
        <ul className="space-y-1 text-xs text-neutral-500">
          {plan.caveats.map((c, i) => (
            <li key={i}>· {c}</li>
          ))}
        </ul>
      )}

      <SourcesLegend />

      {model && (
        <p className="text-right text-[10px] text-neutral-400 dark:text-neutral-500">
          생성 모델: {model}
        </p>
      )}
    </article>
  );
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
      className="flex items-center gap-2 pl-14 pr-3 text-[11px] text-neutral-500 dark:text-neutral-400"
    >
      <span aria-hidden className="block h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
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
}: {
  item: TravelItem;
  label: string | undefined;
  dayIndex: number;
}) {
  const addr = item.place?.address;
  const phone = item.place?.phone;
  const category = item.place?.category;
  const kakaoUrl = item.place?.url ?? (item.place_query ? kakaoMapSearchUrl(item.place_query) : undefined);

  const showCost = typeof item.cost_krw === "number" && item.cost_krw > 0;
  const hasDetail = Boolean(addr || phone || category || item.recommended_menu || showCost);

  const costLabel = item.cost_label ?? "비용";
  const pinColor = DAY_COLORS[dayIndex % DAY_COLORS.length];

  return (
    <details className="group rounded-lg border border-neutral-200 open:bg-neutral-50 dark:border-neutral-800 dark:open:bg-neutral-900/50">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 text-sm">
        <div className="flex w-12 shrink-0 flex-col items-start gap-1 pt-0.5">
          {item.time && (
            <span className="font-mono text-xs text-neutral-500">{item.time}</span>
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
        <span className="flex-1 leading-korean">{item.text}</span>
        {kakaoUrl && (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="카카오맵에서 보기"
            title="카카오맵에서 보기"
            className="shrink-0 rounded border border-neutral-300 p-1 text-neutral-500 hover:text-neutral-900 dark:border-neutral-700 dark:hover:text-neutral-100"
          >
            <MapPinIcon />
          </a>
        )}
        {hasDetail && (
          <span
            aria-hidden
            className="ml-1 shrink-0 pt-0.5 text-xs text-neutral-400 transition-transform group-open:rotate-180"
          >
            ▾
          </span>
        )}
      </summary>

      {hasDetail && (
        <dl className="space-y-1 border-t border-neutral-200 px-3 py-2 pl-16 text-xs text-neutral-600 dark:border-neutral-800 dark:text-neutral-300">
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
      <dt className="inline w-14 text-neutral-400">{label} </dt>
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
    <section className="space-y-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">예상 총 경비</p>
        <p className="text-base font-semibold">₩{budget.total.toLocaleString("ko-KR")}</p>
      </div>

      <dl className="space-y-1 text-xs text-neutral-600 dark:text-neutral-300">
        <BudgetLine label="활동·식사·입장 합계" amount={budget.activity} />
        <BudgetLine label="이동 비용 합계" amount={budget.transit} />
        {plan.budget.extras.map((e, i) => (
          <BudgetLine key={i} label={e.label} amount={e.krw} />
        ))}
      </dl>

      {(budget.activityItems.length > 0 || budget.transitItems.length > 0 || plan.budget.extras.length > 0) && (
        <details className="text-xs">
          <summary className="cursor-pointer text-neutral-500 underline decoration-dotted underline-offset-4">
            세부 내역 보기
          </summary>
          <div className="mt-2 space-y-3 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900/50">
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
      <dt className="text-neutral-500">{label}</dt>
      <dd>₩{amount.toLocaleString("ko-KR")}</dd>
    </div>
  );
}

function BudgetGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-neutral-400">{title}</p>
      <ul className="space-y-0.5 text-neutral-600 dark:text-neutral-300">{children}</ul>
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
      className="underline decoration-dotted decoration-neutral-400 underline-offset-2 text-neutral-500 dark:text-neutral-400"
    >
      {children}
    </span>
  );
}

function SourcesLegend() {
  return (
    <details className="text-[11px] text-neutral-500 dark:text-neutral-400">
      <summary className="cursor-pointer select-none underline decoration-dotted underline-offset-4">
        정보 출처 · 정확도
      </summary>
      <div className="mt-2 space-y-1.5 rounded-md bg-neutral-50 p-3 dark:bg-neutral-900/50">
        <p>
          <span className="underline decoration-dotted decoration-neutral-400 underline-offset-2">
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
