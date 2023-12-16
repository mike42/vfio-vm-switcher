#!/bin/bash
set -exu -o pipefail

# Angular build
(cd ui && npm install && npm run build)

# Python build
if [ ! -d venv/ ]; then
    # Create venv if it doesn't exist
    python3 -m venv venv/
fi
./venv/bin/pip install -r requirements.txt
./venv/bin/pyinstaller --add-data "ui/dist/:ui/dist/" --onefile app/main.py

