#!/usr/bin/env node

const PLANNING_MODELS = ["classic", "balanced", "verified", "grounded"];

const GOLDEN_CASES = [
  {
    id: "jeju-family-2n3d",
    destination: "제주",
    startDate: "2026-05-06",
    endDate: "2026-05-08",
    prompt:
      "성인 2명과 6세 아이 1명. 렌터카 이용. 아이 낮잠 때문에 13시~15시는 실내 또는 이동 적게. 카페는 하루 1번 이하. 숙소: 그랜드 조선 제주",
  },
  {
    id: "busan-no-car-food",
    destination: "부산",
    startDate: "2026-06-13",
    endDate: "2026-06-15",
    prompt:
      "차 없이 대중교통 위주. 해운대보다 광안리 쪽 선호. 회와 돼지국밥은 꼭 포함. 너무 빡빡하지 않게.",
  },
  {
    id: "gangneung-parents-slow",
    destination: "강릉",
    startDate: "2026-07-04",
    endDate: "2026-07-05",
    prompt:
      "부모님과 1박 2일. 오래 걷는 일정은 피하고, 바다 전망 식사와 카페를 포함. 주차 쉬운 곳 위주.",
  },
];

const DEFAULT_BASE_URL = "http://localhost:3000";
const DEFAULT_OUT_DIR = ".gstack/evals/travel";
const REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_RETRY_429_MS = 60_000;

function printUsage() {
  console.log(`Usage: npm run eval:travel -- [options]

Runs the travel planner golden set against a running local app.
Start the app first, for example: npm run dev

Options:
  --base-url <url>     App URL. Default: ${DEFAULT_BASE_URL}
  --runs <n>           Repetitions per case/model. Default: 1
  --case <id>          Run one golden case only. Can be repeated.
  --models <list>      Comma-separated models. Default: ${PLANNING_MODELS.join(",")}
  --out <dir>          Snapshot output dir. Default: ${DEFAULT_OUT_DIR}
  --no-write           Print summary without writing a snapshot.
  --retry-429 <n>      Retry each run on upstream 429. Default: 0
  --retry-429-ms <ms>  Wait between 429 retries. Default: ${DEFAULT_RETRY_429_MS}
  --strict             Exit non-zero when any run fails. Default: write snapshot and continue.
  --help               Show this help.

Golden cases:
${GOLDEN_CASES.map((c) => `  - ${c.id}`).join("\n")}
`);
}

function parseArgs(argv) {
  const args = {
    baseUrl: DEFAULT_BASE_URL,
    runs: 1,
    caseIds: [],
    models: PLANNING_MODELS,
    outDir: DEFAULT_OUT_DIR,
    write: true,
    strict: false,
    retry429: 0,
    retry429Ms: DEFAULT_RETRY_429_MS,
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
    if (arg === "--base-url") {
      args.baseUrl = readValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--runs") {
      args.runs = Number(readValue(argv, ++i, arg));
      continue;
    }
    if (arg === "--case") {
      args.caseIds.push(readValue(argv, ++i, arg));
      continue;
    }
    if (arg === "--models") {
      args.models = readValue(argv, ++i, arg)
        .split(",")
        .map((v) => v.trim())
        .filter(Boolean);
      continue;
    }
    if (arg === "--out") {
      args.outDir = readValue(argv, ++i, arg);
      continue;
    }
    if (arg === "--no-write") {
      args.write = false;
      continue;
    }
    if (arg === "--retry-429") {
      args.retry429 = Number(readValue(argv, ++i, arg));
      continue;
    }
    if (arg === "--retry-429-ms") {
      args.retry429Ms = Number(readValue(argv, ++i, arg));
      continue;
    }
    if (arg === "--strict") {
      args.strict = true;
      continue;
    }
    throw new Error(`Unknown option: ${arg}`);
  }

  if (!Number.isInteger(args.runs) || args.runs < 1 || args.runs > 10) {
    throw new Error("--runs must be an integer from 1 to 10");
  }
  if (!Number.isInteger(args.retry429) || args.retry429 < 0 || args.retry429 > 5) {
    throw new Error("--retry-429 must be an integer from 0 to 5");
  }
  if (!Number.isInteger(args.retry429Ms) || args.retry429Ms < 1_000) {
    throw new Error("--retry-429-ms must be an integer >= 1000");
  }
  for (const model of args.models) {
    if (!PLANNING_MODELS.includes(model)) {
      throw new Error(`Unknown planning model: ${model}`);
    }
  }
  return args;
}

