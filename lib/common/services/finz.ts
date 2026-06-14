export type FinzTasteCard = {
  id: string;
  label: string;
  tags: string[];
};

export type FinzCharacterStats = {
  attack: number;
  defense: number;
  patience: number;
  research: number;
  fomoRisk: number;
};

export type FinzCharacter = {
  classId: string;
  className: string;
  levelTitle: string;
  summary: string;
  stats: FinzCharacterStats;
  weakness: string;
  tease: string;
  roleMission: string;
};

export type FinzProfile = {
  selectedCardIds: string[];
  selectedCards: FinzTasteCard[];
  selectedTags: string[];
  character: FinzCharacter;
};

export type FinzDailyPick = {
  name: string;
  kind: "stock" | "theme";
  oneLine: string;
  whyThisFits: string[];
  debatePoint: string;
  openingQuestions: string[];
  conversationSeeds: string[];
  rolePrompt: string;
  caveats: string[];
};

// 2인 파티 우정주 픽 (party shape). 단일 rolePrompt 대신 멤버별 rolePrompts[],
// whyThisFits 대신 whyThisParty[]. V0 는 환각 방어로 kind 를 항상 "theme" 로 고정한다.
export type FinzPartyRolePrompt = {
  memberName: string;
  role: string;
  prompt: string;
};

export type FinzPartyPick = {
  name: string;
  kind: "stock" | "theme";
  oneLine: string;
  whyThisParty: string[];
  rolePrompts: FinzPartyRolePrompt[];
  debatePoint: string;
  openingQuestions: string[];
  conversationSeeds: string[];
  caveats: string[];
};

type CharacterArchetype = FinzCharacter & {
  tagWeights: Record<string, number>;
};

export const FINZ_MIN_SELECTIONS = 3;

export const FINZ_TASTE_CARDS: FinzTasteCard[] = [
  {
    id: "world-changing-tech",
    label: "세상을 바꾸는 기술이 좋다",
    tags: ["technology", "growth", "story"],
  },
  {
    id: "durable-company",
    label: "오래 버틸 수 있는 회사가 좋다",
    tags: ["quality", "defense", "patience"],
  },
  {
    id: "daily-brand",
    label: "내가 직접 쓰는 브랜드가 좋다",
    tags: ["brand", "consumer", "quality"],
  },
  {
    id: "big-upside",
    label: "한 방이 있어야 재밌다",
    tags: ["momentum", "growth", "fomo"],
  },
  {
    id: "cashflow-calm",
    label: "현금흐름이 마음을 편하게 한다",
    tags: ["cashflow", "dividend", "defense"],
  },
  {
    id: "crowd-buzz",
    label: "사람들이 떠드는 곳에 기회가 있다",
    tags: ["meme", "momentum", "social"],
  },
  {
    id: "crisis-picker",
    label: "위기 때 줍는 게 좋다",
    tags: ["contrarian", "value", "patience"],
  },
  {
    id: "hidden-value",
    label: "남들이 놓친 저평가를 찾고 싶다",
    tags: ["value", "research", "contrarian"],
  },
  {
    id: "story-first",
    label: "숫자보다 스토리에 끌린다",
    tags: ["story", "founder", "growth"],
  },
  {
    id: "early-discovery",
    label: "유행이 되기 전 먼저 발견하고 싶다",
    tags: ["early", "research", "trend"],
  },
  {
    id: "service-habit",
    label: "매일 쓰는 서비스가 결국 이긴다고 믿는다",
    tags: ["consumer", "brand", "quality"],
  },
  {
    id: "founder-led",
    label: "CEO나 창업자 이야기에 끌린다",
    tags: ["founder", "story", "conviction"],
  },
  {
    id: "steady-dividend",
    label: "배당처럼 꾸준히 들어오는 게 좋다",
    tags: ["dividend", "cashflow", "defense"],
  },
  {
    id: "fear-is-signal",
    label: "모두가 무서워할 때 오히려 궁금해진다",
    tags: ["contrarian", "patience", "value"],
  },
  {
    id: "product-events",
    label: "신제품 발표와 컨퍼런스를 챙겨본다",
    tags: ["technology", "trend", "research"],
  },
  {
    id: "friend-adoption",
    label: "친구들이 쓰기 시작한 앱이 신경 쓰인다",
    tags: ["social", "consumer", "early"],
  },
  {
    id: "growth-over-profit",
    label: "적자여도 성장하면 봐줄 수 있다",
    tags: ["growth", "risk", "fomo"],
  },
  {
    id: "strong-financials",
    label: "재무제표가 단단한 회사를 좋아한다",
    tags: ["quality", "research", "defense"],
  },
  {
    id: "meme-watch",
    label: "밈이 붙은 종목은 일단 관찰한다",
    tags: ["meme", "social", "risk"],
  },
  {
    id: "too-famous-too-late",
    label: "너무 유명해지면 늦었다고 느낀다",
    tags: ["early", "contrarian", "trend"],
  },
];

