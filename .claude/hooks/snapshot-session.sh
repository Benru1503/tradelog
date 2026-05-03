#!/usr/bin/env bash
# Snapshot recent project state into CLAUDE.md so the next Claude Code session
# (after compaction or a cold start) sees fresh context instead of stale memory.
#
# Wired as a PreCompact hook in .claude/settings.json. Idempotent: replaces
# whatever lives between the session-snapshot markers; appends them if missing.
# Always exits 0 so it never blocks compaction.

set -uo pipefail

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && cd .. && pwd)"
CLAUDE_MD="$PROJECT_ROOT/CLAUDE.md"
[[ -f "$CLAUDE_MD" ]] || exit 0

cd "$PROJECT_ROOT" || exit 0

ISO_TS=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || printf 'n/a')
RECENT_COMMITS=$(git log --oneline -10 2>/dev/null || printf '(no git log)')
DIRTY=$(git status --short 2>/dev/null)
[[ -z "$DIRTY" ]] && DIRTY="(clean working tree)"

CLAUDE_MD="$CLAUDE_MD" \
ISO_TS="$ISO_TS" \
BRANCH="$BRANCH" \
RECENT_COMMITS="$RECENT_COMMITS" \
DIRTY="$DIRTY" \
python3 - <<'PY'
import os, re

CLAUDE_MD = os.environ["CLAUDE_MD"]
START = "<!-- session-snapshot:start -->"
END = "<!-- session-snapshot:end -->"

block = (
    f"{START}\n"
    "## Recent session snapshot\n\n"
    "_Auto-updated by the PreCompact hook. Anything between the markers is overwritten before the next compaction._\n\n"
    f"- **Timestamp:** {os.environ['ISO_TS']}\n"
    f"- **Branch:** {os.environ['BRANCH']}\n\n"
    "**Last 10 commits:**\n"
    "```\n"
    f"{os.environ['RECENT_COMMITS']}\n"
    "```\n\n"
    "**Working tree:**\n"
    "```\n"
    f"{os.environ['DIRTY']}\n"
    "```\n"
    f"{END}\n"
)

with open(CLAUDE_MD, "r", encoding="utf-8") as f:
    body = f.read()

pattern = re.compile(
    re.escape(START) + r".*?" + re.escape(END) + r"\n?",
    re.DOTALL,
)

if pattern.search(body):
    body = pattern.sub(block, body)
else:
    if not body.endswith("\n"):
        body += "\n"
    body += "\n" + block

with open(CLAUDE_MD, "w", encoding="utf-8") as f:
    f.write(body)
PY

exit 0
