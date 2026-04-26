---
name: feedback
description: secondwind의 사용자 피드백·버그리포트를 운영 환경에서 받아 로컬에서 안전하게 조회·분석·수정하기 위한 스킬. 사용자가 /feedback help, /feedback list, /feedback show, /feedback investigate, /feedback fix 같은 명령을 쓰거나, "사용자 피드백", "버그리포트", "유저가 남긴 의견" 등을 언급할 때 사용한다. KV 토큰을 로컬에 두지 않고 admin endpoint + 로컬 캐시 파일로만 작업한다 (TRAVEL-FEEDBACK-01).
---

# 사용자 피드백 관리

## 개요

이 스킬은 운영 환경의 사용자 피드백을 안전하게 조회하고 후속 작업으로 연결한다. 단일 출처는 다음 두 가지다.

- **운영 데이터**: `https://secondwind-mu.vercel.app/api/travel/feedback/admin` — Bearer 토큰 인증, read-only
- **로컬 캐시**: `docs/feedback/feedback.local.json` — `npm run feedback:pull` 로 갱신, gitignored
- **워크플로 문서**: `docs/feedback/README.md`
- **Feature inventory**: `docs/plans/2026-04-26-feature-inventory.md` — Feature ID 매핑에 사용

저장소를 수정하기 전, 현재 세션에 아직 로드돼 있지 않다면 `PROJECT.md`, `GIT.md`, `GSTACK.md`, `docs/README.md`, `docs/feedback/README.md` 를 먼저 읽는다.

## 절대 안전 가드

작업 전에 항상 확인한다.

1. **prod KV 토큰을 로컬에 설정하지 마라.** `KV_REST_API_URL` 또는 `KV_REST_API_TOKEN` 이 환경에 보이면 즉시 멈추고 사용자에게 알린다. 이 스킬은 KV 클라이언트를 직접 호출하지 않는다.
2. **HTTP 요청만 사용한다.** 직접 Redis 접근 금지.
3. **`fix` 는 명시적 호출에만.** `list`/`show`/`investigate` 까지가 기본 흐름. 사용자가 "이 피드백 고쳐", "fix" 라고 말하지 않으면 코드 수정 안 함.
4. **캐시 파일은 commit 하지 않는다.** `.gitignore` 가 차단하지만, 우회 시도 금지.
5. **Feature ID 1개로 PR 범위 제한.** `GIT.md` 규칙에 따라 새 브랜치, `main` 직접 수정 금지.

## 명령 라우팅

| 요청 형태 | 작업 |
|---|---|
| `/feedback help`, `/feedback`, 사용법이 불명확한 질문 | 도움말 표시 |
| `/feedback pull`, "피드백 갱신", "feedback 다시 받아와" | `npm run feedback:pull` 실행 안내 + 결과 요약 |
| `/feedback list`, `/feedback list bug`, "최근 피드백" | 캐시 요약 표 (id, category, 한 줄 message, createdAt) |
| `/feedback show <id>`, "피드백 ABC123 상세" | record 한 건 펼치기 |
| `/feedback investigate <id>`, "이 피드백 분석" | 관련 Feature ID 추정 + 재현 절차 + 가설 (코드 수정 X) |
| `/feedback fix <id>`, "이 피드백 고쳐" | investigate + 브랜치 생성 + 수정 |
| `/feedback stale`, "캐시 신선해?" | 캐시 mtime 확인, 오래됐으면 pull 권유 |

의도가 애매하면 짧은 질문을 최대 하나만 한다. 안전한 기본값이 있으면 질문하지 말고 진행한다.

## 도움말 출력

`/feedback help` 요청에서는 도움말만 출력한다. 파일을 수정하지 않는다.

다음을 포함한다.

```text
/feedback help
  도움말과 예제를 보여줍니다.

/feedback pull
  운영 환경에서 최신 피드백을 받아 docs/feedback/feedback.local.json 으로
  저장합니다. (npm run feedback:pull 실행)

/feedback list [bug|quality|other]
  로컬 캐시의 피드백 요약 표를 보여줍니다.

/feedback show <id>
  피드백 1건의 상세 (입력값, 결과, 페이지, 메시지) 를 보여줍니다.

/feedback investigate <id>
  피드백을 분석하고 관련 Feature ID, 재현 절차, 가설을 제안합니다.
  코드는 수정하지 않습니다.

/feedback fix <id>
  investigate 후 브랜치를 만들고 수정 작업을 시작합니다.
  Feature ID 1개 범위, GIT.md 규칙 준수.

/feedback stale
  캐시 파일이 얼마나 오래됐는지 확인합니다.
```

예제 3개도 함께 포함한다.

```text
/feedback list bug
/feedback show ab12cd34
/feedback investigate ab12cd34
```

## 캐시 갱신 (`pull`)

1. 먼저 안전 가드 확인 — `KV_REST_API_URL` / `KV_REST_API_TOKEN` 이 셸 환경에 있으면 멈추고 경고.
2. `npm run feedback:pull` 을 사용자에게 안내한다. 실행은 사용자에게 맡기는 것을 기본으로 하되, 사용자가 "직접 실행해줘" 라고 하면 진행한다.
3. 인증 실패 (404) 가 뜨면 다음을 점검하라고 안내:
   - Keychain 토큰 등록 (`security add-generic-password -s secondwind-feedback-admin-token -w`)
   - 운영자가 `ADMIN_FEEDBACK_TOKEN` 을 prod 에 등록했는지
   - 토큰이 회전됐는지 (회전됐으면 owner 에게 새 값 요청)
