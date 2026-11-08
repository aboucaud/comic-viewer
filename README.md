# Kiosque BD

Visionneuse de bande dessinée PDF pour borne d'exposition : écran externe en portrait, une souris pour seul périphérique, aucun accès Internet nécessaire.

Au repos, la BD défile toute seule en boucle. Le visiteur clique pour la feuilleter à son rythme : page par page, à la molette ou par chapitre.

[![Télécharger le kiosque (ZIP)](https://img.shields.io/badge/T%C3%A9l%C3%A9charger-kiosque--bd.zip-ffcf3f?style=for-the-badge&logo=github&logoColor=white&labelColor=1d1c22)](https://github.com/aboucaud/comic-viewer/releases/latest/download/kiosque-bd.zip)
[![Dernière version](https://img.shields.io/github/v/release/aboucaud/comic-viewer?style=for-the-badge&label=version&labelColor=1d1c22&color=555)](https://github.com/aboucaud/comic-viewer/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/aboucaud/comic-viewer/paquet.yml?branch=main&style=for-the-badge&label=CI&labelColor=1d1c22)](https://github.com/aboucaud/comic-viewer/actions/workflows/paquet.yml)

Le bouton jaune télécharge toujours la dernière version. Décompressez le fichier, puis ouvrez `Guide d'installation.html`.

## Sommaire

- [Prérequis](#prérequis)
- [Démarrage rapide](#démarrage-rapide)
- [Utilisation](#utilisation)
- [Configuration](#configuration)
- [Chapitres](#chapitres)
- [Préparer le PDF](#préparer-le-pdf)
- [Installer sur la machine d'exposition](#installer-sur-la-machine-dexposition)
- [Développement](#développement)
- [Dépannage](#dépannage)

> **Vous installez la borne et vous n'êtes pas informaticien ?** Ouvrez plutôt le fichier [`Guide d'installation.html`](Guide%20d'installation.html) (double-clic). Il explique pas à pas l'installation sous Windows et sur Mac.

## Prérequis

| Système | À installer |
| --- | --- |
| Windows 10 / 11 | Rien. Le lanceur utilise PowerShell et Microsoft Edge, déjà présents (ou Chrome s'il est installé). |
| macOS | Google Chrome. Python 3 est proposé par macOS au premier lancement (« outils de ligne de commande »). |
| Linux | Python 3 et Chromium ou Chrome. |

Aucun paquet supplémentaire n'est nécessaire. La bibliothèque de lecture des PDF ([PDF.js](https://mozilla.github.io/pdf.js/) 4.10.38) est fournie dans `lib/`.

## Démarrage rapide

1. Copiez votre BD dans ce dossier sous le nom `bd.pdf`, ou indiquez son nom dans `config.js` (réglage `pdf`).
2. Lancez le kiosque :
   - Windows : double-cliquez sur `Lancer le kiosque - Windows.bat`.
   - macOS : double-cliquez sur `Lancer le kiosque - Mac.command`.
   - Linux, ou en ligne de commande : `lib/kiosque-mac-linux.sh`, ou `lib/kiosque-mac-linux.sh autre.pdf`.

Le navigateur s'ouvre en plein écran. Pour le fermer pendant la mise au point : Alt+F4 sous Windows et Linux, Cmd+Q sous macOS.

> Ouvrir `index.html` par double-clic ne fonctionne pas : le navigateur refuse de lire le PDF depuis un fichier local. Passez toujours par un script de lancement ou par un serveur.

## Utilisation

| Mode | Comportement |
| --- | --- |
| **Défilement automatique** | Les pages défilent en boucle, sans curseur. Un clic n'importe où passe en exploration, à la page affichée. |
| **Exploration** | Clic sur les bords gauche et droit de la page, boutons ◀ ▶, molette, menu « ☰ Chapitres ». |
| **Retour au défilement** | **Ctrl + Alt + Q**, réservé au personnel. Ou automatiquement après une période d'inactivité, si `inactivityReturn` est réglé. |

Pendant l'exploration, le clavier est neutralisé, sauf les flèches, Début, Fin et la combinaison de sortie. Le clic droit, le glisser-déposer et le zoom le sont aussi.

## Configuration

Tous les réglages sont dans `config.js`. Une valeur invalide est remplacée par la valeur par défaut, et un avertissement s'affiche dans la console.

| Réglage | Défaut | Rôle |
| --- | --- | --- |
| `pdf` | `"bd.pdf"` | Fichier à présenter, chemin relatif à `index.html`. |
| `autoMode` | `"scroll"` | `"scroll"` : défilement continu. `"pages"` : une page à la fois, avec un fondu. |
| `scrollSpeed` | `45` | Mode `scroll` : vitesse, en pixels par seconde. |
| `pageDuration` | `10` | Mode `pages` : durée d'affichage de chaque page, en secondes. |
| `pauseAtEnd` | `5` | Pause en fin de BD avant de recommencer, en secondes. |
| `pageGap` | `0` | Mode `scroll` : espace entre deux pages, en pixels. |
| `clickToExplore` | `true` | Un clic du visiteur passe en exploration. |
| `hint` | `"Cliquez pour explorer la BD"` | Message affiché pendant le défilement. |
| `exitCombo` | Ctrl+Alt+Q | Combinaison pour revenir au défilement. |
| `inactivityReturn` | `0` | Retour automatique au défilement après N secondes sans activité. `0` = jamais. |
| `chapters` | `null` | Liste des chapitres. `null` = lecture des signets du PDF. |
| `background` | `"#111"` | Couleur de fond autour des pages. |

Pour un essai rapide sans modifier `config.js`, ajoutez des paramètres à l'adresse : `index.html?pdf=autre.pdf&mode=pages`.

> **Conseil pour l'exposition :** avec `inactivityReturn: 0`, une BD laissée en exploration par un visiteur reste figée sur sa page jusqu'à l'intervention du personnel. Une valeur de `120` (2 minutes) relance le défilement automatiquement.

## Chapitres

Les chapitres sont lus dans les signets du PDF. Si le PDF n'en a pas, déclarez-les dans `config.js` :

```js
chapters: [
  { title: "Chapitre 1 — Le Big Bang", page: 1 },
  { title: "Chapitre 2 — Les étoiles", page: 5 },
],
```

Sans signets ni liste, le bouton « Chapitres » est masqué.

## Préparer le PDF

- **Une page par page de BD.** Les planches doubles s'affichent en paysage, donc en petit sur un écran vertical.
- **Poids.** Chaque page est convertie une fois en image, puis gardée en mémoire. Une BD d'une centaine de pages ne pose pas de problème. Au-delà, ou avec des pages très lourdes, testez le démarrage et la fluidité sur la machine d'exposition.
- **Signets.** Ils fournissent le menu des chapitres sans configuration.

## Installer sur la machine d'exposition

Le mode kiosque du navigateur empêche de quitter le plein écran avec Échap ou F11. Il ne bloque pas Alt+F4, Ctrl+Alt+Suppr ni le menu système. Pour un verrouillage complet :

- **Windows :** créez un compte local dédié avec « Accès affecté » (mode kiosque de Windows), ou placez un raccourci de `Lancer le kiosque - Windows.bat` dans le dossier `shell:startup`.
- **Raspberry Pi / mini-PC Linux :** session automatique, et `lib/kiosque-mac-linux.sh` lancé au démarrage (fichier `.desktop` dans `~/.config/autostart/`, ou service systemd utilisateur).
- **Dans tous les cas :** désactivez la mise en veille de l'écran et les mises à jour automatiques pendant les heures d'ouverture. Réglez l'écran en portrait dans le système d'exploitation.

Les lanceurs utilisent un profil de navigateur séparé, pour ne pas toucher au navigateur habituel : `%LOCALAPPDATA%\KiosqueBD\` sous Windows (avec le journal `journal.txt`), `.profil-kiosque/` sous macOS et Linux (exclu du dépôt Git).

### Fonctionnement des lanceurs

Le navigateur bloque les modules ES et la lecture du PDF sous `file://`, avec ou sans `--allow-file-access-from-files`. Un serveur HTTP local est donc indispensable.

- **Windows** (`lib/kiosque-windows.ps1`) : un serveur `System.Net.HttpListener` sur `localhost`, qui ne demande pas de droits administrateur. Il prend le premier port libre entre 8765 et 8775, ouvre Chrome ou Edge en kiosque, et s'arrête quand plus aucun processus du navigateur n'utilise le profil du kiosque. Les erreurs s'affichent dans une boîte de dialogue en français. Le fichier doit rester en UTF-8 **avec BOM** et en CRLF (voir `.gitattributes`), sinon Windows PowerShell 5.1 affiche mal les accents.
- **macOS / Linux** (`lib/kiosque-mac-linux.sh`) : `python3 -m http.server`, premier port libre à partir de 8765 (ou de `KIOSQUE_PORT`). Le script vérifie que le serveur répond avant d'ouvrir le navigateur.

## Développement

```text
index.html          structure et styles, sans dépendance externe
app.js              logique (module ES) : rendu, modes auto et exploration
config.js           réglages de l'opérateur
lib/                PDF.js 4.10.38 (pdf.min.mjs + worker), embarqué pour le hors-ligne
bd.pdf              BD de test : 12 pages, 3 chapitres, avec signets
Lancer le kiosque - Windows.bat   lanceur à double-cliquer (appelle lib/kiosque-windows.ps1)
Lancer le kiosque - Mac.command   lanceur à double-cliquer (appelle lib/kiosque-mac-linux.sh)
Guide d'installation.html         mode d'emploi pour les non-informaticiens
lib/kiosque-*.ps1|sh              lanceurs : serveur local + navigateur en kiosque
```

Pour tester sans le mode kiosque :

```sh
python3 -m http.server 8765
```

Ouvrez ensuite <http://127.0.0.1:8765> dans une fenêtre en portrait, par exemple 540×960 avec l'émulation d'appareil des outils de développement.

Principe du rendu : chaque page du PDF est dessinée une seule fois dans un canevas, convertie en JPEG (blob URL), puis gardée en cache. Les trois premières pages sont prêtes avant l'affichage, les autres se préparent en arrière-plan.

## Dépannage

| Symptôme | Cause probable |
| --- | --- |
| « Impossible d'ouvrir la BD » | Le PDF est introuvable (vérifiez `pdf` dans `config.js`), ou la page a été ouverte par double-clic au lieu du script. |
| « Aucun port réseau local libre » | Les ports 8765 à 8775 sont tous occupés. Fermez les autres kiosques ou redémarrez. |
| Windows : rien ne se passe au double-clic | Consultez `%LOCALAPPDATA%\KiosqueBD\journal.txt`. |
| Défilement saccadé | La machine est trop lente pour la résolution de l'écran. Baissez `scrollSpeed` ou passez en `autoMode: "pages"`. |
| Ctrl+Alt+Q sans effet | Le clavier est-il bien branché sur la machine du kiosque ? Sur un clavier AZERTY, la touche physique A fonctionne aussi. |
