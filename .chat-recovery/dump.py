#!/usr/bin/env python3
"""Render the broken Cursor chat transcript into readable Markdown."""
import json
import sys
from pathlib import Path

SRC = Path(
    "/home/fox/.cursor/projects/home-fox-workspace-lotus/agent-transcripts/"
    "1dbb1024-ee28-44b9-91fc-50912e32a308/"
    "1dbb1024-ee28-44b9-91fc-50912e32a308.jsonl"
)
OUT = Path("/home/fox/workspace/lotus/.chat-recovery/transcript.md")


def trim(s, n=4000):
    s = s.rstrip()
    if len(s) <= n:
        return s
    return s[:n] + f"\n\n_... [truncated {len(s) - n} chars] ..._"


def render_tool(name, inp):
    if name == "Shell":
        return f"```bash\n# {inp.get('description', '')}\n{trim(inp.get('command', ''), 1500)}\n```"
    if name in ("Read", "Glob"):
        path = inp.get("path") or inp.get("glob_pattern") or ""
        offset = inp.get("offset")
        limit = inp.get("limit")
        extra = ""
        if offset is not None or limit is not None:
            extra = f" (offset={offset}, limit={limit})"
        return f"**{name}**: `{path}`{extra}"
    if name == "Grep":
        return f"**Grep** `{inp.get('pattern', '')}` in `{inp.get('path', '.')}`"
    if name == "Write":
        path = inp.get("path", "")
        body = trim(inp.get("contents", ""), 2500)
        return f"**Write**: `{path}`\n```\n{body}\n```"
    if name == "StrReplace":
        path = inp.get("path", "")
        old = trim(inp.get("old_string", ""), 1500)
        new = trim(inp.get("new_string", ""), 1500)
        return f"**StrReplace**: `{path}`\n```diff\n- OLD ---\n{old}\n- NEW ---\n{new}\n```"
    if name == "Delete":
        return f"**Delete**: `{inp.get('path', '')}`"
    if name == "TodoWrite":
        items = inp.get("todos", [])
        rows = "\n".join(
            f"- [{'x' if t.get('status') == 'completed' else ' '}] "
            f"({t.get('status')}) {t.get('content')}"
            for t in items
        )
        return f"**TodoWrite**:\n{rows}"
    if name == "WebSearch":
        return f"**WebSearch**: {inp.get('search_term', '')}"
    if name == "WebFetch":
        return f"**WebFetch**: {inp.get('url', '')}"
    return f"**{name}**: ```{json.dumps(inp)[:400]}```"


lines_in = SRC.read_text().splitlines()
out_lines = [
    "# Recovered chat transcript",
    "",
    f"Source: `{SRC}`",
    f"Total entries: {len(lines_in)}",
    "",
    "---",
    "",
]

for idx, raw in enumerate(lines_in, start=1):
    try:
        d = json.loads(raw)
    except Exception as exc:
        out_lines.append(f"### Entry {idx}: PARSE ERROR — {exc}")
        continue
    role = d.get("role", "?")
    msg = d.get("message", {})
    contents = msg.get("content", [])
    out_lines.append(f"## [{idx}] {role}")
    out_lines.append("")
    for c in contents:
        t = c.get("type")
        if t == "text":
            out_lines.append(trim(c.get("text", ""), 8000))
            out_lines.append("")
        elif t == "tool_use":
            out_lines.append(render_tool(c.get("name", "?"), c.get("input", {})))
            out_lines.append("")
        elif t == "tool_result":
            res = c.get("content", "")
            if isinstance(res, list):
                res = "\n".join(
                    item.get("text", "") if isinstance(item, dict) else str(item)
                    for item in res
                )
            out_lines.append(f"<details><summary>tool result</summary>\n\n```\n{trim(str(res), 2500)}\n```\n\n</details>")
            out_lines.append("")
        else:
            out_lines.append(f"_(unknown content type: {t})_")
            out_lines.append("")
    out_lines.append("---")
    out_lines.append("")

OUT.write_text("\n".join(out_lines))
print(f"wrote {OUT} ({OUT.stat().st_size} bytes)")
