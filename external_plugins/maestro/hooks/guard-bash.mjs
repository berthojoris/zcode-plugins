#!/usr/bin/env node
/**
 * Maestro PreToolUse Bash Guard
 *
 * Enforces two layers of protection on Bash tool calls:
 * 1. Read-only lane enforcement: when the active agent is one of maestro's
 *    read-only specialists (scout, elder, atelier, tribunal, lens), any
 *    mutating shell command (file writes/deletes, output redirection to files,
 *    mutating git subcommands, package installs/builds, or in-place edits) is
 *    denied so only maestro:wright can modify workspace state.
 * 2. Universal destructive-command guard: blocks catastrophic unrecoverable
 *    commands (git reset --hard, git clean -f, unguarded git push --force
 *    without --force-with-lease, recursive .git/root/parent deletions) across
 *    every session and specialist.
 */

import { readFileSync } from "node:fs";

const READONLY_LANES = new Set([
  "scout",
  "elder",
  "atelier",
  "tribunal",
  "lens",
  "maestro:scout",
  "maestro:elder",
  "maestro:atelier",
  "maestro:tribunal",
  "maestro:lens",
]);

const DESTRUCTIVE_PATTERNS = [
  {
    re: /\bgit\s+reset\s+--hard\b/i,
    reason: "git reset --hard discards uncommitted work irreversibly",
  },
  {
    re: /\bgit\s+(?:checkout|restore)\s+(?:--\s+)?\.(?:\s|$|[;&|])/i,
    reason: "discarding all working-tree changes across '.' is blocked",
  },
  {
    re: /\bgit\s+clean\s+-[a-zA-Z]*f/i,
    reason: "git clean -f permanently deletes untracked files",
  },
  {
    re: /\bgit\s+push\b(?=[^;&|]*(?:\s--force\b|\s-[a-zA-Z]*f\b))(?![^;&|]*--force-with-lease\b)/i,
    reason: "unguarded git push --force is blocked; use --force-with-lease if a rebase push is authorized",
  },
  {
    re: /\b(?:rm|del|rmdir|Remove-Item)\b[^;&|]*\s(?:-[a-zA-Z]*r[a-zA-Z]*f|-[a-zA-Z]*f[a-zA-Z]*r|--recursive)\b[^;&|]*\s(?:\.git|\/|~|\.\.)(?:\s|$|\/|[;&|])/i,
    reason: "recursive deletion targeting '/', '~', '..', or '.git' is blocked",
  },
];

