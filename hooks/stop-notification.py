#!/usr/bin/env python3
"""
Stop hook: shows a native notification when Claude finishes executing.
Reads the transcript to extract a brief summary of the last response.
Uses terminal-notifier for a rich notification with the Claude icon.
Also calls claude-code-notification in the background for VSCode click-to-focus.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")


def extract_summary(transcript_path: str) -> str:
    if not transcript_path or not os.path.exists(transcript_path):
        return "Task complete"

    try:
        with open(transcript_path) as f:
            lines = f.readlines()

        # Walk backwards to find last assistant text block
        for line in reversed(lines):
            line = line.strip()
            if not line:
                continue
            try:
                obj = json.loads(line)
                if obj.get("type") != "assistant":
                    continue
                content = obj.get("message", {}).get("content", [])
                if isinstance(content, list):
                    for block in content:
                        if isinstance(block, dict) and block.get("type") == "text":
                            text = block["text"].strip()
                            if text:
                                summary = text[:120].replace("\n", " ").strip()
                                if len(text) > 120:
                                    summary += "…"
                                return summary
                elif isinstance(content, str) and content.strip():
                    text = content.strip()
                    summary = text[:120].replace("\n", " ").strip()
                    if len(text) > 120:
                        summary += "…"
                    return summary
            except (json.JSONDecodeError, KeyError):
                continue
    except Exception:
        pass

    return "Task complete"


def main():
    raw = sys.stdin.read()
    try:
        hook_data = json.loads(raw)
    except json.JSONDecodeError:
        sys.exit(0)

    # Guard against infinite loop — stop_hook_active is true when Claude is
    # already continuing because of a previous Stop hook result.
    if hook_data.get("stop_hook_active"):
        sys.exit(0)

    transcript_path = hook_data.get("transcript_path", "")
    summary = extract_summary(transcript_path)

    # Craft a notification payload that claude-code-notification understands.
    # We reuse the idle_prompt notification_type so it uses the same VSCode
    # integration path (click opens the Claude Code chat tab).
    # Show rich notification with Claude icon via terminal-notifier
    notifier_cmd = [
        "terminal-notifier",
        "-title", "Claude Code",
        "-message", summary,
        "-sound", "Funk",
        "-activate", "com.microsoft.VSCode",
    ]
    if os.path.exists(ICON_PATH):
        notifier_cmd += ["-contentImage", ICON_PATH]
    subprocess.Popen(notifier_cmd, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)

    # Also call claude-code-notification in the background so clicking the
    # notification opens the Claude Code chat tab (VSCode extension integration).
    notification = {
        "message": summary,
        "title": "Done",
        "hook_event_name": "Notification",
        "notification_type": "idle_prompt",
        "session_id": hook_data.get("session_id", ""),
        "transcript_path": transcript_path,
        "cwd": hook_data.get("cwd", ""),
        "permission_mode": hook_data.get("permission_mode", "default"),
    }
    subprocess.Popen(
        ["claude-code-notification", "--sound", "Funk"],
        stdin=subprocess.PIPE,
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    ).communicate(input=json.dumps(notification).encode())


if __name__ == "__main__":
    main()
