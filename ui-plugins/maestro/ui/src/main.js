// Maestro agents panel (MCP App). Shows the orchestrator and all specialist
// lanes with live activity: a green spinner while a lane is dispatched, and a
// recent-activity feed afterwards. State comes from the maestro_status server
// tool (poll) fed by the plugin's agent-status hooks.
import { App } from "@modelcontextprotocol/ext-apps";
import { h, applyTheme, json } from "./dom.js";

const app = new App(
  { name: "maestro-panel", version: __PLUGIN_VERSION__ },
  { availableDisplayModes: ["inline", "fullscreen"] },
);
const root = document.getElementById("root");
const show = (...kids) => root.replaceChildren(...kids.flat().filter((k) => k != null && k !== false));

const ORDER = ["scout", "elder", "atelier", "wright", "lens", "tribunal"];
const COLOR = {
  scout: "#2563eb",
  elder: "#6d28d9",
  atelier: "#db2777",
  wright: "#0f766e",
  lens: "#b45309",
  tribunal: "#c2410c",
};

const T = {
  en: {
    sub: "Orchestrator panel",
    live: "live",
    waiting: "waiting",
    orch: "Orchestrator",
    lanes: "Specialist lanes",
    activeN: (n) => `${n} active`,
    none: "no lanes dispatched yet",
    idle: "idle",
    dispatching: "Dispatching",
    idleOrch: "Idle — send a prompt",
    last: (ago, dur) => `last ${ago} · ${dur}`,
    failed: "failed",
    feed: "Recent activity",
    noFeed: "nothing yet — dispatches appear here",
    hint: "Substantial prompts are routed to specialists automatically. Opt out: “/maestro off”.",
    err: (e) => `status unavailable: ${e}`,
  },
  zh: {
    sub: "编排者面板",
    live: "运行中",
    waiting: "等待",
    orch: "编排者",
    lanes: "专家路线",
    activeN: (n) => `${n} 条进行中`,
    none: "尚未派发任何路线",
    idle: "空闲",
    dispatching: "调度中",
    idleOrch: "空闲 — 发送提示即可开始",
    last: (ago, dur) => `上次 ${ago} · ${dur}`,
    failed: "失败",
    feed: "近期动态",
    noFeed: "暂无记录 — 派发后在此显示",
    hint: "实质性提示会自动路由给专家。退出：“/maestro off”。",
    err: (e) => `状态不可用：${e}`,
  },
};
const isZh = () => (app.getHostContext?.()?.locale || "en").toLowerCase().startsWith("zh");

const state = { status: null, err: null, now: Date.now() };

