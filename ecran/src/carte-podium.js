// Génère une carte-image du podium (1080×1080 PNG) prête à partager sur les
// réseaux. Tout se fait dans le navigateur (canvas) : aucun coût, aucune API.
// On y met la marque Boumbo, le top 3 avec photos + noms + scores, et la date.

const C = {
  nuit: '#23122b',
  nuit2: '#2d1837',
  creme: '#f7eee3',
  cremeDim: 'rgba(247,238,227,0.7)',
  or: '#f6b23c',
  rouge: '#f0392b',
  rougeLo: '#c0231c',
  teal: '#35c2c9',
};

function chargerImage(src) {
  return new Promise((resolve) => {
    if (!src) return resolve(null);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function dessinerDome(ctx, cx, cy, r) {
  const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, r * 0.2, cx, cy, r);
  grad.addColorStop(0, '#ff6a54');
  grad.addColorStop(0.55, C.rouge);
  grad.addColorStop(1, C.rougeLo);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();
}

// « b●umb● » centré horizontalement autour de cx, base à y.
function dessinerMarque(ctx, cx, y, taille = 68) {
  ctx.font = `800 ${taille}px 'Baloo 2', cursive`;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  const domeR = taille * 0.28;
  const gap = taille * 0.07;
  const offset = taille * 0.29;
  const wB = ctx.measureText('b').width;
  const wUmb = ctx.measureText('umb').width;
  const total = wB + gap + domeR * 2 + gap + wUmb + gap + domeR * 2;
  let x = cx - total / 2;

  ctx.fillStyle = C.creme;
  ctx.fillText('b', x, y);
  x += wB + gap;
  dessinerDome(ctx, x + domeR, y - offset, domeR);
  x += domeR * 2 + gap;
  ctx.fillStyle = C.creme;
  ctx.fillText('umb', x, y);
  x += wUmb + gap;
  dessinerDome(ctx, x + domeR, y - offset, domeR);
}

function tronquer(ctx, texte, largeurMax) {
  if (ctx.measureText(texte).width <= largeurMax) return texte;
  let t = texte;
  while (t.length > 2 && ctx.measureText(`${t}…`).width > largeurMax) t = t.slice(0, -1);
  return `${t}…`;
}

export async function genererCartePodium(classement, { titreQuiz, nomEtablissement } = {}) {
  // S'assure que les polices Baloo 2 / Figtree sont chargées avant de dessiner.
  await document.fonts.ready.catch(() => {});

  const T = 1080;
  const canvas = document.createElement('canvas');
  canvas.width = T;
  canvas.height = T;
  const ctx = canvas.getContext('2d');

  // Fond nuit + halos
  ctx.fillStyle = C.nuit;
  ctx.fillRect(0, 0, T, T);
  const halo1 = ctx.createRadialGradient(T * 0.82, 20, 40, T * 0.82, 20, 720);
  halo1.addColorStop(0, 'rgba(240,57,43,0.20)');
  halo1.addColorStop(1, 'transparent');
  ctx.fillStyle = halo1;
  ctx.fillRect(0, 0, T, T);
  const halo2 = ctx.createRadialGradient(0, T * 0.35, 40, 0, T * 0.35, 640);
  halo2.addColorStop(0, 'rgba(246,178,60,0.12)');
  halo2.addColorStop(1, 'transparent');
  ctx.fillStyle = halo2;
  ctx.fillRect(0, 0, T, T);

  // Marque Boumbo (secondaire, en haut)
  dessinerMarque(ctx, T / 2, 88, 42);

  // En-tête : le nom de l'établissement est la vedette de la carte.
  ctx.textAlign = 'center';
  if (nomEtablissement) {
    ctx.fillStyle = C.creme;
    ctx.font = "800 60px 'Baloo 2', cursive";
    ctx.fillText(tronquer(ctx, nomEtablissement, 920), T / 2, 182);
    ctx.fillStyle = C.or;
    ctx.font = "700 34px 'Baloo 2', cursive";
    ctx.fillText('Podium de la soirée', T / 2, 228);
    if (titreQuiz) {
      ctx.fillStyle = C.cremeDim;
      ctx.font = "600 26px 'Figtree', sans-serif";
      ctx.fillText(tronquer(ctx, titreQuiz, 820), T / 2, 266);
    }
  } else {
    ctx.fillStyle = C.or;
    ctx.font = "800 48px 'Baloo 2', cursive";
    ctx.fillText('Podium de la soirée', T / 2, 190);
    if (titreQuiz) {
      ctx.fillStyle = C.cremeDim;
      ctx.font = "600 28px 'Figtree', sans-serif";
      ctx.fillText(tronquer(ctx, titreQuiz, 820), T / 2, 232);
    }
  }

  // Top 3
  const top3 = [...classement].sort((a, b) => b.points - a.points).slice(0, 3);
  const images = await Promise.all(top3.map((t) => chargerImage(t.photo)));
  const medailles = ['🥇', '🥈', '🥉'];
  const baseY = 340;
  const rowH = 200;

  top3.forEach((equipe, i) => {
    const cy = baseY + i * rowH + 70;

    // Médaille
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = "64px 'Figtree', sans-serif";
    ctx.fillText(medailles[i], 150, cy);

    // Photo ronde (ou pastille avec initiale)
    const px = 320;
    const r = 66;
    ctx.save();
    ctx.beginPath();
    ctx.arc(px, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    if (images[i]) {
      ctx.drawImage(images[i], px - r, cy - r, r * 2, r * 2);
    } else {
      ctx.fillStyle = C.nuit2;
      ctx.fillRect(px - r, cy - r, r * 2, r * 2);
      ctx.fillStyle = C.creme;
      ctx.font = "800 56px 'Baloo 2', cursive";
      ctx.fillText((equipe.nom[0] || '?').toUpperCase(), px, cy + 2);
    }
    ctx.restore();
    ctx.beginPath();
    ctx.arc(px, cy, r, 0, Math.PI * 2);
    ctx.lineWidth = 5;
    ctx.strokeStyle = i === 0 ? C.or : 'rgba(247,238,227,0.3)';
    ctx.stroke();

    // Nom
    ctx.textAlign = 'left';
    ctx.fillStyle = C.creme;
    ctx.font = "800 46px 'Baloo 2', cursive";
    ctx.fillText(tronquer(ctx, equipe.nom, 380), 430, cy);

    // Points
    ctx.textAlign = 'right';
    ctx.fillStyle = C.or;
    ctx.font = "800 52px 'Baloo 2', cursive";
    ctx.fillText(`${equipe.points} pt`, T - 90, cy);
  });

  // Date + signature
  ctx.textAlign = 'center';
  ctx.textBaseline = 'alphabetic';
  ctx.fillStyle = C.cremeDim;
  ctx.font = "500 30px 'Figtree', sans-serif";
  const date = new Date().toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });
  ctx.fillText(date, T / 2, T - 118);
  ctx.fillStyle = C.teal;
  ctx.font = "700 32px 'Baloo 2', cursive";
  ctx.fillText("Joué avec Boumbo · le buzzer qui met l'ambiance", T / 2, T - 68);

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'));
}
