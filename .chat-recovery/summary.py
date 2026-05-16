#!/usr/bin/env python3
"""Compact summary: user prompts + 1-line summary of each assistant turn."""
import json
from pathlib import Path

SRC = Path(
    "/home/fox/.cursor/projects/home-fox-workspace-lotus/agent-transcripts/"
    "1dbb1024-ee28-44b9-91fc-50912e32a308/"
    "1dbb1024-ee28-44b9-91fc-50912e32a308.jsonl"
)
OUT = Path("/home/fox/workspace/lotus/.chat-recovery/summary.md")


def short(s, n=120):
    s = " ".join((s or "").split())
    return s if len(s) <= n else s[: n - 1] + "…"


lines = SRC.read_text().splitlines()
out = ["# Chat summary (compact)", "", f"Total entries: {len(lines)}", ""]

# group consecutive assistant entries; emit one bullet per assistant entry
for i, raw in enumerate(lines, start=1):
    d = json.loads(raw)
    role = d.get("role")
    msg = d.get("message", {})
    contents = msg.get("content", [])
    if role == "user":
        # find the user_query block
        user_text = ""
        for c in contents:
            if c.get("type") == "text":
                user_text = c.get("text", "")
                break
            if c.get("type") == "tool_result":
                user_text = "(tool result)"
        if "<user_query>" in user_text:
            user_text = user_text.split("<user_query>")[1].split("</user_query>")[0]
        if user_text and user_text != "(tool result)":
            out.append("")
            out.append(f"### USER [{i}]")
            out.append("")
            out.append(short(user_text, 600))
            out.append("")
    else:  # assistant
        bits = []
        for c in contents:
            t = c.get("type")
            if t == "text":
                txt = short(c.get("text", ""), 200)
                if txt:
                    bits.append(f"  *say*: {txt}")
            elif t == "tool_use":
                name = c.get("name")
                inp = c.get("input", {})
                if name == "Shell":
                    bits.append(f"  *sh*: `{short(inp.get('command', ''), 100)}`")
                elif name == "StrReplace":
                    bits.append(f"  *edit*: {inp.get('path')}")
                elif name == "Write":
                    bits.append(f"  *write*: {inp.get('path')}")
                elif name == "Read":
                    bits.append(f"  *read*: {inp.get('path')}")
                elif name == "Grep":
                    bits.append(f"  *grep*: {short(inp.get('pattern', ''), 60)}")
                elif name == "Glob":
                    bits.append(f"  *glob*: {inp.get('glob_pattern', '')}")
                elif name == "Delete":
                    bits.append(f"  *del*: {inp.get('path')}")
                elif name == "WebSearch":
                    bits.append(f"  *web*: {short(inp.get('search_term', ''), 80)}")
                elif name == "WebFetch":
                    bits.append(f"  *fetch*: {inp.get('url')}")
                elif name == "TodoWrite":
                    todos = inp.get("todos", [])
                    n = len(todos)
                    in_prog = sum(1 for t in todos if t.get("status") == "in_progress")
                    done = sum(1 for t in todos if t.get("status") == "completed")
                    bits.append(f"  *todos*: {n} items ({done} done, {in_prog} in-progress)")
                else:
                    bits.append(f"  *{name}*")
        if bits:
            out.append(f"- ASSISTANT [{i}]")
            out.extend(bits)

OUT.write_text("\n".join(out))
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
