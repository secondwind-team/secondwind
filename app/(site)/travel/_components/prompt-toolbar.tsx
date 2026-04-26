"use client";

import { useState } from "react";
import { Lightbulb, ListPlus } from "lucide-react";

const TEMPLATE = [
  "구성원:",
  "주 이동수단:",
  "여행스타일:",
  "꼭 하고 싶은 것:",
  "피하고 싶은 것:",
  "그 외 추가정보:",
  "",
  "예산·숙소는 위 선택 옵션에서 따로 지정할 수 있어요.",
].join("\n");

type Example = { title: string; body: string };

const EXAMPLES: Example[] = [
  {
    title: "아이 동반 · 자차 · 여유롭게",
    body: [
      "구성원: 부부 2명 + 6세 아이. 아이가 낮잠 필요 (13~15시 쯤).",
      "주 이동수단: 자차",
      "여행스타일: 여유롭게. 하루 3~4군데만, 이동 많지 않게.",
      "꼭 하고 싶은 것: 아이가 좋아할 실내 체험, 첫날 저녁 돈가스.",
      "피하고 싶은 것: 계단 많은 곳, 오래 걷는 코스.",
      "그 외 추가정보: 예산과 숙소는 선택 옵션에서 따로 지정할게요. 유모차 필요 없음.",
    ].join("\n"),
  },
  {
    title: "부모님 동반 · 렌트카 · 맛집 투어",
    body: [
      "구성원: 부부 + 양가 부모님 4분 (60대 후반, 두 분은 거동 불편). 총 6명.",
      "주 이동수단: 렌트카 (7인승)",
      "여행스타일: 맛집 투어 중심. 관광지는 1~2곳만.",
      "꼭 하고 싶은 것: 한정식, 흑돼지, 경치 좋은 카페.",
      "피하고 싶은 것: 계단 많은 곳, 주차 어려운 곳, 너무 촘촘한 일정.",
      "그 외 추가정보: 숙소는 선택 옵션에서 고를게요.",
    ].join("\n"),
  },
  {
    title: "커플 · 대중교통 · 액티비티",
    body: [
      "구성원: 커플 (20대 후반)",
      "주 이동수단: 대중교통 + 가끔 택시",
      "여행스타일: 액티비티 위주. 서핑·요트 같은 것 해보고 싶음.",
      "꼭 하고 싶은 것: 서핑이나 요트, 야경 좋은 곳에서 사진 찍기.",
      "피하고 싶은 것: 이동만 오래 걸리는 코스.",
      "그 외 추가정보: 감성 카페 1~2곳만. 숙소는 선택 옵션에서 지정할게요.",
    ].join("\n"),
  },
  {
    title: "혼자 · 기차 · 힐링",
    body: [
      "구성원: 혼자 (30대)",
      "주 이동수단: 기차(KTX) + 현지 버스·도보",
      "여행스타일: 힐링. 책 읽기 좋은 카페, 조용한 서점, 바다 앞 산책.",
      "꼭 하고 싶은 것: 바다 앞 산책, 조용한 서점, 오래 앉아 있을 카페.",
      "피하고 싶은 것: 사람 많은 관광지, 줄 오래 서는 맛집.",
      "그 외 추가정보: 평일 낮 시간대 위주. 예산은 선택 옵션에서 넣을게요.",
    ].join("\n"),
  },
  {
    title: "친구 여럿 · 렌트카 · 관광지 투어",
    body: [
      "구성원: 친구 4명 (20대)",
      "주 이동수단: 렌트카 2대",
      "여행스타일: 관광지 투어. 유명한 곳 최대한 많이 찍기.",
      "꼭 하고 싶은 것: 사진 잘 나오는 명소, 마지막 날 저녁 바베큐.",
      "피하고 싶은 것: 너무 조용한 코스, 일찍 마감하는 장소.",
      "그 외 추가정보: 숙소와 예산 포함 범위는 선택 옵션에서 지정할게요.",
    ].join("\n"),
  },
];

type Props = {
  value: string;
  onChange: (next: string) => void;
  maxLength: number;
};

export function PromptToolbar({ value, onChange, maxLength }: Props) {
  const [examplesOpen, setExamplesOpen] = useState(false);

  function insert(text: string) {
    if (value.trim().length > 0) {
      const ok = window.confirm("기존 입력이 지워집니다. 계속하시겠어요?");
      if (!ok) return;
    }
    onChange(text.slice(0, maxLength));
  }

  function handleTemplate() {
    insert(TEMPLATE);
  }

  function handleExample(body: string) {
    insert(body);
    setExamplesOpen(false);
  }

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap justify-end gap-2">
        <button
          type="button"
          onClick={handleTemplate}
          title="라벨만 있는 빈 양식을 삽입"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--line)] bg-white px-3 py-1.5 text-xs font-medium text-[var(--muted)] transition hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
        >
          <ListPlus className="h-3.5 w-3.5" aria-hidden />
          <span>가이드 양식</span>
        </button>
        <button
          type="button"
          onClick={() => setExamplesOpen((v) => !v)}
          aria-expanded={examplesOpen}
          title="완성된 예시 프롬프트 5개 보기"
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
            examplesOpen
              ? "border-[var(--accent)] bg-[var(--accent-soft)] text-[var(--accent-strong)]"
              : "border-[var(--line)] bg-white text-[var(--muted)] hover:border-[var(--accent)] hover:text-[var(--accent-strong)]"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          <span>예시 보기</span>
        </button>
      </div>

      {examplesOpen && (
        <div className="space-y-3 rounded-2xl border border-[var(--line)] bg-white p-3">
          <p className="text-xs leading-relaxed text-[var(--muted)]">
            카드를 클릭하면 예시가 그대로 삽입됩니다. 예산과 숙소는 위 선택 옵션에서 따로 고를 수 있어요.
          </p>
          <ul className="grid gap-2 sm:grid-cols-2">
            {EXAMPLES.map((ex) => (
              <li key={ex.title}>
                <button
                  type="button"
                  onClick={() => handleExample(ex.body)}
                  className="block h-full w-full rounded-xl border border-[var(--line)] bg-slate-50 p-3 text-left transition hover:-translate-y-0.5 hover:border-[var(--accent)] hover:bg-white hover:shadow-sm"
                >
                  <div className="text-xs font-semibold text-[var(--ink)]">
                    {ex.title}
                  </div>
                  <div className="mt-1.5 line-clamp-4 whitespace-pre-wrap text-xs leading-relaxed text-[var(--muted)]">
                    {ex.body}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
