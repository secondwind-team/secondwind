import { describe, expect, it } from "vitest";
import { parseFinzInline, parseFinzBlocks, hasFinzMarkdown } from "./finz-markdown";

describe("parseFinzInline", () => {
  it("평문은 단일 text 토큰", () => {
    expect(parseFinzInline("안녕 반가워")).toEqual([{ type: "text", value: "안녕 반가워" }]);
  });

  it("**굵게** 를 bold 로 (제보된 라인: 괄호·콜론 포함)", () => {
    expect(parseFinzInline("**테슬라 (TSLA):** 자율주행 선두주자")).toEqual([
      { type: "bold", value: "테슬라 (TSLA):" },
      { type: "text", value: " 자율주행 선두주자" },
    ]);
  });

  it("*기울임* 을 italic 으로", () => {
    expect(parseFinzInline("이건 *강조* 야")).toEqual([
      { type: "text", value: "이건 " },
      { type: "italic", value: "강조" },
      { type: "text", value: " 야" },
    ]);
  });

  it("`코드` 를 code 로", () => {
    expect(parseFinzInline("값은 `005930` 이야")).toEqual([
      { type: "text", value: "값은 " },
      { type: "code", value: "005930" },
      { type: "text", value: " 이야" },
    ]);
  });

  it("[링크](url) 를 link 로", () => {
    expect(parseFinzInline("출처 [네이버](https://naver.com) 참고")).toEqual([
      { type: "text", value: "출처 " },
      { type: "link", value: "네이버", href: "https://naver.com" },
      { type: "text", value: " 참고" },
    ]);
  });

  it("** 가 * 보다 우선 — **굵게** 가 italic 으로 쪼개지지 않는다", () => {
    expect(parseFinzInline("**굵게**")).toEqual([{ type: "bold", value: "굵게" }]);
  });

  it("여러 토큰 혼합", () => {
    expect(parseFinzInline("**A** 그리고 *B*")).toEqual([
      { type: "bold", value: "A" },
      { type: "text", value: " 그리고 " },
      { type: "italic", value: "B" },
    ]);
  });

  it("snake_case(밑줄)는 italic 으로 오인하지 않는다", () => {
    expect(parseFinzInline("CRON_SECRET 을 설정해")).toEqual([{ type: "text", value: "CRON_SECRET 을 설정해" }]);
  });

  it("빈 강조(****)는 리터럴 텍스트로 흘린다(무한루프 방지)", () => {
    const out = parseFinzInline("a****b");
    expect(out.map((t) => t.value).join("")).toBe("a****b");
  });
});

describe("parseFinzBlocks", () => {
  it("불릿(*, -, •)을 한 리스트로 묶는다", () => {
    const text = "* 첫째\n- 둘째\n• 셋째";
    expect(parseFinzBlocks(text)).toEqual([{ type: "bullet", items: ["첫째", "둘째", "셋째"] }]);
  });

  it("번호 목록(1. 2.)을 ordered 로", () => {
    const text = "1. 현대차\n2. 삼성전자\n3) 모트렉스";
    expect(parseFinzBlocks(text)).toEqual([
      {
        type: "ordered",
        items: [
          { num: 1, text: "현대차" },
          { num: 2, text: "삼성전자" },
          { num: 3, text: "모트렉스" },
        ],
      },
    ]);
  });

  it("# 제목을 heading 으로(레벨 보존)", () => {
    expect(parseFinzBlocks("## 미래 모빌리티")).toEqual([{ type: "heading", level: 2, text: "미래 모빌리티" }]);
  });

  it("빈 줄로 문단을 나눈다", () => {
    expect(parseFinzBlocks("첫 문단\n\n둘째 문단")).toEqual([
      { type: "paragraph", lines: ["첫 문단"] },
      { type: "paragraph", lines: ["둘째 문단"] },
    ]);
  });

  it("문단 → 불릿 전환 시 각각 블록으로 분리", () => {
    const text = "추천 종목이야:\n* 현대차\n* 삼성전자";
    expect(parseFinzBlocks(text)).toEqual([
      { type: "paragraph", lines: ["추천 종목이야:"] },
      { type: "bullet", items: ["현대차", "삼성전자"] },
    ]);
  });

  it("제보된 케이스: 불릿 + 인라인 굵게", () => {
    const text = "*   **테슬라 (TSLA):** 자율주행 전기차 분야의 선두주자이고\n*   **엔비디아 (NVDA):** AI 칩";
    const blocks = parseFinzBlocks(text);
    expect(blocks).toHaveLength(1);
    expect(blocks[0]).toEqual({
      type: "bullet",
      items: ["**테슬라 (TSLA):** 자율주행 전기차 분야의 선두주자이고", "**엔비디아 (NVDA):** AI 칩"],
    });
    // 각 항목은 렌더 시 인라인 파싱되어 bold 가 적용된다.
    expect(parseFinzInline((blocks[0] as { items: string[] }).items[0]!)[0]).toEqual({
      type: "bold",
      value: "테슬라 (TSLA):",
    });
  });
});

describe("hasFinzMarkdown", () => {
  it("평문은 false", () => {
    expect(hasFinzMarkdown("그냥 평범한 답변이야. 줄바꿈도 있어\n두 번째 줄.")).toBe(false);
  });
  it("불릿/굵게/번호/제목이 있으면 true", () => {
    expect(hasFinzMarkdown("* 항목")).toBe(true);
    expect(hasFinzMarkdown("**굵게**")).toBe(true);
    expect(hasFinzMarkdown("1. 첫째")).toBe(true);
    expect(hasFinzMarkdown("# 제목")).toBe(true);
  });
});