const READONLY_MUTATION_PATTERNS = [
  {
    re: /(?:^|[;&|]\s*|\$\(\s*|`\s*)(?:sudo\s+)?(?:rm|mv|cp|mkdir|rmdir|touch|chmod|chown|chgrp|truncate|dd|install|patch|unlink|shred|mktemp|Remove-Item|Move-Item|Copy-Item|New-Item|Rename-Item|Set-Content|Add-Content|Clear-Content|Out-File)\b/,
    reason: "filesystem modification commands are forbidden in read-only specialist lanes",
  },
  {
    re: /\b(?:sed|perl|ruby)\s+[^;&|]*\s-[a-zA-Z]*i\b/,
    reason: "in-place file editing (-i) is forbidden in read-only specialist lanes",
  },
  {
    re: /\btee\b(?!\s+(?:\/dev\/null|\/dev\/stderr|\/dev\/stdout)\b)/,
    reason: "writing files via tee is forbidden in read-only specialist lanes",
  },
  {
    re: /\bgit\s+(?:add|commit|push|pull|fetch|merge|rebase|cherry-pick|revert|checkout|switch|reset|restore|stash|tag|clean|am|apply|init|clone|mv|rm|worktree|submodule\s+update)\b/,
    reason: "mutating git subcommands are forbidden in read-only specialist lanes (allowed: status, log, show, diff, blame, rev-parse, ls-files, grep)",
  },
  {
    re: /\bgit\s+branch\s+[^;&|]*-(?:d|D|m|M|c|C)\b/,
    reason: "creating, renaming, or deleting git branches is forbidden in read-only specialist lanes",
  },
  {
    re: /\b(?:npm|pnpm|yarn|bun)\s+(?:install|i|add|remove|uninstall|update|up|upgrade|link|unlink|publish|pack|init|create|dedupe|prune|rebuild|patch|build| format|lint\s+--fix)\b/,
    reason: "package installation, mutation, or build scripts are forbidden in read-only specialist lanes",
  },
  {
    re: /\b(?:pip|pip3|pipx|uv|poetry|pdm|conda|cargo|go|gem|composer|mvn|gradle|dotnet)\s+(?:install|uninstall|add|remove|update|build|publish|init|new|clean| tidy|fix)\b/,
    reason: "toolchain install/build/mutation subcommands are forbidden in read-only specialist lanes",
  },
  {
    re: /\b(?:writeFileSync|writeFile|appendFileSync|appendFile|unlinkSync|rmSync|mkdirSync|write_text|write_bytes)\b/,
    reason: "inline script file writes are forbidden in read-only specialist lanes",
  },
];

/**
 * Strip quoted string literals so redirection operators inside grep patterns
 * (e.g. `rg "foo > bar"`) do not trigger false positives.
 */
function stripQuotedStrings(command) {
  return command
    .replace(/'[^']*'/g, "''")
    .replace(/"(?:\\.|[^"\\])*"/g, '""');
}

/**
 * Detect shell file-output redirection (`>`, `>>`, `&>`, `1>`, `2>`) that does
 * not target `/dev/null`, `NUL`, or a file descriptor (`>&1`, `>&2`).
 */
function hasFileOutputRedirection(command) {
  const unquoted = stripQuotedStrings(command);
  const redirRegex = /(?:^|[^<>0-9])(?:[12&])?>>?\s*([^\s;&|()]+)/g;
  let match;
  while ((match = redirRegex.exec(unquoted)) !== null) {
    const target = match[1];
    if (!target) continue;
    if (target.startsWith("&")) continue; // e.g. 2>&1
    if (
      target === "/dev/null" ||
      target === "/dev/stdout" ||
      target === "/dev/stderr" ||
      target.toUpperCase() === "NUL"
    ) {
      continue;
    }
    return true;
  }
  return false;
}

/**
 * Identify whether the current hook invocation belongs to a read-only maestro
 * specialist agent via payload fields, environment variables, or transcript.
 */
function detectReadonlyLane(input) {
  const candidates = [
    input.agent_type,
    input.agentType,
    input.subagent_type,
    input.subagentType,
    input.agent_name,
    input.agentName,
    process.env.ZCODE_AGENT_TYPE,
    process.env.ZCODE_SUBAGENT_TYPE,
  ];
  for (const raw of candidates) {
    if (typeof raw === "string" && raw.trim()) {
      const normalized = raw.trim().toLowerCase();
      if (READONLY_LANES.has(normalized)) {
        return normalized.replace(/^maestro:/, "");
      }
    }
  }

  const transcriptPath = input.transcript_path || input.transcriptPath;
  if (typeof transcriptPath === "string" && transcriptPath.trim()) {
    try {
      const head = readFileSync(transcriptPath, "utf8").slice(0, 16384);
      const m = head.match(
        /You are \*\*(scout|elder|atelier|tribunal|lens)\*\*/,
      );
      if (m) return m[1];
    } catch {
      // Ignore unreadable transcript and fall through
    }
  }
  return null;
}

function deny(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
        permissionDecisionReason: reason,
      },
    }),
  );
  process.exit(0);
}

let raw = "";
process.stdin.setEncoding("utf8");
for await (const chunk of process.stdin) raw += chunk;

let input = {};
try {
  input = raw.trim() ? JSON.parse(raw) : {};
} catch {
  process.exit(0); // fail open on malformed hook input
}

const toolName = input.tool_name || input.toolName || "";
if (toolName && toolName !== "Bash") {
  process.exit(0);
}

const toolInput = input.tool_input || input.toolInput || {};
const command =
  typeof toolInput.command === "string"
    ? toolInput.command.trim()
    : typeof toolInput.cmd === "string"
      ? toolInput.cmd.trim()
      : "";

if (!command) {
  process.exit(0);
}

// 1. Universal destructive-command check across all lanes and sessions
for (const rule of DESTRUCTIVE_PATTERNS) {
  if (rule.re.test(command)) {
    deny(
      `[maestro] Blocked destructive Bash command: ${rule.reason}. Ask the user for explicit confirmation or use a safe alternative.`,
    );
  }
}

// 2. Read-only specialist lane check (scout, elder, atelier, tribunal, lens)
const readonlyLane = detectReadonlyLane(input);
if (readonlyLane) {
  const unquoted = stripQuotedStrings(command);
  for (const rule of READONLY_MUTATION_PATTERNS) {
    if (rule.re.test(unquoted)) {
      deny(
        `[maestro:${readonlyLane}] Read-only boundary violation: ${rule.reason}. Return your findings/spec to the orchestrator so maestro:wright can apply the change.`,
      );
    }
  }
  if (hasFileOutputRedirection(command)) {
    deny(
      `[maestro:${readonlyLane}] Read-only boundary violation: shell output redirection to a file is forbidden in read-only specialist lanes. Delegate file writes to maestro:wright.`,
    );
  }
}

process.exit(0);
