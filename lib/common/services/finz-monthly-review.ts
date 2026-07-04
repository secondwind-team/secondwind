export type FinzAssetType = "stock" | "crypto";

export type FinzMentionDirection =
  | "positive"
  | "negative"
  | "watching"
  | "conditional"
  | "mention";

export type FinzReviewKind = "scheduled-monthly" | "manual-interim";

export type FinzAssetCatalogItem = {
  symbol: string;
  name: string;
  assetType: FinzAssetType;
  aliases: string[];
  priceSymbol?: string;
  currency?: string;
};

export type FinzRoomMessage = {
  id: string;
  roomId: string;
  memberId: string;
  memberName: string;
  text: string;
  createdAt: string;
};

export type FinzExtractedMention = {
  messageId: string;
  memberId: string;
  memberName: string;
  symbol: string;
  assetName: string;
  assetType: FinzAssetType;
  direction: FinzMentionDirection;
  text: string;
  createdAt: string;
};

export type FinzReviewMention = {
  symbol: string;
  assetName: string;
  assetType: FinzAssetType;
  memberId: string;
  memberName: string;
  direction: FinzMentionDirection;
  messageCount: number;
  messageSummary: string;
  firstMentionedAt: string;
  lastMentionedAt: string;
};

export type FinzPricePoint = {
  price: number;
  currency: string;
  observedAt: string;
  source: string;
};

export type FinzPriceProvider = {
  getOpenPrice(asset: FinzAssetCatalogItem, at: string): Promise<FinzPricePoint | null>;
  getFirstAvailableOpenPrice(
    asset: FinzAssetCatalogItem,
    from: string,
    to: string,
  ): Promise<FinzPricePoint | null>;
};

export type FinzReviewPriceSnapshot = {
  symbol: string;
  assetName: string;
  assetType: FinzAssetType;
  baselinePrice: number | null;
  baselineObservedAt: string | null;
  baselineSource:
    | "previous-scheduled-review-open"
    | "first-available-price-for-first-review"
    | "unavailable";
  reviewOpenPrice: number | null;
  reviewOpenObservedAt: string | null;
  currency: string;
  priceDiff: number | null;
  returnRate: number | null;
};

export type FinzReviewRecord = {
  id: string;
  roomId: string;
  kind: FinzReviewKind;
  periodStart: string | null;
  periodEnd: string;
  createdAt: string;
  previousReviewId?: string;
  baselineScheduledReviewId?: string;
  updatesMonthlyBaseline: boolean;
  mentions: FinzReviewMention[];
  priceSnapshots: FinzReviewPriceSnapshot[];
  summaryText: string;
};

export type BuildFinzMonthlyReviewInput = {
  roomId: string;
  kind: FinzReviewKind;
  requestedAt: string;
  messages: FinzRoomMessage[];
  previousReviews?: FinzReviewRecord[];
  priceProvider: FinzPriceProvider;
  assetCatalog?: FinzAssetCatalogItem[];
  reviewId?: string;
};

export const FINZ_MONTHLY_REVIEW_TIME_ZONE = "Asia/Seoul";

export const FINZ_DEFAULT_ASSET_CATALOG: FinzAssetCatalogItem[] = [
  {
    symbol: "NVDA",
    name: "NVIDIA",
    assetType: "stock",
    aliases: ["nvda", "nvidia", "엔비디아", "젠슨황"],
  },
  {
    symbol: "AAPL",
    name: "Apple",
    assetType: "stock",
    aliases: ["aapl", "apple", "애플", "아이폰"],
  },
  {
    symbol: "TSLA",
    name: "Tesla",
    assetType: "stock",
    aliases: ["tsla", "tesla", "테슬라", "일론"],
  },
  {
    symbol: "MSFT",
    name: "Microsoft",
    assetType: "stock",
    aliases: ["msft", "microsoft", "마이크로소프트", "마소"],
  },
  {
    symbol: "GOOGL",
    name: "Alphabet",
    assetType: "stock",
    aliases: ["googl", "google", "alphabet", "구글", "알파벳"],
  },
  {
    symbol: "META",
    name: "Meta",
    assetType: "stock",
    aliases: ["meta", "메타", "페이스북", "인스타"],
  },
  {
    symbol: "AMZN",
    name: "Amazon",
    assetType: "stock",
    aliases: ["amzn", "amazon", "아마존"],
  },
  {
    symbol: "BTC",
    name: "Bitcoin",
    assetType: "crypto",
    priceSymbol: "BTC-USD",
    aliases: ["btc", "bitcoin", "비트코인", "비트"],
  },
  {
    symbol: "ETH",
    name: "Ethereum",
    assetType: "crypto",
    priceSymbol: "ETH-USD",
    aliases: ["eth", "ethereum", "이더리움", "이더"],
  },
  {
    symbol: "SOL",
    name: "Solana",
    assetType: "crypto",
    priceSymbol: "SOL-USD",
    aliases: ["sol", "solana", "솔라나"],
  },
];

