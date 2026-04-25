# secondwind

3인 팀이 함께 만들어가는 vibe-coding 프로젝트입니다.

**팀 구성**
- 개발자 1명 (Claude Code 사용)
- 비개발자 2명 (현재 Codex CLI, 이후 Claude Code 로 이전 예정)

---

## 현재 상태

**도구 세팅:** 완료 (2026-04-21). 개발자의 로컬에는 공용 워크플로 도구([gstack](./GSTACK.md))가 설치되어 바로 사용 가능합니다.

**제품 자체:** 아직 미정입니다. 프레임워크·코드·DB·배포 타깃 모두 없습니다.

다음 할 일은 **"secondwind 가 무엇이 될 것인가"** 를 아이디어부터 구체화하는 일입니다.

---

## 개발 환경 셋업 (OS 별)

각 팀원이 본인 로컬을 먼저 세팅합니다. **이 단계는 gstack 설치 전까지의 공통 환경 준비** 입니다. gstack 설치·사용법은 [GSTACK.md](./GSTACK.md) 에서 이어집니다.

### macOS / Linux

1. **AI CLI 설치** — [Claude Code](https://docs.anthropic.com/en/docs/claude-code) 또는 [Codex CLI](https://github.com/openai/codex) 중 본인이 사용할 것.
2. **프로젝트 클론**
   ```bash
   git clone https://github.com/akushig/secondwind.git secondwind
   cd secondwind
   ```
3. 완료. 이후는 [GSTACK.md](./GSTACK.md) 의 "설치" 섹션 참고.

### Windows (WSL2 기반, 권장) — 비개발자 친화형 가이드

네이티브 Windows (CMD / PowerShell) 에서는 gstack 이 돌지 않습니다. 대신 **WSL2 위에 Ubuntu 를 깔고, VS Code 를 그 Ubuntu 에 연결** 하는 방식으로 진행합니다. 그러면 macOS 와 거의 같은 경험이 됩니다.

#### 먼저 용어부터

- **WSL** (Windows Subsystem for Linux) — Windows 안에 **리눅스 컴퓨터를 하나 심는 기술**. 듀얼부팅 없이 Windows 와 Linux 를 동시에 씁니다.
- **Ubuntu** — WSL 로 깔리는 Linux 의 "브랜드". Windows 에 Pro/Home 에디션이 있듯이 Linux 에도 Ubuntu / Debian / Fedora 등 여러 배포판이 있고, 우리는 가장 대중적인 Ubuntu 를 씁니다.
- **CLI** (Command Line Interface) — 검은 터미널 창에서 키보드 명령으로 다루는 프로그램. `Claude Code CLI` 와 `Codex CLI` 는 터미널 기반 AI 어시스턴트입니다.
- **왜 Ubuntu *안에* AI CLI 를 깔아야 하나?** 우리가 쓸 도구(gstack) 는 Linux 명령을 씁니다. VS Code 를 WSL 에 연결하면 편집기·터미널·AI 가 전부 Ubuntu 안에서 한 덩어리로 돌아 가장 안정적입니다. **VS Code 확장은 "창"일 뿐이고, 실제 AI 엔진은 CLI — 그래서 CLI 도 Ubuntu 안에 있어야 서로 연결됩니다.**

전체 흐름:

```
WSL 설치 → VS Code 설치 → Ubuntu 안에 AI CLI 깔기
      → VS Code 를 Ubuntu 에 연결 → 프로젝트 클론 → 시작
```

---

#### 1단계. WSL2 + Ubuntu 설치

*무엇을 하나:* Windows 안에 Linux 컴퓨터(Ubuntu) 를 설치합니다.

**1-a) PowerShell 을 관리자 모드로 엽니다.**

1. 키보드의 **Windows 키** 를 누르거나 화면 왼쪽 하단의 시작 버튼 클릭
2. `powershell` 이라고 입력
3. 검색 결과의 **"Windows PowerShell"** 위에서 **마우스 우클릭** → **"관리자 권한으로 실행"** 클릭
4. "이 앱이 디바이스를 변경할 수 있도록 허용하시겠어요?" 창이 뜨면 **예** 클릭
5. **파란색 창** 이 열리고 상단 제목 표시줄에 **"관리자: Windows PowerShell"** 이라고 뜨면 성공

**1-b) 아래 명령을 정확히 입력하고 Enter:**

```powershell
wsl --install
```

→ WSL + Ubuntu 가 자동으로 다운로드·설치됩니다. 몇 분 걸립니다.

**1-c) 설치가 끝나면 "재부팅이 필요합니다" 라는 메시지가 나옵니다. 컴퓨터를 재부팅합니다.**

**1-d) 재부팅 후 Ubuntu 최초 설정:**

