<template>
  <div class="home-container">
    <div class="home-card">
      <img src="../../core/assets/logo.png" alt="KPI Project Logo" class="home-logo" />
      <h1 class="home-title">{{ t('kpiSystemTitle') }}</h1>
      <p class="home-desc">{{ t('homeWelcome') }}</p>
      <div class="quick-features" v-if="visibleFeatures.length">
        <div
          v-for="feature in visibleFeatures"
          :key="feature.key"
          class="feature-card"
          @click="goTo(feature.route)"
        >
          <component :is="feature.icon" class="feature-icon" />
          <span class="feature-label">{{ t(feature.label) }}</span>
        </div>
      </div>
      <p class="footer-note">{{ t('versionText', { version: '1.0.0 © 2025' }) }}</p>
    </div>
  </div>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';
import { computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  DashboardOutlined,
  AppstoreOutlined,
  AuditOutlined,
  TeamOutlined,
  BarChartOutlined,
  SettingOutlined,
} from '@ant-design/icons-vue';
import { RBAC_ACTIONS, RBAC_RESOURCES } from '@/core/constants/rbac.constants';

const { t } = useI18n();
const store = useStore();
const router = useRouter();

const user = computed(() => store.getters['auth/user']);
const userPermissions = computed(() => user.value?.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}

const features = [
  {
    key: 'dashboard',
    icon: DashboardOutlined,
    label: 'dashboard',
    route: '/dashboard',
    permission: () => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.DASHBOARD),
  },
  {
    key: 'kpi-management',
    icon: AppstoreOutlined,
    label: 'kpiManagement',
    route: '/kpis/company',
    permission: () =>
      hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_COMPANY) ||
      hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_DEPARTMENT) ||
      hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.KPI_SECTION),
  },
  {
    key: 'approvals',
    icon: AuditOutlined,
    label: 'approvalsAndReviews',
    route: '/approvals',
    permission: () => hasPermission(RBAC_ACTIONS.APPROVE, RBAC_RESOURCES.KPI_VALUE),
  },
  {
    key: 'employee-list',
    icon: TeamOutlined,
    label: 'employeeList',
    route: '/employees',
    permission: () => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.EMPLOYEE_COMPANY),
  },
  {
    key: 'report',
    icon: BarChartOutlined,
    label: 'reportGenerator',
    route: '/report-generator',
    permission: () => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.REPORT),
  },
  {
    key: 'admin',
    icon: SettingOutlined,
    label: 'administration',
    route: '/user-role-manager',
    permission: () => hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ADMIN),
  },
];

const visibleFeatures = computed(() => features.filter(f => f.permission()));

function goTo(route) {
  router.push(route);
}
</script>
<style scoped lang="scss">
.home-container {
  min-height: 81vh;
  width: 100%;
  height: 100%;
  max-width: 100vw;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-family: 'Roboto', sans-serif;
  background: linear-gradient(120deg, #e3f2fd 0%, #f8f9fa 100%);
  overflow-x: hidden;
  overflow-y: auto;
}
.home-container::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image: url('../../core/assets/background.png');
  background-size: cover;
  background-position: center;
  opacity: 0.35;
  filter: blur(4px) brightness(0.85);
  z-index: 0;
}
.home-card {
  position: relative;
  z-index: 1;
  background: rgba(255,255,255,0.92);
  border-radius: 22px;
  box-shadow: 0 8px 40px 0 rgba(25, 118, 210, 0.13), 0 1.5px 8px 0 rgba(0,0,0,0.07);
  padding: 48px 38px 32px 38px;
  min-width: 320px;
  max-width: 1000px;
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  animation: fadeIn 0.8s cubic-bezier(0.4,0,0.2,1);
}
@keyframes fadeIn {
  from { opacity: 0; transform: translateY(30px); }
  to { opacity: 1; transform: none; }
}
.quick-features {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 22px 28px;
  margin: 32px 0 18px 0;
  width: 100%;
  max-width: 700px;
}
.feature-card {
  background: linear-gradient(120deg, #e3f2fd 60%, #fff 100%);
  border-radius: 16px;
  box-shadow: 0 2px 12px 0 rgba(25, 118, 210, 0.10);
  padding: 22px 18px 14px 18px;
  min-width: 110px;
  min-height: 110px;
  max-width: 140px;
  flex: 1 1 110px;
  display: flex;
  flex-direction: column;
  align-items: center;
  cursor: pointer;
  transition: box-shadow 0.18s, transform 0.18s, background 0.18s;
  position: relative;
  border: 1.5px solid #e3f2fd;
  user-select: none;
}
.feature-card:hover {
  box-shadow: 0 6px 24px 0 rgba(25, 118, 210, 0.18);
  background: linear-gradient(120deg, #bbdefb 60%, #fff 100%);
  transform: translateY(-2px) scale(1.04);
  border-color: #90caf9;
}
.feature-icon {
  font-size: 2.2em;
  color: #1976d2;
  margin-bottom: 12px;
  filter: drop-shadow(0 2px 8px #b3e5fc);
}
.feature-label {
  font-size: 1.08em;
  color: #1976d2;
  font-weight: 600;
  text-align: center;
  letter-spacing: 0.2px;
  margin-top: 2px;
}
.home-logo {
  width: 120px;
  margin-bottom: 28px;
  filter: drop-shadow(0 2px 8px #b3e5fc);
}
.home-title {
  color: #1976d2;
  font-size: 2.3rem;
  font-weight: 800;
  margin-bottom: 18px;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 0 #fff, 0 1.5px 2px #b2ebf2;
}
.home-desc {
  font-size: 1.18rem;
  color: #444;
  margin-bottom: 18px;
  line-height: 1.7;
  font-weight: 500;
}
.footer-note {
  color: #999;
  font-size: 0.98rem;
  margin-top: 30px;
}
@media (max-width: 900px) {
  .home-card {
    max-width: 98vw;
    padding: 28px 8px 18px 8px;
  }
  .quick-features {
    max-width: 98vw;
    gap: 14px 8px;
  }
}
@media (max-width: 600px) {
  .home-card {
    padding: 28px 8px 18px 8px;
    min-width: 0;
    max-width: 98vw;
  }
  .quick-features {
    gap: 14px 8px;
    max-width: 98vw;
  }
  .feature-card {
    min-width: 90px;
    max-width: 120px;
    padding: 14px 8px 10px 8px;
  }
}
</style>
