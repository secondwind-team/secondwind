"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { getOrCreateMemberId, rememberPartyMembership } from "@/lib/common/finz-party-id";
import { FinzCharacterBuilder } from "./finz-character-builder";

// 파티 생성: 캐릭터를 만들고 → POST /api/finz/party → 발급된 룸으로 이동.
export function FinzPartyCreate() {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create(selectedCardIds: string[], displayName: string) {
    setPending(true);
    setError(null);
    try {
      const memberId = getOrCreateMemberId();
      const res = await fetch("/api/finz/party", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, displayName, selectedCardIds }),
      });
      const json = (await res.json()) as { status: string; id?: string; url?: string };
      if (!res.ok || json.status !== "ok" || !json.id) {
        throw new Error(
          json.status === "not-configured"
            ? "지금은 파티 기능을 사용할 수 없어요. 잠시 뒤 다시 시도해주세요."
            : "파티를 만들지 못했어요. 잠시 뒤 다시 시도해주세요.",
        );
      }
      rememberPartyMembership(json.id, memberId);
      router.push(json.url ?? `/finz/party/${json.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "파티를 만들지 못했어요.");
      setPending(false);
    }
  }

  return (
    <div className="space-y-4">
      <FinzCharacterBuilder submitLabel="파티 만들고 링크 받기" pending={pending} onSubmit={create} />
      {error && (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>
      )}
    </div>
  );
}
