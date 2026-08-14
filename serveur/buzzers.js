const { SerialPort, ReadlineParser } = require('serialport');
const { EventEmitter } = require('events');

const REGEX_BUZZ = /^BUZZ\s*@\s*(\d+)\s*ms$/;
const BAUD_RATE = 115200;
const INTERVALLE_SCAN_MS = 2000;

// Ouvre une connexion sur chaque port qui ressemble à un Arduino branché en USB
// (motif usbmodem*), sans savoir à l'avance à quelle équipe chacun appartient
// — l'association se fait plus tard, à l'appui (voir partie.js). Re-scanne
// régulièrement pour détecter les buzzers branchés après coup, pas seulement
// ceux déjà là au démarrage.
function detecterEtOuvrirBuzzers() {
  const emetteur = new EventEmitter();
  const portsOuverts = new Set();

  function ouvrirPort(path) {
    if (portsOuverts.has(path)) return;
    portsOuverts.add(path);

    const port = new SerialPort({ path, baudRate: BAUD_RATE });
    const parser = port.pipe(new ReadlineParser({ delimiter: '\n' }));

    port.on('open', () => emetteur.emit('port-ouvert', { path }));
    port.on('error', (erreur) => {
      emetteur.emit('port-erreur', { path, message: erreur.message });
      portsOuverts.delete(path); // permet de retenter si le port revient plus tard
    });
    port.on('close', () => portsOuverts.delete(path));

    parser.on('data', (ligne) => {
      const texte = ligne.trim();
      const correspondance = texte.match(REGEX_BUZZ);

      if (!correspondance) {
        emetteur.emit('info-firmware', { path, texte });
        return;
      }

      emetteur.emit('buzz', { path, horodatage: Number(correspondance[1]) });
    });
  }

  async function scanner() {
    const tousLesPorts = await SerialPort.list();
    tousLesPorts.filter((p) => /usbmodem/i.test(p.path)).forEach((p) => ouvrirPort(p.path));
  }

  scanner();
  setInterval(scanner, INTERVALLE_SCAN_MS);

  return { emetteur, getPortsOuverts: () => [...portsOuverts] };
}

module.exports = { detecterEtOuvrirBuzzers };