const fmtDur = (ms) => {
  const s = Math.max(0, Math.round(ms / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  return m < 60 ? `${m}m${String(s % 60).padStart(2, "0")}s` : `${Math.floor(m / 60)}h${m % 60}m`;
};
const fmtAgo = (ms) => {
  const s = Math.max(0, Math.round((state.now - ms) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
};

const spinner = () => h("span", { class: "spin", "aria-label": "active" });
const avatar = (name, color, big) =>
  h("span", {
    class: big ? "avatar" : "avatar",
    style: { width: big ? "40px" : "30px", height: big ? "40px" : "30px", background: color },
  }, name[0].toUpperCase());

function render() {
  const t = isZh() ? T.zh : T.en;
  const s = state.status;

  if (state.err) return show(h("div", { class: "err" }, t.err(state.err)));
  if (!s) return show(h("div", { class: "empty" }, "…"));

  const orchBusy = !!s.orchestrator || s.activeCount > 0;
  const orchEl = h("div", { class: "orch" + (orchBusy ? " busy" : "") },
    avatar("m", "linear-gradient(135deg,#312e81,#6d28d9)", true),
    h("div", { class: "body" },
      h("div", { class: "row1" },
        h("span", { class: "mono", style: { fontWeight: 650 } }, "maestro"),
        h("span", { class: "tag" }, t.orch),
      ),
      s.orchestrator?.prompt
        ? h("div", { class: "prompt" }, `“${s.orchestrator.prompt}”`)
        : null,
      orchBusy
        ? h("div", { class: "stat" }, spinner(),
            t.dispatching,
            s.activeCount > 0 ? `· ${t.activeN(s.activeCount)}` : null,
            s.orchestrator?.busySince ? fmtDur(state.now - s.orchestrator.busySince) : null)
        : h("div", { class: "stat idle" }, t.idleOrch),
    ),
  );

  const agents = [...(s.agents || [])].sort(
    (a, b) => ORDER.indexOf(a.name) - ORDER.indexOf(b.name),
  );
  const lanesEl = h("div", { class: "sec" },
    h("div", { class: "cap" }, t.lanes,
      s.activeCount > 0 ? h("span", { class: "pill" }, h("span", { class: "dot live" }), t.activeN(s.activeCount)) : null),
    agents.length === 0 ? h("div", { class: "empty" }, t.none) : agents.map((a) => {
      const active = a.state === "active";
      return h("div", { class: "lane" + (active ? " active" : "") },
        avatar(a.name, COLOR[a.name] || "#475569"),
        h("div", { class: "mid" },
          h("div", { class: "nm" },
            h("span", { class: "mono" }, `maestro:${a.name}`),
            h("span", { class: "role" }, a.role),
          ),
          active && a.task ? h("div", { class: "task" }, a.task) : null,
        ),
        active
          ? h("div", { class: "st active" }, spinner(), fmtDur(state.now - (a.startedAt || state.now)))
          : a.lastRun
            ? h("div", { class: "st" },
                a.lastRun.outcome === "failed" ? h("span", { class: "fail" }, t.failed) : null,
                h("span", { class: "ago" }, t.last(fmtAgo(a.lastRun.endedAt), fmtDur(a.lastRun.durationMs || 0))))
            : h("div", { class: "st mut" }, t.idle),
      );
    }),
  );

  const feedEl = h("div", { class: "sec" },
    h("div", { class: "cap" }, t.feed),
    (s.recent || []).length === 0
      ? h("div", { class: "empty" }, t.noFeed)
      : h("div", { class: "feed" }, s.recent.slice(0, 6).map((r) =>
          h("div", { class: "ev" },
            h("span", { class: "chip", style: { background: colorMix(r.agent), color: "#fff" } }, r.agent),
            h("span", { class: "what" }, r.task || "—"),
            h("span", { class: "dur" }, fmtDur(r.durationMs || 0)),
            h("span", { class: "out " + (r.outcome === "failed" ? "bad" : "ok") },
              r.outcome === "failed" ? "✕" : "✓"),
          )),
        ),
  );

  show(
    h("header", { class: "hdr" },
      h("span", { class: "mark" }, "M"),
      h("div", { class: "t" },
        h("div", { class: "name" }, "Maestro"),
        h("div", { class: "sub" }, t.sub),
      ),
      h("span", { class: "pill" },
        h("span", { class: "dot" + (s.hooksConnected ? " live" : "") }),
        s.hooksConnected ? t.live : t.waiting),
    ),
    orchEl,
    lanesEl,
    feedEl,
    h("footer", { class: "ft" }, t.hint, ` · v${s.version}`),
  );
}

function colorMix(agent) {
  return COLOR[agent] || "#475569";
}

async function poll() {
  try {
    const r = await app.callServerTool({ name: "maestro_status", arguments: {} });
    const d = json(r);
    if (!d || d.ok !== true) throw new Error("bad reply");
    state.status = d;
    state.err = null;
  } catch (e) {
    state.err = String(e?.message || e);
  }
  state.now = Date.now();
  render();
}

app.onhostcontextchanged = () => { applyTheme(app); render(); };
app.ontoolresult = (r) => { if (json(r)?.ok) poll(); };
app.onteardown = async () => ({});

async function boot() {
  await app.connect();
  applyTheme(app);
  render();
  await poll();
  setInterval(poll, 1500); // lane state
  setInterval(() => { state.now = Date.now(); render(); }, 1000); // elapsed clocks
}
boot().catch((e) => { state.err = String(e?.message || e); render(); });
