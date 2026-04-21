# docs/ — 팀 공유 문서

이 폴더는 secondwind 팀이 공유하는 **회의록·아이데이션·기획·결정** 문서를 담습니다. 사람과 AI 가 함께 읽고 씁니다.

> gstack 의 `/office-hours`, `/autoplan` 등은 기본적으로 `~/.gstack/projects/secondwind/` (각자 홈) 에 문서를 저장합니다. 그중 **팀에 공유할 가치가 있는 것만** 이 폴더로 복사·커밋하세요.

---

## 폴더 구조

| 폴더 | 용도 | 파일명 규칙 |
|---|---|---|
| `meetings/` | 팀 싱크·회의록 | `YYYY-MM-DD-슬러그.md` |
| `ideation/` | 아이데이션 — `/office-hours`, 브레인스토밍 | `YYYY-MM-DD-슬러그.md` |
| `plans/` | 확정된 기획 — `/autoplan`, PRD, 기능 스펙 | `YYYY-MM-DD-슬러그.md` |
| `decisions/` | ADR — 주요 의사결정 기록 | `NNNN-슬러그.md` (`0001`, `0002` ...) |
| `assets/` | 목업·와이어프레임·다이어그램 이미지 | 자유 |

### 파일명 규칙

- **시계열 문서** (meetings / ideation / plans): `YYYY-MM-DD-슬러그.md`
  - 예: `2026-04-28-office-hours-core.md`
  - `ls` 만 쳐도 시간순 정렬됨
- **결정 (decisions)** 만 예외: `NNNN-슬러그.md` (순번, `0001`, `0002` …)
  - 예: `0001-framework-nextjs.md`
  - 뒤집힌 결정 추적이 쉬움

---

## 문서 작성 규칙

- 첫 줄은 `# 제목` (Markdown h1). YAML frontmatter 는 쓰지 않습니다 — 시도해봤는데 문서가 지저분해져서 뺐습니다.
- 문서 상단에 초안/검토 단계·작성 경위 등을 인용 블록(`> …`) 으로 간단히 남겨도 좋습니다.
- 중요한 의사결정이 끝난 뒤 수정이 제한되어야 할 문서라면, 커밋 메시지나 PR 설명에 그 사실을 남기세요.

---

## 사람용 가이드

- AI 가 `/office-hours`, `/autoplan` 결과를 `~/.gstack/projects/secondwind/` 에 저장했다면, 공유 가치 있는 것만 여기로 복사·커밋:
  ```bash
  cp ~/.gstack/projects/secondwind/<파일> docs/ideation/$(date +%Y-%m-%d)-<슬러그>.md
  # git add → git commit
  ```
- 중요한 기술·제품 결정이 생기면 `decisions/` 에 이전 번호 + 1 로 ADR 파일 추가.
- 회의 중 그린 화이트보드 사진 등은 `assets/` 에 업로드하고, 해당 회의록에서 상대 경로로 참조.
