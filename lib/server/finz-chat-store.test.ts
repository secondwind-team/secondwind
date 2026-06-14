import { beforeEach, describe, expect, it, vi } from "vitest";

// 인메모리 mock redis + 가변 그룹. vi.hoisted 로 만들어 mock 팩토리에서 안전하게 참조.
const h = vi.hoisted(() => {
  const lists = new Map<string, unknown[]>();
  const kv = new Map<string, string>();
  let members = [
    { memberId: "a", displayName: "지헌", selectedCardIds: ["x"], joinedAt: "t" },
    { memberId: "b", displayName: "태훈", selectedCardIds: ["y"], joinedAt: "t" },
  ];
  const redis = {
    async llen(key: string) {
      return (lists.get(key) ?? []).length;
    },
    async lrange(key: string, start: number, end: number) {
      const arr = lists.get(key) ?? [];
      const n = arr.length;
      const s = start < 0 ? Math.max(0, n + start) : start;
      const e = end < 0 ? n + end : end;
      return arr.slice(s, e + 1);
    },
    async rpush(key: string, val: unknown) {
      const arr = lists.get(key) ?? [];
      arr.push(val);
      lists.set(key, arr);
      return arr.length;
    },
    async set(key: string, val: string, opts?: { nx?: boolean }) {
      if (opts?.nx && kv.has(key)) return null;
      kv.set(key, val);
      return "OK";
    },
    async del(key: string) {
      kv.delete(key);
      return 1;
    },
    pipeline() {
      const p = { expire() { return p; }, async exec() { return []; } };
      return p;
    },
  };
  return {
    lists,
    kv,
    redis,
    getMembers: () => members,
    setMembers: (m: typeof members) => {
      members = m;
    },
  };
});

vi.mock("./finz-group-store", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./finz-group-store")>();
  return {
    ...actual,
    getClient: () => h.redis,
    getFinzGroup: async (id: string) => ({ id, members: h.getMembers(), createdAt: "t", expiresAt: "t" }),
  };
});

import {
  acquirePickLock,
  appendTextMessage,
  getChatTail,
} from "./finz-chat-store";

const CHAT_KEY = "sw:finz:chat:abc123";

beforeEach(() => {
  h.lists.clear();
  h.kv.clear();
  h.setMembers([
    { memberId: "a", displayName: "지헌", selectedCardIds: ["x"], joinedAt: "t" },
    { memberId: "b", displayName: "태훈", selectedCardIds: ["y"], joinedAt: "t" },
  ]);
});

describe("getChatTail — dual-mode 파싱(객체 prod / 문자열 mock)", () => {
  it("객체 원소와 문자열 원소를 모두 파싱하고 seq=인덱스 부여", () => {
    const objMsg = { id: "m0", role: "member", authorId: "a", authorName: "지헌", kind: "text", text: "hi", createdAt: "t" };
    const strMsg = JSON.stringify({ id: "m1", role: "finz", authorId: "finz", authorName: "FINZ", kind: "summary", payload: { summary: "s", nextNudge: "n" }, createdAt: "t" });
    h.lists.set(CHAT_KEY, [objMsg, strMsg]);

    return getChatTail("abc123", -1).then((tail) => {
      expect(tail.total).toBe(2);
      expect(tail.messages).toHaveLength(2);
      expect(tail.messages[0]?.seq).toBe(0);
      expect(tail.messages[1]?.seq).toBe(1);
      expect(tail.cursor).toBe(1);
    });
  });

  it("after 로 그 이후만 필터", async () => {
    h.lists.set(CHAT_KEY, [
      { id: "m0", role: "member", authorId: "a", authorName: "지헌", kind: "text", text: "0", createdAt: "t" },
      { id: "m1", role: "member", authorId: "b", authorName: "태훈", kind: "text", text: "1", createdAt: "t" },
    ]);
    const tail = await getChatTail("abc123", 0);
    expect(tail.messages).toHaveLength(1);
    expect(tail.messages[0]?.seq).toBe(1);
  });

  it("깨진 원소는 드롭하되 seq 는 절대 인덱스 유지", async () => {
    h.lists.set(CHAT_KEY, [
      { nope: true },
      { id: "m1", role: "member", authorId: "a", authorName: "지헌", kind: "text", text: "ok", createdAt: "t" },
    ]);
    const tail = await getChatTail("abc123", -1);
    expect(tail.messages).toHaveLength(1);
    expect(tail.messages[0]?.seq).toBe(1); // 인덱스 1 유지(0 은 드롭)
  });
});

describe("appendTextMessage", () => {
  it("멤버면 저장하고 authorName 은 서버 조회값", async () => {
    const r = await appendTextMessage("abc123", "a", "  안녕  ");
    expect(r.status).toBe("ok");
    expect(r.message?.kind).toBe("text");
    expect(r.message?.authorName).toBe("지헌");
    if (r.message?.kind === "text") expect(r.message.text).toBe("안녕"); // trim
  });
  it("멤버가 아니면 not-member", async () => {
    expect((await appendTextMessage("abc123", "zzz", "hi")).status).toBe("not-member");
  });
  it("finz/system 위조는 not-member", async () => {
    expect((await appendTextMessage("abc123", "finz", "hi")).status).toBe("not-member");
    expect((await appendTextMessage("abc123", "system", "hi")).status).toBe("not-member");
  });
  it("빈 텍스트는 empty", async () => {
    expect((await appendTextMessage("abc123", "a", "   ")).status).toBe("empty");
  });
  it("연속 전송은 레이트 리밋", async () => {
    expect((await appendTextMessage("abc123", "a", "first")).status).toBe("ok");
    expect((await appendTextMessage("abc123", "a", "second")).status).toBe("rate-limited");
  });
  it("clientId 를 주면 그걸 메시지 id 로 쓴다(재시도 dedup용)", async () => {
    const r = await appendTextMessage("abc123", "a", "hi", "temp-uuid-1");
    expect(r.message?.id).toBe("temp-uuid-1");
  });
});

describe("acquirePickLock", () => {
  it("처음엔 true, 두 번째는 false, force 면 reroll-lock 으로 다시 true", async () => {
    expect(await acquirePickLock("abc123", false)).toBe(true);
    expect(await acquirePickLock("abc123", false)).toBe(false);
    expect(await acquirePickLock("abc123", true)).toBe(true); // reroll-lock 획득 → pick-lock del 후 재획득
  });
  it("동시 force 두 번은 하나만 통과(reroll-lock 레이스 방지)", async () => {
    await acquirePickLock("abc123", false); // pick-lock 점유
    expect(await acquirePickLock("abc123", true)).toBe(true); // 첫 force 승
    expect(await acquirePickLock("abc123", true)).toBe(false); // 둘째 force: reroll-lock 이 막음
  });
});
