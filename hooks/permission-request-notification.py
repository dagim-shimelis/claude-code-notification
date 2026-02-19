#!/usr/bin/env python3
"""
PermissionRequest hook: shows a notification whenever Claude needs explicit
permission for a tool, regardless of the permission mode.
Uses ClaudeNotifier.app (UNUserNotificationCenter) for icon + sound support.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")
NOTIFIER = os.path.expanduser("~/.claude/ClaudeNotifier.app/Contents/MacOS/ClaudeNotifier")


def build_message(hook_data: dict) -> str:
    tool = hook_data.get("tool_name", "unknown tool")
    tool_input = hook_data.get("tool_input", {})

    if tool == "Bash":
        detail = tool_input.get("command", "")
        if detail:
            return f"Bash: {detail[:100]}"
    elif tool in ("Write", "Edit"):
        path = tool_input.get("file_path", "")
        if path:
            return f"{tool}: {os.path.basename(path)}"
    elif tool == "WebFetch":
        url = tool_input.get("url", "")
        if url:
            return f"WebFetch: {url[:80]}"

    return f"Permission needed for {tool}"


def main():
    raw = sys.stdin.read()
    try:
        hook_data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    message = build_message(hook_data)

    subprocess.Popen(
        [NOTIFIER, "Permission Required", message, "Glass.aiff", ICON_PATH],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    main()
