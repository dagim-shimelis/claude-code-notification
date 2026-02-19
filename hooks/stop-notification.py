#!/usr/bin/env python3
"""
Stop hook: shows a macOS notification when Claude finishes executing.
Reads the transcript to extract a brief summary of the last response.
Uses ClaudeNotifier.app (UNUserNotificationCenter) for icon + sound support.
"""

import json
import os
import subprocess
import sys

ICON_PATH = os.path.expanduser("~/.claude/icons/claude.png")
NOTIFIER = os.path.expanduser("~/.claude/ClaudeNotifier.app/Contents/MacOS/ClaudeNotifier")


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

    subprocess.Popen(
        [NOTIFIER, "Claude Code", summary, "Funk.aiff", ICON_PATH],
        stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
    )


if __name__ == "__main__":
    main()
