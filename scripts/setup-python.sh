#!/usr/bin/env bash

# Stop on first error
set -e

echo "=== Setting up Python Virtual Environment ==="

# Check python3 is installed
if ! command -v python3 &> /dev/null; then
    echo "ERROR: python3 could not be found. Please install python3 first."
    exit 1
fi

# Create virtual environment if it doesn't exist
if [ ! -d ".venv" ]; then
    echo "Creating virtual environment in .venv..."
    python3 -m venv .venv
else
    echo "Virtual environment .venv already exists."
fi

# Upgrade pip
echo "Upgrading pip..."
.venv/bin/pip install --upgrade pip

# Install requirements
echo "Installing requirements from python/requirements.txt..."
.venv/bin/pip install -r python/requirements.txt

echo "=== Python setup completed successfully ==="
