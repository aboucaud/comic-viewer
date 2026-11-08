#!/bin/bash
# Kiosque BD - double-cliquez sur ce fichier pour lancer le kiosque (macOS).
# Pour quitter : Cmd + Q.
exec "$(dirname "$0")/lib/kiosque-mac-linux.sh" "$@"
