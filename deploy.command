#!/bin/bash
# Double-click this file (or run ./deploy.command "message") to publish updates.
# It commits your changes and pushes to GitHub; Render auto-deploys within ~1-2 min.
cd "$(dirname "$0")" || exit 1

if [ ! -d .git ]; then
  echo "This folder is not a git repository yet."
  echo "Follow the one-time setup in DEPLOY.md (git init + git remote add), then run this again."
  read -n 1 -s -r -p "Press any key to close..."; exit 1
fi

if ! git remote get-url origin >/dev/null 2>&1; then
  echo "No 'origin' remote is set. See DEPLOY.md step 3 (git remote add origin ...)."
  read -n 1 -s -r -p "Press any key to close..."; exit 1
fi

MSG="${1:-Update $(date '+%Y-%m-%d %H:%M')}"
echo "Staging changes..."
git add -A
if git diff --cached --quiet; then
  echo "No changes to publish."
else
  git commit -m "$MSG" || exit 1
fi

BRANCH="$(git rev-parse --abbrev-ref HEAD)"
echo "Pushing $BRANCH to origin..."
if git push origin "$BRANCH"; then
  echo ""
  echo "Done. Render is now auto-deploying. Watch progress at https://dashboard.render.com"
else
  echo ""
  echo "Push failed. If this is the first push, run: git push -u origin $BRANCH"
fi
read -n 1 -s -r -p "Press any key to close..."
echo ""
