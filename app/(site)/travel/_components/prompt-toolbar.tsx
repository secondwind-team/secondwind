"use client";

import { useState } from "react";
import { Lightbulb, ListPlus } from "lucide-react";

const TEMPLATE = [
  "여행예산:",
  "숙소:",
  "구성원:",
  "주 이동수단:",
  "여행스타일:",
  "그 외 추가정보:",
].join("\n");

type Example = { title: string; body: string };

const EXAMPLES: Example[] = [
  {
    title: "아이 동반 · 자차 · 여유롭게",
    body: [
      "여행예산: 하루 30만원 정도 (식사·카페·입장료 포함)",
      "숙소: 아직 안 정함. 아이 있어서 물놀이장 있는 리조트 선호.",
      "구성원: 부부 2명 + 6세 아이. 아이가 낮잠 필요 (13~15시 쯤).",
      "주 이동수단: 자차",
      "여행스타일: 여유롭게. 하루 3~4군데만, 이동 많지 않게.",
      "그 외 추가정보: 첫날 저녁은 아이 좋아하는 돈가스. 유모차 필요 없음.",
    ].join("\n"),
  },
  {
    title: "부모님 동반 · 렌트카 · 맛집 투어",
    body: [
      "여행예산: 1인 하루 15만원 내외",
      "숙소: 제주 그랜드조선 2박",
      "구성원: 부부 + 양가 부모님 4분 (60대 후반, 두 분은 거동 불편). 총 6명.",
      "주 이동수단: 렌트카 (7인승)",
      "여행스타일: 맛집 투어 중심. 관광지는 1~2곳만.",
      "그 외 추가정보: 계단 많은 곳 피하기. 한정식·흑돼지 선호. 카페는 경치 좋은 곳.",
    ].join("\n"),
  },
  {
    title: "커플 · 대중교통 · 액티비티",
    body: [
      "여행예산: 2인 총 80만원",
      "숙소: 해운대 근처 감성 스테이",
      "구성원: 커플 (20대 후반)",
      "주 이동수단: 대중교통 + 가끔 택시",
      "여행스타일: 액티비티 위주. 서핑·요트 같은 것 해보고 싶음.",
      "그 외 추가정보: 야경 좋은 곳에서 사진 찍기. 감성 카페 1~2곳.",
    ].join("\n"),
  },
  {
    title: "혼자 · 기차 · 힐링",
    body: [
      "여행예산: 하루 10만원 (식사 2끼 + 카페 + 입장료)",
      "숙소: 아직 안 정함. 조용한 게스트하우스 또는 호캉스.",
      "구성원: 혼자 (30대)",
      "주 이동수단: 기차(KTX) + 현지 버스·도보",
      "여행스타일: 힐링. 책 읽기 좋은 카페, 조용한 서점, 바다 앞 산책.",
      "그 외 추가정보: 사람 많은 관광지는 피하기. 평일 낮 시간대 위주.",
    ].join("\n"),
  },
  {
    title: "친구 여럿 · 렌트카 · 관광지 투어",
    body: [
      "여행예산: 1인 하루 12만원",
      "숙소: 풀빌라 2박",
      "구성원: 친구 4명 (20대)",
      "주 이동수단: 렌트카 2대",
      "여행스타일: 관광지 투어. 유명한 곳 최대한 많이 찍기.",
      "그 외 추가정보: 마지막 날 저녁 바베큐. 사진 잘 나오는 곳 우선.",
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
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={handleTemplate}
          title="라벨만 있는 빈 양식을 삽입"
          className="inline-flex items-center gap-1.5 rounded-md border border-neutral-300 px-2.5 py-1.5 text-xs text-neutral-600 transition hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
        >
          <ListPlus className="h-3.5 w-3.5" aria-hidden />
          <span>가이드 양식</span>
        </button>
        <button
          type="button"
          onClick={() => setExamplesOpen((v) => !v)}
          aria-expanded={examplesOpen}
          title="완성된 예시 프롬프트 5개 보기"
          className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs transition ${
            examplesOpen
              ? "border-neutral-500 bg-neutral-100 text-neutral-900 dark:border-neutral-500 dark:bg-neutral-800 dark:text-neutral-100"
              : "border-neutral-300 text-neutral-600 hover:bg-neutral-50 hover:text-neutral-900 dark:border-neutral-700 dark:text-neutral-300 dark:hover:bg-neutral-900 dark:hover:text-neutral-100"
          }`}
        >
          <Lightbulb className="h-3.5 w-3.5" aria-hidden />
          <span>예시 보기</span>
        </button>
      </div>

      {examplesOpen && (
        <div className="space-y-2 rounded-md border border-neutral-200 bg-neutral-50/60 p-3 dark:border-neutral-800 dark:bg-neutral-900/40">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            카드를 클릭하면 예시가 그대로 삽입됩니다. 상황에 맞게 편집하세요.
          </p>
          <ul className="space-y-2">
            {EXAMPLES.map((ex) => (
              <li key={ex.title}>
                <button
                  type="button"
                  onClick={() => handleExample(ex.body)}
                  className="block w-full rounded-md border border-neutral-200 bg-white p-3 text-left transition hover:border-neutral-400 dark:border-neutral-800 dark:bg-neutral-950/40 dark:hover:border-neutral-600"
                >
                  <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                    {ex.title}
                  </div>
                  <div className="mt-1.5 whitespace-pre-wrap text-xs leading-relaxed text-neutral-600 dark:text-neutral-300">
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
