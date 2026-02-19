# claude-code-notification

macOS notifications for [Claude Code](https://claude.ai/code) — get alerted when Claude finishes a task, goes idle, or needs your permission to run something.

## Install

```bash
npx @dagim_s/claude-code-notification
```

That's it. The setup script will:

1. Check for `python3` (required)
2. Install `terminal-notifier` via Homebrew if it's missing
3. Copy the three hook scripts to `~/.claude/hooks/`
4. Copy the Claude icon to `~/.claude/icons/`
5. Patch `~/.claude/settings.json` to register the hooks
6. Print a success summary

Then **restart Claude Code** for the hooks to take effect.

## What you get

| Event | Notification | Sound |
|---|---|---|
| Claude finishes a task | Summary of last response | Funk |
| Claude is waiting for input | "Claude is waiting" | Glass |
| Claude needs a permission | Tool name + what it wants to do | Glass |

All notifications activate VS Code when clicked.

## Requirements

- macOS
- [Claude Code](https://claude.ai/code) (the VS Code extension or CLI)
- Python 3
- [Homebrew](https://brew.sh) (used to install `terminal-notifier` automatically)

## How it works

The package registers three Claude Code hooks via `~/.claude/settings.json`:

- **`Stop`** → `stop-notification.py` — reads the transcript to extract the last assistant message and shows it as a notification
- **`Notification`** (for `idle_prompt` and `permission_prompt` events) → `notification-with-icon.py` — forwards the notification with the Claude icon
- **`PermissionRequest`** → `permission-request-notification.py` — shows the tool name and the specific command/file/URL it wants to access

## Re-running

Running `npx @dagim_s/claude-code-notification` again is safe — it skips anything already installed and never duplicates hook entries.

## Uninstall

Remove the hook scripts:

```bash
rm ~/.claude/hooks/stop-notification.py \
   ~/.claude/hooks/notification-with-icon.py \
   ~/.claude/hooks/permission-request-notification.py \
   ~/.claude/icons/claude.png
```

Then remove the corresponding `Stop`, `Notification`, and `PermissionRequest` entries from `~/.claude/settings.json`.
