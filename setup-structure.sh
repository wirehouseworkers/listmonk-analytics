#!/usr/bin/env bash
#
# setup-structure.sh — create the listmonk-analytics repo skeleton.
#
# Run ONCE from inside the repo root after committing the planning files.
# Creates directories, .gitkeep placeholders, .gitignore, and fetches the
# pinned Chart.js vendor file. Idempotent: safe to re-run.
#
# Usage:
#   chmod +x setup-structure.sh
#   ./setup-structure.sh
#
set -euo pipefail

echo "Creating directory structure..."
mkdir -p internal/config
mkdir -p internal/db
mkdir -p internal/api
mkdir -p web/static/vendor
mkdir -p specs
mkdir -p docs
mkdir -p setup

# Keep otherwise-empty dirs in git until real files land.
touch internal/config/.gitkeep
touch internal/db/.gitkeep
touch internal/api/.gitkeep
touch web/static/.gitkeep
touch setup/.gitkeep

# .gitignore
if [ ! -f .gitignore ]; then
  echo "Writing .gitignore..."
  cat > .gitignore <<'EOF'
# Binaries
/listmonk-analytics
*.exe
*.out

# Env / secrets — NEVER commit a real DATABASE_URL
.env
.env.local
*.local

# Go
/vendor/
*.test
*.prof

# OS / editor
.DS_Store
Thumbs.db
.idea/
.vscode/
*.swp
EOF
else
  echo ".gitignore exists, skipping."
fi

# Pinned Chart.js (vendored so the binary is self-contained, no CDN at runtime).
CHART_VER="4.4.3"
CHART_PATH="web/static/vendor/chart.min.js"
if [ ! -f "$CHART_PATH" ]; then
  echo "Fetching Chart.js v${CHART_VER}..."
  if command -v curl >/dev/null 2>&1; then
    curl -fsSL "https://cdn.jsdelivr.net/npm/chart.js@${CHART_VER}/dist/chart.umd.min.js" -o "$CHART_PATH" \
      && echo "  -> $CHART_PATH" \
      || echo "  !! fetch failed — download chart.js@${CHART_VER} manually into $CHART_PATH"
  else
    echo "  !! curl not found — download chart.js@${CHART_VER} manually into $CHART_PATH"
  fi
else
  echo "Chart.js already vendored, skipping."
fi

echo ""
echo "Structure ready. Verify with: find . -type d -not -path './.git/*' | sort"
echo "Next: open a Claude Code session on section S00 (see specs/build-plan.md)."
