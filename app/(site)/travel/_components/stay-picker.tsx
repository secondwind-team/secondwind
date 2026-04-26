"use client";

import { useEffect, useRef, useState } from "react";
import { Building2, Check, MapPin, Search, X } from "lucide-react";
import { loadKakaoSdk, type KakaoPlaceSearchResult } from "@/lib/common/kakao";
import type { Stay } from "@/lib/common/services/travel";

type Props = {
  destination: string;
  value?: Stay;
  onChange: (stay: Stay | undefined) => void;
};

type SearchState =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "ok"; results: KakaoPlaceSearchResult[] }
  | { kind: "error"; message: string };

export function StayPicker({ destination, value, onChange }: Props) {
  const [open, setOpen] = useState(false);

  return (
    <section className="space-y-2">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold text-[var(--muted)]">숙소 거점</p>
          <p className="mt-1 text-xs text-[var(--muted)]">
            선택하면 요청사항에 따로 쓰지 않아도 숙소 기준으로 동선을 잡습니다.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--line)] bg-white px-3 py-2 text-xs font-medium text-[var(--ink)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          <MapPin className="h-3.5 w-3.5" aria-hidden />
          {value ? "숙소 변경" : "카카오맵에서 선택"}
        </button>
      </div>

      {value && (
        <div className="flex items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-slate-50 px-3 py-2 text-xs">
          <div className="min-w-0">
            <p className="font-semibold text-[var(--ink)]">{value.name}</p>
            {value.place?.address && (
              <p className="mt-0.5 truncate text-[var(--muted)]">{value.place.address}</p>
            )}
          </div>
          <button
            type="button"
            onClick={() => onChange(undefined)}
            className="shrink-0 rounded-lg p-1 text-[var(--muted)] transition hover:bg-white hover:text-[var(--accent-strong)]"
            aria-label="숙소 선택 해제"
          >
            <X className="h-3.5 w-3.5" aria-hidden />
          </button>
        </div>
      )}

      {open && (
        <StaySearchDialog
          destination={destination}
          selected={value}
          onSelect={(stay) => {
            onChange(stay);
            setOpen(false);
          }}
          onClose={() => setOpen(false)}
        />
      )}
    </section>
  );
}

function StaySearchDialog({
  destination,
  selected,
  onSelect,
  onClose,
}: {
  destination: string;
  selected?: Stay;
  onSelect: (stay: Stay) => void;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(selected?.name ?? "");
  const [state, setState] = useState<SearchState>({ kind: "idle" });
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  async function search() {
    const keyword = [destination, query].filter(Boolean).join(" ").trim();
    if (!keyword) return;
    const appKey = process.env.NEXT_PUBLIC_KAKAO_JS_KEY ?? "";
    if (!appKey) {
      setState({ kind: "error", message: "Kakao 지도 키가 아직 연결되지 않았습니다." });
      return;
    }
    setState({ kind: "loading" });
    try {
      const kakao = await loadKakaoSdk(appKey);
      const places = kakao.maps.services?.Places;
      const status = kakao.maps.services?.Status;
      if (!places || !status) throw new Error("kakao-services-unavailable");
      new places().keywordSearch(
        keyword,
        (results, searchStatus) => {
          if (searchStatus === status.OK) {
            setState({ kind: "ok", results });
            return;
          }
          if (searchStatus === status.ZERO_RESULT) {
            setState({ kind: "ok", results: [] });
            return;
          }
          setState({ kind: "error", message: "검색 결과를 불러오지 못했습니다." });
        },
        { size: 8 },
      );
    } catch (err) {
      setState({
        kind: "error",
        message: err instanceof Error ? err.message : "검색 결과를 불러오지 못했습니다.",
      });
    }
  }

  function choose(result: KakaoPlaceSearchResult) {
    const lat = Number(result.y);
    const lng = Number(result.x);
    onSelect({
      name: result.place_name,
      place: {
        name: result.place_name,
        address: result.road_address_name || result.address_name,
        phone: result.phone || undefined,
        category: result.category_name || undefined,
        url: result.place_url || undefined,
        lat: Number.isFinite(lat) ? lat : undefined,
        lng: Number.isFinite(lng) ? lng : undefined,
      },
    });
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="숙소 선택"
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--line)] p-4">
          <div>
            <p className="flex items-center gap-2 text-base font-semibold text-[var(--ink)]">
              <Building2 className="h-4 w-4 text-[var(--accent)]" aria-hidden />
              숙소 선택
            </p>
            <p className="mt-1 text-xs text-[var(--muted)]">카카오맵 검색 결과에서 여행 거점을 고릅니다.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="rounded-lg p-1.5 text-[var(--muted)] transition hover:bg-[var(--accent-soft)] hover:text-[var(--accent-strong)]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <div className="space-y-3 p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              void search();
            }}
            className="flex gap-2"
          >
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={destination ? `${destination} 숙소명` : "숙소명"}
              className="min-w-0 flex-1 rounded-xl border border-[var(--line)] px-3 py-2 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-4 focus:ring-[var(--accent-soft)]"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--accent-strong)]"
            >
              <Search className="h-4 w-4" aria-hidden />
              검색
            </button>
          </form>

          {state.kind === "idle" && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-[var(--muted)]">
              숙소명이나 호텔명을 검색하세요. 목적지가 함께 검색어에 들어갑니다.
            </p>
          )}
          {state.kind === "loading" && (
            <p className="rounded-xl bg-slate-50 p-3 text-xs text-[var(--muted)]">검색 중입니다.</p>
          )}
          {state.kind === "error" && (
            <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800">
              {state.message}
            </p>
          )}
          {state.kind === "ok" && (
            <ul className="max-h-[48vh] space-y-2 overflow-y-auto pr-1">
              {state.results.length === 0 && (
                <li className="rounded-xl bg-slate-50 p-3 text-xs text-[var(--muted)]">
                  검색 결과가 없습니다. 숙소명을 조금 더 구체적으로 입력해보세요.
                </li>
              )}
              {state.results.map((result) => (
                <li key={result.id}>
                  <button
                    type="button"
                    onClick={() => choose(result)}
                    className="flex w-full items-start justify-between gap-3 rounded-xl border border-[var(--line)] bg-white p-3 text-left transition hover:border-[var(--accent)] hover:bg-slate-50"
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[var(--ink)]">
                        {result.place_name}
                      </span>
                      <span className="mt-1 block truncate text-xs text-[var(--muted)]">
                        {result.road_address_name || result.address_name || result.category_name}
                      </span>
                    </span>
                    <Check className="mt-0.5 h-4 w-4 shrink-0 text-[var(--accent)]" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
