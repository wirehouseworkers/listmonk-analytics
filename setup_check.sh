#!/usr/bin/env bash
#
# setup_check.sh — verify planning files are correctly placed before running
# setup-structure.sh. Read-only: checks presence, changes nothing.
#
# Usage:
#   chmod +x setup_check.sh
#   ./setup_check.sh
#
set -uo pipefail

missing=0

check() {
  if [ -f "$1" ]; then
    echo "  OK    $1"
  else
    echo "  MISS  $1"
    missing=1
  fi
}

echo "Root files:"
check CLAUDE.md
check SCHEMA.md
check BRIEF.md
check STRUCTURE.md
check go.mod
check setup-structure.sh

echo ""
echo "specs/:"
check specs/build-plan.md
check specs/metrics-checklist.md

echo ""
echo "docs/:"
check docs/working-agreement.md

echo ""
if [ "$missing" -eq 0 ]; then
  echo "ALL PRESENT — safe to run ./setup-structure.sh"
  exit 0
else
  echo "MISSING FILES above — fix placement before running setup-structure.sh"
  exit 1
fi
