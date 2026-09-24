#!/usr/bin/env bash
set -e
cd "$HOME/laxalab"
git reset --soft HEAD~1
rm -f _commit_push.sh _build_check.sh
git add -A
git -c user.name="MMMHH5" -c user.email="m774383805m2003m@gmail.com" commit -m "style(frontend): unify post-login UI into dark navy/gold theme - white surfaces replaced with navy (admin layout, explore cards, course open page, opening form), amber accents rebranded to brand-gold, auth/profile/landing polished, i18n keys expanded, vimeo regex regression fixed"
echo "COMMITTED=$(git rev-parse HEAD)"