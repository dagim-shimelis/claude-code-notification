#!/usr/bin/env python3
"""
Notification hook: shows a rich macOS notification with the Claude logo
for permission_prompt and idle_prompt events.
Uses terminal-notifier for the visual and claude-code-notification for VSCode focus.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")

TITLES = {
    "permission_prompt": "Permission Required",
    "idle_prompt": "Claude Code",
    "auth_success": "Claude Code",
    "elicitation_dialog": "Claude Code",
}

SOUNDS = {
    "permission_prompt": "Glass",
    "idle_prompt": "Glass",
}


def main():
    raw = sys.stdin.read()
    try:
        hook_data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    notification_type = hook_data.get("notification_type", "")
    message = hook_data.get("message", "Claude is waiting")
    title = TITLES.get(notification_type, "Claude Code")
    sound = SOUNDS.get(notification_type, "Glass")

    # Show rich notification with Claude icon via terminal-notifier
    notifier_cmd = [
        "terminal-notifier",
        "-title", title,
        "-message", message,
        "-sound", sound,
        "-activate", "com.microsoft.VSCode",
    ]
    if os.path.exists(ICON_PATH):
        notifier_cmd += ["-contentImage", ICON_PATH]
    subprocess.Popen(notifier_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Also call claude-code-notification for VSCode chat tab integration
    subprocess.Popen(
        ["claude-code-notification", "--sound", sound],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).communicate(input=raw.encode())


if __name__ == "__main__":
    main()
