#!/bin/bash
# Build de la app React y publish a GitHub Pages (repo tobiaspossetto/territorios).
# Uso:  ./deploy.sh
set -e
cd "$(dirname "$0")"

echo "==> build"
npm run build

echo "==> sync dist -> ../deploy"
rsync -a --delete --exclude='.git' --exclude='.gitignore' dist/ ../deploy/

echo "==> commit + push"
cd ../deploy
export GIT_SSH_COMMAND="ssh -i $HOME/.ssh/id_ed25519_territorios -o IdentitiesOnly=yes"
git add -A
git commit -m "Deploy app React (territorios)" || echo "(sin cambios para commitear)"
git pull --rebase origin main || true
git push

echo "==> listo: https://tobiaspossetto.github.io/territorios/"
