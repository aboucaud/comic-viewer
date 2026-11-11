// =====================================================================
//  Configuration du kiosque BD — modifiez les valeurs ci-dessous.
// =====================================================================
window.KIOSQUE_CONFIG = {
  // Fichier PDF à présenter (chemin relatif à index.html).
  // « bd_signets.pdf » est la sortie de outils/ajouter_sommaire.py. S'il n'existe pas,
  // le kiosque prend « bd.pdf » (même nom sans « _signets »).
  pdf: "bd_signets.pdf",

  // Défilement automatique :
  //   "scroll" = les pages défilent en continu de haut en bas
  //   "pages"  = une page à la fois, avec un fondu
  autoMode: "scroll",
  scrollSpeed: 45,        // mode "scroll" : vitesse en pixels par seconde
  pageDuration: 10,       // mode "pages"  : secondes par page
  pauseAtEnd: 5,          // pause (s) à la fin avant de recommencer
  pageGap: 0,             // espace (px) entre les pages en mode "scroll"

  // Passage en mode exploration par un simple clic du visiteur
  clickToExplore: true,
  hint: "Cliquez pour explorer la BD",

  // Combinaison pour quitter le mode exploration (et y entrer depuis le clavier).
  // key = la lettre en minuscule.
  exitCombo: { ctrl: true, alt: true, shift: false, key: "q" },

  // Combinaison pour relancer le défilement à partir de la page affichée
  // (au lieu de repartir du début). null = désactivée.
  resumeCombo: { ctrl: true, alt: true, shift: false, key: "r" },

  // Retour automatique au défilement après N secondes sans activité.
  // 0 = jamais (seule la combinaison de touches fait sortir).
  inactivityReturn: 0,
  // true = ce retour automatique reprend à la page affichée, false = au début.
  inactivityResume: false,

  // Chapitres. Laissez null pour utiliser les signets du PDF.
  // Sinon : [{ title: "Chapitre 1 — ...", page: 1 }, { title: "...", page: 9 }, ...]
  // Raccourcis en retrait sous un chapitre : { title: "...", page: 9, marks: [{ title: "...", page: 11 }] }
  chapters: null,

  // Couleur de fond autour des pages
  background: "#111",
};
