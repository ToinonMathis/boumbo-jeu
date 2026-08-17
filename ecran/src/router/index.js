import { createRouter, createWebHistory } from 'vue-router';
import EcranView from '../views/EcranView.vue';
import AnimateurView from '../views/AnimateurView.vue';
import ApercuPodiumView from '../views/ApercuPodiumView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'ecran', component: EcranView },
    { path: '/animateur', name: 'animateur', component: AnimateurView },
    // Aperçu du podium sans buzzer ni serveur de jeu (données de démo).
    { path: '/apercu-podium', name: 'apercu-podium', component: ApercuPodiumView },
  ],
});

export default router;