const CHARACTER_ARCHETYPES: CharacterArchetype[] = [
  {
    classId: "future-tech-dealer",
    className: "미래기술 딜러",
    levelTitle: "Lv.1 상상력 과충전",
    summary:
      "아직 돈을 버는 회사보다 세상을 바꿀 것 같은 회사를 먼저 봅니다. 공격력은 높지만 FOMO 위험도 같이 올라갑니다.",
    stats: { attack: 86, defense: 42, patience: 54, research: 72, fomoRisk: 82 },
    weakness: "좋은 기술과 좋은 투자를 가끔 같은 말로 착각합니다.",
    tease: "컨퍼런스 키노트 뜨면 말이 빨라지는 타입",
    roleMission: "성장 가능성으로 레이드 보스를 공격하세요.",
    tagWeights: { technology: 4, growth: 3, story: 2, trend: 2, fomo: 1 },
  },
  {
    classId: "dividend-healer",
    className: "배당 힐러",
    levelTitle: "Lv.1 현금흐름 수호자",
    summary:
      "화려한 급등보다 꾸준히 버티는 힘을 좋아합니다. 파티가 흥분할 때 회복 주문을 걸어줍니다.",
    stats: { attack: 38, defense: 82, patience: 78, research: 58, fomoRisk: 26 },
    weakness: "너무 안정적인 선택만 보면 파티의 텐션이 살짝 내려갑니다.",
    tease: "차트보다 배당락일을 더 또렷하게 기억하는 타입",
    roleMission: "포트폴리오 안정성과 현금흐름 관점으로 파티를 회복시키세요.",
    tagWeights: { dividend: 4, cashflow: 4, defense: 3, quality: 1, patience: 1 },
  },
  {
    classId: "value-tanker",
    className: "가치 탱커",
    levelTitle: "Lv.1 방어력 계산 중",
    summary:
      "좋은 회사라도 가격이 중요하다고 믿습니다. 하락장에서도 파티 앞줄에서 리스크를 받아냅니다.",
    stats: { attack: 46, defense: 88, patience: 84, research: 76, fomoRisk: 24 },
    weakness: "너무 오래 기다리다가 좋은 파도를 놓칠 때가 있습니다.",
    tease: "싸다는 말 없으면 잘 안 움직이는 타입",
    roleMission: "밸류에이션과 리스크로 레이드 보스의 공격을 막으세요.",
    tagWeights: { value: 4, defense: 3, quality: 3, research: 2, patience: 2 },
  },
  {
    classId: "brand-ranger",
    className: "브랜드 레인저",
    levelTitle: "Lv.1 소비자 감지 모드",
    summary:
      "사람들이 실제로 쓰고 좋아하는 브랜드를 먼저 봅니다. 일상에서 투자 힌트를 잘 줍습니다.",
    stats: { attack: 62, defense: 56, patience: 58, research: 70, fomoRisk: 50 },
    weakness: "좋아하는 제품이면 숫자 검증을 조금 늦게 합니다.",
    tease: "친구들이 새 앱 깔면 종목부터 떠올리는 타입",
    roleMission: "소비자 관찰과 브랜드 힘으로 대화 포인트를 찾으세요.",
    tagWeights: { brand: 4, consumer: 4, social: 2, quality: 1, early: 1 },
  },
  {
    classId: "meme-berserker",
    className: "밈 버서커",
    levelTitle: "Lv.1 과열 감지자",
    summary:
      "시장의 열기와 커뮤니티 에너지를 빠르게 읽습니다. 위험하지만 파티에 대화 폭발력을 줍니다.",
    stats: { attack: 90, defense: 28, patience: 34, research: 50, fomoRisk: 94 },
    weakness: "재밌다는 이유만으로 너무 가까이 다가갈 수 있습니다.",
    tease: "종목보다 댓글창 온도를 먼저 체크하는 타입",
    roleMission: "시장의 과열, 밈 에너지, 군중 심리를 읽어주세요.",
    tagWeights: { meme: 4, momentum: 3, social: 3, risk: 2, fomo: 2 },
  },
  {
    classId: "macro-mage",
    className: "매크로 마법사",
    levelTitle: "Lv.1 금리 주문 연습",
    summary:
      "개별 기업보다 금리, 환율, 경기 흐름을 먼저 봅니다. 파티가 큰 지도를 잊지 않게 해줍니다.",
    stats: { attack: 58, defense: 66, patience: 70, research: 82, fomoRisk: 42 },
    weakness: "큰 흐름을 보다가 눈앞의 제품 감각을 놓칠 수 있습니다.",
    tease: "친구가 앱 얘기할 때 금리 얘기로 받는 타입",
    roleMission: "금리, 환율, 경기 흐름으로 레이드의 배경을 해석하세요.",
    tagWeights: { research: 3, trend: 3, defense: 2, quality: 1, patience: 1 },
  },
  {
    classId: "crisis-scavenger",
    className: "위기 줍줍러",
    levelTitle: "Lv.1 공포 탐색 중",
    summary:
      "모두가 피할 때 오히려 궁금해합니다. 파티에 역발상 질문을 던지는 역할입니다.",
    stats: { attack: 64, defense: 62, patience: 88, research: 72, fomoRisk: 36 },
    weakness: "싼 이유가 진짜 문제인지 확인하는 데 시간이 걸립니다.",
    tease: "폭락 뉴스에 조용히 장바구니 여는 타입",
    roleMission: "시장이 놓친 반전 가능성과 함정을 동시에 찾아보세요.",
    tagWeights: { contrarian: 4, patience: 3, value: 3, risk: 1, research: 1 },
  },
  {
    classId: "story-scout",
    className: "스토리 정찰병",
    levelTitle: "Lv.1 서사 추적자",
    summary:
      "숫자보다 창업자, 제품 방향, 시장의 이야기에 먼저 끌립니다. 파티가 새 테마를 발견하게 돕습니다.",
    stats: { attack: 68, defense: 40, patience: 60, research: 68, fomoRisk: 70 },
    weakness: "검증보다 이야기가 먼저 달려나갈 때가 있습니다.",
    tease: "실적표보다 창업자 인터뷰를 먼저 공유하는 타입",
    roleMission: "이 종목이 왜 사람들의 상상력을 건드리는지 설명하세요.",
    tagWeights: { story: 4, founder: 4, early: 2, conviction: 2, growth: 1 },
  },
];