function readValue(argv, index, option) {
  const value = argv[index];
  if (!value || value.startsWith("--")) {
    throw new Error(`${option} requires a value`);
  }
  return value;
}

function pickCases(caseIds) {
  if (caseIds.length === 0) return GOLDEN_CASES;
  const selected = [];
  for (const id of caseIds) {
    const match = GOLDEN_CASES.find((c) => c.id === id);
    if (!match) throw new Error(`Unknown golden case: ${id}`);
    selected.push(match);
  }
  return selected;
}

async function postTravel(baseUrl, input) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error("request-timeout")), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(new URL("/api/gemini", baseUrl), {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ service: "travel", input }),
      signal: controller.signal,
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok || json.status !== "ok") {
      return {
        status: "error",
        httpStatus: res.status,
        reason: json.reason ?? json.status ?? "unknown",
        raw: json,
      };
    }
    return { status: "ok", httpStatus: res.status, ...json };
  } catch (err) {
    return {
      status: "error",
      httpStatus: 0,
      reason: err instanceof Error ? err.message : "unknown",
    };
  } finally {
    clearTimeout(timer);
  }
}

async function runTravelWithRetries(baseUrl, input, retry429, retry429Ms) {
  const attempts = [];
  for (let attempt = 0; attempt <= retry429; attempt++) {
    const started = Date.now();
    const response = await postTravel(baseUrl, input);
    attempts.push({
      attempt: attempt + 1,
      durationMs: Date.now() - started,
      status: response.status,
      httpStatus: response.httpStatus,
      reason: response.status === "error" ? response.reason : undefined,
    });
    if (response.status !== "error" || response.reason !== "upstream 429" || attempt === retry429) {
      return { response, attempts };
    }
    console.log(`429 retry ${attempt + 1}/${retry429}: waiting ${retry429Ms}ms`);
    await sleep(retry429Ms);
  }
  return { response: attempts.at(-1), attempts };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function planMetrics(plan, placeStats) {
  const days = Array.isArray(plan?.days) ? plan.days : [];
  const items = days.flatMap((day) => day.items ?? []);
  const transitEligible = days.flatMap((day) => (day.items ?? []).slice(1));
  const withTransit = transitEligible.filter((item) => item.transit).length;
  return {
    dayCount: days.length,
    itemCount: items.length,
    transitCoverage: transitEligible.length > 0 ? round(withTransit / transitEligible.length) : 0,
    totalPlaceQueries: placeStats?.totalPlaceQueries ?? 0,
    verifiedPlaces: placeStats?.verifiedPlaces ?? 0,
    verificationRate:
      placeStats?.totalPlaceQueries > 0
        ? round(placeStats.verifiedPlaces / placeStats.totalPlaceQueries)
        : 0,
    warnings: placeStats?.warnings ?? 0,
    destinationMismatches: placeStats?.destinationMismatches ?? 0,
    outlierRejects: placeStats?.outlierRejects ?? 0,
    repairedPlaces: placeStats?.repairedPlaces ?? 0,
  };
}

function placeAudit(plan) {
  const days = Array.isArray(plan?.days) ? plan.days : [];
  return days.flatMap((day) =>
    (day.items ?? [])
      .filter((item) => item.place_query || item.place || item.place_warning)
      .map((item) => ({
        day: day.label,
        text: item.text,
        placeQuery: item.place_query ?? "",
        placeName: item.place?.name ?? "",
        category: item.place?.category ?? "",
        address: item.place?.address ?? "",
        warning: item.place_warning ?? "",
      })),
  );
}

function round(n) {
  return Math.round(n * 1000) / 1000;
}

function summarize(results) {
  const groups = new Map();
  for (const result of results) {
    const key = `${result.caseId}:${result.planningModel}`;
    const group = groups.get(key) ?? {
      caseId: result.caseId,
      planningModel: result.planningModel,
      runs: 0,
      ok: 0,
      errors: 0,
      avgMs: 0,
      avgVerifiedPlaces: 0,
      avgTotalPlaceQueries: 0,
      avgVerificationRate: 0,
      avgWarnings: 0,
      avgDestinationMismatches: 0,
      avgOutlierRejects: 0,
      avgRepairedPlaces: 0,
      avgTokens: 0,
    };
    group.runs++;
    if (result.status === "ok") {
      group.ok++;
      group.avgMs += result.durationMs;
      group.avgVerifiedPlaces += result.metrics.verifiedPlaces;
      group.avgTotalPlaceQueries += result.metrics.totalPlaceQueries;
      group.avgVerificationRate += result.metrics.verificationRate;
      group.avgWarnings += result.metrics.warnings;
      group.avgDestinationMismatches += result.metrics.destinationMismatches;
      group.avgOutlierRejects += result.metrics.outlierRejects;
      group.avgRepairedPlaces += result.metrics.repairedPlaces;
      group.avgTokens += result.usage?.total ?? 0;
    } else {
      group.errors++;
    }
    groups.set(key, group);
  }

  return Array.from(groups.values()).map((group) => {
    const ok = Math.max(group.ok, 1);
    return {
      caseId: group.caseId,
      model: group.planningModel,
      runs: group.runs,
      ok: group.ok,
      errors: group.errors,
      avgMs: Math.round(group.avgMs / ok),
      avgVerifiedPlaces: round(group.avgVerifiedPlaces / ok),
      avgTotalPlaceQueries: round(group.avgTotalPlaceQueries / ok),
      avgVerificationRate: round(group.avgVerificationRate / ok),
      avgWarnings: round(group.avgWarnings / ok),
      avgDestinationMismatches: round(group.avgDestinationMismatches / ok),
      avgOutlierRejects: round(group.avgOutlierRejects / ok),
      avgRepairedPlaces: round(group.avgRepairedPlaces / ok),
      avgTokens: Math.round(group.avgTokens / ok),
    };
  });
}

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, "-");
}

