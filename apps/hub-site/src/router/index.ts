import { createRouter, createWebHistory } from 'vue-router';
import CatalogView from '@/views/CatalogView.vue';
import ReadMaterialView from '@/views/ReadMaterialView.vue';
import MyMaterialsView from '@/views/MyMaterialsView.vue';
import OrdersView from '@/views/OrdersView.vue';
import LoginView from '@/views/LoginView.vue';

const routes = [
  {
    path: '/',
    redirect: '/materiais',
  },
  {
    path: '/materiais',
    name: 'materiais',
    component: CatalogView,
  },
  {
    path: '/materiais/:id/ler',
    name: 'ler-material',
    component: ReadMaterialView,
  },
  {
    path: '/meus-materiais',
    name: 'meus-materiais',
    component: MyMaterialsView,
  },
  {
    path: '/pedidos',
    name: 'pedidos',
    component: OrdersView,
  },
  {
    path: '/login',
    name: 'login',
    component: LoginView,
  },
  {
    path: '/:pathMatch(.*)*',
    redirect: '/materiais',
  },
];

export const router = createRouter({
  history: createWebHistory(),
  routes,
  scrollBehavior() {
    return { top: 0 };
  },
});
