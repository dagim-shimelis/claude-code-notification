#!/usr/bin/env python3
"""
Notification hook: shows a macOS notification with the Claude logo
for permission_prompt and idle_prompt events.
Uses ClaudeNotifier.app (UNUserNotificationCenter) for icon + sound support.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")
NOTIFIER = os.path.expanduser("~/.claude/ClaudeNotifier.app/Contents/MacOS/ClaudeNotifier")

TITLES = {
    "permission_prompt": "Permission Required",
    "idle_prompt": "Claude Code",
    "auth_success": "Claude Code",
    "elicitation_dialog": "Claude Code",
}

SOUNDS = {
    "permission_prompt": "Glass.aiff",
    "idle_prompt": "Glass.aiff",
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
    sound = SOUNDS.get(notification_type, "Glass.aiff")

    subprocess.Popen(
        [NOTIFIER, title, message, sound, ICON_PATH],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    main()
