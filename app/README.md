# app/

secondwind 의 **Next.js 15 App Router** 엔트리 포인트입니다.

## 구조

```
app/
  layout.tsx            루트 레이아웃 (html, body, globals.css)
  globals.css           Tailwind base
  (site)/               공용 헤더·푸터가 붙는 사이트 group
    layout.tsx
    page.tsx            랜딩 (서비스 카드 리스트)
    travel/             지헌 오너십 — 여행 계획 (v0)
      page.tsx
      _components/
      _lib/
    diary/              태훈 오너십 placeholder
    experiment-3/       덕우 오너십 placeholder
  api/
    gemini/route.ts     3개 서비스 공용 LLM 프록시 (v0 스코프 선택)
```

## 서비스 폴더 규칙

- `app/(site)/<service>/_components/` · `_lib/` 아래에 서비스 전용 코드 배치 (`_` prefix 는 Next.js route 에서 제외됨).
- 서비스끼리 직접 import 금지. 공유는 `components/common` · `lib/common` 으로 올려야 함 (ESLint `no-restricted-imports` 로 차단).

## 참고

- 설계 의도: `docs/decisions/0001-v0-stack-and-accepted-risks.md`
- 프로젝트 원칙: 루트 `CLAUDE.md` / `AGENTS.md`
