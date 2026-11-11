# /// script
# requires-python = ">=3.11"
# dependencies = ["pypdf>=4.3"]
# ///
"""Ajoute une table des matières (signets) à un PDF à partir d'un fichier TOML.

Les signets déjà présents dans le PDF sont remplacés.

Usage (depuis la racine du dépôt) :
    uv run outils/ajouter_sommaire.py bd.pdf            # lit outils/sommaire.toml
    uv run outils/ajouter_sommaire.py livre.pdf --sommaire livre.toml -o livre_signets.pdf
    uv run outils/ajouter_sommaire.py livre.pdf --decalage 2   # si les pages sont décalées
"""

from __future__ import annotations

import argparse
import sys
import tomllib
from dataclasses import dataclass, field
from pathlib import Path

from pypdf import PdfReader, PdfWriter
from pypdf.errors import PdfReadError


@dataclass
class Entree:
    titre: str
    page: int  # numérotation Aperçu, à partir de 1
    sections: list[Entree] = field(default_factory=list)


def erreur(message: str) -> None:
    sys.exit(f"Erreur : {message}")


def lire_entree(donnees: object, ou: str) -> Entree:
    """Vérifie une entrée du TOML (titre + page) et la convertit."""
    if not isinstance(donnees, dict):
        erreur(f"{ou} n'est pas une entrée valide (attendu : titre = \"...\" et page = ...).")
    titre = donnees.get("titre")
    if not isinstance(titre, str) or not titre.strip():
        erreur(f"{ou} n'a pas de titre. Ajoutez une ligne titre = \"...\".")
    page = donnees.get("page")
    if page is None:
        erreur(f"« {titre} » n'a pas de numéro de page. Ajoutez une ligne page = ... (sans guillemets).")
    if isinstance(page, bool) or not isinstance(page, int):
        erreur(f"« {titre} » : la page doit être un nombre entier sans guillemets (page = 5), "
               f"pas {page!r}.")
    return Entree(titre=titre.strip(), page=page)


def charger_sommaire(chemin: Path) -> list[Entree]:
    """Lit le fichier TOML et renvoie la liste des chapitres."""
    try:
        with chemin.open("rb") as f:
            donnees = tomllib.load(f)
    except FileNotFoundError:
        erreur(f"le fichier de sommaire « {chemin} » est introuvable. "
               "Indiquez-le avec --sommaire chemin/vers/sommaire.toml.")
    except tomllib.TOMLDecodeError as e:
        erreur(f"le fichier « {chemin} » est mal écrit ({e}). "
               "Vérifiez les guillemets et les crochets autour de cette ligne.")

    chapitres = donnees.get("chapitre")
    if not isinstance(chapitres, list) or not chapitres:
        erreur(f"aucun chapitre trouvé dans « {chemin} ». "
               "Chaque chapitre commence par une ligne [[chapitre]].")

    entrees = []
    for i, ch in enumerate(chapitres, start=1):
        chapitre = lire_entree(ch, f"le chapitre n° {i}")
        sections = ch.get("sections", [])
        if not isinstance(sections, list):
            erreur(f"« {chapitre.titre} » : les sections doivent commencer par [[chapitre.sections]].")
        chapitre.sections = [lire_entree(s, f"la section n° {j} de « {chapitre.titre} »")
                             for j, s in enumerate(sections, start=1)]
        entrees.append(chapitre)
    return entrees


def index_page(page: int, decalage: int, nb_pages: int, titre: str) -> int:
    """Convertit un numéro de page Aperçu (1-based) en index pypdf (0-based)."""
    index = page - 1 + decalage
    if not 0 <= index < nb_pages:
        erreur(f"« {titre} » pointe vers la page {page} (index {index}), "
               f"hors du document ({nb_pages} pages).")
    return index


def ajouter_signets(writer: PdfWriter, entrees: list[Entree], decalage: int) -> None:
    nb_pages = len(writer.pages)
    for chapitre in entrees:
        parent = writer.add_outline_item(
            chapitre.titre, index_page(chapitre.page, decalage, nb_pages, chapitre.titre)
        )
        for section in chapitre.sections:
            writer.add_outline_item(
                section.titre,
                index_page(section.page, decalage, nb_pages, section.titre),
                parent=parent,
            )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("pdf", type=Path, help="PDF d'entrée")
    parser.add_argument("-s", "--sommaire", type=Path,
                        default=Path(__file__).with_name("sommaire.toml"),
                        help="fichier TOML du sommaire (défaut : sommaire.toml à côté du script)")
    parser.add_argument("-o", "--sortie", type=Path,
                        help="PDF de sortie (défaut : <entrée>_signets.pdf)")
    parser.add_argument("-d", "--decalage", type=int, default=0,
                        help="décalage à appliquer à tous les numéros de page (défaut : 0)")
    args = parser.parse_args()

    sortie = args.sortie or args.pdf.with_name(f"{args.pdf.stem}_signets.pdf")
    entrees = charger_sommaire(args.sommaire)

    try:
        writer = PdfWriter(clone_from=PdfReader(args.pdf))
    except FileNotFoundError:
        erreur(f"le PDF « {args.pdf} » est introuvable.")
    except PdfReadError as e:
        erreur(f"« {args.pdf} » n'est pas un PDF lisible ({e}).")

    # Repartir de zéro : sinon les nouveaux signets s'ajoutent à la suite des anciens.
    remplaces = " (anciens signets remplacés)" if writer.outline else ""
    writer.root_object.pop("/Outlines", None)
    ajouter_signets(writer, entrees, args.decalage)
    writer.page_mode = "/UseOutlines"  # ouvre la barre des signets à l'ouverture
    try:
        writer.write(sortie)
    except PermissionError:
        erreur(f"impossible d'écrire « {sortie} ». "
               "Le fichier est peut-être ouvert dans un autre logiciel : fermez-le et recommencez.")

    nb = len(entrees) + sum(len(c.sections) for c in entrees)
    print(f"✓ {nb} signets ajoutés{remplaces} → {sortie}")


if __name__ == "__main__":
    main()
