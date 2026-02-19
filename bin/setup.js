#!/usr/bin/env node
"use strict";

const os = require("os");
const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");

// ─── Paths ────────────────────────────────────────────────────────────────────

const HOME = os.homedir();
const CLAUDE_DIR = path.join(HOME, ".claude");
const HOOKS_DIR = path.join(CLAUDE_DIR, "hooks");
const ICONS_DIR = path.join(CLAUDE_DIR, "icons");
const SETTINGS_PATH = path.join(CLAUDE_DIR, "settings.json");
const PKG_ROOT = path.join(__dirname, "..");

// Hook script filenames
const HOOK_FILES = [
  "stop-notification.py",
  "notification-with-icon.py",
  "permission-request-notification.py",
];

// ─── Hooks to inject into settings.json ───────────────────────────────────────

function buildHookEntries(hooksDir) {
  return {
    Stop: [
      {
        hooks: [
          {
            type: "command",
            command: `python3 "${path.join(hooksDir, "stop-notification.py")}"`,
          },
        ],
      },
    ],
    Notification: [
      {
        matcher: "idle_prompt|permission_prompt",
        hooks: [
          {
            type: "command",
            command: `python3 "${path.join(hooksDir, "notification-with-icon.py")}"`,
          },
        ],
      },
    ],
    PermissionRequest: [
      {
        hooks: [
          {
            type: "command",
            command: `python3 "${path.join(hooksDir, "permission-request-notification.py")}"`,
          },
        ],
      },
    ],
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg) {
  process.stdout.write(msg + "\n");
}

function ok(msg) {
  process.stdout.write(`\x1b[32m✔\x1b[0m  ${msg}\n`);
}

function info(msg) {
  process.stdout.write(`\x1b[34mℹ\x1b[0m  ${msg}\n`);
}

function warn(msg) {
  process.stdout.write(`\x1b[33m⚠\x1b[0m  ${msg}\n`);
}

function err(msg) {
  process.stdout.write(`\x1b[31m✖\x1b[0m  ${msg}\n`);
}

function isCommandAvailable(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── Settings merge ───────────────────────────────────────────────────────────

/**
 * Normalize a command string for comparison by stripping quotes around paths.
 * Prevents duplicates when existing entries use unquoted paths and new ones use quoted.
 */
function normalizeCommand(cmd) {
  return cmd.replace(/"/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Returns true if an equivalent command already exists in the hook list for
 * a given event key. Avoids duplicate entries on re-runs.
 */
function commandAlreadyPresent(existingList, command) {
  if (!Array.isArray(existingList)) return false;
  const normalized = normalizeCommand(command);
  for (const group of existingList) {
    for (const hook of group.hooks || []) {
      if (normalizeCommand(hook.command) === normalized) return true;
    }
  }
  return false;
}

function mergeHooks(settings, newEntries) {
  if (!settings.hooks) settings.hooks = {};

  let added = 0;

  for (const [event, groups] of Object.entries(newEntries)) {
    for (const group of groups) {
      const command = group.hooks[0].command;
      if (commandAlreadyPresent(settings.hooks[event], command)) {
        continue;
      }
      if (!settings.hooks[event]) settings.hooks[event] = [];
      settings.hooks[event].push(group);
      added++;
    }
  }

  return added;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function main() {
  log("");
  log("\x1b[1mClaude Code Notify — Setup\x1b[0m");
  log("─".repeat(40));
  log("");

  // 1. Platform check
  if (process.platform !== "darwin") {
    warn("This package currently supports macOS only.");
    warn(
      "Notifications rely on terminal-notifier and macOS notification center."
    );
    warn("Linux/Windows support may be added in a future release.");
    log("");
  }

  // 2. Check Python 3
  if (!isCommandAvailable("python3")) {
    err("python3 not found in PATH.");
    err("Install Python 3 and try again: https://www.python.org/downloads/");
    process.exit(1);
  }
  ok("python3 found");

  // 3. Check terminal-notifier
  if (!isCommandAvailable("terminal-notifier")) {
    warn("terminal-notifier is not installed.");
    if (isCommandAvailable("brew")) {
      info("Installing terminal-notifier via Homebrew...");
      try {
        execSync("brew install terminal-notifier", { stdio: "inherit" });
        ok("terminal-notifier installed");
      } catch {
        err("Homebrew install failed. Run manually: brew install terminal-notifier");
        process.exit(1);
      }
    } else {
      err(
        "Please install Homebrew (https://brew.sh) then run: brew install terminal-notifier"
      );
      process.exit(1);
    }
  } else {
    ok("terminal-notifier found");
  }

  // 4. Create ~/.claude/hooks/
  fs.mkdirSync(HOOKS_DIR, { recursive: true });
  ok(`Hooks directory ready: ${HOOKS_DIR}`);

  // 5. Copy Python hook scripts
  for (const file of HOOK_FILES) {
    const src = path.join(PKG_ROOT, "hooks", file);
    const dest = path.join(HOOKS_DIR, file);
    fs.copyFileSync(src, dest);
    fs.chmodSync(dest, 0o755);
  }
  ok(`Copied ${HOOK_FILES.length} hook scripts`);

  // 6. Copy Claude icon
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  const iconSrc = path.join(PKG_ROOT, "assets", "claude.png");
  const iconDest = path.join(ICONS_DIR, "claude.png");
  if (fs.existsSync(iconSrc)) {
    fs.copyFileSync(iconSrc, iconDest);
    ok("Claude icon installed");
  } else {
    warn("Icon asset not found in package — notifications will appear without the Claude logo");
  }

  // 7. Read / create settings.json
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    } catch {
      warn(
        `Could not parse ${SETTINGS_PATH} — will create a fresh hooks section`
      );
      settings = {};
    }
  } else {
    info(`${SETTINGS_PATH} not found — creating it`);
  }

  // 8. Merge hook entries
  const newEntries = buildHookEntries(HOOKS_DIR);
  const added = mergeHooks(settings, newEntries);

  // 9. Write settings back
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");

  if (added > 0) {
    ok(`Added ${added} hook entr${added === 1 ? "y" : "ies"} to ${SETTINGS_PATH}`);
  } else {
    ok("Hooks already present in settings.json — nothing to change");
  }

  // 10. Done
  log("");
  log("\x1b[1m\x1b[32mAll set!\x1b[0m You will now receive macOS notifications when:");
  log("  • Claude finishes a task (Stop)");
  log("  • Claude is waiting for your input (Notification)");
  log("  • Claude needs permission to run a command (PermissionRequest)");
  log("");
  log("Restart Claude Code for the hooks to take effect.");
  log("");
}

main();
