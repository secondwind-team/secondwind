import { Fragment } from "react";
import {
  computeBudget,
  kakaoMapSearchUrl,
  type TransitInfo,
  type TravelItem,
  type TravelPlan,
} from "@/lib/common/services/travel";

export function PlanCard({ plan }: { plan: TravelPlan }) {
  const budget = computeBudget(plan);

  return (
    <article className="space-y-6 rounded-xl border border-neutral-300 p-5 dark:border-neutral-700">
      <header className="space-y-1.5">
        <p className="text-xs uppercase tracking-wide text-neutral-400">이 정도면 됩니다</p>
        <p className="text-base font-medium leading-korean">{plan.summary_line}</p>
      </header>

      <ol className="space-y-6">
        {plan.days.map((day, i) => (
          <li key={i} className="space-y-2">
            <h3 className="text-sm font-semibold">{day.label}</h3>
            <ol className="space-y-1.5">
              {day.items.map((item, j) => (
                <Fragment key={j}>
                  {j > 0 && item.transit && <TransitRow transit={item.transit} />}
                  <li>
                    <ItemCard item={item} />
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
    </article>
  );
}

function TransitRow({ transit }: { transit: TransitInfo }) {
  const hasCost = typeof transit.cost_krw === "number" && transit.cost_krw > 0;
  return (
    <li
      aria-label="이동"
      className="flex items-center gap-2 pl-14 pr-3 text-[11px] text-neutral-500 dark:text-neutral-400"
    >
      <span aria-hidden className="block h-3 w-px bg-neutral-300 dark:bg-neutral-700" />
      <span>
        {transit.mode} {transit.duration_min}분
        {hasCost && ` · ₩${(transit.cost_krw ?? 0).toLocaleString("ko-KR")}`}
        {transit.note && ` · ${transit.note}`}
      </span>
    </li>
  );
}

function ItemCard({ item }: { item: TravelItem }) {
  const addr = item.place?.address;
  const phone = item.place?.phone;
  const category = item.place?.category;
  const kakaoUrl = item.place?.url ?? (item.place_query ? kakaoMapSearchUrl(item.place_query) : undefined);

  const showCost = typeof item.cost_krw === "number" && item.cost_krw > 0;
  const hasDetail = Boolean(addr || phone || category || item.recommended_menu || showCost);

  const costLabel = item.cost_label ?? "비용";

  return (
    <details className="group rounded-lg border border-neutral-200 open:bg-neutral-50 dark:border-neutral-800 dark:open:bg-neutral-900/50">
      <summary className="flex cursor-pointer list-none items-start gap-3 px-3 py-2.5 text-sm">
        {item.time ? (
          <span className="w-12 shrink-0 pt-0.5 font-mono text-xs text-neutral-500">{item.time}</span>
        ) : (
          <span className="w-12 shrink-0" aria-hidden />
        )}
        <span className="flex-1 leading-korean">{item.text}</span>
        {kakaoUrl && (
          <a
            href={kakaoUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="shrink-0 rounded border border-neutral-300 px-1.5 py-0.5 text-[10px] text-neutral-500 hover:text-neutral-900 dark:border-neutral-700 dark:hover:text-neutral-100"
          >
            지도
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
              <a href={`tel:${phone}`} className="underline decoration-dotted">
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
              <span>
                {item.recommended_menu}
                <span className="ml-1 text-neutral-400">(제안, 확인 필요)</span>
              </span>
            </Row>
          )}
          {showCost && (
            <Row label={costLabel}>
              <span>₩{(item.cost_krw ?? 0).toLocaleString("ko-KR")}</span>
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