async function writeSnapshot(outDir, snapshot) {
  const fs = await import("node:fs/promises");
  await fs.mkdir(outDir, { recursive: true });
  const file = `${outDir}/${timestamp()}.json`;
  await fs.writeFile(file, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");
  return file;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cases = pickCases(args.caseIds);
  const results = [];

  console.log(
    `Running travel eval: ${cases.length} case(s) x ${args.models.length} model(s) x ${args.runs} run(s)`,
  );
  console.log(`Target: ${args.baseUrl}`);

  for (const goldenCase of cases) {
    for (const model of args.models) {
      for (let run = 1; run <= args.runs; run++) {
        const input = { ...goldenCase, planningModel: model };
        delete input.id;
        const started = Date.now();
        const { response, attempts } = await runTravelWithRetries(
          args.baseUrl,
          input,
          args.retry429,
          args.retry429Ms,
        );
        const durationMs = Date.now() - started;
        const result = {
          caseId: goldenCase.id,
          planningModel: model,
          run,
          durationMs,
          status: response.status,
          httpStatus: response.httpStatus,
          model: response.model,
          promptVersion: response.promptVersion,
          usage: response.usage,
          attempts,
          placeStats: response.placeStats,
          metrics: response.status === "ok" ? planMetrics(response.plan, response.placeStats) : undefined,
          placeAudit: response.status === "ok" ? placeAudit(response.plan) : undefined,
          error: response.status === "error" ? { reason: response.reason, raw: response.raw } : undefined,
        };
        results.push(result);

        const marker = response.status === "ok" ? "ok" : "error";
        console.log(`${marker} ${goldenCase.id} ${model} run ${run}/${args.runs} ${durationMs}ms`);
      }
    }
  }

  const summary = summarize(results);
  const errors = results
    .filter((r) => r.status !== "ok")
    .map((r) => ({
      caseId: r.caseId,
      model: r.planningModel,
      run: r.run,
      httpStatus: r.httpStatus,
      reason: r.error?.reason ?? "unknown",
    }));
  console.table(summary);
  if (errors.length > 0) {
    console.log("Errors:");
    console.table(errors);
  }

  const snapshot = {
    createdAt: new Date().toISOString(),
    baseUrl: args.baseUrl,
    runs: args.runs,
    cases: cases.map((c) => ({ ...c })),
    models: args.models,
    summary,
    errors,
    results,
  };

  if (args.write) {
    const file = await writeSnapshot(args.outDir, snapshot);
    console.log(`Snapshot written: ${file}`);
  }

  if (args.strict && errors.length > 0) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
