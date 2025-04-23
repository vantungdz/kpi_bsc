<template>
  <a-layout style="min-height: 100vh"> <AppSidebar v-if="isAuthenticated" />

    <a-layout>
      <AppHeader v-if="isAuthenticated" />

      <a-layout-content style="margin: 16px;"> <div v-if="isAuthenticating" style="display: flex; justify-content: center; align-items: center; height: calc(100vh - 100px);"> <a-spin size="large" tip="Loading user data..." />
         </div>
         <router-view v-else />
      </a-layout-content>

      <a-layout-footer style="text-align: center; padding: 13px 50px; background: #f0f2f5;"> Created by IVC ©{{ new Date().getFullYear() }}
      </a-layout-footer>
    </a-layout>
  </a-layout>
</template>

<script setup>
// --- Imports ---
import { ref, computed, onMounted } from 'vue'; // <<< Thêm ref, computed, onMounted
import { useStore } from 'vuex'; // <<< Thêm useStore
import AppHeader from './components/AppHeader.vue';
import AppSidebar from './components/AppSidebar.vue';
// <<< Import các component layout và Spin từ Ant Design >>>
import { Layout as ALayout, LayoutContent as ALayoutContent, LayoutFooter as ALayoutFooter, Spin as ASpin } from 'ant-design-vue';

// --- Store ---
const store = useStore();

// --- State ---
// State kiểm tra xem có đang trong quá trình xác thực/lấy profile không
const isAuthenticating = ref(true);

// --- Computed Properties ---
// Kiểm tra xem người dùng đã đăng nhập chưa (dựa vào sự tồn tại của token)
const isAuthenticated = computed(() => store.getters['auth/isAuthenticated']);

// --- Lifecycle Hooks ---
onMounted(async () => {
    isAuthenticating.value = true;
    const token = store.getters['auth/token'];

    // === THAY ĐỔI ĐIỀU KIỆN: Chỉ cần có token là fetch profile ===
    if (token) {
        // Luôn cố gắng fetch profile mới nhất nếu có token
        console.log('App.vue onMounted: Token found, fetching user profile...');
        try {
            await store.dispatch('auth/fetchUserProfile');
            console.log('App.vue onMounted: User profile fetch attempt finished.');
        } catch (error) {
            // Lỗi fetch profile (ví dụ: token hết hạn) đã được xử lý logout bên trong action
            console.error('App.vue onMounted: Error during fetchUserProfile dispatch (logout might have been triggered).');
        }
    } else {
         console.log('App.vue onMounted: No token found.');
         // Nếu không có token, đảm bảo trạng thái user là null (logout đã làm việc này)
         if(store.getters['auth/user']) {
             console.warn("App.vue: User state exists without token, forcing logout.");
             store.dispatch('auth/logout'); // Logout nếu có user mà ko có token
         }
    }
    // ========================================================

    isAuthenticating.value = false;
});
</script>

<style scoped>
/* Thêm style nếu cần */
.ant-layout-content {
    padding: 24px; /* Thêm padding cho nội dung */
    background: #fff; /* Nền trắng cho nội dung */
     min-height: calc(100vh - 64px - 48px - 32px); /* Tính toán chiều cao tối thiểu (Header 64, Footer ~48, Margin 16*2) */
}
</style>