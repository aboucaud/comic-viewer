# Kiosque BD

Visionneuse de PDF (bande dessinée de vulgarisation scientifique) pour un écran externe en orientation portrait, en exposition. Le public n'a qu'une souris : pas d'écran tactile, pas de clavier.

## Architecture
- `index.html` : structure et CSS, sans dépendance externe. Trois vues : `#loading`, `#auto`, `#explore`.
- `app.js` : module ES. Le rendu passe par PDF.js (`lib/`, pdfjs-dist v4, embarqué pour un usage hors ligne). Chaque page est rendue une seule fois en JPEG (blob URL), puis gardée en cache.
- `config.js` : réglages destinés à l'opérateur (`window.KIOSQUE_CONFIG`). Tous sont documentés dans `README.md`, à tenir à jour. `app.js` valide les valeurs au démarrage.
- Lanceurs à double-cliquer, `Lancer le kiosque - Windows.bat` et `Lancer le kiosque - Mac.command`. Ils appellent `lib/kiosque-windows.ps1` (serveur PowerShell `HttpListener`, rien à installer) et `lib/kiosque-mac-linux.sh` (`python3 -m http.server`). Le serveur est obligatoire : sous `file://`, le navigateur bloque les modules ES et le worker PDF.js, même avec `--allow-file-access-from-files` (vérifié).
- Public visé : l'installation est faite par une personne non informaticienne, sous Windows. `Guide d'installation.html` est son mode d'emploi, à tenir à jour quand les lanceurs ou les messages changent. Les messages d'erreur des lanceurs sont en français courant.
- Encodage : `.ps1` en UTF-8 avec BOM + CRLF, `.bat` en CRLF (voir `.gitattributes`). Sinon les accents ou les blocs `if` cassent sous Windows.
- `bd.pdf` : BD de test de 12 pages en 3 chapitres, avec un raccourci en retrait sous chacun (signets générés depuis `outils/sommaire.toml`).
- `outils/ajouter_sommaire.py` : script uv (pypdf, métadonnées PEP 723) qui écrit les signets d'un PDF depuis un TOML (`[[chapitre]]` puis `[[chapitre.sections]]`, pages numérotées à partir de 1). Il remplace les signets existants et s'arrête sur un message en français, sans trace Python. `outils/sommaire.toml` est l'exemple pour `bd.pdf` et le sommaire lu par défaut. `outils/` est exclu du ZIP (`export-ignore`) ; la CI exécute le script sur `bd.pdf`.

## Comportement
- Mode auto : défilement continu (`autoMode: "scroll"`) ou page par page avec fondu (`"pages"`). Il tourne en boucle et le curseur est masqué. Un clic fait passer en exploration, à la page alors affichée.
- Mode exploration : clic sur les bords de la page ou sur les boutons ◀ ▶, molette, menu des chapitres. Les chapitres viennent des signets du PDF ou de `config.chapters`. Seuls deux niveaux sont lus : les signets de premier niveau sont les chapitres, leurs enfants (`marks`) sont des raccourcis vers une page, affichés en retrait. La barre et la surbrillance suivent le chapitre, jamais le raccourci. Une entrée hors du PDF est ignorée.
- Seuls Ctrl+Alt+Q (`exitCombo`, défilement depuis la page 1) et Ctrl+Alt+R (`resumeCombo`, défilement à partir de la page affichée) font sortir de l'exploration. Ctrl+Alt+Q bascule aussi dans l'autre sens ; Ctrl+Alt+R est sans effet pendant le défilement. Les autres touches, le clic droit, le glisser-déposer et le zoom sont neutralisés. Exception obligatoire : Alt+F4 et Cmd+Q ne doivent jamais recevoir `preventDefault()`. Sous Windows, la page qui consomme Alt+F4 empêche la fenêtre de se fermer (constaté en test) ; Alt+F4 appelle aussi `window.close()` en secours. Le retour automatique après inactivité est désactivé par défaut (`inactivityReturn: 0`) ; `inactivityResume: true` le fait reprendre à la page affichée.

## Tester
`python3 -m http.server 8765`, puis ouvrir http://127.0.0.1:8765. Utiliser une fenêtre en portrait, par exemple 540×960. `?pdf=autre.pdf&mode=pages` remplace les réglages de `config.js` le temps d'un test.

## Pistes ouvertes
- Essai avec la vraie BD : vitesse de défilement, poids des pages.
- Démarrage automatique sur la machine d'exposition (Raspberry Pi / mini-PC, ou Windows « Accès affecté »).
