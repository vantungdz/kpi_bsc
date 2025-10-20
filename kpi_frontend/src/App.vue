<template>
  <template v-if="route.name === 'PageNotFound'">
    <PageNotFound />
  </template>
  <template v-else>
    <a-layout
      style="height: 100vh; overflow: hidden"
      class="app-layout-wrapper"
    >
      <AppSidebar v-if="isAuthenticated" />

      <a-layout class="site-layout">
        <AppHeader v-if="isAuthenticated" />

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
            <LoadingOverlay :visible="loading" message="Loading user data..." />
          </div>
          <div v-else id="app">
            <transition name="fade-page" mode="out-in">
              <router-view />
            </transition>
          </div>
        </a-layout-content>

        <a-layout-footer
          class="site-layout-footer"
          style="text-align: center; padding: 13px 50px; background: #f0f2f5"
        >
          {{ $t("footerText", { year: new Date().getFullYear() }) }}
        </a-layout-footer>
      </a-layout>
    </a-layout>
  </template>
</template>

<script setup>
import { ref, computed, onMounted, watch, getCurrentInstance } from "vue";
import { useStore } from "vuex";
import AppHeader from "@/core/components/layout/AppHeader.vue";
import AppSidebar from "@/core/components/layout/AppSidebar.vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { useI18nLocale } from "@/core/i18n";
import { useRoute } from "vue-router";
import PageNotFound from "@/features/common/PageNotFound.vue";

import {
  Layout as ALayout,
  LayoutContent as ALayoutContent,
  LayoutFooter as ALayoutFooter,
} from "ant-design-vue";

const store = useStore();

const isAuthenticating = ref(true);

const isAuthenticated = computed(() => store.getters["auth/isAuthenticated"]);

const i18nLocale = useI18nLocale();
const route = useRoute();

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
html,
body,
#app {
  height: 100%;
}

.app-layout-wrapper {
  display: flex;
  flex-direction: row;
}

.site-layout {
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  overflow: hidden;
  padding: 16px;
}

.site-layout-content {
  margin: 0px;
  padding: 24px;
  background: #fff;
  overflow: auto;
  display: flex;
  flex-direction: column;
  flex: 1 1 auto;
  min-height: 0;
  /* overflow-y: auto;
  flex-grow: 1; */
}

.no-outer-scroll .site-layout-content {
  overflow: hidden;
}

.site-layout-footer {
  flex-shrink: 0;
}

.fade-page-enter-active,
.fade-page-leave-active {
  transition: opacity 0.45s cubic-bezier(0.4, 0, 0.2, 1);
}
.fade-page-enter-from,
.fade-page-leave-to {
  opacity: 0;
}
.fade-page-enter-to,
.fade-page-leave-from {
  opacity: 1;
}
</style>