export function getSelectedTasteCards(selectedIds: string[]): FinzTasteCard[] {
  const selected = new Set(selectedIds);
  return FINZ_TASTE_CARDS.filter((card) => selected.has(card.id));
}

export function summarizeTasteTags(cards: FinzTasteCard[], limit = 4): string[] {
  const tagCounts = new Map<string, number>();

  cards.forEach((card) => {
    card.tags.forEach((tag) => {
      tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    });
  });

  return [...tagCounts.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([tag]) => tag);
}

export function summonFinzCharacter(selectedIds: string[]): FinzCharacter | null {
  const selectedCards = getSelectedTasteCards(selectedIds);
  if (selectedCards.length < FINZ_MIN_SELECTIONS) return null;

  const selectedTags = selectedCards.flatMap((card) => card.tags);
  const [winner] = CHARACTER_ARCHETYPES.map((character, index) => {
    const score = selectedTags.reduce(
      (sum, tag) => sum + (character.tagWeights[tag] ?? 0),
      0,
    );
    return { character, index, score };
  }).sort((a, b) => b.score - a.score || a.index - b.index);

  if (!winner) return null;

  const { tagWeights: _tagWeights, ...character } = winner.character;
  return character;
}

export function buildFinzProfile(selectedIds: string[]): FinzProfile | null {
  const selectedCards = getSelectedTasteCards(selectedIds);
  const character = summonFinzCharacter(selectedIds);
  if (!character) return null;

  return {
    selectedCardIds: selectedCards.map((card) => card.id),
    selectedCards,
    selectedTags: summarizeTasteTags(selectedCards, 6),
    character,
  };
}

