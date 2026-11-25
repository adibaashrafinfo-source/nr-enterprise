#!/bin/sh
# Copies the cPanel SPA build (dist/client) into the committed folder frontend-dist/ so cPanel needs no Node.
set -e
cd "$(dirname "$0")/.."
rm -rf frontend-dist && mkdir frontend-dist && cp -r dist/client/. frontend-dist/
echo "frontend-dist updated: $(du -sh frontend-dist | cut -f1)"
