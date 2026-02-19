#!/usr/bin/env python3
"""
PermissionRequest hook: shows a notification whenever Claude needs explicit
permission for a tool, regardless of the permission mode.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")


def build_message(hook_data: dict) -> str:
    tool = hook_data.get("tool_name", "unknown tool")
    tool_input = hook_data.get("tool_input", {})

    # Show the most useful field depending on the tool
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

    notifier_cmd = [
        "terminal-notifier",
        "-title", "Permission Required",
        "-message", message,
        "-sound", "Glass",
        "-activate", "com.microsoft.VSCode",
    ]
    if os.path.exists(ICON_PATH):
        notifier_cmd += ["-contentImage", ICON_PATH]
    subprocess.Popen(notifier_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Also call claude-code-notification for VSCode chat tab integration
    notification = {
        "message": message,
        "title": "Permission Required",
        "hook_event_name": "Notification",
        "notification_type": "permission_prompt",
        "session_id": hook_data.get("session_id", ""),
        "transcript_path": hook_data.get("transcript_path", ""),
        "cwd": hook_data.get("cwd", ""),
        "permission_mode": hook_data.get("permission_mode", "default"),
    }
    subprocess.Popen(
        ["claude-code-notification", "--sound", "Glass"],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).communicate(input=json.dumps(notification).encode())


if __name__ == "__main__":
    main()
