<template>
  <div class="home-container">
    <div class="left-section">
      <img src="../../core/assets/logo.png" alt="KPI Project Logo" class="home-logo" />
      <h1>{{ t('kpiSystemTitle') }}</h1>
      <p>
        {{ t('homeWelcome') }}
      </p>
      <p class="footer-note">{{ t('versionText', { version: '1.0.0 © 2025' }) }}</p>
    </div>
    <div class="right-section">
      <div class="features-grid">
        <router-link to="/kpi/review" class="feature-card">
          <i class="fas fa-file-signature"></i>
          <span>{{ t('managerReview' ) }}</span>
        </router-link>
        <router-link to="/approvals" class="feature-card">
          <i class="fas fa-check-circle"></i>
          <span>{{ t('kpiApproval' ) }}</span>
        </router-link>
        <router-link to="/employee-kpi-scores" class="feature-card">
          <i class="fas fa-chart-bar"></i>
          <span>{{ t('employeeKpiScoreList' ) }}</span>
        </router-link>
        <router-link to="/personal" class="feature-card">
          <i class="fas fa-user"></i>
          <span>{{ t('myPersonalKpis' ) }}</span>
        </router-link>
        <router-link to="/my-kpi-review" class="feature-card">
          <i class="fas fa-comments"></i>
          <span>{{ t('myKpiReview' ) }}</span>
        </router-link>
        <router-link to="/dashboard" class="feature-card">
          <i class="fas fa-tachometer-alt"></i>
          <span>{{ t('dashboardOverview' ) }}</span>
        </router-link>
        <router-link to="/employees" class="feature-card">
          <i class="fas fa-users"></i>
          <span>{{ t('employeeList' ) }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
<script setup>
import { useI18n } from 'vue-i18n';
const { t } = useI18n();
</script>
<style scoped lang="scss">

.home-container {
  min-height: 100vh;
  height: 100vh;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  font-family: 'Roboto', sans-serif;
  &::before {
    content: '';
    position: absolute;
    top: 0; left: 0; right: 0; bottom: 0;
    background-image: url('../../core/assets/background.png');
    background-size: cover;
    background-position: center;
    filter: blur(6px) brightness(0.7);
    z-index: 0;
  }
}

.left-section, .right-section {
  position: relative;
  z-index: 1;
}

.left-section {
  width: 40%;
  padding: 60px;
  background-color: rgba(255, 255, 255, 0.8); /* Thêm một lớp phủ trắng mờ để làm nổi bật nội dung */
  border-radius: 16px;
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.1);
  text-align: left;
  h1 {
    color: #1890ff;
    margin-bottom: 20px;
    font-size: 2.5rem;
  }
  p {
    font-size: 1.1rem;
    line-height: 1.6;
    color: #555;
  }
}

.right-section {
  width: 55%;
  padding: 60px;
  display: flex;
  justify-content: center;
}
.features-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 20px;
  width: 100%;
}
.home-logo {
  width: 120px;
  margin-bottom: 30px;
}
.feature-card {
  background-color: #fff;
  border-radius: 12px;
  padding: 20px;
  text-align: center;
  text-decoration: none;
  color: #333;
  transition: transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out;
  box-shadow: 0 2px 10px rgba(0, 0, 0, 0.05);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  i {
    font-size: 2.5rem;
    margin-bottom: 15px;
    color: #1890ff;
  }
  span {
    font-weight: 500;
    font-size: 1.1rem;
  }
  &:hover {
    transform: translateY(-5px);
    box-shadow: 0 6px 20px rgba(0, 0, 0, 0.1);
  }
}
.footer-note {
  color: #999;
  font-size: 0.9rem;
  margin-top: 20px;
}
</style>