const DIRECTION_KEYWORDS: Record<FinzMentionDirection, string[]> = {
  conditional: ["떨어지면", "빠지면", "조정 오면", "조건", "이면", "라면", "if "],
  positive: ["좋", "오를", "상승", "롱", "매수", "살", "담", "기대", "끌림", "buy", "bull"],
  negative: ["싫", "내릴", "하락", "숏", "매도", "비싸", "고평가", "무섭", "위험", "sell", "bear"],
  watching: ["관망", "지켜", "대기", "보류", "애매", "모르", "watch"],
  mention: [],
};

export function extractFinzMentions(
  messages: FinzRoomMessage[],
  assetCatalog: FinzAssetCatalogItem[] = FINZ_DEFAULT_ASSET_CATALOG,
): FinzExtractedMention[] {
  const mentions: FinzExtractedMention[] = [];

  for (const message of messages) {
    if (!isValidDate(message.createdAt)) continue;
    const normalizedText = normalizeText(message.text);
    const matchedSymbols = new Set<string>();

    for (const asset of assetCatalog) {
      if (matchedSymbols.has(asset.symbol)) continue;
      if (!mentionsAsset(normalizedText, asset)) continue;
      matchedSymbols.add(asset.symbol);
      mentions.push({
        messageId: message.id,
        memberId: message.memberId,
        memberName: message.memberName,
        symbol: asset.symbol,
        assetName: asset.name,
        assetType: asset.assetType,
        direction: detectDirection(normalizedText),
        text: message.text,
        createdAt: message.createdAt,
      });
    }
  }

  return mentions.sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

export function getFinzReviewPeriod(input: {
  kind: FinzReviewKind;
  requestedAt: string;
  messages: FinzRoomMessage[];
  previousReviews?: FinzReviewRecord[];
}): { periodStart: string | null; periodEnd: string; previousReview?: FinzReviewRecord; baselineScheduledReview?: FinzReviewRecord } {
  const previousReviews = sortReviews(input.previousReviews ?? []);
  const previousReview = previousReviews.at(-1);
  const baselineScheduledReview = previousReviews
    .filter((review) => review.kind === "scheduled-monthly" && review.updatesMonthlyBaseline)
    .at(-1);

  const firstMessageAt = input.messages
    .filter((message) => message.roomId && isValidDate(message.createdAt))
    .map((message) => message.createdAt)
    .sort((a, b) => Date.parse(a) - Date.parse(b))[0] ?? null;

  const periodStart =
    input.kind === "scheduled-monthly"
      ? baselineScheduledReview?.createdAt ?? firstMessageAt
      : previousReview?.createdAt ?? firstMessageAt;

  return {
    periodStart,
    periodEnd: input.requestedAt,
    previousReview,
    baselineScheduledReview,
  };
}

export async function buildFinzMonthlyReview(
  input: BuildFinzMonthlyReviewInput,
): Promise<FinzReviewRecord> {
  if (!isValidDate(input.requestedAt)) {
    throw new Error("invalid-requested-at");
  }

  const assetCatalog = input.assetCatalog ?? FINZ_DEFAULT_ASSET_CATALOG;
  const period = getFinzReviewPeriod(input);
  const messages = filterMessagesForPeriod(
    input.messages.filter((message) => message.roomId === input.roomId),
    period.periodStart,
    period.periodEnd,
    Boolean(input.kind === "scheduled-monthly" ? period.baselineScheduledReview : period.previousReview),
  );
  const extractedMentions = extractFinzMentions(messages, assetCatalog);
  const mentions = aggregateMentions(extractedMentions);
  const priceSnapshots = await buildPriceSnapshots({
    mentions,
    assetCatalog,
    baselineScheduledReview: period.baselineScheduledReview,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    priceProvider: input.priceProvider,
  });

  const review: FinzReviewRecord = {
    id: input.reviewId ?? makeReviewId(input.roomId, input.kind, input.requestedAt),
    roomId: input.roomId,
    kind: input.kind,
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    createdAt: input.requestedAt,
    ...(period.previousReview ? { previousReviewId: period.previousReview.id } : {}),
    ...(period.baselineScheduledReview
      ? { baselineScheduledReviewId: period.baselineScheduledReview.id }
      : {}),
    updatesMonthlyBaseline: input.kind === "scheduled-monthly",
    mentions,
    priceSnapshots,
    summaryText: "",
  };

  return { ...review, summaryText: formatFinzReviewSummary(review) };
}

export function formatFinzReviewSummary(review: FinzReviewRecord): string {
  const title =
    review.kind === "scheduled-monthly"
      ? "FINZ 월간 리뷰"
      : "FINZ 중간 월간 리뷰";
  const period = `${formatDate(review.periodStart) ?? "첫 대화"} ~ ${formatDate(review.periodEnd)}`;
  const lines = [`${title}`, "", `기간: ${period}`];

  if (review.kind === "manual-interim") {
    lines.push("중간 리뷰는 정기 월간 리뷰의 가격 기준선을 바꾸지 않습니다.");
  }

  if (review.mentions.length === 0) {
    lines.push("", "이번 기간에는 리뷰할 주식/코인 언급을 찾지 못했습니다.");
    lines.push("", "FINZ 리뷰는 투자 조언이 아니라 대화 회고입니다.");
    return lines.join("\n");
  }

  lines.push("", "많이 나온 종목");
  const symbolCounts = countBySymbol(review.mentions);
  symbolCounts.slice(0, 5).forEach((entry, index) => {
    lines.push(`${index + 1}. ${entry.symbol} - ${entry.count}회 언급`);
  });

  lines.push("", "사용자별 방향");
  review.mentions.slice(0, 12).forEach((mention) => {
    lines.push(
      `- ${mention.memberName}: ${mention.symbol} ${directionLabel(mention.direction)} (${mention.messageCount}회)`,
    );
  });

  lines.push("", "종목별 실제 움직임");
  review.priceSnapshots.forEach((snapshot) => {
    lines.push(`- ${snapshot.symbol}: ${formatPriceSnapshot(snapshot)}`);
  });

  lines.push("", "주의: FINZ 리뷰는 투자 조언이 아니라 대화 회고입니다.");
  return lines.join("\n");
}

function filterMessagesForPeriod(
  messages: FinzRoomMessage[],
  periodStart: string | null,
  periodEnd: string,
  startExclusive: boolean,
): FinzRoomMessage[] {
  const startMs = periodStart ? Date.parse(periodStart) : Number.NEGATIVE_INFINITY;
  const endMs = Date.parse(periodEnd);
  return messages
    .filter((message) => {
      const createdMs = Date.parse(message.createdAt);
      return (
        Number.isFinite(createdMs) &&
        (startExclusive ? createdMs > startMs : createdMs >= startMs) &&
        createdMs <= endMs
      );
    })
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function aggregateMentions(mentions: FinzExtractedMention[]): FinzReviewMention[] {
  const groups = new Map<string, FinzExtractedMention[]>();
  for (const mention of mentions) {
    const key = `${mention.symbol}:${mention.assetType}:${mention.memberId}`;
    groups.set(key, [...(groups.get(key) ?? []), mention]);
  }

  return [...groups.values()]
    .map((group) => {
      const first = group[0];
      if (!first) throw new Error("empty-mention-group");
      const last = group[group.length - 1] ?? first;
      return {
        symbol: first.symbol,
        assetName: first.assetName,
        assetType: first.assetType,
        memberId: first.memberId,
        memberName: first.memberName,
        direction: dominantDirection(group.map((mention) => mention.direction)),
        messageCount: group.length,
        messageSummary: summarizeMessages(group.map((mention) => mention.text)),
        firstMentionedAt: first.createdAt,
        lastMentionedAt: last.createdAt,
      };
    })
    .sort((a, b) => b.messageCount - a.messageCount || a.symbol.localeCompare(b.symbol));
}

async function buildPriceSnapshots(input: {
  mentions: FinzReviewMention[];
  assetCatalog: FinzAssetCatalogItem[];
  baselineScheduledReview?: FinzReviewRecord;
  periodStart: string | null;
  periodEnd: string;
  priceProvider: FinzPriceProvider;
}): Promise<FinzReviewPriceSnapshot[]> {
  const mentionedAssets = uniqueMentionedAssets(input.mentions, input.assetCatalog);
  const snapshots: FinzReviewPriceSnapshot[] = [];

  for (const asset of mentionedAssets) {
    const baselineScheduledReview = input.baselineScheduledReview;
    const previousSnapshot = baselineScheduledReview?.priceSnapshots.find(
      (snapshot) => snapshot.symbol === asset.symbol && snapshot.assetType === asset.assetType,
    );
    const reviewOpen = await input.priceProvider.getOpenPrice(asset, input.periodEnd);

    let baselinePrice: FinzPricePoint | null = null;
    let baselineSource: FinzReviewPriceSnapshot["baselineSource"] = "unavailable";
    if (previousSnapshot?.reviewOpenPrice != null) {
      baselinePrice = {
        price: previousSnapshot.reviewOpenPrice,
        currency: previousSnapshot.currency,
        observedAt: previousSnapshot.reviewOpenObservedAt ?? baselineScheduledReview?.createdAt ?? input.periodEnd,
        source: "previous scheduled review",
      };
      baselineSource = "previous-scheduled-review-open";
    } else {
      const firstMention = input.mentions
        .filter((mention) => mention.symbol === asset.symbol && mention.assetType === asset.assetType)
        .sort((a, b) => Date.parse(a.firstMentionedAt) - Date.parse(b.firstMentionedAt))[0];
      baselinePrice = await input.priceProvider.getFirstAvailableOpenPrice(
        asset,
        firstMention?.firstMentionedAt ?? input.periodStart ?? input.periodEnd,
        input.periodEnd,
      );
      baselineSource = baselinePrice ? "first-available-price-for-first-review" : "unavailable";
    }

    const priceDiff =
      baselinePrice && reviewOpen ? roundMoney(reviewOpen.price - baselinePrice.price) : null;
    const returnRate =
      baselinePrice && reviewOpen && baselinePrice.price !== 0
        ? roundRate(((reviewOpen.price - baselinePrice.price) / baselinePrice.price) * 100)
        : null;

    snapshots.push({
      symbol: asset.symbol,
      assetName: asset.name,
      assetType: asset.assetType,
      baselinePrice: baselinePrice?.price ?? null,
      baselineObservedAt: baselinePrice?.observedAt ?? null,
      baselineSource,
      reviewOpenPrice: reviewOpen?.price ?? null,
      reviewOpenObservedAt: reviewOpen?.observedAt ?? null,
      currency: reviewOpen?.currency ?? baselinePrice?.currency ?? asset.currency ?? "USD",
      priceDiff,
      returnRate,
    });
  }

  return snapshots.sort((a, b) => a.symbol.localeCompare(b.symbol));
}

function uniqueMentionedAssets(
  mentions: FinzReviewMention[],
  assetCatalog: FinzAssetCatalogItem[],
): FinzAssetCatalogItem[] {
  const symbols = new Set(mentions.map((mention) => `${mention.assetType}:${mention.symbol}`));
  return assetCatalog.filter((asset) => symbols.has(`${asset.assetType}:${asset.symbol}`));
}

function mentionsAsset(normalizedText: string, asset: FinzAssetCatalogItem): boolean {
  const aliases = [asset.symbol, ...asset.aliases].map(normalizeText);
  return aliases.some((alias) => {
    if (/^[a-z0-9.-]+$/.test(alias)) {
      return new RegExp(`(^|[^a-z0-9])\\$?${escapeRegExp(alias)}([^a-z0-9]|$)`).test(normalizedText);
    }
    return normalizedText.includes(alias);
  });
}

function detectDirection(normalizedText: string): FinzMentionDirection {
  const order: FinzMentionDirection[] = ["conditional", "positive", "negative", "watching"];
  for (const direction of order) {
    if (DIRECTION_KEYWORDS[direction].some((keyword) => normalizedText.includes(keyword))) {
      return direction;
    }
  }
  return "mention";
}

function dominantDirection(directions: FinzMentionDirection[]): FinzMentionDirection {
  const priority: FinzMentionDirection[] = ["conditional", "positive", "negative", "watching", "mention"];
  const counts = new Map<FinzMentionDirection, number>();
  directions.forEach((direction) => counts.set(direction, (counts.get(direction) ?? 0) + 1));
  return [...counts.entries()].sort(
    (a, b) => b[1] - a[1] || priority.indexOf(a[0]) - priority.indexOf(b[0]),
  )[0]?.[0] ?? "mention";
}

function summarizeMessages(messages: string[]): string {
  return messages
    .slice(0, 2)
    .map((message) => message.trim().replace(/\s+/g, " "))
    .join(" / ")
    .slice(0, 180);
}

function countBySymbol(mentions: FinzReviewMention[]): Array<{ symbol: string; count: number }> {
  const counts = new Map<string, number>();
  mentions.forEach((mention) => counts.set(mention.symbol, (counts.get(mention.symbol) ?? 0) + mention.messageCount));
  return [...counts.entries()]
    .map(([symbol, count]) => ({ symbol, count }))
    .sort((a, b) => b.count - a.count || a.symbol.localeCompare(b.symbol));
}

function formatPriceSnapshot(snapshot: FinzReviewPriceSnapshot): string {
  if (snapshot.baselinePrice == null || snapshot.reviewOpenPrice == null) {
    return "가격 데이터를 가져오지 못했습니다.";
  }
  const sign = snapshot.priceDiff != null && snapshot.priceDiff > 0 ? "+" : "";
  const rateSign = snapshot.returnRate != null && snapshot.returnRate > 0 ? "+" : "";
  const baselineLabel =
    snapshot.baselineSource === "previous-scheduled-review-open"
      ? "전달 정기 리뷰 시가"
      : "첫 확보 가능 시가";
  return `${baselineLabel} ${formatMoney(snapshot.baselinePrice, snapshot.currency)} -> 리뷰 시가 ${formatMoney(
    snapshot.reviewOpenPrice,
    snapshot.currency,
  )}, ${sign}${formatMoney(snapshot.priceDiff ?? 0, snapshot.currency)} (${rateSign}${snapshot.returnRate ?? 0}%)`;
}

function formatMoney(value: number, currency: string): string {
  const prefix = currency === "USD" ? "$" : "";
  return `${prefix}${value.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}

function directionLabel(direction: FinzMentionDirection): string {
  const labels: Record<FinzMentionDirection, string> = {
    positive: "긍정",
    negative: "부정",
    watching: "관망",
    conditional: "조건부",
    mention: "단순 언급",
  };
  return labels[direction];
}

function sortReviews(reviews: FinzReviewRecord[]): FinzReviewRecord[] {
  return [...reviews]
    .filter((review) => isValidDate(review.createdAt))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt));
}

function makeReviewId(roomId: string, kind: FinzReviewKind, requestedAt: string): string {
  return `${roomId}:${kind}:${requestedAt}`;
}

function normalizeText(value: string): string {
  return value.toLowerCase().normalize("NFKC");
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isValidDate(value: string): boolean {
  return Number.isFinite(Date.parse(value));
}

function formatDate(value: string | null): string | null {
  if (!value) return null;
  return new Intl.DateTimeFormat("ko-KR", {
    timeZone: FINZ_MONTHLY_REVIEW_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

function roundRate(value: number): number {
  return Math.round(value * 100) / 100;
}
