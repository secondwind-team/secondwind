# travel planning models

> Draft: 2026-04-25
> Context: 같은 입력에서도 장소 정확도가 흔들리는 문제를, 프롬프트 단일 수정이 아니라 추천 프로세스 자체를 모델화해서 실험한다.

## 목표

`/travel` 의 추천 방식을 하나로 고정하지 않고, 사용자가 목적에 맞게 선택할 수 있는 계획 모델로 분리한다.

v0 의 목표는 완성된 모든 알고리즘을 한 번에 만드는 것이 아니라, 정확도 실험을 반복할 수 있는 제품/코드 구조를 먼저 고정하는 것이다.

## 모델

### 빠른 추천

기존 방식에 가장 가깝다.

- Gemini 가 전체 일정과 `place_query` 를 한 번에 생성
- Naver Local Search 로 후처리 위치 보강
- 빠르고 비용이 낮음
- LLM 이 상호명을 잘못 고르면 장소 정확도가 흔들릴 수 있음

### 균형형

기본값으로 둔다.

- 빠른 추천과 같은 단일 생성 흐름에서 시작
- 장소 정확도 프롬프트와 낮은 temperature 를 적용
- enrich 결과와 통계를 노출해 다음 repair pass 를 붙일 수 있게 한다
- 속도와 안정성 사이의 기본 선택지

### 장소 정확도 우선

장소 정확도를 우선하는 실험 슬롯이다.

- 더 낮은 temperature 와 보수적인 장소명 규칙을 적용
- 확실한 단일 POI 가 아니면 빈 `place_query` 를 허용
- 다음 단계에서는 후보 검색 → 후보 중 선택 → 일정 구성의 2-pass 구조로 확장한다
- 생성 시간과 API 호출 수가 늘어날 수 있음

## 데이터

입력에는 `planningModel` 을 추가한다.

```ts
type PlanningModel = "classic" | "balanced" | "verified";
```

API 응답에는 모델과 장소 통계를 같이 보낸다.

```ts
type PlaceStats = {
  totalPlaceQueries: number;
  verifiedPlaces: number;
  warnings: number;
  destinationMismatches: number;
  outlierRejects: number;
  repairedPlaces: number;
};
```

## 측정

같은 입력을 여러 모델로 반복 실행해 다음 값을 비교한다.

- 전체 `place_query` 수
- 실제 좌표가 붙은 장소 수
- 위치 확인 필요 수
- 목적지 불일치 reject 수
- 같은 날짜 outlier reject 수
- repair 된 장소 수
- 사용된 Gemini 모델

## 비목표

이번 v0 에서는 하지 않는다.

- Google Places, Kakao Place, Naver 블로그 검색 도입
- 사용자에게 내부 LLM 모델명을 선택하게 하기
- CI 에 외부 API 비용이 드는 eval 추가
- 실제 예약/영업시간 보장

## 다음 단계

1. `balanced` 에 실패 장소만 재생성하는 repair pass 를 붙인다.
2. `verified` 를 후보 기반 2-pass 구조로 바꾼다.
3. `scripts/eval-travel.ts` 로 골든셋 반복 실행과 snapshot 저장을 만든다.
4. Google Search grounding, Kakao Place API, Google Places API 는 비용과 ToS 를 검토한 뒤 별도 실험 모델로 추가한다.
