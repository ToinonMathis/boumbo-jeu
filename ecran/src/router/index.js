import { createRouter, createWebHistory } from 'vue-router';
import EcranView from '../views/EcranView.vue';
import AnimateurView from '../views/AnimateurView.vue';

const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/', name: 'ecran', component: EcranView },
    { path: '/animateur', name: 'animateur', component: AnimateurView },
  ],
});

export default router;
