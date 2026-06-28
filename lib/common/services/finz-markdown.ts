// finz 봇 메시지의 경량 마크다운 파싱(순수 — 클라이언트/서버 공용, 단위 테스트 대상).
// LLM(ask/브리핑/선제개입 등)이 자연스럽게 뱉는 마크다운(**굵게**, * 불릿, 1. 번호, # 제목)을
// 채팅창에서 예쁘게 렌더하기 위해, 텍스트를 "블록"과 "인라인 토큰"으로 분해한다.
// 렌더는 react 컴포넌트(finz-rich-text)가 담당 — 여기선 HTML 을 만들지 않는다(인젝션 표면 0).
//
// 외부 마크다운 라이브러리를 쓰지 않는 이유: finz 출력은 제한된 부분집합이고(의존성 최소 원칙),
// finz 전용 디자인 토큰(--fz-*)으로 렌더해야 하며, 안전(React 노드 생성, dangerouslySetInnerHTML 금지)을 위해서다.

export type FinzInlineToken =
  | { type: "text"; value: string }
  | { type: "bold"; value: string }
  | { type: "italic"; value: string }
  | { type: "code"; value: string }
  | { type: "link"; value: string; href: string };

// 인라인 패턴 — 우선순위 순(앞이 먼저). 같은 위치면 앞 패턴이 이긴다.
// underscore(_) 변형은 일부러 제외 — snake_case(예: CRON_SECRET) 오탐 방지. LLM 한국어 출력은 * 계열을 쓴다.
const INLINE_PATTERNS: { type: Exclude<FinzInlineToken["type"], "text" | "link">; re: RegExp }[] = [
  { type: "bold", re: /\*\*([^*\n]+?)\*\*/ },
  { type: "code", re: /`([^`\n]+?)`/ },
  { type: "italic", re: /\*([^*\n]+?)\*/ },
];
const LINK_RE = /\[([^\]\n]+?)\]\((https?:\/\/[^)\s]+)\)/;

// 한 줄(또는 한 조각)의 인라인 마크다운을 토큰 배열로. 매칭 안 되는 부분은 text 토큰.
export function parseFinzInline(text: string): FinzInlineToken[] {
  const tokens: FinzInlineToken[] = [];
  let rest = text;
  let guard = 0;
  while (rest.length > 0 && guard++ < 2000) {
    let best: { idx: number; len: number; token: FinzInlineToken } | null = null;

    const link = LINK_RE.exec(rest);
    if (link) best = { idx: link.index, len: link[0].length, token: { type: "link", value: link[1]!, href: link[2]! } };

    for (const p of INLINE_PATTERNS) {
      const m = p.re.exec(rest);
      if (!m) continue;
      if (best === null || m.index < best.idx) {
        best = { idx: m.index, len: m[0].length, token: { type: p.type, value: m[1]! } };
      }
    }

    if (!best) {
      tokens.push({ type: "text", value: rest });
      break;
    }
    if (best.idx > 0) tokens.push({ type: "text", value: rest.slice(0, best.idx) });
    // 빈 캡처(예: **** )는 무한루프 방지 위해 리터럴 텍스트로 흘린다.
    if (best.token.type !== "link" && best.token.value.length === 0) {
      tokens.push({ type: "text", value: rest.slice(best.idx, best.idx + best.len) });
    } else {
      tokens.push(best.token);
    }
    rest = rest.slice(best.idx + best.len);
  }
  return mergeAdjacentText(tokens);
}

function mergeAdjacentText(tokens: FinzInlineToken[]): FinzInlineToken[] {
  const out: FinzInlineToken[] = [];
  for (const t of tokens) {
    const prev = out[out.length - 1];
    if (t.type === "text" && prev && prev.type === "text") prev.value += t.value;
    else out.push(t);
  }
  return out;
}

export type FinzBlock =
  | { type: "paragraph"; lines: string[] } // 각 줄은 렌더 시 parseFinzInline + <br/> 결합
  | { type: "heading"; level: number; text: string }
  | { type: "bullet"; items: string[] }
  | { type: "ordered"; items: { num: number; text: string }[] };

// 멀티라인 텍스트를 블록 배열로. 빈 줄은 블록 경계. 불릿/번호는 연속 줄을 한 리스트로 묶는다.
export function parseFinzBlocks(text: string): FinzBlock[] {
  const lines = text.replace(/\r\n?/g, "\n").split("\n");
  const blocks: FinzBlock[] = [];
  let para: string[] = [];
  let bullets: string[] = [];
  let ordered: { num: number; text: string }[] = [];

  const flushPara = () => {
    if (para.length) blocks.push({ type: "paragraph", lines: para });
    para = [];
  };
  const flushBullets = () => {
    if (bullets.length) blocks.push({ type: "bullet", items: bullets });
    bullets = [];
  };
  const flushOrdered = () => {
    if (ordered.length) blocks.push({ type: "ordered", items: ordered });
    ordered = [];
  };
  const flushAll = () => {
    flushPara();
    flushBullets();
    flushOrdered();
  };

  for (const line of lines) {
    if (/^\s*$/.test(line)) {
      flushAll();
      continue;
    }
    const heading = /^\s{0,3}(#{1,6})\s+(.+?)\s*#*\s*$/.exec(line);
    if (heading) {
      flushAll();
      blocks.push({ type: "heading", level: heading[1]!.length, text: heading[2]! });
      continue;
    }
    const bullet = /^\s*[-*•]\s+(.+)$/.exec(line);
    if (bullet) {
      flushPara();
      flushOrdered();
      bullets.push(bullet[1]!);
      continue;
    }
    const ord = /^\s*(\d{1,3})[.)]\s+(.+)$/.exec(line);
    if (ord) {
      flushPara();
      flushBullets();
      ordered.push({ num: Number(ord[1]), text: ord[2]! });
      continue;
    }
    flushBullets();
    flushOrdered();
    para.push(line.trim());
  }
  flushAll();
  return blocks;
}

// 텍스트에 렌더할 마크다운 구조가 하나라도 있는지(없으면 호출부가 평문 fast-path 가능).
export function hasFinzMarkdown(text: string): boolean {
  return parseFinzBlocks(text).some(
    (b) =>
      b.type === "heading" ||
      b.type === "bullet" ||
      b.type === "ordered" ||
      (b.type === "paragraph" && b.lines.some((l) => parseFinzInline(l).some((t) => t.type !== "text"))),
  );
}
