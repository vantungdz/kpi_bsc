<template>
  <!-- Layout ngoài cùng chiếm đúng 100% chiều cao viewport và không tự cuộn -->
  <a-layout style="height: 100vh; overflow: hidden" class="app-layout-wrapper">
    <AppSidebar v-if="isAuthenticated" />

    <!-- Layout này sẽ chứa header, content, và footer -->
    <a-layout class="site-layout">
      <AppHeader v-if="isAuthenticated" />

      <!-- Khu vực nội dung chính, phần này sẽ cuộn -->
      <a-layout-content class="site-layout-content">
        <div
          v-if="isAuthenticating"
          style="
            display: flex;
            justify-content: center;
            align-items: center;
            height: calc(100vh - 100px);
          "
        >
          <a-spin size="large" :tip="$t('loadingUserData')" />
        </div>
        <div v-else id="app">
          <router-view />
        </div>
      </a-layout-content>

      <!-- Footer sẽ nằm ở dưới cùng của site-layout -->
      <a-layout-footer
        class="site-layout-footer"
        style="text-align: center; padding: 13px 50px; background: #f0f2f5"
      >
        {{ $t('footerText', { year: new Date().getFullYear() }) }}
      </a-layout-footer>
    </a-layout>
  </a-layout>
</template>

<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import AppHeader from "@/core/components/layout/AppHeader.vue";
import AppSidebar from "@/core/components/layout/AppSidebar.vue";
import  { useI18nLocale } from "@/core/i18n";

import {
  Layout as ALayout,
  LayoutContent as ALayoutContent,
  LayoutFooter as ALayoutFooter,
  Spin as ASpin,
} from "ant-design-vue";

const store = useStore();

const isAuthenticating = ref(true);

const isAuthenticated = computed(() => store.getters["auth/isAuthenticated"]);

const i18nLocale = useI18nLocale();

onMounted(async () => {
  isAuthenticating.value = true;
  const token = store.getters["auth/token"];

  if (token) {
    try {
      await store.dispatch("auth/fetchUserProfile");

      if (isAuthenticated.value) {
        store.dispatch("notifications/fetchUnreadCount");
      }
    } catch (error) {
      console.error(
        "App.vue onMounted: Error during fetchUserProfile dispatch (logout might have been triggered)."
      );
    }
  } else {
    if (store.getters["auth/user"]) {
      console.warn("App.vue: User state exists without token, forcing logout.");
      store.dispatch("auth/logout");
    }
  }

  isAuthenticating.value = false;
});

watch(isAuthenticated, (newValue, oldValue) => {
  if (newValue && !oldValue) {
    store.dispatch("notifications/fetchUnreadCount");
  }
});

watch(i18nLocale, () => {
  const app = getCurrentInstance();
  if (app) app.proxy.$forceUpdate();
});

</script>

<style>
/* CSS này nên được giữ nguyên từ lần sửa trước */
.app-layout-wrapper {
  display: flex;
  flex-direction: row;
  /* height: 100vh; đã được đặt inline */
  /* overflow: hidden; đã được đặt inline */
}

.site-layout {
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  overflow: hidden; /* Quan trọng để header sticky hoạt động đúng trong context này */
}

.site-layout-content {
  margin: 16px;
  padding: 24px;
  background: #fff;
  overflow-y: auto; /* Chỉ phần này cuộn */
  flex-grow: 1; /* Đẩy footer xuống */
}

.site-layout-footer {
  flex-shrink: 0; /* Ngăn footer co lại */
}
</style>
