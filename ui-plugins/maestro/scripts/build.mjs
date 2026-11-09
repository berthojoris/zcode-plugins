#!/usr/bin/env node
// Builds dist/: panel.html (one self-contained page) + server.mjs (bundled MCP
// server) + THIRD_PARTY_NOTICES.txt. The root builder copies dist/ into the
// installable directory and writes the completion marker itself.
import { readFile, rm, stat, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { mkdir } from "node:fs/promises";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const DIST = join(ROOT, "dist");
const INSTALL = ["../../external_plugins/maestro", "../../plugins/maestro"]
  .map((p) => join(ROOT, p));
const manifestDir = (await Promise.all(
  INSTALL.map((d) => stat(join(d, ".zcode-plugin/plugin.json")).then(() => d, () => null)),
)).find(Boolean);
if (!manifestDir) throw new Error("plugin manifest not found next to ui-plugins/maestro");
const manifest = JSON.parse(await readFile(join(manifestDir, ".zcode-plugin/plugin.json"), "utf8"));
const pkg = JSON.parse(await readFile(join(ROOT, "package.json"), "utf8"));
if (manifest.version !== pkg.version)
  throw new Error(`version mismatch: manifest ${manifest.version} vs package ${pkg.version}`);

const esbuild = createRequire(join(ROOT, "package.json"))("esbuild");
const nodePaths = [join(ROOT, "node_modules")];

await rm(DIST, { recursive: true, force: true });
await mkdir(DIST, { recursive: true });

// 1. panel — one self-contained page (JS+CSS inlined; the host serves only the HTML)
const ui = await esbuild.build({
  entryPoints: [join(ROOT, "ui/src/main.js")],
  bundle: true, format: "iife", platform: "browser", target: ["es2022"],
  minify: true, legalComments: "none", write: false, logLevel: "warning",
  nodePaths, metafile: true,
  define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
});
const js = ui.outputFiles[0].text.replace(/<\/script/gi, "<\\/script");
const css = await readFile(join(ROOT, "ui/src/style.css"), "utf8");
const escapeCss = css.replace(/<\/style/gi, "<\\/style");
const html = (await readFile(join(ROOT, "ui/template.html"), "utf8"))
  .replace("__TITLE__", "Maestro agents")
  .replace("/*__CSS__*/", () => escapeCss.trim())
  .replace("/*__JS__*/", () => js.trim());
await writeFile(join(DIST, "panel.html"), html);

// 2. server — SDK + zod bundled into one ESM file
const server = await esbuild.build({
  entryPoints: [join(ROOT, "server/maestro_server.mjs")],
  outfile: join(DIST, "server.mjs"),
  bundle: true, platform: "node", format: "esm", target: ["node24"],
  metafile: true, logLevel: "warning", write: false,
  banner: { js: 'import { createRequire as __createRequire } from "node:module"; const require=__createRequire(import.meta.url);' },
  define: { __PLUGIN_VERSION__: JSON.stringify(pkg.version) },
});
await writeFile(join(DIST, "server.mjs"), server.outputFiles[0].contents);

// 3. notices for everything bundled into panel.html and server.mjs
const packages = new Map();
for (const meta of [ui.metafile, server.metafile]) {
  for (const input of Object.keys(meta.inputs)) {
    if (!input.includes("node_modules/")) continue;
    let dir = dirname(resolve(ROOT, input));
    for (; dir !== dirname(dir); dir = dirname(dir)) {
      try {
        const meta2 = JSON.parse(await readFile(join(dir, "package.json"), "utf8"));
        if (meta2.name && meta2.version) { packages.set(dir, meta2); break; }
      } catch { /* keep walking up */ }
    }
  }
}
let notices = "ZCode maestro plugin — bundled dependency notices\n\n";
for (const [dir, meta2] of [...packages].sort((a, b) => a[1].name.localeCompare(b[1].name))) {
  let license = "";
  for (const name of ["LICENSE", "LICENSE.md", "LICENSE.txt", "LICENSE-MIT", "license", "license.md"]) {
    try { license = await readFile(join(dir, name), "utf8"); break; } catch { /* next */ }
  }
  if (!license) throw new Error(`Missing bundled dependency license: ${meta2.name}`);
  notices += `===== ${meta2.name} ${meta2.version} =====\n${license}\n\n`;
}
await writeFile(join(DIST, "THIRD_PARTY_NOTICES.txt"), notices);

// 4. every local manifest path must exist in the build
for (const serverDecl of Object.values(manifest.mcpServers || {})) {
  for (const arg of serverDecl.args || []) {
    if (!arg.includes("${ZCODE_PLUGIN_ROOT}/dist/")) continue;
    await stat(join(DIST, arg.split("${ZCODE_PLUGIN_ROOT}/dist/")[1]))
      .catch(() => { throw new Error(`manifest path missing from build: ${arg}`); });
  }
}
process.stdout.write(
  `maestro plugin ${manifest.version}: panel.html ${(Buffer.byteLength(html) / 1024).toFixed(0)} KiB, ` +
  `server.mjs ${(server.outputFiles[0].contents.length / 1024).toFixed(0)} KiB, ${packages.size} bundled packages noticed\n`,
);
