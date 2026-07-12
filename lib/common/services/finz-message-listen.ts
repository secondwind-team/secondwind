import type { FinzChatMessage } from "./finz-chat";

export const FINZ_LISTEN_MIN_TEXT_LENGTH = 120;

export function canListenToFinzMessage(message: FinzChatMessage, minLength = FINZ_LISTEN_MIN_TEXT_LENGTH): boolean {
  return (
    message.kind === "text" &&
    !message.deletedAt &&
    typeof message.text === "string" &&
    message.text.length >= minLength
  );
}

export function prepareFinzSpeechText(input: string): string {
  return input
    .replace(/https?:\/\/[^\s<>)\]]+/gi, " 링크 ")
    .replace(/<[^>]*>/g, " ")
    .replace(/\[([^\]]+)\]\((?:https?:\/\/)?[^)]+\)/g, "$1 링크")
    .replace(/[`*_~>#|[\](){}]/g, " ")
    .replace(/^\s*[-+]\s+/gm, " ")
    .replace(/@\s*(?:finz|핀즈|에이아이|ai(?![a-z]))/gi, "핀즈")
    .replace(
      /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}]/gu,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}
