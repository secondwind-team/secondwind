"use client";

import { AtSign, Check, LogOut, Pencil, RotateCcw, Sparkles, X } from "lucide-react";
import { signOut } from "next-auth/react";
import { useEffect, useMemo, useState } from "react";
import {
  FINZ_BIO_MAX,
  FINZ_DISPLAY_NAME_MAX,
  FINZ_HANDLE_MAX,
  formatHandle,
  isValidHandle,
  normalizeHandle,
  type FinzAccount,
} from "@/lib/common/services/finz-account";
import {
  FINZ_MIN_SELECTIONS,
  FINZ_TASTE_CARDS,
  getSelectedTasteCards,
  summarizeTasteTags,
  summonFinzCharacter,
} from "@/lib/common/services/finz";
import { FinzCharacterCard, finzClassEmoji } from "./finz-character-card";
import { useFinzAccountCtx } from "./finz-account-context";

type HandleState = "idle" | "checking" | "available" | "taken" | "invalid";

// 프로필 탭 본문. 상단 헤더/하단 탭바는 (tabs)/layout 이 제공하므로 여기선 본문만 렌더한다.
// 보기 모드 ↔ 편집 모드 토글. 편집 저장 성공 시 setAccount 로 컨텍스트를 갱신한다.
export function FinzProfileView({ account }: { account: FinzAccount }) {
  const { setAccount } = useFinzAccountCtx();
  const [editing, setEditing] = useState(false);

  // ── 보기 모드 파생값 ──
  const character = useMemo(() => summonFinzCharacter(account.selectedCardIds), [account.selectedCardIds]);
  const tags = useMemo(
    () => summarizeTasteTags(getSelectedTasteCards(account.selectedCardIds)),
    [account.selectedCardIds],
  );
  const avatarEmoji = character ? finzClassEmoji(character.classId) : null;
  const createdAtLabel = useMemo(() => formatJoinDate(account.createdAt), [account.createdAt]);

  return (
    <div className="pb-10">
      {/* ── 따뜻한 그라데이션 배너 ── */}
      <header className="fz-profile-header">
        <span className="fz-avatar h-20 w-20 text-4xl shadow-[var(--fz-shadow)]">
          {avatarEmoji ?? account.displayName.slice(0, 1) ?? "🙂"}
        </span>
        <div>
          <h2 className="fz-display text-2xl text-[var(--fz-ink)]">{account.displayName}</h2>
          <p className="mt-0.5 text-sm font-semibold text-[var(--fz-coral-ink)]">{formatHandle(account.handle)}</p>
        </div>
        {account.bio && (
          <p className="max-w-xs text-sm leading-relaxed text-[var(--fz-muted)]">{account.bio}</p>
        )}
        {!editing && (
          <button type="button" onClick={() => setEditing(true)} className="fz-btn fz-btn--ghost mt-1 px-4 py-2 text-sm">
            <Pencil className="h-4 w-4" aria-hidden />
            프로필 편집
          </button>
        )}
      </header>

      <div className="space-y-4 px-4 pt-5">
        {editing ? (
          <FinzProfileEditor
            account={account}
            onCancel={() => setEditing(false)}
            onSaved={(updated) => {
              setAccount(updated);
              setEditing(false);
            }}
          />
        ) : (
          <>
            {/* ── 내 캐릭터 ── */}
            <section className="space-y-2">
              <p className="fz-seclabel">내 캐릭터</p>
              {character ? (
                <FinzCharacterCard character={character} tags={tags} />
              ) : (
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="fz-bubble fz-bubble--pick w-full p-5 text-left"
                >
                  <p className="fz-display text-lg text-[var(--fz-ink)]">아직 캐릭터가 없어요 ✨</p>
                  <p className="mt-2 text-sm leading-relaxed text-[var(--fz-muted)]">
                    취향 카드 3개로 투자 캐릭터를 소환해봐. 대화방에 들어가려면 캐릭터가 필요해.
                  </p>
                  <span className="fz-btn mt-3 inline-flex">
                    <Sparkles className="h-4 w-4" aria-hidden />
                    캐릭터 소환하기
                  </span>
                </button>
              )}
            </section>

            {/* ── 이력(가벼움) ── */}
            <section className="fz-card p-4">
              <p className="fz-seclabel">이력</p>
              {createdAtLabel && (
                <p className="mt-2 text-sm text-[var(--fz-muted)]">
                  <span className="font-semibold text-[var(--fz-ink)]">{createdAtLabel}</span>
                  부터 핀즈와 함께하고 있어요.
                </p>
              )}
              <p className="mt-1 text-sm text-[var(--fz-muted)]">
                고른 취향 카드 <span className="fz-num font-semibold text-[var(--fz-ink)]">{account.selectedCardIds.length}</span>개
              </p>
            </section>

            {/* ── 안전 카피 + 로그아웃 ── */}
            <p className="px-1 text-center text-xs leading-relaxed text-[var(--fz-muted)]">
              핀즈는 정보 참고용이에요. 투자 조언이 아니라 친구랑 나눌 대화 소재예요.
            </p>
            <button
              type="button"
              onClick={() => void signOut({ callbackUrl: "/finz" })}
              className="fz-btn fz-btn--ghost w-full"
            >
              <LogOut className="h-4 w-4" aria-hidden />
              로그아웃
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// 편집 모드: 표시 이름 / bio / 취향 카드 재선택 / 핸들 변경. 저장 시 POST /api/finz/account.
function FinzProfileEditor({
  account,
  onCancel,
  onSaved,
}: {
  account: FinzAccount;
  onCancel: () => void;
  onSaved: (updated: FinzAccount) => void;
}) {
  const [displayName, setDisplayName] = useState(account.displayName);
  const [bio, setBio] = useState(account.bio);
  const [selectedIds, setSelectedIds] = useState<string[]>(account.selectedCardIds);
  const [handleInput, setHandleInput] = useState(account.handle);
  const [handleState, setHandleState] = useState<HandleState>("idle");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handle = normalizeHandle(handleInput);
  const handleChanged = handle !== account.handle;

  const selectedTags = useMemo(() => summarizeTasteTags(getSelectedTasteCards(selectedIds)), [selectedIds]);
  const previewCharacter = useMemo(() => summonFinzCharacter(selectedIds), [selectedIds]);
  const enoughCards = selectedIds.length >= FINZ_MIN_SELECTIONS;
  const remaining = Math.max(FINZ_MIN_SELECTIONS - selectedIds.length, 0);

  // 핸들이 바뀐 경우에만 디바운스 가용성 체크. 안 바꿨으면 검사 불필요(현재 핸들 그대로 OK).
  useEffect(() => {
    if (!handleChanged) {
      setHandleState("idle");
      return;
    }
    if (!isValidHandle(handle)) {
      setHandleState("invalid");
      return;
    }
    setHandleState("checking");
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/finz/account/handle?handle=${encodeURIComponent(handle)}`, { cache: "no-store" });
        const json = (await res.json()) as { valid?: boolean; available?: boolean };
        if (cancelled) return;
        if (!json.valid) setHandleState("invalid");
        else setHandleState(json.available ? "available" : "taken");
      } catch {
        if (!cancelled) setHandleState("idle");
      }
    }, 400);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [handle, handleChanged]);

  function toggleCard(id: string) {
    setSelectedIds((cur) => (cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id]));
    setError(null);
  }

  // 카드는 비워두거나(캐릭터 없음) 3개 이상. 1~2개만 불가.
  const cardsOk = selectedIds.length === 0 || enoughCards;
  const canSave = cardsOk && (!handleChanged || handleState === "available") && !saving;

  async function save() {
    if (!cardsOk) {
      setError(`취향 카드는 비워두거나 ${FINZ_MIN_SELECTIONS}개 이상 골라줘.`);
      return;
    }
    if (handleChanged && handleState !== "available") {
      setError("쓸 수 있는 핸들을 먼저 정해줘.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      // 서버는 항상 handle/displayName/selectedCardIds/bio 전부를 읽으므로 현재 값을 모두 보낸다.
      const res = await fetch("/api/finz/account", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          handle, // 안 바꿨으면 현재 핸들 그대로
          displayName: displayName.trim(),
          selectedCardIds: selectedIds,
          bio: bio.trim(),
        }),
      });
      const json = (await res.json()) as { status: string; account?: FinzAccount };
      if (res.status === 409 || json.status === "handle-taken") {
        setHandleState("taken");
        setError("방금 누가 같은 핸들을 가져갔어. 다른 걸로 해줘.");
        return;
      }
      if (json.status === "invalid") {
        setError("입력을 다시 확인해줘. 취향 카드는 3개 이상이어야 해.");
        return;
      }
      if (!res.ok || json.status !== "ok" || !json.account) {
        throw new Error("save-failed");
      }
      onSaved(json.account);
    } catch {
      setError("프로필을 저장하지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* 표시 이름 + bio */}
      <section className="fz-card space-y-4 p-5">
        <p className="fz-seclabel">기본 정보</p>
        <label className="block text-sm">
          <span className="font-semibold text-[var(--fz-ink)]">표시 이름</span>
          <input
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={FINZ_DISPLAY_NAME_MAX}
            placeholder="친구들에게 보일 이름"
            className="fz-input mt-1"
            aria-label="표시 이름"
          />
        </label>
        <label className="block text-sm">
          <span className="font-semibold text-[var(--fz-ink)]">한 줄 소개</span>
          <input
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={FINZ_BIO_MAX}
            placeholder="나를 한 줄로 (선택)"
            className="fz-input mt-1"
            aria-label="한 줄 소개"
          />
          <span className="mt-1 block text-right text-xs text-[var(--fz-muted)]">
            {bio.length} / {FINZ_BIO_MAX}
          </span>
        </label>
      </section>

      {/* 핸들 변경 */}
      <section className="fz-card space-y-3 p-5">
        <p className="fz-seclabel">핸들</p>
        <div className="relative">
          <AtSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--fz-muted)]" aria-hidden />
          <input
            value={handleInput}
            onChange={(e) => setHandleInput(e.target.value)}
            maxLength={FINZ_HANDLE_MAX + 2}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            placeholder="jiheon"
            className="fz-input fz-input--icon"
            aria-label="핸들"
          />
        </div>
        <p className="text-xs leading-relaxed text-[var(--fz-muted)]">
          {!handleChanged && "친구가 너를 찾는 주소예요. 소문자·숫자·밑줄 3~20자."}
          {handleChanged && handleState === "checking" && "확인 중…"}
          {handleChanged && handleState === "available" && (
            <span className="inline-flex items-center gap-1 text-[var(--fz-amber-ink)]">
              <Check className="h-3.5 w-3.5" aria-hidden /> {formatHandle(handle)} 쓸 수 있어요
            </span>
          )}
          {handleChanged && handleState === "taken" && (
            <span className="inline-flex items-center gap-1 text-[var(--fz-coral-ink)]">
              <X className="h-3.5 w-3.5" aria-hidden /> 이미 쓰는 핸들이에요
            </span>
          )}
          {handleChanged && handleState === "invalid" && "소문자·숫자·밑줄 3~20자로 정해줘"}
        </p>
      </section>

      {/* 취향 카드 재선택 */}
      <section className="fz-card space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="fz-seclabel">취향 카드</p>
            <p className="mt-1 text-sm leading-relaxed text-[var(--fz-muted)]">
              {enoughCards ? "고른 취향으로 캐릭터가 바뀌어요." : `${remaining}개 더 고르면 돼요.`}
            </p>
          </div>
          <span className="fz-tag shrink-0">
            {selectedIds.length} / {FINZ_MIN_SELECTIONS}
          </span>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {FINZ_TASTE_CARDS.map((card) => {
            const selected = selectedIds.includes(card.id);
            return (
              <button
                key={card.id}
                type="button"
                aria-pressed={selected}
                onClick={() => toggleCard(card.id)}
                className={`flex min-h-20 items-start justify-between gap-3 rounded-[20px] border p-4 text-left transition active:scale-[0.98] ${
                  selected
                    ? "border-transparent bg-[var(--fz-coral-tint)] shadow-[var(--fz-shadow-sm)]"
                    : "border-[var(--fz-line)] bg-[var(--fz-surface)] hover:border-[var(--fz-coral)]"
                }`}
              >
                <span className="text-sm font-semibold leading-relaxed text-[var(--fz-ink)]">{card.label}</span>
                <span
                  className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border ${
                    selected
                      ? "border-transparent bg-[var(--fz-coral)] text-white"
                      : "border-[var(--fz-line)] bg-[var(--fz-surface)] text-transparent"
                  }`}
                  aria-hidden
                >
                  <Check className="h-3.5 w-3.5" />
                </span>
              </button>
            );
          })}
        </div>

        {previewCharacter && (
          <div className="space-y-2">
            <p className="fz-seclabel">미리보기</p>
            <FinzCharacterCard character={previewCharacter} tags={selectedTags} />
          </div>
        )}
      </section>

      {error && <p className="fz-alert">{error}</p>}

      <div className="flex gap-2">
        <button type="button" onClick={onCancel} disabled={saving} className="fz-btn fz-btn--ghost flex-1">
          <RotateCcw className="h-4 w-4" aria-hidden />
          취소
        </button>
        <button type="button" onClick={() => void save()} disabled={!canSave} className="fz-btn flex-1 disabled:opacity-50">
          <Sparkles className="h-4 w-4" aria-hidden />
          {saving ? "저장 중" : "저장하기"}
        </button>
      </div>
    </div>
  );
}

// createdAt(ISO) → "2026년 6월" 류 표시. 파싱 실패 시 null(섹션에서 생략).
function formatJoinDate(createdAt: string | undefined): string | null {
  if (!createdAt) return null;
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return null;
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월`;
}