1. 재부팅 직후 자동으로 Ubuntu 설치 창이 이어질 수 있습니다. 안 뜨면 시작 메뉴에서 `Ubuntu` 검색 → 실행
2. 검은 터미널 창이 열리며 **"Enter new UNIX username:"** 이 나옴 → 원하는 영문 사용자명 입력 후 Enter (예: `mina`)
3. **"New password:"** → 비밀번호 입력 후 Enter.
   ⚠️ **화면에 글자가 하나도 안 보이는 게 정상입니다** (보안상 숨김). 그냥 타이핑하고 Enter.
4. **"Retype new password:"** → 같은 비밀번호 다시 입력 후 Enter
5. `username@ComputerName:~$` 같은 프롬프트가 뜨면 완료. 이 비밀번호는 **나중에 Ubuntu 안에서 `sudo` 명령 쓸 때** 쓰니 꼭 기억하세요. 이 창은 일단 닫아도 됩니다.

> 💡 "Ubuntu 를 갑자기 왜 실행하라는 거지?" 라고 느꼈다면: **WSL 을 깔면 기본 배포판으로 Ubuntu 가 같이 설치됨**. 즉 `wsl --install` 한 줄로 `WSL + Ubuntu` 둘 다 깔린 거라, 이제 그 Ubuntu 를 한 번 실행해 초기 설정을 해주는 단계입니다.

---

#### 2단계. VS Code 와 확장 프로그램 설치

*무엇을 하나:* 코드 편집기 + AI 채팅을 한 창에서 쓸 도구를 준비합니다.

**2-a)** [code.visualstudio.com](https://code.visualstudio.com/) 에 접속 → **Download for Windows** 버튼으로 설치 파일 받기 → 실행 → 기본 설정 그대로 **다음 → 설치**.

**2-b)** VS Code 실행 후, 왼쪽 사이드바의 **정사각형 4개** 모양 아이콘(**Extensions**, 단축키 `Ctrl+Shift+X`) 클릭.

**2-c)** 검색창에 다음을 **하나씩** 검색해 Install 버튼 클릭:

| 검색어 | 제공자 | 용도 |
|---|---|---|
| `WSL` | Microsoft | VS Code 와 Ubuntu 를 연결 |
| `Codex` *또는* `Claude Code` | OpenAI / Anthropic | 본인이 쓸 AI 플러그인 하나만 |

---

#### 3단계. Ubuntu 안에 AI CLI 설치

*무엇을 하나:* 방금 설치한 VS Code 플러그인은 **채팅 창(UI) 만** 보여줍니다. 실제 AI 엔진인 **CLI 프로그램**이 Ubuntu 안에 별도로 있어야 채팅이 동작합니다. 이게 **"왜 또 뭔가 깔아야 하지?"** 의 답 — 창과 엔진은 분리되어 있고, 엔진은 Ubuntu 쪽에 있어야 gstack 이 붙을 수 있기 때문입니다.

**3-a)** 시작 메뉴에서 **`Ubuntu`** 검색 → 실행. 검은 터미널(쉘) 이 열립니다.

**3-b)** 본인이 쓸 AI 의 **공식 문서** 에 나온 Linux 용 설치 명령을 붙여넣습니다:

- **Codex 사용자**: [github.com/openai/codex](https://github.com/openai/codex) 의 설치 섹션 참고
- **Claude Code 사용자**: [docs.anthropic.com/en/docs/claude-code](https://docs.anthropic.com/en/docs/claude-code) 의 설치 가이드 참고

> 설치 명령이 `sudo` 로 시작하거나 중간에 비밀번호를 묻는다면, **1-d 에서 만든 Ubuntu 비밀번호** 를 입력하세요. 여기서도 화면에는 글자가 안 보입니다 (정상).

**3-c)** 설치가 끝났는지 확인 — 각 CLI 의 공식 문서에 나온 **버전 확인 명령** (보통 `codex --version` 또는 `claude --version`) 을 실행해 숫자가 나오면 성공.

---

#### 4단계. VS Code 를 Ubuntu 에 연결

*무엇을 하나:* 지금까지 VS Code 는 Windows 쪽에 붙어 있습니다. 이걸 **Ubuntu 쪽으로 "이사"** 시킵니다. 이후 VS Code 의 파일 탐색·터미널·AI 채팅이 전부 Ubuntu 기준으로 동작합니다.

**4-a)** VS Code 실행 (이미 떠 있으면 그대로).

**4-b)** **왼쪽 아래 구석** 의 **파란색 `><` 아이콘** 클릭.

**4-c)** 화면 상단 중앙에 메뉴가 뜹니다 → **`Connect to WSL`** 클릭 (또는 `Connect to WSL using Distro` → `Ubuntu` 선택).

**4-d)** VS Code 창이 자동으로 새로 열리면서 **왼쪽 아래에 `WSL: Ubuntu`** 라는 표시가 나오면 성공. 이제 이 VS Code 창은 Ubuntu 안에서 돌아갑니다.

---

#### 5단계. 프로젝트 클론 — 반드시 Ubuntu 홈 아래

*무엇을 하나:* 우리 프로젝트 코드를 Ubuntu 의 내 폴더로 가져옵니다.

