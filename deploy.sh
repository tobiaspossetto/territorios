#!/bin/bash
# Compila y publica la V2 sobre el hosting principal solicitado.
set -e
cd "$(dirname "$0")"

echo "==> build"
npm run build

echo "==> deploy Firebase Hosting"
npx --yes firebase-tools deploy --only hosting --project territorios-este-sf
