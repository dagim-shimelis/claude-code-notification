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

// ClaudeNotifier.app paths
const NOTIFIER_APP       = path.join(CLAUDE_DIR, "ClaudeNotifier.app");
const NOTIFIER_CONTENTS  = path.join(NOTIFIER_APP, "Contents");
const NOTIFIER_MACOS     = path.join(NOTIFIER_CONTENTS, "MacOS");
const NOTIFIER_RESOURCES = path.join(NOTIFIER_CONTENTS, "Resources");
const NOTIFIER_BINARY    = path.join(NOTIFIER_MACOS, "ClaudeNotifier");
const NOTIFIER_PLIST     = path.join(NOTIFIER_CONTENTS, "Info.plist");

const NOTIFIER_PLIST_CONTENT = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleExecutable</key>
    <string>ClaudeNotifier</string>
    <key>CFBundleIdentifier</key>
    <string>com.claude-code.notifier</string>
    <key>CFBundleName</key>
    <string>Claude Code</string>
    <key>CFBundleVersion</key>
    <string>1</string>
    <key>CFBundleShortVersionString</key>
    <string>1.0</string>
    <key>CFBundleIconFile</key>
    <string>claude</string>
    <key>LSUIElement</key>
    <true/>
    <key>NSPrincipalClass</key>
    <string>NSApplication</string>
    <key>NSUserNotificationAlertStyle</key>
    <string>alert</string>
    <key>NSUserNotificationsUsageDescription</key>
    <string>Claude Code notifications for task completion and permission requests.</string>
</dict>
</plist>
`;

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

function log(msg)  { process.stdout.write(msg + "\n"); }
function ok(msg)   { process.stdout.write(`\x1b[32m✔\x1b[0m  ${msg}\n`); }
function info(msg) { process.stdout.write(`\x1b[34mℹ\x1b[0m  ${msg}\n`); }
function warn(msg) { process.stdout.write(`\x1b[33m⚠\x1b[0m  ${msg}\n`); }
function err(msg)  { process.stdout.write(`\x1b[31m✖\x1b[0m  ${msg}\n`); }

function isCommandAvailable(cmd) {
  try {
    execSync(`which ${cmd}`, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

// ─── Settings merge ───────────────────────────────────────────────────────────

function normalizeCommand(cmd) {
  return cmd.replace(/"/g, "").replace(/\s+/g, " ").trim();
}

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
      if (commandAlreadyPresent(settings.hooks[event], command)) continue;
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
    warn("Notifications rely on ClaudeNotifier.app and the macOS notification center.");
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

  // 3. Check clang (needed to compile ClaudeNotifier)
  if (!isCommandAvailable("clang")) {
    err("clang not found. Install Xcode Command Line Tools:");
    err("  xcode-select --install");
    process.exit(1);
  }
  ok("clang found");

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
    warn("Icon asset not found — notifications will appear without the Claude logo");
  }

  // 7. Build ClaudeNotifier.app
  info("Building ClaudeNotifier.app...");

  fs.mkdirSync(NOTIFIER_MACOS,     { recursive: true });
  fs.mkdirSync(NOTIFIER_RESOURCES, { recursive: true });

  // Compile Objective-C source
  const sourcePath = path.join(PKG_ROOT, "assets", "ClaudeNotifier.m");
  try {
    execSync(
      `clang -fobjc-arc -framework Foundation -framework AppKit -framework UserNotifications "${sourcePath}" -o "${NOTIFIER_BINARY}"`,
      { stdio: "pipe" }
    );
  } catch (e) {
    err("Failed to compile ClaudeNotifier:");
    err(e.stderr ? e.stderr.toString() : String(e));
    process.exit(1);
  }
  fs.chmodSync(NOTIFIER_BINARY, 0o755);

  // Write Info.plist
  fs.writeFileSync(NOTIFIER_PLIST, NOTIFIER_PLIST_CONTENT, "utf8");

  // Copy icon into bundle
  if (fs.existsSync(iconDest)) {
    fs.copyFileSync(iconDest, path.join(NOTIFIER_RESOURCES, "claude.png"));
  }

  // Copy notification sounds from system
  const SYSTEM_SOUNDS = "/System/Library/Sounds";
  for (const name of ["Funk", "Glass"]) {
    const src = path.join(SYSTEM_SOUNDS, `${name}.aiff`);
    const dest = path.join(NOTIFIER_RESOURCES, `${name}.aiff`);
    if (fs.existsSync(src)) {
      fs.copyFileSync(src, dest);
    }
  }

  // Ad-hoc code sign
  try {
    execSync(`codesign --sign - --force --deep "${NOTIFIER_APP}"`, { stdio: "ignore" });
  } catch {
    warn("codesign failed — notifications may not appear on newer macOS versions");
  }

  ok("ClaudeNotifier.app built and signed");

  // 8. Read / create settings.json
  let settings = {};
  if (fs.existsSync(SETTINGS_PATH)) {
    try {
      settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
    } catch {
      warn(`Could not parse ${SETTINGS_PATH} — will create a fresh hooks section`);
      settings = {};
    }
  } else {
    info(`${SETTINGS_PATH} not found — creating it`);
  }

  // 9. Merge hook entries
  const newEntries = buildHookEntries(HOOKS_DIR);
  const added = mergeHooks(settings, newEntries);

  // 10. Write settings back
  fs.mkdirSync(CLAUDE_DIR, { recursive: true });
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");

  if (added > 0) {
    ok(`Added ${added} hook entr${added === 1 ? "y" : "ies"} to ${SETTINGS_PATH}`);
  } else {
    ok("Hooks already present in settings.json — nothing to change");
  }

  // 11. Done
  log("");
  log("\x1b[1m\x1b[32mAll set!\x1b[0m You will now receive macOS notifications when:");
  log("  • Claude finishes a task (Stop)");
  log("  • Claude is waiting for your input (Notification)");
  log("  • Claude needs permission to run a command (PermissionRequest)");
  log("");
  log("The first notification will prompt macOS for permission — click Allow.");
  log("Restart Claude Code for the hooks to take effect.");
  log("");
}

main();
