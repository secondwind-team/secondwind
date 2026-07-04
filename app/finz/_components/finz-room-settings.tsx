"use client";

import Link from "next/link";
import { useState } from "react";
import { Bell, ChevronLeft, Clock, Image as ImageIcon, ListFilter, Pencil, Plus, Trash2, X } from "lucide-react";
import {
  formatRecurringSchedule,
  MIN_INTERVAL_MINUTES,
  RECURRING_CONTENT_MAX,
  type FinzRecurringContentKind,
  type FinzRecurringFreq,
  type FinzRecurringMessage,
} from "@/lib/common/services/finz-recurring";
import type { FinzTrade } from "@/lib/common/services/finz-portfolio";
import type { FinzChatMode } from "@/lib/common/services/finz-chat";
import { useFinzAccount } from "./finz-account-context";
import { FinzPortfolioSettings } from "./finz-portfolio-settings";

const WEEKDAYS = ["일", "월", "화", "수", "목", "금", "토"];

// 채팅방 설정 — 풀블리드(탭바 밖). 정기 메시지·포트폴리오 관리 + 아침 시황 토글. 추후 사진/유형별 보기 등 확장.
export function FinzRoomSettings({
  groupId,
  roomTitle,
  memberIds,
  initialItems,
  initialBriefingSubscribed,
  initialTrades,
  initialMute,
  initialChatMode,
}: {
  groupId: string;
  roomTitle: string;
  memberIds: string[];
  initialItems: FinzRecurringMessage[];
  initialBriefingSubscribed: boolean;
  initialTrades: FinzTrade[];
  initialMute: { muted: boolean; allowMentions: boolean };
  initialChatMode: FinzChatMode;
}) {
  const account = useFinzAccount();
  const memberId = account.accountId;
  const isMember = memberIds.includes(memberId);

  const [items, setItems] = useState<FinzRecurringMessage[]>(initialItems);
  const [briefingOn, setBriefingOn] = useState(initialBriefingSubscribed);
  const [muted, setMuted] = useState(initialMute.muted);
  const [allowMentions, setAllowMentions] = useState(initialMute.allowMentions);
  const [muteBusy, setMuteBusy] = useState(false);
  const [chatMode, setChatMode] = useState<FinzChatMode>(initialChatMode);
  const [modeBusy, setModeBusy] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<FinzRecurringMessage | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  if (!isMember) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-12 text-center">
        <h1 className="fz-display text-2xl text-[var(--fz-ink)]">방 멤버만 설정을 볼 수 있어요.</h1>
        <Link href={`/finz/party/${groupId}`} className="fz-btn mt-6">
          대화방으로
        </Link>
      </div>
    );
  }

  async function toggleBriefing() {
    setError(null);
    const next = !briefingOn;
    setBriefingOn(next); // 낙관적
    try {
      const res = await fetch(`/api/finz/party/${groupId}/briefing/subscribe`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, subscribe: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setBriefingOn(!next); // 롤백
      setError("아침 시황 설정을 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
    }
  }

  // 방 음소거 설정 저장(낙관적 + 실패 시 롤백). muted/allowMentions 를 함께 보낸다.
  async function saveMute(next: { muted: boolean; allowMentions: boolean }) {
    setError(null);
    setMuteBusy(true);
    const prev = { muted, allowMentions };
    setMuted(next.muted);
    setAllowMentions(next.allowMentions);
    try {
      const res = await fetch(`/api/finz/party/${groupId}/mute`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error();
    } catch {
      setMuted(prev.muted); // 롤백
      setAllowMentions(prev.allowMentions);
      setError("알림 설정을 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setMuteBusy(false);
    }
  }

  // 대화 방식(일반/스레드) 전환 — 방 단위(전 멤버 공유). 낙관적 저장 후 실패 시 롤백.
  async function saveMode(next: FinzChatMode) {
    setError(null);
    setModeBusy(true);
    const prev = chatMode;
    setChatMode(next);
    try {
      const res = await fetch(`/api/finz/party/${groupId}/mode`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ mode: next }),
      });
      if (!res.ok) throw new Error();
    } catch {
      setChatMode(prev); // 롤백
      setError("대화 방식을 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setModeBusy(false);
    }
  }

  async function toggleItem(item: FinzRecurringMessage) {
    setError(null);
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/finz/party/${groupId}/recurring/${item.id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId, enabled: !item.enabled }),
      });
      const json = (await res.json()) as { status: string; items?: FinzRecurringMessage[] };
      if (!res.ok || json.status !== "ok") throw new Error();
      if (json.items) setItems(json.items);
    } catch {
      setError("정기 메시지를 바꾸지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setBusyId(null);
    }
  }

  async function deleteItem(item: FinzRecurringMessage) {
    if (typeof window !== "undefined" && !window.confirm(`'${item.content}' 정기 메시지를 삭제할까요?`)) return;
    setError(null);
    setBusyId(item.id);
    try {
      const res = await fetch(`/api/finz/party/${groupId}/recurring/${item.id}`, {
        method: "DELETE",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      const json = (await res.json()) as { status: string; items?: FinzRecurringMessage[] };
      if (!res.ok || json.status !== "ok") throw new Error();
      if (json.items) setItems(json.items);
    } catch {
      setError("삭제하지 못했어. 잠시 뒤 다시 시도해줘.");
    } finally {
      setBusyId(null);
    }
  }

  async function submitForm(values: RecurringFormValues) {
    setError(null);
    const editingId = editing?.id;
    try {
      const res = await fetch(
        editingId ? `/api/finz/party/${groupId}/recurring/${editingId}` : `/api/finz/party/${groupId}/recurring`,
        {
          method: editingId ? "PATCH" : "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ memberId, ...values }),
        },
      );
      const json = (await res.json()) as { status: string; items?: FinzRecurringMessage[]; reason?: string };
      if (res.status === 409 || json.reason === "limit") {
        setError("정기 메시지는 한 방에 최대 10개까지야.");
        return;
      }
      if (res.status === 422 || json.reason === "invalid-input") {
        setError("시각과 내용을 다시 확인해줘.");
        return;
      }
      if (!res.ok || json.status !== "ok") throw new Error();
      if (json.items) setItems(json.items);
      setFormOpen(false);
      setEditing(null);
    } catch {
      setError("저장하지 못했어. 잠시 뒤 다시 시도해줘.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* 헤더 */}
      <div className="flex-none border-b border-[var(--fz-line)] bg-[var(--fz-bg)] px-2 py-2.5">
        <div className="flex items-center gap-1">
          <Link
            href={`/finz/party/${groupId}`}
            className="fz-iconbtn h-9 w-9 shrink-0 border-none bg-transparent shadow-none"
            aria-label="대화방으로"
          >
            <ChevronLeft className="h-5 w-5" aria-hidden />
          </Link>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">채팅방 설정</p>
            <p className="truncate text-xs text-[var(--fz-muted)]">{roomTitle}</p>
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-4 py-5">
        {error && <p className="fz-alert">{error}</p>}

        {/* 대화 방식(일반/스레드) */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-[var(--fz-ink)]">💬 대화 방식</h2>
          <div className="fz-card divide-y divide-[var(--fz-line)]">
            <div className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--fz-ink)]">스레드 모드</p>
                <p className="text-xs leading-relaxed text-[var(--fz-muted)]">
                  {chatMode === "thread"
                    ? "메시지에 답글을 달면 별도 스레드로 모여요(슬랙식). 메인엔 원글만 보여요."
                    : "지금은 일반 채팅이에요. 켜면 답글이 별도 스레드로 정리돼요."}
                </p>
              </div>
              <Toggle
                on={chatMode === "thread"}
                onClick={() => void saveMode(chatMode === "thread" ? "linear" : "thread")}
                disabled={modeBusy}
                label="스레드 모드"
              />
            </div>
          </div>
        </section>

        {/* 알림 음소거 */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-[var(--fz-ink)]">🔔 알림</h2>
          <div className="fz-card divide-y divide-[var(--fz-line)]">
            <div className="flex items-center gap-3 p-3.5">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-[var(--fz-ink)]">이 방 알림 끄기</p>
                <p className="text-xs leading-relaxed text-[var(--fz-muted)]">
                  {muted ? "이 방의 새 메시지 푸시 알림을 받지 않아요." : "새 메시지가 오면 푸시 알림을 받아요."}
                </p>
              </div>
              <Toggle
                on={muted}
                onClick={() => void saveMute({ muted: !muted, allowMentions })}
                disabled={muteBusy}
                label="이 방 알림 끄기"
              />
            </div>
            {muted && (
              <div className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-[var(--fz-ink)]">멘션은 받기</p>
                  <p className="text-xs leading-relaxed text-[var(--fz-muted)]">
                    알림을 꺼도 누가 나를 멘션하면 알림을 받아요.
                  </p>
                </div>
                <Toggle
                  on={allowMentions}
                  onClick={() => void saveMute({ muted, allowMentions: !allowMentions })}
                  disabled={muteBusy}
                  label="멘션은 받기"
                />
              </div>
            )}
          </div>
        </section>

        {/* 정기 메시지 */}
        <section className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-sm font-bold text-[var(--fz-ink)]">⏰ 정기 메시지</h2>
            {!formOpen && (
              <button
                type="button"
                onClick={() => {
                  setEditing(null);
                  setFormOpen(true);
                }}
                className="fz-btn fz-btn--ghost px-3 py-1.5 text-xs"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden />
                추가
              </button>
            )}
          </div>
          <p className="px-1 text-xs leading-relaxed text-[var(--fz-muted)]">
            정해진 시각·주기에 finz 가 메시지를 보내줘요. 채팅방에서 “@finz 매일 9시에 물 마시기 보내줘” 처럼 말해도 등록돼요.
          </p>

          {/* 아침 경제 시황(내장) */}
          <div className="fz-card flex items-center gap-3 p-3.5">
            <span className="text-lg" aria-hidden>
              📈
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">아침 경제 시황</p>
              <p className="truncate text-xs text-[var(--fz-muted)]">매일 오전 9:00 · 그날의 경제 시황 (AI 생성)</p>
            </div>
            <Toggle on={briefingOn} onClick={toggleBriefing} label="아침 경제 시황" />
          </div>

          {/* 사용자 정기 메시지 */}
          {items.map((item) => (
            <div key={item.id} className="fz-card p-3.5">
              <div className="flex items-start gap-3">
                <Clock className="mt-0.5 h-4 w-4 shrink-0 text-[var(--fz-coral)]" aria-hidden />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-sm font-semibold text-[var(--fz-ink)]">{item.content}</p>
                    {(item.contentKind === "ai" || item.contentKind === "chart") && (
                      <span className="shrink-0 rounded-[var(--fz-r-full)] bg-[var(--fz-surface-2)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--fz-coral-ink)]">
                        {item.contentKind === "ai" ? "AI" : "차트"}
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-[var(--fz-muted)]">{formatRecurringSchedule(item)}</p>
                </div>
                <Toggle on={item.enabled} onClick={() => toggleItem(item)} disabled={busyId === item.id} label={item.content} />
              </div>
              <div className="mt-2 flex justify-end gap-1 border-t border-[var(--fz-line)] pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setEditing(item);
                    setFormOpen(true);
                  }}
                  className="inline-flex items-center gap-1 rounded-[var(--fz-r-sm)] px-2 py-1 text-xs font-medium text-[var(--fz-muted)] transition hover:bg-[var(--fz-surface-2)]"
                >
                  <Pencil className="h-3.5 w-3.5" aria-hidden />
                  수정
                </button>
                <button
                  type="button"
                  onClick={() => deleteItem(item)}
                  disabled={busyId === item.id}
                  className="inline-flex items-center gap-1 rounded-[var(--fz-r-sm)] px-2 py-1 text-xs font-medium text-[var(--fz-error)] transition hover:bg-[var(--fz-surface-2)] disabled:opacity-50"
                >
                  <Trash2 className="h-3.5 w-3.5" aria-hidden />
                  삭제
                </button>
              </div>
            </div>
          ))}

          {items.length === 0 && !formOpen && (
            <p className="px-1 py-2 text-center text-xs text-[var(--fz-muted)]">아직 등록한 정기 메시지가 없어요.</p>
          )}

          {formOpen && (
            <RecurringForm
              key={editing?.id ?? "new"}
              initial={editing}
              onCancel={() => {
                setFormOpen(false);
                setEditing(null);
              }}
              onSubmit={submitForm}
            />
          )}
        </section>

        {/* 포트폴리오 */}
        <FinzPortfolioSettings groupId={groupId} initialTrades={initialTrades} />

        {/* 곧 추가될 기능(로드맵 안내) */}
        <section className="space-y-2">
          <h2 className="px-1 text-sm font-bold text-[var(--fz-ink)]">곧 추가될 기능</h2>
          <ComingSoon icon={<ImageIcon className="h-4 w-4" aria-hidden />} label="사진 모아보기" />
          <ComingSoon icon={<ListFilter className="h-4 w-4" aria-hidden />} label="메시지 유형별 보기" />
          <ComingSoon icon={<Bell className="h-4 w-4" aria-hidden />} label="예약 메시지" />
        </section>
      </div>
    </div>
  );
}

function Toggle({
  on,
  onClick,
  disabled,
  label,
}: {
  on: boolean;
  onClick: () => void;
  disabled?: boolean;
  label: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? "끄기" : "켜기"}`}
      onClick={onClick}
      disabled={disabled}
      className={`relative h-6 w-11 shrink-0 rounded-[var(--fz-r-full)] transition disabled:opacity-50 ${
        on ? "bg-[var(--fz-coral)]" : "bg-[var(--fz-line)]"
      }`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-[var(--fz-r-full)] bg-white shadow-sm transition-all ${
          on ? "left-[1.375rem]" : "left-0.5"
        }`}
      />
    </button>
  );
}

function ComingSoon({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[var(--fz-r)] border border-dashed border-[var(--fz-line)] px-3.5 py-3 text-[var(--fz-muted)]">
      <span className="shrink-0">{icon}</span>
      <span className="flex-1 text-sm">{label}</span>
      <span className="shrink-0 text-[11px]">준비 중</span>
    </div>
  );
}

// ── 등록/수정 폼 ──

type RecurringFormValues = {
  contentKind: FinzRecurringContentKind;
  content: string;
  freq: FinzRecurringFreq;
  hour: number;
  minute: number;
  weekday: number;
  intervalMinutes: number;
};

function RecurringForm({
  initial,
  onCancel,
  onSubmit,
}: {
  initial: FinzRecurringMessage | null;
  onCancel: () => void;
  onSubmit: (v: RecurringFormValues) => void;
}) {
  const [contentKind, setContentKind] = useState<FinzRecurringContentKind>(initial?.contentKind ?? "text");
  const [content, setContent] = useState(initial?.content ?? "");
  const [freq, setFreq] = useState<FinzRecurringFreq>(initial?.freq ?? "daily");
  const [time, setTime] = useState(
    `${String(initial?.hour ?? 9).padStart(2, "0")}:${String(initial?.minute ?? 0).padStart(2, "0")}`,
  );
  const [weekday, setWeekday] = useState(initial?.weekday ?? 1);
  const [intervalMinutes, setIntervalMinutes] = useState(initial?.intervalMinutes || 60);
  const [submitting, setSubmitting] = useState(false);

  function submit() {
    if (!content.trim() || submitting) return;
    const [h, m] = time.split(":");
    setSubmitting(true);
    onSubmit({
      contentKind,
      content: content.trim(),
      freq,
      hour: parseInt(h ?? "9", 10) || 0,
      minute: parseInt(m ?? "0", 10) || 0,
      weekday,
      intervalMinutes: Math.max(intervalMinutes || 0, MIN_INTERVAL_MINUTES),
    });
  }

  return (
    <div className="fz-card space-y-3 p-3.5">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold text-[var(--fz-ink)]">{initial ? "정기 메시지 수정" : "새 정기 메시지"}</p>
        <button type="button" onClick={onCancel} aria-label="닫기" className="fz-iconbtn h-7 w-7 border-none bg-transparent shadow-none">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {/* 내용 종류 */}
      <div className="flex gap-1.5">
        <Chip on={contentKind === "text"} onClick={() => setContentKind("text")}>
          고정 문구
        </Chip>
        <Chip on={contentKind === "ai"} onClick={() => setContentKind("ai")}>
          AI 생성
        </Chip>
        <Chip on={contentKind === "chart"} onClick={() => setContentKind("chart")}>
          차트
        </Chip>
      </div>

      {/* 내용 */}
      <input
        value={content}
        onChange={(e) => setContent(e.target.value.slice(0, RECURRING_CONTENT_MAX))}
        placeholder={
          contentKind === "ai"
            ? "예: 오늘의 명언, 오늘 서울 날씨"
            : contentKind === "chart"
              ? "종목 심볼 (예: NASDAQ:TSLA, BINANCE:SOLUSDT)"
              : "예: 물 마시기, 회의 시작!"
        }
        className="fz-input w-full"
      />

      {/* 주기 */}
      <div className="flex gap-1.5">
        <Chip on={freq === "daily"} onClick={() => setFreq("daily")}>
          매일
        </Chip>
        <Chip on={freq === "weekly"} onClick={() => setFreq("weekly")}>
          매주
        </Chip>
        <Chip on={freq === "interval"} onClick={() => setFreq("interval")}>
          N분마다
        </Chip>
      </div>

      {freq === "weekly" && (
        <div className="flex flex-wrap gap-1.5">
          {WEEKDAYS.map((w, i) => (
            <Chip key={i} on={weekday === i} onClick={() => setWeekday(i)}>
              {w}
            </Chip>
          ))}
        </div>
      )}

      {freq === "interval" ? (
        <label className="flex items-center gap-2 text-sm text-[var(--fz-ink)]">
          <input
            type="number"
            min={MIN_INTERVAL_MINUTES}
            step={5}
            value={intervalMinutes}
            onChange={(e) => setIntervalMinutes(parseInt(e.target.value, 10) || 0)}
            className="fz-input w-24"
          />
          분마다 (최소 {MIN_INTERVAL_MINUTES}분)
        </label>
      ) : (
        <label className="flex items-center gap-2 text-sm text-[var(--fz-ink)]">
          시각
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="fz-input w-32" />
        </label>
      )}

      <div className="flex gap-2 pt-1">
        <button type="button" onClick={onCancel} className="fz-btn fz-btn--ghost flex-1">
          취소
        </button>
        <button type="button" onClick={submit} disabled={!content.trim() || submitting} className="fz-btn flex-1 disabled:opacity-50">
          {initial ? "저장" : "등록"}
        </button>
      </div>
    </div>
  );
}

function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" onClick={onClick} className={`fz-chip ${on ? "fz-chip--on" : ""}`} aria-pressed={on}>
      {children}
    </button>
  );
}
