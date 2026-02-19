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

  // 8. Trigger notification permission dialog now, during setup.
  //    Launching via `open` gives the app a proper user-session context so
  //    macOS shows the "Allow Notifications?" dialog immediately and registers
  //    the app in System Settings → Notifications.  If we skip this, the first
  //    launch happens inside a detached subprocess from a Claude hook — macOS
  //    suppresses the dialog there and the app never appears in Notifications.
  info("Requesting notification permission (watch for the system dialog)...");
  try {
    execSync(
      `open -a "${NOTIFIER_APP}" --args "Claude Code" "Notifications are ready!" "Glass" ""`,
      { stdio: "ignore" }
    );
    // Give the app a moment to show the dialog before we continue printing.
    execSync("sleep 2", { stdio: "ignore" });
    ok("Notification permission requested — click Allow in the system dialog if prompted");
  } catch {
    warn("Could not launch ClaudeNotifier for permission setup.");
    warn("Run this manually to trigger the permission dialog:");
    warn(`  open -a "${NOTIFIER_APP}"`);
  }

  // 9. Read / create settings.json
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
  log("Restart Claude Code for the hooks to take effect.");
  log("");
}

// ─── Uninstall ────────────────────────────────────────────────────────────────

const BUNDLE_ID = "com.claude-code.notifier";

function removeIfExists(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
    return true;
  }
  return false;
}

function cleanHooksFromSettings() {
  if (!fs.existsSync(SETTINGS_PATH)) return false;
  let settings;
  try {
    settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, "utf8"));
  } catch {
    warn("Could not parse settings.json — skipping hook removal");
    return false;
  }
  if (!settings.hooks) return false;
  let removed = 0;
  for (const event of Object.keys(settings.hooks)) {
    const before = settings.hooks[event].length;
    settings.hooks[event] = settings.hooks[event].filter((group) => {
      const hooks = group.hooks || [];
      return !hooks.some((h) =>
        typeof h.command === "string" &&
        HOOK_FILES.some((name) => h.command.includes(name))
      );
    });
    removed += before - settings.hooks[event].length;
    if (settings.hooks[event].length === 0) delete settings.hooks[event];
  }
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;
  fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2) + "\n", "utf8");
  return removed > 0;
}

function uninstall() {
  log("");
  log("\x1b[1mClaude Code Notify — Uninstall\x1b[0m");
  log("─".repeat(40));
  log("");

  if (removeIfExists(NOTIFIER_APP)) {
    ok("Removed ClaudeNotifier.app");
  } else {
    info("ClaudeNotifier.app not found — skipping");
  }

  let hooksRemoved = 0;
  for (const file of HOOK_FILES) {
    if (removeIfExists(path.join(HOOKS_DIR, file))) hooksRemoved++;
  }
  if (hooksRemoved > 0) {
    ok(`Removed ${hooksRemoved} hook script(s) from ${HOOKS_DIR}`);
  } else {
    info("No hook scripts found — skipping");
  }

  const iconPath = path.join(ICONS_DIR, "claude.png");
  if (removeIfExists(iconPath)) {
    ok(`Removed icon: ${iconPath}`);
  } else {
    info("Icon not found — skipping");
  }

  if (cleanHooksFromSettings()) {
    ok(`Removed hook entries from ${SETTINGS_PATH}`);
  } else {
    info("No hook entries found in settings.json — skipping");
  }

  try {
    execSync(`tccutil reset Notifications ${BUNDLE_ID}`, { stdio: "ignore" });
    ok(`Reset macOS notification permission for ${BUNDLE_ID}`);
  } catch {
    warn("Could not reset notification permission — remove it manually if needed:");
    warn("  System Settings → Notifications → find \"Claude Code\" → remove");
  }

  log("");
  log("\x1b[1m\x1b[32mUninstall complete.\x1b[0m");
  log("Re-run setup to reinstall:");
  log("  npx @dagim_s/claude-code-notification");
  log("");
}

// ─── Entry point ──────────────────────────────────────────────────────────────

if (process.argv.includes("--uninstall")) {
  uninstall();
} else {
  main();
}
