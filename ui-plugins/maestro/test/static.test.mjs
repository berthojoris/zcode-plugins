// Static checks on the built artifacts. Run after `pnpm build`; skips when
// dist/ is absent (fresh checkout before build) so `pnpm -r test` stays green.
import { strict as assert } from "node:assert";
import { readFile, stat } from "node:fs/promises";
import { test } from "node:test";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const hasDist = await stat(join(DIST, "server.mjs")).then(() => true, () => false);
const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
const manifest = JSON.parse(
  await readFile(join(ROOT, "../../external_plugins/maestro/.zcode-plugin/plugin.json"), "utf8"),
);

test("package version matches installable manifest", () => {
  assert.equal(pkg.version, manifest.version);
});

test("surface resourceUri is served by the build", () => {
  const surface = manifest.ui?.surfaces?.[0];
  assert.ok(surface, "manifest declares a ui surface");
  assert.equal(surface.resourceUri, "ui://maestro/panel.html");
  assert.ok(Array.isArray(manifest.mcpServers?.[surface.server]?.args));
});

test("hooks ship the activity tracker", async () => {
  const hooks = JSON.parse(
    await readFile(join(ROOT, "../../external_plugins/maestro/hooks/hooks.json"), "utf8"),
  );
  const pre = hooks.hooks.PreToolUse || [];
  const agentMatcher = pre.find((e) => e.matcher === "Agent|Task");
  assert.ok(agentMatcher, "PreToolUse tracks Agent|Task");
  assert.ok(
    JSON.stringify(agentMatcher).includes("agent-status.mjs"),
    "tracker wired into Agent|Task hooks",
  );
});

test("dist artifacts", { skip: !hasDist }, async () => {
  const html = await readFile(join(DIST, "panel.html"), "utf8");
  assert.ok(html.includes('id="root"'));
  assert.ok(!html.includes("/*__JS__*/") && !html.includes("/*__CSS__*/"), "placeholders replaced");
  assert.ok(html.includes("maestro-panel"), "panel bundle present");

  const server = await readFile(join(DIST, "server.mjs"), "utf8");
  assert.ok(server.includes('"maestro"'), "serverInfo name");
  assert.ok(server.includes(pkg.version), "serverInfo version matches package");
  assert.ok(server.includes("maestro_status") && server.includes("maestro_panel_view"));
  assert.ok(server.includes("registerResource"), "panel resource registered");
  assert.ok(server.includes("ui://maestro/panel.html"), "panel resource uri literal");
  assert.ok(server.includes("text/html;profile=mcp-app"), "mcp-app html mime type");
});