4. 결과 파일 경로와 record 수를 보고한다.

## 목록 보기 (`list`)

1. `docs/feedback/feedback.local.json` 을 읽는다. 없으면 `pull` 권유.
2. 옵션 카테고리 필터 (`bug`/`quality`/`other`) 가 있으면 적용.
3. 다음 컬럼으로 표를 만든다.
   - `id` (8자)
   - `category`
   - `createdAt` (날짜만, ISO 의 `T` 앞)
   - `pagePath` (있으면)
   - `message` 첫 줄 (60자 truncate)
   - `model` (있으면)
4. 캐시가 비어 있으면 "최근 피드백 없음 또는 캐시가 오래됨 — `/feedback pull` 권장" 으로 안내.

## 상세 보기 (`show <id>`)

1. 캐시에서 `id` 일치하는 record 를 찾는다 (대소문자 구분).
2. 다음 항목을 보여준다.
   - id, category, createdAt, expiresAt
   - message (전체)
   - pagePath, model, userAgent
   - context (있으면)
   - input (destination, startDate, endDate, planningModel, prompt 등)
   - draftInput (input 이 없을 때 폴백)
   - plan 요약: `summary`, `days[].items.length`, `stay?.name`. 전체 plan JSON 은 길어서 사용자가 요청할 때만.
3. 못 찾으면 prefix 매칭 후보를 제시.

## 분석 (`investigate <id>`)

코드를 수정하지 않는다. 분석 보고서만 제공.

1. `show` 와 동일한 정보 수집 + feature inventory 읽기.
2. **Feature ID 매핑 후보** 를 도출한다. 단서:
   - `pagePath` 가 `/travel/<shareId>` → SHARE-* 의심
   - `category=bug` + `429`/quota/cooldown 메시지 → `TRAVEL-OPS-02`
   - `category=quality` + plan 의 `transit` 이상 → `TRAVEL-MAP-07`/`TRAVEL-MAP-08`
   - place_warning 다수 → `TRAVEL-PLACE-*`
   - 비용 관련 → `TRAVEL-BUDGET-*`
   - 입력 폼 관련 → `TRAVEL-INPUT-*`
   - 추천 모드 차이 → `TRAVEL-PLAN-06`/`TRAVEL-PLAN-07`/`TRAVEL-PLAN-08`
   - 결정 패널·확정 → `TRAVEL-RESULT-04`/`TRAVEL-RESULT-05`
   - 분류가 모호하면 후보 2~3개를 제시한다.
3. **재현 절차** 제안: 같은 입력값을 로컬 dev 에서 재현하는 단계. `input` 또는 `draftInput` 을 그대로 활용.
4. **가설** 제안: 무엇이 잘못됐을 가능성, 관련 코드 위치(파일 + 줄), 수정 범위 추정.
5. **권장 다음 단계** 한 줄: `/feedback fix <id>` 또는 `/feature build <Feature ID>` 또는 "유지보수 후보에 추가만" 등.

보고 형식 (간결하게):

```
[piloted analysis]
- 피드백: <id> — <category> — <createdAt>
- 한 줄 요약: <message 첫 문장>

[Feature ID 매핑]
- 1순위: <ID> — 이유
- 2순위: <ID> — 이유 (있을 경우)

[재현 절차]
1. ...

[가설]
- ...

[권장 다음 단계]
- ...
```

## 수정 (`fix <id>`)

명시적 요청에만 동작한다.

1. `investigate` 와 동일한 분석을 먼저 수행한다.
2. `git branch --show-current`, `git status --short` 로 현재 상태 확인. main/master 면 새 브랜치를 만든다.
3. 매핑된 Feature ID 의 type 에 따라 브랜치명을 정한다.
   - 사용자에게 보이는 새 동작: `feat/<scope>-<short-desc>`
   - 버그 수정: `fix/<scope>-<short-desc>`
   - 문서만 수정: `docs/<scope>-<short-desc>`
4. 코드를 수정하기 전에 사용자에게 **변경 계획** 한 줄 요약을 보여준다. 명시적으로 진행 OK 한 후 작업.
5. PR 범위는 Feature ID 1개. 다른 개선이 눈에 띄어도 별도 작업으로 남긴다.
6. 위험도에 맞춰 검증한다.
   - 문서만 변경: `git diff` 확인
   - 코드 변경: `npm run typecheck`, `npm run lint`, `npm run build`
   - UI 변경: 가능하면 브라우저에서 확인
7. feature inventory 의 `유지보수 후보` 에서 해당 항목을 제거하거나 ✅ 표시.
8. 보고는 사용자가 보게 될 변화, 코드/문서 변경, 검증 결과 순서.

## 캐시 신선도 (`stale`)

1. `docs/feedback/feedback.local.json` 의 mtime 확인.
2. 24시간 이상 됐거나 파일이 없으면 `/feedback pull` 권유.
3. 그 외엔 "캐시 OK (X 시간 전 갱신)" 로 보고.

## 비개발자 친화

- `list`, `show`, `investigate` 출력은 한국어로 — 회의에서 그대로 공유 가능.
- `show` 와 `investigate` 끝에 권장 다음 단계 한 줄 제공.
- `fix` 는 비개발자에게 자동 제안하지 않는다. 항상 명시적 요청 후.
