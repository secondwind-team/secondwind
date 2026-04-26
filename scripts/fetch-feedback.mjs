#!/usr/bin/env node

// 운영 환경의 사용자 피드백을 admin endpoint 로 받아 로컬 캐시 파일로 저장한다.
// KV 토큰을 로컬에 두지 않기 위한 안전 장치 — 토큰은 macOS Keychain 에 보관한다.

import { spawnSync } from "node:child_process";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

const KEYCHAIN_SERVICE = "secondwind-feedback-admin-token";
const DEFAULT_BASE_URL = "https://secondwind-mu.vercel.app";
const DEFAULT_OUT = "docs/feedback/feedback.local.json";
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

function printUsage() {
  console.log(`Usage: npm run feedback:pull -- [options]

운영 환경의 travel 피드백을 admin endpoint 로 받아 로컬 JSON 으로 저장한다.
토큰은 macOS Keychain (service: "${KEYCHAIN_SERVICE}") 에서 읽는다.

Options:
  --base-url <url>     운영 base URL (default: ${DEFAULT_BASE_URL})
  --limit <n>          가져올 record 수 (default: ${DEFAULT_LIMIT}, max: ${MAX_LIMIT})
  --since <iso>        ISO 날짜 이후 record 만
  --category <c>       bug | quality | other
  --out <path>         출력 경로 (default: ${DEFAULT_OUT})
  --token-env <NAME>   Keychain 대신 환경변수에서 토큰 읽기 (CI 용)
  --help               이 메시지

최초 1회 (macOS):
  security add-generic-password -s ${KEYCHAIN_SERVICE} -w
  # 프롬프트가 뜨면 ADMIN_FEEDBACK_TOKEN 값 붙여넣기 후 enter
`);
}

function parseArgs(argv) {
  const out = {
    help: false,
    limit: null,
    since: null,
    category: null,
    baseUrl: null,
    outPath: null,
    tokenEnv: null,
  };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    const next = () => argv[(i += 1)];
    if (a === "--help" || a === "-h") {
      out.help = true;
    } else if (a === "--limit") {
      out.limit = next();
    } else if (a === "--since") {
      out.since = next();
    } else if (a === "--category") {
      out.category = next();
    } else if (a === "--base-url") {
      out.baseUrl = next();
    } else if (a === "--out") {
      out.outPath = next();
    } else if (a === "--token-env") {
      out.tokenEnv = next();
    } else {
      console.error(`Unknown option: ${a}`);
      process.exit(2);
    }
  }
  return out;
}

function readTokenFromKeychain() {
  if (process.platform !== "darwin") return null;
  const r = spawnSync(
    "security",
    ["find-generic-password", "-s", KEYCHAIN_SERVICE, "-w"],
    { encoding: "utf8" },
  );
  if (r.status !== 0) return null;
  const token = r.stdout.trim();
  return token.length >= 16 ? token : null;
}

function abort(msg, code = 1) {
  console.error(msg);
  process.exit(code);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printUsage();
    return;
  }

  // KV 토큰이 로컬에 잘못 설정돼 있으면 경고. 안전 가드.
  if (process.env.KV_REST_API_URL || process.env.KV_REST_API_TOKEN) {
    console.warn(
      "[warn] KV_REST_API_URL/TOKEN 이 환경에 보입니다. 이 스크립트는 KV 를 직접 호출하지 않지만, " +
        "로컬에 prod KV 토큰을 두는 것은 권장되지 않습니다. .env.local 을 확인하세요.",
    );
  }

  let token;
  if (args.tokenEnv) {
    token = process.env[args.tokenEnv];
    if (!token) abort(`환경변수 ${args.tokenEnv} 가 비어 있습니다.`, 2);
  } else {
    token = readTokenFromKeychain();
    if (!token) {
      abort(
        [
          "Keychain 에서 토큰을 읽지 못했습니다.",
          `최초 1회 등록: security add-generic-password -s ${KEYCHAIN_SERVICE} -w`,
          "또는 --token-env <NAME> 으로 환경변수에서 읽도록 지정하세요.",
        ].join("\n"),
        2,
      );
    }
  }

  const baseUrl = args.baseUrl || DEFAULT_BASE_URL;
  const url = new URL("/api/travel/feedback/admin", baseUrl);
  if (args.limit) url.searchParams.set("limit", args.limit);
  if (args.since) url.searchParams.set("since", args.since);
  if (args.category) url.searchParams.set("category", args.category);

  console.log(`GET ${url}`);
  let res;
  try {
    res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  } catch (err) {
    abort(`요청 실패: ${err instanceof Error ? err.message : String(err)}`);
  }
  if (res.status === 404) {
    abort(
      "404 — endpoint 가 아직 배포되지 않았거나, 토큰이 잘못됐습니다 (둘 다 동일 응답).",
    );
  }
  if (res.status === 503) {
    abort("503 — 서버에 KV 가 설정되지 않았습니다.");
  }
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    abort(`HTTP ${res.status}: ${body}`);
  }

  const json = await res.json();
  const outPath = resolve(process.cwd(), args.outPath || DEFAULT_OUT);
  mkdirSync(dirname(outPath), { recursive: true });
  writeFileSync(outPath, JSON.stringify(json, null, 2) + "\n", "utf8");
  console.log(`Wrote ${json.count ?? 0} records → ${outPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
