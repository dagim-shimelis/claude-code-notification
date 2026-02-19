# claude-code-notification

**Native macOS notifications for [Claude Code](https://claude.ai/code)** — know the moment Claude finishes a task, goes idle, or needs your permission, even when you've switched to another app.

[![npm version](https://img.shields.io/npm/v/@dagim_s/claude-code-notification?style=flat-square&color=black)](https://www.npmjs.com/package/@dagim_s/claude-code-notification)
[![platform](https://img.shields.io/badge/platform-macOS-black?style=flat-square)](https://www.npmjs.com/package/@dagim_s/claude-code-notification)
[![license](https://img.shields.io/npm/l/@dagim_s/claude-code-notification?style=flat-square&color=black)](LICENSE)

---

## What it looks like

```
┌─────────────────────────────────────────────────────┐
│  [●] Claude Code                             now    │
│      All changes applied. AuthModal now             │
│      validates tokens on mount and redirects…       │
│                                          [claude]   │
└─────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────┐
│  [●] Permission Required                     now    │
│      Bash: npm run build                            │
│                                          [claude]   │
└─────────────────────────────────────────────────────┘
```

Notifications appear in the macOS notification center with the **Claude logo**, a **preview of Claude's last message** or the action requested, and a distinct sound — so you always know what's happening without looking at the terminal.

---

## Install

```bash
npx @dagim_s/claude-code-notification
```

That's it. The setup script handles everything automatically:

1. Verifies `python3` and `clang` are available
2. Compiles a tiny native notification helper (`ClaudeNotifier.app`)
3. Copies the three hook scripts to `~/.claude/hooks/`
4. Copies the Claude icon to `~/.claude/icons/`
5. Patches `~/.claude/settings.json` to wire up the hooks
6. Ad-hoc signs the app so macOS Notification Center accepts it
7. Launches `ClaudeNotifier.app` once to trigger the macOS permission prompt

During setup, `ClaudeNotifier.app` is launched once so macOS can show the **"Allow Notifications?"** prompt immediately — click **Allow**. Then **restart Claude Code**.

> Re-running `npx @dagim_s/claude-code-notification` is always safe. It skips anything already in place and never creates duplicate hook entries.

---

## Notifications at a glance

| Trigger | Title | Message | Sound |
|---|---|---|---|
| Claude finishes a response | `Claude Code` | First 120 chars of the last reply | Funk |
| Claude is idle / waiting | `Claude Code` | Claude's own idle message | Glass |
| Claude needs permission | `Permission Required` | Tool + what it wants to do | Glass |

### Permission notification examples

```
Bash: npm run dev
Bash: git push origin main
Write: Button.tsx
WebFetch: https://api.example.com/data
```

---

## How it works

The package registers three [Claude Code hooks](https://docs.anthropic.com/en/docs/claude-code/hooks) in `~/.claude/settings.json`:

```
Claude Code event
      │
      ├── Stop ──────────────────► stop-notification.py
      │                            Reads transcript → extracts last reply
      │
      ├── Notification ──────────► notification-with-icon.py
      │   (idle_prompt |           Forwards the notification message
      │    permission_prompt)
      │
      └── PermissionRequest ─────► permission-request-notification.py
                                   Shows tool name + command / file / URL
```

Each hook script fires `ClaudeNotifier.app` — a minimal Objective-C app compiled locally during setup. It uses macOS's native `UNUserNotificationCenter` API, which is why the Claude icon and sounds work properly without any third-party dependencies.

---

## Requirements

| Requirement | Notes |
|---|---|
| **macOS** | Notification Center API is macOS-only |
| **Claude Code** | CLI or IDE extension |
| **Python 3** | Runs the hook scripts |
| **Xcode Command Line Tools** | Provides `clang` to compile the notifier |

To install Xcode Command Line Tools if you don't have them:

```bash
xcode-select --install
```

---

## Uninstall

```bash
npx @dagim_s/claude-code-notification --uninstall
```

This removes `ClaudeNotifier.app`, the hook scripts, the icon, the hook entries from `~/.claude/settings.json`, and resets the macOS notification permission — leaving your system in a clean state for reinstallation.

---

## License

MIT © [dagim-shimelis](https://github.com/dagim-shimelis)