export function finzProfileKey(profile: Pick<FinzProfile, "selectedCardIds" | "character">): string {
  return [profile.character.classId, ...profile.selectedCardIds].join("|");
}

const FINZ_FALLBACK_THEMES: Record<string, { name: string; why: string; debate: string }> = {
  "future-tech-dealer": {
    name: "요즘 가장 뜨거운 기술 트렌드",
    why: "세상을 바꿀 기술과 성장 스토리에 먼저 반응하는 당신다운 주제예요.",
    debate: "지금 이 기술은 진짜 변화일까, 아니면 과열된 기대일까?",
  },
  "dividend-healer": {
    name: "오래 버티는 배당·현금흐름 이야기",
    why: "화려한 급등보다 꾸준한 현금흐름을 좋아하는 당신과 잘 맞아요.",
    debate: "안정적인 배당주는 지금도 매력적일까, 성장에서 너무 멀어진 걸까?",
  },
  "value-tanker": {
    name: "싸게 사서 버티는 가치투자 이야기",
    why: "좋은 회사라도 가격과 체력을 먼저 따지는 당신의 결에 맞는 주제예요.",
    debate: "싸다는 건 기회일까, 싼 데는 이유가 있는 함정일까?",
  },
  "brand-ranger": {
    name: "내가 매일 쓰는 브랜드 이야기",
    why: "사람들이 실제로 쓰고 좋아하는 브랜드를 먼저 보는 당신답죠.",
    debate: "익숙한 브랜드는 안전한 선택일까, 이미 다 알려져 늦은 걸까?",
  },
  "meme-berserker": {
    name: "지금 커뮤니티가 떠드는 화제의 종목",
    why: "시장의 열기와 커뮤니티 에너지를 빠르게 읽는 당신과 어울려요.",
    debate: "이 분위기는 진짜 신호일까, 곧 식을 거품일까?",
  },
  "macro-mage": {
    name: "금리·환율·경기 흐름 이야기",
    why: "개별 기업보다 큰 흐름을 먼저 보는 당신의 시야에 맞아요.",
    debate: "지금 매크로 환경은 위험 신호일까, 과한 걱정일까?",
  },
  "crisis-scavenger": {
    name: "남들이 무서워할 때 줍는 역발상 이야기",
    why: "모두가 피할 때 오히려 궁금해하는 당신다운 주제예요.",
    debate: "지금의 공포는 줍줍 기회일까, 아직 더 떨어질 신호일까?",
  },
  "story-scout": {
    name: "숫자보다 스토리에 끌리는 종목 이야기",
    why: "창업자와 제품의 서사에 먼저 끌리는 당신과 잘 맞아요.",
    debate: "좋은 스토리는 좋은 투자로 이어질까, 이야기에 취한 걸까?",
  },
};

const FINZ_FALLBACK_DEFAULT = {
  name: "오늘 가볍게 던져볼 투자 이야기",
  why: "당신의 취향 카드와 어울리는, 부담 없이 시작할 수 있는 주제예요.",
  debate: "지금 들어가는 건 기회일까, 늦은 걸까?",
};

