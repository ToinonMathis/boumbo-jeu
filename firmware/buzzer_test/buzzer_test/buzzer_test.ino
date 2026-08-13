// --- Boumbo : test buzzer n°1 ---
// Lit un bouton sur la broche 2, allume la LED intégrée,
// et envoie "BUZZ" au PC via le port série.

const int BROCHE_BOUTON = 2;
const int BROCHE_LED = 13;      // LED intégrée à l'Uno

int etatPrecedent = HIGH;       // au repos, la broche est HIGH (grâce au pull-up)
unsigned long dernierAppui = 0; // pour l'anti-rebond

void setup() {
  pinMode(BROCHE_BOUTON, INPUT_PULLUP);  // active la résistance interne
  pinMode(BROCHE_LED, OUTPUT);
  Serial.begin(115200);                  // ouvre la liaison avec le PC
  Serial.println("Boumbo pret. Appuie sur le bouton (broche 2 -> GND).");
}

void loop() {
  int etat = digitalRead(BROCHE_BOUTON);

  // détecte le passage HIGH -> LOW = un appui
  if (etatPrecedent == HIGH && etat == LOW) {
    if (millis() - dernierAppui > 50) {   // anti-rebond : ignore les parasites < 50 ms
      Serial.print("BUZZ  @ ");
      Serial.print(millis());             // horodatage en millisecondes
      Serial.println(" ms");
      digitalWrite(BROCHE_LED, HIGH);     // allume la LED
    }
    dernierAppui = millis();
  }

  // relâche : éteint la LED
  if (etat == HIGH) {
    digitalWrite(BROCHE_LED, LOW);
  }

  etatPrecedent = etat;
}