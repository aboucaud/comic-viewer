// =====================================================================
//  Configuration du kiosque BD — modifiez les valeurs ci-dessous.
// =====================================================================
window.KIOSQUE_CONFIG = {
  // Fichier PDF à présenter (chemin relatif à index.html)
  pdf: "bd.pdf",

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

  // Retour automatique au défilement après N secondes sans activité.
  // 0 = jamais (seule la combinaison de touches fait sortir).
  inactivityReturn: 0,

  // Chapitres. Laissez null pour utiliser les signets du PDF.
  // Sinon : [{ title: "Chapitre 1 — ...", page: 1 }, { title: "...", page: 9 }, ...]
  chapters: null,

  // Couleur de fond autour des pages
  background: "#111",
};
