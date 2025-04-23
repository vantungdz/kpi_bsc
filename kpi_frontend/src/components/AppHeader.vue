<template>
  <a-layout-header class="app-header-container">
    <div class="header-left">
      <div class="logo-title">KPI Dashboard</div>
    </div>

    <div class="header-right">
      <a-dropdown v-if="isAuthenticated" placement="bottomRight">
        <div class="user-profile-trigger">
          <a-avatar :src="actualUser?.avatar_url" size="small">
            <template #icon>
              <span v-if="actualUser && (actualUser.first_name || actualUser.username)">
                 {{ (actualUser.first_name || actualUser.username).charAt(0).toUpperCase() }}
              </span>
              <span v-else><UserOutlined /></span>
            </template>
          </a-avatar>
          <span class="user-name">
            {{ actualUser?.first_name || actualUser?.username || 'User' }}
            <span class="role-display"> ({{ effectiveRole || 'No Role' }})</span>
          </span>
          <down-outlined class="user-arrow" />
        </div>
        <template #overlay>
          <a-menu @click="handleMenuClick">
            <a-menu-item key="profile"> <user-outlined /> Profile </a-menu-item>
            <a-menu-item key="settings"> <setting-outlined /> Settings </a-menu-item>
            <a-menu-divider />
            <a-menu-item key="logout"> <logout-outlined /> Logout </a-menu-item>
          </a-menu>
        </template>
      </a-dropdown>
       <div v-else> </div> </div>
  </a-layout-header>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { useRouter } from 'vue-router';
// Import Ant Design components và icons
import { UserOutlined, SettingOutlined, LogoutOutlined, DownOutlined } from '@ant-design/icons-vue';

const store = useStore();
const router = useRouter();

// --- Lấy State/Getters từ Store ---
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);
const actualUser = computed(() => store.getters['auth/user']);
const effectiveRole = computed(() => store.getters['auth/effectiveRole']);


// --- Các hàm xử lý menu và logout ---
const handleMenuClick = ({ key }) => {
  console.log(`Clicked on menu item ${key}`);
  if (key === 'logout') { handleLogout(); }
  else if (key === 'profile') { router.push('/profile'); }
  else if (key === 'settings') { router.push('/settings'); }
};
const handleLogout = () => { store.dispatch('auth/logout'); };


</script>

<style scoped>
.app-header-container {
  background: linear-gradient(to bottom right, #e0f7fa, #f8f9fa);
  padding: 0 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 61px;
  color: rgba(0, 0, 0, 0.85);
  border-bottom: 1px solid #f0f0f0;
   position: sticky;
  top: 0;
  z-index: 10;
}
.logo-title { color: var(--brand-primary, #0056b3); font-size: 1.4em; font-weight: 600; }
.header-right { display: flex; align-items: center; gap: 15px; }
.role-selector { display: flex; align-items: center; }
.role-label { margin-right: 8px; font-size: 0.9em; color: rgba(0, 0, 0, 0.65); white-space: nowrap; }
.user-profile-trigger { display: flex; align-items: center; cursor: pointer; padding: 0 12px; height: 100%; transition: background-color 0.3s; border-radius: 4px; }
.user-profile-trigger:hover { background-color: rgba(0, 0, 0, 0.025); }
.user-name { margin-left: 8px; font-weight: 500; color: rgba(0, 0, 0, 0.85); white-space: nowrap; }
.user-arrow { font-size: 0.8em; margin-left: 5px; color: rgba(0, 0, 0, 0.45); }
.role-display { font-size: 0.8em; opacity: 0.7; margin-left: 4px; font-weight: 400; }
</style>