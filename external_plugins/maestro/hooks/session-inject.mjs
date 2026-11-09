#!/usr/bin/env node
/**
 * Maestro SessionStart + UserPromptSubmit injection.
 *
 * Two events, one purpose: make the main session behave as the maestro
 * orchestrator by default (OMOS-style always-on), without the user having
 * to invoke /maestro or $maestro first.
 *
 *  - SessionStart (startup|clear|compact): injects the core orchestration
 *    contract once per session — the main session IS the dispatcher, the
 *    specialist roster, the direct-work boundary, and the opt-out switch.
 *  - UserPromptSubmit: injects a compact routing hint per prompt ONLY when
 *    the prompt looks substantial (multi-file, multi-step, research,
 *    design, or review shaped). Short or trivial prompts get no hint, so
 *    delegation never shadows a quick direct answer.
 *
 * Exit code 0 with a single JSON object on stdout, per the hook protocol.
 * Fails open (exit 0, empty) on malformed input so a broken hook can never
 * block a session.
 */

const MAX_PROMPT_CHARS = 4000;

const SESSION_CONTEXT = [
  "[Maestro active] You are the maestro orchestrator for this session.",
  "You do not do substantive engineering work yourself: you plan, dispatch, reconcile, verify, and report.",
  "Dispatch specialist sub-agents (subagent_type: maestro:scout, maestro:elder, maestro:atelier, maestro:wright, maestro:lens, maestro:tribunal) automatically, without waiting to be asked.",
  "Routing: scout = discovery / multi-file search / tracing / external docs; elder = architecture decisions, trade-offs, debugging strategy; atelier = any UI/UX decision; wright = bounded, well-specified implementation (the only lane that writes files); lens = visual evidence (screenshots, PDFs, diagrams); tribunal = high-stakes or hard-to-reverse decisions.",
  "Direct-work boundary: act directly only when the change is small and clear and you already hold the needed context, or when the work itself is context you already have (docs, changelogs, summaries). Never delegate clarifying questions — ask the user yourself.",
  "Every dispatch is self-contained (Objective + Context + Scope + Output format + Validation), because the specialist sees nothing but its prompt. Split independent work into parallel lanes in one message; parallel writers never share write scopes.",
  "Specialists never dispatch other agents. If a specialist names another lane, you make that dispatch. Read produced artifacts before relying on them; verify proportionately at the end.",
  "Opt-out: if the user writes /maestro off, \"no subagents\", \"direct mode\", or similar, disable orchestration for the rest of the session and act directly — do not re-enable it.",
].join(" ");

const SUBSTANTIAL_PATTERNS = [
  /\brefactor/i,
  /\bimplement\b|\bbuild\b|\bcreate\b|\badd\b|\bfix\b.*\bfile/i,
  /\bdesign\b|\barchitect/i,
  /\breview\b|\baudit\b|\bcheck\b.*\bcode/i,
  /\bresearch\b|\binvestigate\b|\bexplore\b|\bmap\b|\bunderstand\b.*\bcode/i,
  /\bmulti[- ]?file\b|\bacross\b.*\bmodule/i,
  /\btest\b.*\bcover/i,
  /\bscreenshot\b|\bmockup\b|\bui\b|\bdesign\b.*\blayout/i,
  /\bremove\b|\bmigrat|\bupgrade\b.*\bcode/i,
  /\bwhy\b.*\bdoes\b|\bhow\b.*\bdoes\b.*\bwork/i,
  /\bplan\b|\bstrategy\b|\bdecision\b.*\btrade/i,
];

const SKIP_PATTERNS = [
  /^\s*\/[a-z]/i, // slash commands already name their workflow
  /^\s*\$[a-z]/i, // explicit skill invocations
  /^\s*(hi|hello|thanks?|thank you|ok|okay|yes|no|help)\b/i,
  /^\s*(what is|define|explain|meaning of)/i,
];

function readStdin() {
  return new Promise((resolve) => {
    let raw = "";
    process.stdin.setEncoding("utf8");
    process.stdin.on("data", (c) => (raw += c));
    process.stdin.on("end", () => resolve(raw));
    process.stdin.on("error", () => resolve(raw));
  });
}

function emit(eventName, additionalContext) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: { hookEventName: eventName, additionalContext },
    })
  );
  process.exit(0);
}

const raw = await readStdin();
let input;
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.exit(0); // fail open on malformed hook input
}

const eventName = input.hook_event_name || input.hookEventName || "";

if (eventName === "SessionStart") {
  // Specialist sub-agent sessions (agent_type set) must NOT become orchestrators.
  if (input.agent_type || input.agentType) process.exit(0);
  emit("SessionStart", SESSION_CONTEXT);
}

if (eventName === "UserPromptSubmit") {
  const prompt =
    typeof input.prompt === "string" ? input.prompt.trim() : "";
  if (!prompt || prompt.length < 20 || prompt.length > MAX_PROMPT_CHARS) {
    process.exit(0);
  }
  if (SKIP_PATTERNS.some((re) => re.test(prompt))) process.exit(0);
  if (SUBSTANTIAL_PATTERNS.some((re) => re.test(prompt))) {
    emit(
      "UserPromptSubmit",
      "[Maestro routing hint] This prompt looks substantial. Default to drafting lanes and dispatching the matching specialist(s) (maestro:scout / elder / atelier / wright / lens / tribunal) via the Agent tool (subagent_type) instead of doing the work inline. Act directly only if the change is small, clear, and already fully in context. Ask clarifying questions yourself, never via a specialist."
    );
  }
  process.exit(0);
}

// Any other event: no-op.
process.exit(0);
