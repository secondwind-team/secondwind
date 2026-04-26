---
name: feature
description: secondwind의 feature inventory와 feature 단위 작업을 관리한다. 사용자가 /feature help를 요청하거나, feature 목록 조회, 상세 보기, 추가, 수정, 삭제/폐기 표시, TRAVEL-SHARE-01 같은 Feature ID 기반 구현을 요청할 때 사용한다. "travel share", "지도", "quota" 같은 feature 힌트를 주거나 기능 관리/작업 시작 방법을 물을 때도 사용한다.
---

# Feature 관리

## 개요

이 스킬은 secondwind의 프로젝트 단위 feature 메뉴로 사용한다. 단일 출처는 다음 문서다.

- `docs/plans/2026-04-26-feature-inventory.md`

저장소를 수정하기 전, 현재 세션에 아직 로드되어 있지 않다면 `PROJECT.md`, `GIT.md`, `GSTACK.md`, `docs/README.md`를 먼저 읽는다.

## 명령 라우팅

사용자의 요청을 다음 작업 중 하나로 해석한다.

| 요청 형태 | 작업 |
|---|---|
| `/feature help`, `/feature`, 사용법이 불명확한 질문 | 도움말 표시 |
| `/feature list`, `/feature travel`, `/feature 지도`, "feature 목록" | feature 목록 표시, 힌트가 있으면 관련 항목만 필터링 |
| `/feature TRAVEL-SHARE-01`, "TRAVEL-SHARE-01 자세히" | feature 하나의 상세 내용 표시 |
| `/feature add ...`, "feature 추가" | feature 추가 |
| `/feature edit ...`, "feature 수정" | feature 수정 |
| `/feature delete ...`, "feature 삭제" | feature 폐기 표시 또는 삭제 |
| `/feature build TRAVEL-SHARE-01`, "이 feature 구현" | feature 구현 |

의도가 애매하면 짧은 질문을 최대 하나만 한다. 안전한 기본값이 있으면 질문하지 말고 진행한다.

## 도움말 출력

`/feature help` 요청에서는 도움말만 출력한다. 파일을 수정하지 않는다.

다음을 포함한다.

```text
/feature help
  도움말과 예제를 보여줍니다.

/feature list
  전체 feature 대분류와 하위 목록을 보여줍니다.

/feature list travel
/feature travel
/feature 지도
  힌트와 관련된 feature만 보여줍니다.

/feature TRAVEL-SHARE-01
  특정 feature의 상세 내용을 보여줍니다.

/feature add
  질문을 통해 새 feature를 feature inventory에 추가합니다.

/feature edit TRAVEL-SHARE-01
  기존 feature의 상태, 설명, 후보 작업 등을 수정합니다.

/feature delete TRAVEL-SHARE-01
  기본은 삭제 대신 deprecated/removed 표시를 제안합니다.

/feature build TRAVEL-SHARE-01
  관련 코드와 문서를 읽고 작은 구현 계획을 세운 뒤 작업합니다.
```

예제 3개도 함께 포함한다.

```text
/feature share
/feature TRAVEL-MAP-05
/feature build TRAVEL-INPUT-04
```

## Feature 목록 보기

1. `docs/plans/2026-04-26-feature-inventory.md`를 읽는다.
2. 힌트가 없으면 대분류 표를 요약하고 Travel 하위 섹션 제목을 나열한다.
3. 힌트가 있으면 다음 기준으로 필터링한다.
   - Feature ID prefix 또는 정확한 ID
   - `기능`, `사용자 가치`, `코드 위치`, `신규 후보`, `유지보수 후보`에 들어 있는 한국어/영어 텍스트
   - 자주 쓰는 동의어:
     - 지도, map, route, 경로 -> `TRAVEL-MAP-*`
     - 공유, share, link -> `TRAVEL-SHARE-*`
     - 입력, form, prompt, 브리핑 -> `TRAVEL-INPUT-*`
     - 장소, place, naver, 검증 -> `TRAVEL-PLACE-*`
     - 결과, decision, 확정 -> `TRAVEL-RESULT-*`
     - quota, 429, 운영, eval -> `TRAVEL-OPS-*`
     - 비용, budget -> `TRAVEL-BUDGET-*`
