// Réduit une photo choisie/prise sur le téléphone en une petite vignette carrée
// (crop centré), encodée en JPEG data-URL. But : quelques Ko seulement, pour
// pouvoir transiter par le serveur (SSE) et rester en mémoire sans peser — on
// n'enregistre rien sur disque.
export function reduireImage(fichier, taille = 160) {
  return new Promise((resolve, reject) => {
    const lecteur = new FileReader();
    lecteur.onerror = reject;
    lecteur.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        // Crop carré centré.
        const cote = Math.min(img.width, img.height);
        const sx = (img.width - cote) / 2;
        const sy = (img.height - cote) / 2;

        const canvas = document.createElement('canvas');
        canvas.width = taille;
        canvas.height = taille;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, sx, sy, cote, cote, 0, 0, taille, taille);

        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = lecteur.result;
    };
    lecteur.readAsDataURL(fichier);
  });
}
