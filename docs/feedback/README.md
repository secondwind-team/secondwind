# 사용자 피드백 워크플로 (TRAVEL-FEEDBACK-01)

운영 환경에 들어온 사용자 피드백·버그리포트를 **로컬에서 안전하게 조회**하기 위한 자리입니다.

## 핵심 원칙

- **prod KV 토큰 (`KV_REST_API_URL` / `KV_REST_API_TOKEN`) 을 로컬에 두지 마세요.** 이 토큰은 share + feedback 전체에 read/write/delete 가 가능합니다.
- 대신 **read-only admin endpoint + 별도 토큰** 을 씁니다. 이 토큰의 권한은 "최근 피드백 조회" 뿐입니다.
- 토큰은 `.env*` 가 아닌 **macOS Keychain** 에 보관합니다.

## 사용 흐름

### 1. 최초 1회: Keychain 에 토큰 등록

`ADMIN_FEEDBACK_TOKEN` 값은 owner 에게 받습니다.

```bash
security add-generic-password -s secondwind-feedback-admin-token -w
# 프롬프트가 뜨면 토큰 값을 붙여넣고 enter
```

값 확인:

```bash
security find-generic-password -s secondwind-feedback-admin-token -w
```

### 2. 캐시 갱신

```bash
npm run feedback:pull
# 옵션 예시
npm run feedback:pull -- --limit 100 --since 2026-04-01 --category bug
```

결과는 `docs/feedback/feedback.local.json` 에 저장됩니다 (gitignored).

### 3. 작업 시작

캐시 파일을 읽어 분석·수정 작업을 진행합니다. `/feedback` skill 이 추가되면 이 파일을 자동으로 사용합니다.

## 운영자 체크리스트 (admin)

토큰 발급:

```bash
openssl rand -hex 32
```

prod 에만 등록 (preview/dev 에는 안 둠):

```bash
vercel env add ADMIN_FEEDBACK_TOKEN production
vercel deploy --prod
```

로컬 dev 에서 endpoint 를 테스트할 땐 `ALLOW_FEEDBACK_ADMIN=1` 을 명시적으로 설정해야 켜집니다 (그 외 환경에선 404).

회전:

```bash
vercel env rm ADMIN_FEEDBACK_TOKEN production
vercel env add ADMIN_FEEDBACK_TOKEN production
vercel deploy --prod
# 팀에 새 값 전달 → 각자 Keychain 갱신
```

## 안전 가드

- 캐시 파일은 PII 마스킹된 (email/phone) 상태로 받습니다.
- 인증 실패와 환경 비활성 모두 **404** — endpoint 존재 자체를 노출하지 않습니다.
- 캐시 파일은 commit 차단됩니다 (`.gitignore`).
- 토큰 유출이 의심되면 즉시 owner 에게 알리고 회전합니다.

## 관련 코드

- [app/api/travel/feedback/admin/route.ts](../../app/api/travel/feedback/admin/route.ts) — admin GET endpoint
- [lib/server/travel-feedback-store.ts](../../lib/server/travel-feedback-store.ts) — `listTravelFeedback`
- [scripts/fetch-feedback.mjs](../../scripts/fetch-feedback.mjs) — 로컬 pull 스크립트
