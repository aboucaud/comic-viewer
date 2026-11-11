#!/usr/bin/env bash
# Lance le kiosque BD en plein écran (mode kiosque de Chrome/Chromium/Edge).
# Sous macOS, double-cliquez plutôt sur « Lancer le kiosque - Mac.command ».
# Usage : lib/kiosque-mac-linux.sh [fichier.pdf]
# Variable d'environnement facultative : KIOSQUE_PORT (8765 par défaut).
set -euo pipefail
cd "$(dirname "$0")/.."

PORT="${KIOSQUE_PORT:-8765}"
PDF="${1:-}"

die() { printf '\n  *** Le kiosque ne peut pas démarrer ***\n\n  %s\n\n' "$*" >&2; exit 1; }

# Sous macOS, python3 existe toujours mais peut demander l'installation des
# « outils de ligne de commande » au premier appel.
if ! python3 -c 1 >/dev/null 2>&1; then
  if [ "$(uname)" = Darwin ]; then
    die "Python 3 n'est pas encore installé. Une fenêtre vous propose d'installer les « outils de ligne de commande » : cliquez sur « Installer », attendez la fin, puis relancez le kiosque."
  fi
  die "python3 est introuvable. Installez-le (paquet « python3 ») puis relancez."
fi
[ -z "$PDF" ] || [ -f "$PDF" ] || die "fichier introuvable : $PDF"
CFG_PDF=$(sed -n 's/^[[:space:]]*pdf:[[:space:]]*"\([^"]*\)".*/\1/p' config.js | head -1)
# bd_signets.pdf (sortie de outils/ajouter_sommaire.py), sinon le même nom sans « _signets »
CFG_PDF=${CFG_PDF:-bd_signets.pdf}; PLAIN_PDF=$(printf '%s' "$CFG_PDF" | sed 's/_signets\.pdf$/.pdf/')
[ -n "$PDF" ] || [ -f "$CFG_PDF" ] || [ -f "$PLAIN_PDF" ] || die "La BD « $PLAIN_PDF » est introuvable. Copiez votre PDF dans le dossier du kiosque et renommez-le « $PLAIN_PDF »."

# Navigateur : Chromium/Chrome (Linux), puis Chrome ou Edge (macOS)
BROWSER=""
for c in chromium chromium-browser google-chrome google-chrome-stable \
         "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
         "/Applications/Chromium.app/Contents/MacOS/Chromium" \
         "/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge"; do
  if command -v "$c" >/dev/null 2>&1 || [ -x "$c" ]; then BROWSER="$c"; break; fi
done
[ -n "$BROWSER" ] || die "Google Chrome est introuvable. Installez-le depuis https://www.google.com/chrome/ puis relancez."

# Premier port libre à partir de $PORT (sinon le navigateur afficherait le
# contenu d'un autre serveur).
port_free() { python3 -c "import socket,sys; socket.socket().bind(('127.0.0.1', int(sys.argv[1])))" "$1" 2>/dev/null; }
for _ in $(seq 10); do port_free "$PORT" && break; PORT=$((PORT + 1)); done
port_free "$PORT" || die "Aucun port réseau local libre. Fermez les autres fenêtres du kiosque, ou redémarrez l'ordinateur."

python3 -m http.server "$PORT" --bind 127.0.0.1 >/dev/null 2>&1 &
SERVER=$!
trap 'kill "$SERVER" 2>/dev/null || true' EXIT

# Attend que le serveur réponde (5 s au plus) plutôt qu'un délai fixe
URL="http://127.0.0.1:$PORT/index.html"
for _ in $(seq 50); do
  kill -0 "$SERVER" 2>/dev/null || die "le serveur n'a pas démarré (port $PORT déjà utilisé ?)."
  python3 -c "import urllib.request,sys; urllib.request.urlopen(sys.argv[1], timeout=1)" "$URL" 2>/dev/null && break
  sleep 0.1
done

if [ -n "$PDF" ]; then
  URL="$URL?pdf=$(python3 -c 'import sys,urllib.parse; print(urllib.parse.quote(sys.argv[1]))' "$PDF")"
fi

"$BROWSER" --kiosk --noerrdialogs --disable-infobars --disable-pinch --overscroll-history-navigation=0 \
  --disable-features=TranslateUI --disable-session-crashed-bubble --no-first-run \
  --user-data-dir="$(pwd)/.profil-kiosque" "$URL"