**5-a)** 방금 WSL 에 연결된 VS Code 에서 상단 메뉴 **`Terminal` → `New Terminal`** 클릭 (또는 단축키 `` Ctrl + ` ``, 백틱).

**5-b)** 창 아래쪽에 터미널이 열리고 프롬프트가 `username@...:~$` 형태로 나옵니다. 여기에 아래 명령을 **한 줄씩** 입력:

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/akushig/secondwind.git secondwind
cd secondwind
```

> ⚠️ 반드시 `~/projects/...` (Ubuntu 홈) 아래에 둬야 합니다. `/mnt/c/...` (Windows 드라이브) 에 두면 파일 읽기·쓰기가 매우 느리고 일부 도구가 권한 문제로 깨집니다.

---

#### 6단계. VS Code 에서 프로젝트 폴더 열기

**6-a)** VS Code 상단 메뉴 **`File` → `Open Folder`** 클릭.

**6-b)** 경로 입력창에 `/home/<본인-username>/projects/secondwind` 입력 후 확인 (또는 파일 탐색기로 해당 폴더 선택).

**6-c)** 좌하단 표시가 여전히 `WSL: Ubuntu` 인지 확인. 맞으면 성공.

---

#### 7단계. AI 채팅창 열기

**7-a)** 왼쪽 사이드바에서 설치한 AI 플러그인 아이콘 클릭 (Codex / Claude Code 로고).

**7-b)** 우측 또는 하단에 채팅창이 열립니다. 이제 프로젝트 작업을 시작할 준비 완료.

이 상태에서 **첫 프롬프트로 무엇을 입력해 gstack 을 설치하는지** 는 [GSTACK.md](./GSTACK.md) 의 "설치" 섹션에 있습니다. 거기로 이동하세요.

> 안내된 `./scripts/bootstrap.sh` 한 번으로 **gstack + 로컬 git hook 까지 같이 깔립니다** (회사 도메인·main 직접 commit·에이전트 prefix 차단 — 자세한 규칙은 [GIT.md](./GIT.md)).

---

## 시작하기 (gstack 설치 이후)

환경 셋업과 gstack 설치가 끝난 뒤:

1. 개발자가 `/office-hours` 로 제품 아이디어를 구체화합니다.
2. 이어서 `/autoplan` 으로 CEO/디자인/엔지니어링 리뷰를 거쳐 계획을 확정합니다.
3. 구현 → `/review` → `/qa` → `/ship` → `/land-and-deploy` → `/canary` 순으로 출시까지 진행합니다.

> 각 명령어의 상세 사용법과 옵션은 [GSTACK.md](./GSTACK.md) 참고. Codex 에서는 `/gstack-*` 접두사가 붙습니다.

---

## 팀 원칙 (짧게)

AI 에이전트도 함께 지키는 기본 규칙입니다. 전체 내용:

- 프로젝트 현황 · 팀 원칙 · 가드레일 → [`PROJECT.md`](./PROJECT.md)
- Git 워크플로 (브랜치 · commit · PR · main 보호) → [`GIT.md`](./GIT.md)
- 도구별 차이 → [`CLAUDE.md`](./CLAUDE.md) (Claude Code) / [`AGENTS.md`](./AGENTS.md) (Codex 등)

핵심만:

- 패치 전에 **재현·원인 파악** 먼저
- **작은 단위** 의 리뷰 가능한 변경 선호 — `main` 직접 push 금지, 모든 변경은 새 브랜치 → PR
- 비개발자 팀원을 배려한 설명 — diff 대신 "사용자가 보게 될 것" 을 먼저
- **스키마 / CI / secrets / 의존성 변경** 은 반드시 개발자 확인 후 진행

---

## 프로젝트 구조

| 위치 | 내용 | 주 독자 |
|---|---|---|
| `README.md` | 프로젝트 개요 (이 파일) | 사람 |
| `PROJECT.md` | 현재 단계 · 팀 원칙 · 가드레일 (도구 무관) | 사람 + AI |
| `GIT.md` | Git 워크플로 — 브랜치 · commit · PR · main 보호 | 사람 + AI |
| `CLAUDE.md` | Claude Code 전용 라우터 | AI 에이전트 |
| `AGENTS.md` | Codex / 기타 에이전트 전용 라우터 | AI 에이전트 |
| `GSTACK.md` | gstack 도구 설치·사용·트러블슈팅 | 사람 + AI |
| `docs/` | 팀 공유 문서 (회의록·아이데이션·기획·결정·에셋) | 사람 + AI |
| `app/` | 서비스 개발 코드 (Next.js App Router) | 사람 + AI |
| `scripts/` | 팀 공용 스크립트 (`bootstrap.sh`, `setup-git-hooks.sh`) | 사람 + AI |

문서 하위 폴더 구조와 파일명 규칙은 [`docs/README.md`](./docs/README.md) 참고.

---

## Happy path

```
/office-hours → /autoplan → 구현 → /review → /qa → /ship → /land-and-deploy → /canary
```

이것이 "아이디어 → 배포" 까지의 기본 흐름입니다. 나머지는 선택.