4. `Feature ID`, `기능`, `상태`, `신규 후보`, `유지보수 후보`를 담은 간결한 표로 답한다.

## Feature 상세 보기

1. feature inventory를 읽는다.
2. 대소문자를 구분하지 않고 정확한 Feature ID를 찾는다.
3. 다음 항목을 보여준다.
   - Feature ID
   - 기능
   - 상태
   - 사용자 가치 또는 설명
   - 코드 위치
   - 신규 후보
   - 유지보수 후보
4. 찾지 못하면 같은 prefix 또는 힌트에서 가까운 후보를 보여준다.

## Feature 추가

수정 전에 부족한 필드를 확인한다.

- Feature ID
- 기능
- 상태
- 사용자 가치 또는 설명
- 코드 위치
- 신규 후보
- 유지보수 후보

규칙:

- `TRAVEL-SHARE-06`처럼 안정적인 대문자 ID를 사용한다.
- 사용자가 ID를 지정하지 않으면 알맞은 섹션에서 다음 숫자 suffix를 고른다.
- 올바른 Markdown 표에 feature 하나당 한 행으로 추가한다.
- 아직 코드에 없는 기능은 기본적으로 `planned` 상태로 추가한다.
- 표를 훑어보기 쉽도록 문구를 짧게 유지한다.

수정 후에는 변경한 파일과 새 Feature ID를 알려준다.

## Feature 수정

1. feature inventory를 읽고 대상 행을 찾는다.
2. 사용자가 바꿀 필드를 정확히 말했으면 바로 수정한다. 애매하면 짧게 확인한다.
3. 사용자가 명시적으로 rename을 요청하지 않는 한 Feature ID는 유지한다.
4. rename을 할 때는 같은 inventory 문서 안의 가까운 참조도 함께 업데이트한다.
5. Markdown 표가 깨지지 않게 유지한다.

## Feature 삭제 또는 폐기 표시

기본값은 기록 보존이다.

- `상태`를 `deprecated` 또는 `removed`로 바꾸는 방식을 우선한다.
- 이유는 `유지보수 후보` 또는 `다음 질문`에 남긴다.
- 사용자가 hard deletion을 명시적으로 요청한 경우에만 행을 실제로 삭제한다.

feature 행을 삭제했다는 이유만으로 관련 코드를 삭제하지 않는다. 코드 삭제는 별도의 구현 작업으로 다룬다.

## Feature 구현

`/feature build <Feature ID>` 요청에는 다음 흐름을 사용한다.

1. feature 행과 관련 코드 위치를 읽는다.
2. 아직 로드되어 있지 않다면 `PROJECT.md`, `GIT.md`, `GSTACK.md`, `docs/README.md`를 읽는다.
3. `git branch --show-current`와 `git status --short`로 현재 상태를 확인한다.
4. `main` 또는 `master`에 있으면 `GIT.md` 규칙에 맞춰 브랜치를 만든다.
   - 사용자에게 보이는 신규 기능: `feat/<scope>-<short-desc>`
   - 버그 수정/유지보수: `fix/<scope>-<short-desc>`
   - 문서만 수정: `docs/<scope>-<short-desc>`
5. 사용자의 표현에 따라 작은 구현 계획을 제안하거나 바로 실행한다.
   - 구현해줘/build/do it 류의 요청이면 진행한다.
   - 논의/계획/검토 요청이면 코드 수정은 하지 않는다.
6. 사용자가 달리 요청하지 않는 한 PR 범위는 Feature ID 하나로 제한한다.
7. 상태나 후보 목록이 바뀌었으면 feature inventory도 갱신한다.
8. 위험도에 맞춰 검증한다.
   - 문서만 변경: `git diff` 확인
   - 코드 변경: 가능하면 `npm run typecheck`, `npm run lint`, `npm run build`
   - UI 변경: 가능하면 브라우저에서 확인

보고할 때는 사용자가 보게 될 변화, 코드/문서 변경, 검증 결과 순서로 말한다.