// AI 생성이 실패했을 때(키 미설정·모델 장애·응답 파싱/스키마 실패 등) 대화가 끊기지 않도록
// 프로필만으로 만드는 deterministic 폴백 픽. 실명 종목 환각을 피하려고 안전한 '테마'를 쓴다.
export function buildFinzFallbackPick(
  profile: Pick<FinzProfile, "character" | "selectedTags">,
): FinzDailyPick {
  const theme = FINZ_FALLBACK_THEMES[profile.character.classId] ?? FINZ_FALLBACK_DEFAULT;
  const tags = profile.selectedTags.slice(0, 3);
  return {
    name: theme.name,
    kind: "theme",
    oneLine: `${profile.character.className}답게 친구들과 가볍게 이야기 나눠볼 오늘의 소재예요.`,
    whyThisFits: [
      theme.why,
      tags.length > 0
        ? `당신의 취향(${tags.join(", ")})과 결이 맞는 주제예요.`
        : "당신의 취향 카드와 어울리는 주제예요.",
      "정답을 맞히는 게 아니라 서로의 관점을 꺼내보는 게 목적이에요.",
    ],
    debatePoint: theme.debate,
    openingQuestions: [
      "이 주제에서 너는 어떤 회사가 먼저 떠올라?",
      "지금 들어가는 건 늦은 걸까, 아직 기회일까?",
    ],
    conversationSeeds: [
      "최근에 이 주제로 눈에 띈 뉴스가 있었어?",
      "친구 중에 여기 진심인 사람 있어?",
      "10년 뒤에도 살아남을 회사는 어디일 것 같아?",
    ],
    rolePrompt: profile.character.roleMission,
    caveats: [
      "FINZ는 투자 조언이나 매매 추천이 아니라, 친구들과 이야기할 대화 소재를 만드는 실험이에요.",
      "지금은 AI 생성이 잠시 불안정해 기본 소재로 보여주고 있어요. 잠시 뒤 다시 생성하면 더 맞춤된 우정주를 받을 수 있어요.",
    ],
  };
}

// 파티 AI 생성 실패 시(또는 멤버 카드가 카탈로그 변경으로 깨졌을 때) 쓰는 deterministic 폴백.
// 멤버 profile 이 null(카탈로그 드리프트)이어도 견디게 — resolve 된 멤버를 driver 로 쓰고,
// 안 되는 멤버는 일반 role 로 채운다. 항상 theme.
export function buildFinzPartyFallbackPick(
  members: Array<{ name: string; profile: Pick<FinzProfile, "character" | "selectedTags"> | null }>,
): FinzPartyPick {
  const driver = members.find((m) => m.profile)?.profile ?? null;
  const theme = driver
    ? FINZ_FALLBACK_THEMES[driver.character.classId] ?? FINZ_FALLBACK_DEFAULT
    : FINZ_FALLBACK_DEFAULT;

  const whyThisParty: string[] = [theme.why];
  members.forEach((m) => {
    if (!m.profile) return;
    const tags = m.profile.selectedTags.slice(0, 3);
    whyThisParty.push(
      tags.length > 0
        ? `${m.name}의 취향(${tags.join(", ")})과도 자연스럽게 이어지는 주제예요.`
        : `${m.name}의 취향과도 어울리는 주제예요.`,
    );
  });
  whyThisParty.push("정답을 맞히는 게 아니라 서로의 관점을 꺼내보는 게 목적이에요.");

  const rolePrompts: FinzPartyRolePrompt[] = members.map((m) =>
    m.profile
      ? { memberName: m.name, role: m.profile.character.className, prompt: m.profile.character.roleMission }
      : { memberName: m.name, role: "파티원", prompt: "이 테마에 대한 솔직한 첫인상을 먼저 나눠보세요." },
  );

  return {
    name: theme.name,
    kind: "theme",
    oneLine: "두 사람이 가볍게 이야기 나눠볼 오늘의 소재예요.",
    whyThisParty,
    rolePrompts,
    debatePoint: theme.debate,
    openingQuestions: [
      "둘 중 누가 이 테마에 더 끌려? 이유는?",
      "지금 들어가는 건 늦은 걸까, 아직 기회일까?",
    ],
    conversationSeeds: [
      "최근에 이 테마로 눈에 띈 뉴스가 있었어?",
      "둘이 생각하는 '대장' 회사가 같아, 달라?",
      "10년 뒤에도 살아남을 회사는 어디일 것 같아?",
    ],
    caveats: [
      "FINZ는 투자 조언이나 매매 추천이 아니라, 친구들과 이야기할 대화 소재를 만드는 실험이에요.",
      "지금은 AI 생성이 잘 안 돼 기본 소재로 보여주고 있어요. 잠시 뒤 다시 생성하면 더 맞춤된 우정주를 받을 수 있어요.",
    ],
  };
}

