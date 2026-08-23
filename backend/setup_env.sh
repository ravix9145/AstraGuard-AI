#!/usr/bin/env bash
# =============================================================================
# AstraGuard AI — Backend Environment Setup
# =============================================================================
# Usage:
#   chmod +x setup_env.sh
#   ./setup_env.sh
# =============================================================================

set -euo pipefail

PYTHON=${PYTHON:-python3}
VENV_DIR=".venv"

echo "╔══════════════════════════════════════════╗"
echo "║     AstraGuard AI — Backend Setup        ║"
echo "╚══════════════════════════════════════════╝"
echo ""

# ── 1. Check Python ──────────────────────────────────────────────────────────
if ! command -v "$PYTHON" &>/dev/null; then
  echo "ERROR: '$PYTHON' not found. Install Python 3.11+ and retry."
  exit 1
fi

PY_VERSION=$("$PYTHON" -c "import sys; print(f'{sys.version_info.major}.{sys.version_info.minor}')")
echo "✓  Python $PY_VERSION detected"

# ── 2. Create virtual environment ────────────────────────────────────────────
if [ ! -d "$VENV_DIR" ]; then
  echo "→  Creating virtual environment in $VENV_DIR ..."
  "$PYTHON" -m venv "$VENV_DIR"
  echo "✓  Virtual environment created"
else
  echo "✓  Virtual environment already exists"
fi

# ── 3. Activate and install dependencies ─────────────────────────────────────
# shellcheck disable=SC1091
source "$VENV_DIR/bin/activate"

echo "→  Upgrading pip ..."
pip install --quiet --upgrade pip

echo "→  Installing dependencies from requirements.txt ..."
pip install --quiet -r requirements.txt

echo ""
echo "╔══════════════════════════════════════════╗"
echo "║  Setup complete! Start the API server:   ║"
echo "║                                          ║"
echo "║  source .venv/bin/activate               ║"
echo "║  uvicorn main:app --reload --port 8000   ║"
echo "╚══════════════════════════════════════════╝"
