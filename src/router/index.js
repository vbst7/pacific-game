import { createRouter, createWebHistory } from 'vue-router';
import LobbyView from '../views/LobbyView.vue';
import GameView from '../views/GameView.vue';

const routes = [
  {
    path: '/',
    name: 'Lobby',
    component: LobbyView,
  },
  {
    path: '/game/:id', // Dynamic segment for lobby ID
    name: 'Game',
    component: GameView,
    props: true // Pass route params as props to GameView
  },
  // You might want to add a catch-all route for 404s
  // { path: '/:pathMatch(.*)*', name: 'NotFound', component: NotFoundComponent },
];

const router = createRouter({
  history: createWebHistory(),
  routes,
});

export default router;