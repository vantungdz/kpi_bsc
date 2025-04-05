import { createRouter, createWebHistory } from 'vue-router';
import KpiDashboard from '../views/KpiDashboard.vue';
import KpiList from '../views/KpiList.vue';
import KpiCreate from '../views/KpiCreate.vue';
import KpiDetail from '../views/KpiDetail.vue';

const routes = [
  { path: '/', component: KpiDashboard },
  { path: '/kpi-list', component: KpiList },
  { path: '/kpi/create', component: KpiCreate },
  {
    path: '/kpi/:id',
    name: 'KpiDetail',
    component:KpiDetail,
    props: true
  }
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

export default router;
