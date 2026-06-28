"use client";

import { Fragment, type ReactNode } from "react";
import { splitByMentionTokens } from "@/lib/common/services/finz-chat";
import {
  parseFinzBlocks,
  parseFinzInline,
  type FinzInlineToken,
} from "@/lib/common/services/finz-markdown";

// finz 봇 메시지의 경량 마크다운 렌더 — 순수 파서(finz-markdown)가 만든 블록/인라인 토큰을
// finz 디자인 토큰(--fz-*)으로 그린다. 불릿은 코랄 점, 번호는 코랄 숫자(브랜드 톤).
// HTML 을 직접 만들지 않고 React 노드만 생성한다(인젝션 표면 0). 멘션(@finz·@멤버)은 기존처럼 칩으로.

// 인라인 토큰 → React. text 토큰 안에서만 멘션을 칩으로 강조(굵게/링크 등 안엔 멘션 없다고 가정).
function renderInline(text: string, mentionNames: string[], keyBase: string): ReactNode[] {
  return parseFinzInline(text).map((token, i) => renderToken(token, mentionNames, `${keyBase}-${i}`));
}

function renderToken(token: FinzInlineToken, mentionNames: string[], key: string): ReactNode {
  switch (token.type) {
    case "bold":
      return (
        <strong key={key} className="font-bold text-[var(--fz-ink)]">
          {token.value}
        </strong>
      );
    case "italic":
      return (
        <em key={key} className="italic">
          {token.value}
        </em>
      );
    case "code":
      return (
        <code
          key={key}
          className="rounded-[6px] bg-[var(--fz-surface-2)] px-1 py-0.5 font-mono text-[0.85em] text-[var(--fz-coral-ink)]"
        >
          {token.value}
        </code>
      );
    case "link":
      return (
        <a
          key={key}
          href={token.href}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium text-[var(--fz-coral-ink)] underline underline-offset-2"
        >
          {token.value}
        </a>
      );
    default:
      // 일반 텍스트 — 멘션 토큰만 칩으로.
      return (
        <Fragment key={key}>
          {splitByMentionTokens(token.value, mentionNames).map((seg, j) =>
            seg.isMention ? (
              <span key={j} className="fz-mention">
                {seg.text}
              </span>
            ) : (
              <Fragment key={j}>{seg.text}</Fragment>
            ),
          )}
        </Fragment>
      );
  }
}

// 한 줄(인라인만) — 카드의 짧은 자유 텍스트 필드용. 블록 구조 없이 굵게/기울임/코드/링크/멘션만 적용.
export function FinzInlineText({ text, mentionNames = [] }: { text: string; mentionNames?: string[] }) {
  return <>{renderInline(text, mentionNames, "inl")}</>;
}

// 멀티라인(블록) — finz 답변 말풍선용. 문단/불릿/번호/제목을 finz 톤으로 렌더.
export function FinzRichText({ text, mentionNames = [] }: { text: string; mentionNames?: string[] }) {
  const blocks = parseFinzBlocks(text);
  return (
    <div className="space-y-2">
      {blocks.map((block, bi) => {
        const key = `b${bi}`;
        if (block.type === "heading") {
          const size = block.level <= 1 ? "text-[15px]" : "text-sm";
          return (
            <p key={key} className={`font-bold text-[var(--fz-ink)] ${size}`}>
              {renderInline(block.text, mentionNames, key)}
            </p>
          );
        }
        if (block.type === "bullet") {
          return (
            <ul key={key} className="space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2">
                  <span
                    className="mt-[0.55em] h-[5px] w-[5px] shrink-0 rounded-full bg-[var(--fz-coral)]"
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">{renderInline(item, mentionNames, `${key}-${ii}`)}</span>
                </li>
              ))}
            </ul>
          );
        }
        if (block.type === "ordered") {
          return (
            <ol key={key} className="space-y-1">
              {block.items.map((item, ii) => (
                <li key={ii} className="flex gap-2">
                  <span className="shrink-0 font-bold tabular-nums text-[var(--fz-coral-ink)]">{item.num}.</span>
                  <span className="min-w-0 flex-1">{renderInline(item.text, mentionNames, `${key}-${ii}`)}</span>
                </li>
              ))}
            </ol>
          );
        }
        // paragraph — 줄마다 인라인 렌더, 줄바꿈은 <br/>.
        return (
          <p key={key} className="break-words">
            {block.lines.map((line, li) => (
              <Fragment key={li}>
                {li > 0 && <br />}
                {renderInline(line, mentionNames, `${key}-${li}`)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}