export function isFinzDailyPick(value: unknown): value is FinzDailyPick {
  if (!value || typeof value !== "object") return false;
  const pick = value as Partial<FinzDailyPick>;
  return (
    typeof pick.name === "string" &&
    (pick.kind === "stock" || pick.kind === "theme") &&
    typeof pick.oneLine === "string" &&
    stringArray(pick.whyThisFits) &&
    typeof pick.debatePoint === "string" &&
    stringArray(pick.openingQuestions) &&
    stringArray(pick.conversationSeeds) &&
    typeof pick.rolePrompt === "string" &&
    stringArray(pick.caveats)
  );
}

export function isFinzPartyPick(value: unknown): value is FinzPartyPick {
  if (!value || typeof value !== "object") return false;
  const pick = value as Partial<FinzPartyPick>;
  return (
    typeof pick.name === "string" &&
    (pick.kind === "stock" || pick.kind === "theme") &&
    typeof pick.oneLine === "string" &&
    stringArray(pick.whyThisParty) &&
    isPartyRolePromptArray(pick.rolePrompts) &&
    typeof pick.debatePoint === "string" &&
    stringArray(pick.openingQuestions) &&
    stringArray(pick.conversationSeeds) &&
    stringArray(pick.caveats)
  );
}

function isPartyRolePromptArray(value: unknown): value is FinzPartyRolePrompt[] {
  return (
    Array.isArray(value) &&
    value.length > 0 &&
    value.every((x) => {
      if (!x || typeof x !== "object") return false;
      const r = x as Partial<FinzPartyRolePrompt>;
      return typeof r.memberName === "string" && typeof r.role === "string" && typeof r.prompt === "string";
    })
  );
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === "string");
}

export const FINZ_DAILY_PICK_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "오늘 이야기할 종목명 또는 테마명",
    },
    kind: {
      type: "string",
      enum: ["stock", "theme"],
    },
    oneLine: {
      type: "string",
      description: "매수 추천이 아니라 대화 소재임을 드러내는 한 줄",
    },
    whyThisFits: {
      type: "array",
      items: { type: "string" },
    },
    debatePoint: {
      type: "string",
    },
    openingQuestions: {
      type: "array",
      items: { type: "string" },
    },
    conversationSeeds: {
      type: "array",
      items: { type: "string" },
    },
    rolePrompt: {
      type: "string",
      description: "사용자 캐릭터가 이 소재를 볼 때 맡으면 좋은 관점",
    },
    caveats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "name",
    "kind",
    "oneLine",
    "whyThisFits",
    "debatePoint",
    "openingQuestions",
    "conversationSeeds",
    "rolePrompt",
    "caveats",
  ],
} as const;

// 파티 픽 Gemini responseSchema. kind 는 enum ["theme"] 로 제약해 constrained decoding 단계에서
// 실종목 픽을 원천 차단(검증 완료). rolePrompts 는 멤버별 객체 배열.
export const FINZ_PARTY_PICK_SCHEMA = {
  type: "object",
  properties: {
    name: {
      type: "string",
      description: "두 사람이 함께 이야기할 상위 테마/섹터명. 실제 상장사명·티커 금지.",
    },
    kind: {
      type: "string",
      enum: ["theme"],
    },
    oneLine: {
      type: "string",
      description: "매수 추천이 아니라 대화 소재임을 드러내는 한 줄",
    },
    whyThisParty: {
      type: "array",
      items: { type: "string" },
      description: "두 사람 각각의 취향을 언급하고 어떻게 만나는지",
    },
    rolePrompts: {
      type: "array",
      items: {
        type: "object",
        properties: {
          memberName: { type: "string" },
          role: { type: "string" },
          prompt: { type: "string" },
        },
        required: ["memberName", "role", "prompt"],
      },
    },
    debatePoint: {
      type: "string",
    },
    openingQuestions: {
      type: "array",
      items: { type: "string" },
    },
    conversationSeeds: {
      type: "array",
      items: { type: "string" },
    },
    caveats: {
      type: "array",
      items: { type: "string" },
    },
  },
  required: [
    "name",
    "kind",
    "oneLine",
    "whyThisParty",
    "rolePrompts",
    "debatePoint",
    "openingQuestions",
    "conversationSeeds",
    "caveats",
  ],
} as const;
