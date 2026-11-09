#!/usr/bin/env node
/**
 * Maestro agent activity tracker (feeds the side panel).
 *
 * Writes small JSON files into a deterministic per-install status directory
 * that dist/server.mjs reads (see ui-plugins/maestro/server/maestro_server.mjs
 * for the mirrored resolution). Per-lane files avoid read-modify-write races
 * when several specialists are dispatched in parallel.
 *
 * Events:
 *  - SessionStart            reset state for the new session
 *  - UserPromptSubmit        mark the orchestrator busy with the prompt
 *  - PreToolUse Agent|Task   lane started (subagent_type + task snippet)
 *  - PostToolUse Agent|Task  lane finished -> history
 *  - PostToolUseFailure      lane failed   -> history
 *  - Stop                    orchestrator idle again; prune stale lanes
 *
 * Fails open: any error exits 0 with no stdout, never blocking the session.
 */

import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rm, stat, writeFile, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const LANE_STALE_MS = 30 * 60 * 1000;
const PROMPT_SNIPPET = 160;

// hooks/agent-status.mjs -> plugin root; mirrors the server's resolution.
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statusDir =
  process.env.MAESTRO_STATUS_DIR ||
  join(
    tmpdir(),
    "zcode-maestro-" + createHash("sha1").update(pluginRoot).digest("hex").slice(0, 12),
  );

const laneName = (id) => id.replace(/[^a-zA-Z0-9_-]/g, "_") + ".json";

async function writeAtomic(path, data) {
  await mkdir(dirname(path), { recursive: true });
  const tmp = path + "." + Date.now() + ".tmp";
  await writeFile(tmp, JSON.stringify(data) + "\n");
  await rename(tmp, path);
}

const snippet = (s) =>
  typeof s === "string" ? s.replace(/\s+/g, " ").trim().slice(0, PROMPT_SNIPPET) : "";

function specialistOf(input) {
  const ti = input.tool_input || input.toolInput || {};
  const raw =
    ti.subagent_type || ti.subagentType || ti.agent_type || ti.agentType || ti.type || "";
  if (typeof raw !== "string" || !raw.trim()) return null;
  return raw.trim().toLowerCase().replace(/^maestro:/, "");
}

function taskOf(input) {
  const ti = input.tool_input || input.toolInput || {};
  return snippet(ti.prompt || ti.description || ti.task || ti.query || ti.message);
}

function readStdin() {
  return new Promise((res) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => res(raw));
    process.stdin.on("error", () => res(raw));
  });
}

async function finishLane(input, outcome) {
  const id = input.tool_use_id || input.toolUseId;
  if (!id) return;
  const lanePath = join(statusDir, "lanes", laneName(id));
  try {
    await stat(lanePath);
  } catch {
    return; // lane never recorded (e.g. host skipped PreToolUse hook)
  }
  const lane = JSON.parse((await readFileSafe(lanePath)) || "{}");
  await rm(lanePath, { force: true });
  const endedAt = Date.now();
  await writeAtomic(
    join(statusDir, "history", `${endedAt}-${laneName(id)}`),
    { ...lane, endedAt, durationMs: endedAt - (lane.startedAt || endedAt), outcome },
  );
  // keep history bounded
  const hist = await readdir(join(statusDir, "history")).catch(() => []);
  for (const name of hist.sort().slice(0, Math.max(0, hist.length - 40))) {
    await rm(join(statusDir, "history", name), { force: true });
  }
}

async function readFileSafe(path) {
  try {
    return await readFile(path, "utf8");
  } catch {
    return null;
  }
}

async function pruneStale() {
  const dir = join(statusDir, "lanes");
  const names = await readdir(dir).catch(() => []);
  const now = Date.now();
  for (const name of names) {
    const lane = JSON.parse((await readFileSafe(join(dir, name))) || "null");
    if (lane && now - (lane.startedAt || 0) >= LANE_STALE_MS) {
      await rm(join(dir, name), { force: true });
    }
  }
}

const raw = await readStdin();
let input;
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.exit(0);
}

try {
  const event = input.hook_event_name || input.hookEventName || "";

  if (event === "SessionStart") {
    await rm(statusDir, { recursive: true, force: true });
    await writeAtomic(join(statusDir, "session.json"), { startedAt: Date.now() });
  } else if (event === "UserPromptSubmit") {
    // Specialists do not receive user prompts; this is the orchestrator turning.
    await writeAtomic(join(statusDir, "orchestrator.json"), {
      prompt: snippet(input.prompt),
      since: Date.now(),
      updatedAt: Date.now(),
    });
  } else if (event === "PreToolUse") {
    const agent = specialistOf(input);
    if (!agent) process.exit(0);
    const id = input.tool_use_id || input.toolUseId;
    if (!id) process.exit(0);
    await writeAtomic(join(statusDir, "lanes", laneName(id)), {
      agent,
      task: taskOf(input),
      startedAt: Date.now(),
    });
  } else if (event === "PostToolUse") {
    await finishLane(input, "completed");
  } else if (event === "PostToolUseFailure") {
    await finishLane(input, "failed");
  } else if (event === "Stop") {
    await rm(join(statusDir, "orchestrator.json"), { force: true });
    await pruneStale();
  }
} catch (err) {
  process.stderr.write(`[maestro-status] ${err?.message || err}\n`);
}
process.exit(0);
