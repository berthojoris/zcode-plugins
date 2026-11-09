#!/usr/bin/env node
/**
 * Maestro agent-status MCP server.
 *
 * Two tools:
 *  - maestro_panel_view: opens the side panel (_meta ui surface). The model
 *    calls this when the user asks to see agent activity; the panel can also
 *    be opened manually from the host UI.
 *  - maestro_status: returns the roster plus live lane activity. The panel
 *    polls this; it is read-only and side-effect free.
 *
 * Activity state is produced by hooks/agent-status.mjs (PreToolUse /
 * PostToolUse on the Agent tool, UserPromptSubmit, Stop) which writes small
 * JSON files into a per-install status directory. The same deterministic
 * directory is derived here, so hook writes and server reads always agree
 * even when ZCODE_PLUGIN_DATA differs between the two processes.
 */

import { createHash } from "node:crypto";
import { readdir, readFile, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

const VERSION = __PLUGIN_VERSION__;
const UI_URI = "ui://maestro/panel.html";
const LANE_STALE_MS = 30 * 60 * 1000; // a lane older than this is forgotten residue

const ROSTER = [
  { name: "scout", role: "Recon & research", tools: "read-only + web" },
  { name: "elder", role: "Architecture & risk", tools: "read-only" },
  { name: "atelier", role: "UI/UX design", tools: "read-only" },
  { name: "wright", role: "Implementation", tools: "edit + write" },
  { name: "lens", role: "Visual analysis", tools: "read-only" },
  { name: "tribunal", role: "Adversarial review", tools: "read-only" },
];

// dist/server.mjs -> plugin root; mirrors hooks/agent-status.mjs resolution.
const pluginRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const statusDir =
  process.env.MAESTRO_STATUS_DIR ||
  join(
    tmpdir(),
    "zcode-maestro-" + createHash("sha1").update(pluginRoot).digest("hex").slice(0, 12),
  );

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch {
    return null;
  }
}

async function listJson(dir) {
  try {
    const names = await readdir(dir);
    const entries = await Promise.all(
      names.filter((n) => n.endsWith(".json")).map(async (n) => [n, await readJson(join(dir, n))]),
    );
    return entries.filter(([, v]) => v != null);
  } catch {
    return [];
  }
}

async function snapshot() {
  const now = Date.now();
  const [orchestrator, session, lanes, history] = await Promise.all([
    readJson(join(statusDir, "orchestrator.json")),
    readJson(join(statusDir, "session.json")),
    listJson(join(statusDir, "lanes")),
    listJson(join(statusDir, "history")),
  ]);

  const activeLanes = lanes
    .map(([, v]) => v)
    .filter((lane) => now - (lane.startedAt || 0) < LANE_STALE_MS)
    .sort((a, b) => a.startedAt - b.startedAt);

  const recent = history
    .map(([, v]) => v)
    .sort((a, b) => (b.endedAt || 0) - (a.endedAt || 0))
    .slice(0, 12);

  const lastRunByAgent = new Map();
  for (const run of recent) {
    if (!lastRunByAgent.has(run.agent)) lastRunByAgent.set(run.agent, run);
  }

  return {
    ok: true,
    version: VERSION,
    serverTime: now,
    hooksConnected: session != null,
    session: session ? { startedAt: session.startedAt } : null,
    orchestrator: orchestrator
      ? { prompt: orchestrator.prompt || "", busySince: orchestrator.since }
      : null,
    agents: ROSTER.map((agent) => {
      const lane = activeLanes.find((l) => l.agent === agent.name) || null;
      const last = lastRunByAgent.get(agent.name) || null;
      return {
        ...agent,
        state: lane ? "active" : "idle",
        startedAt: lane ? lane.startedAt : null,
        task: lane ? lane.task || "" : null,
        lastRun: last
          ? { endedAt: last.endedAt, durationMs: last.durationMs, outcome: last.outcome }
          : null,
      };
    }),
    activeCount: activeLanes.length,
    recent,
  };
}

const server = new McpServer(
  { name: "maestro", version: VERSION },
  { capabilities: { tools: {}, resources: {} } },
);

server.tool(
  "maestro_status",
  "Live status of the maestro orchestrator and its specialist lanes (scout, elder, atelier, wright, lens, tribunal): which lane is currently dispatched, for how long, and recent completions. Read-only.",
  async () => ({ content: [{ type: "text", text: JSON.stringify(await snapshot()) }] }),
);

server.tool(
  "maestro_panel_view",
  "Open the Maestro agents side panel showing the orchestrator and every specialist lane with live activity indicators.",
  { reason: z.string().default("") },
  { annotations: { readOnlyHint: true } },
  async () => ({
    content: [{ type: "text", text: JSON.stringify({ ok: true, version: VERSION, panel: UI_URI }) }],
    _meta: { ui: { resourceUri: UI_URI, surface: "maestro-panel", visibility: ["model", "app"] } },
  }),
);

// Side-panel page: served as an MCP resource so the host's resources/read can
// fetch it. dist/server.mjs lands next to dist/panel.html in both the source
// layout and external_plugins/maestro/dist, so resolve via this module's dir.
server.registerResource(
  "panel",
  UI_URI,
  { mimeType: "text/html;profile=mcp-app" },
  async () => ({
    contents: [
      {
        uri: UI_URI,
        mimeType: "text/html;profile=mcp-app",
        text: await readFile(join(dirname(fileURLToPath(import.meta.url)), "panel.html"), "utf8"),
      },
    ],
  }),
);

// Prune stale lane files so an interrupted session does not leave forever-spinning rows.
async function pruneStaleLanes() {
  const now = Date.now();
  const dir = join(statusDir, "lanes");
  for (const [name, lane] of await listJson(dir)) {
    if (lane && now - (lane.startedAt || 0) >= LANE_STALE_MS) await rm(join(dir, name), { force: true });
  }
}

const stderr = (msg) => process.stderr.write(`[maestro-ui] ${msg}\n`);
try {
  await stat(statusDir);
} catch {
  stderr(`status dir not present yet (hooks create it): ${statusDir}`);
}

await server.connect(new StdioServerTransport());
setInterval(pruneStaleLanes, 60_000).unref();
stderr(`maestro agent-status server ${VERSION} ready (status: ${statusDir})`);
