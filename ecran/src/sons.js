// Bruitages synthétisés via Web Audio (même principe que le buzzer de démo de
// la vitrine) : pas de fichier audio à héberger, tout sort des enceintes du PC
// sur lequel tourne cet écran.
let contexteAudio;

function obtenirContexte() {
  if (!contexteAudio) {
    contexteAudio = new (window.AudioContext || window.webkitAudioContext)();
  }
  return contexteAudio;
}

// À appeler depuis un vrai geste utilisateur (clic) : les navigateurs bloquent
// l'audio tant qu'aucune interaction n'a eu lieu sur la page.
export function initialiserAudio() {
  const ctx = obtenirContexte();
  if (ctx.state === 'suspended') ctx.resume();
}

function jouerTonalite({ frequenceDepart, frequenceFin, duree, type = 'sine', volume = 0.3 }) {
  try {
    const ctx = obtenirContexte();
    const t = ctx.currentTime;
    const oscillateur = ctx.createOscillator();
    const gain = ctx.createGain();

    oscillateur.type = type;
    oscillateur.frequency.setValueAtTime(frequenceDepart, t);
    if (frequenceFin) {
      oscillateur.frequency.exponentialRampToValueAtTime(frequenceFin, t + duree);
    }

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(volume, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duree);

    oscillateur.connect(gain);
    gain.connect(ctx.destination);
    oscillateur.start(t);
    oscillateur.stop(t + duree + 0.02);
  } catch (erreur) {
    // Un son raté ne doit jamais interrompre la partie.
  }
}

export function jouerSonQuestion() {
  jouerTonalite({ frequenceDepart: 660, frequenceFin: 880, duree: 0.18, type: 'triangle' });
}

export function jouerSonBuzz() {
  jouerTonalite({ frequenceDepart: 220, frequenceFin: 90, duree: 0.3, type: 'sawtooth', volume: 0.35 });
}

export function jouerSonCorrect() {
  jouerTonalite({ frequenceDepart: 523, frequenceFin: 1046, duree: 0.35, type: 'triangle', volume: 0.3 });
}

export function jouerSonIncorrect() {
  jouerTonalite({ frequenceDepart: 200, frequenceFin: 80, duree: 0.4, type: 'sawtooth', volume: 0.3 });
}

// Petit "tic" de suspense joué à chaque rang dévoilé sur le podium.
export function jouerSonReveal() {
  jouerTonalite({ frequenceDepart: 440, frequenceFin: 560, duree: 0.1, type: 'triangle', volume: 0.28 });
}

// Fanfare ascendante pour le dévoilement du grand gagnant (do-mi-sol-do joués
// en arpège via plusieurs oscillateurs enchaînés).
export function jouerSonVictoire() {
  const notes = [523, 659, 784, 1046];
  notes.forEach((frequence, i) => {
    setTimeout(() => {
      jouerTonalite({ frequenceDepart: frequence, duree: 0.32, type: 'triangle', volume: 0.34 });
    }, i * 140);
  });
}
