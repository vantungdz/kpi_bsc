<template>
  <a-layout-header class="app-header-container">
    <div class="header-left">
      <div class="logo-title">{{ $t("kpiManagementSystem") }}</div>
    </div>

    <div class="header-right">
      <!-- Notification Bell -->
      <NotificationBell v-if="isUserAuthenticated" />

      <a-dropdown v-if="isUserAuthenticated" placement="bottomRight">
        <div class="user-profile-trigger">
          <a-avatar :src="actualUser?.avatar_url" size="small">
            <template #icon
              ><span v-if="userInitial">{{ userInitial }}</span
              ><span v-else> <UserOutlined /> </span
            ></template>
          </a-avatar>
          <span class="user-name">
            {{ displayName }}
          </span>
          <down-outlined class="user-arrow" />
        </div>
        <template #overlay>
          <a-menu @click="handleMenuClick" :items="menuItems" />
        </template>
      </a-dropdown>

      <a-dropdown placement="bottomRight">
        <template #overlay>
          <a-menu>
            <a-menu-item
              v-for="lang in availableLanguages"
              :key="lang.code"
              @click="changeLanguage(lang.code)"
            >
              <flag
                :iso="lang.countryCode"
                style="margin-right: 8px; font-size: 1.2em"
              />
              <span>{{ $t(lang.nameKey) }}</span>
            </a-menu-item>
          </a-menu>
        </template>
        <a-button
          class="lang-btn lang-btn-ghost"
          type="text"
          :title="$t(currentLanguageDisplay.nameKey)"
        >
          <flag
            :iso="currentLanguageDisplay.countryCode"
            style="font-size: 1.15em; margin-right: 6px"
          />
          <span class="lang-code">{{
            currentLocale.value ? currentLocale.value.toUpperCase() : ""
          }}</span>
        </a-button>
      </a-dropdown>
    </div>
  </a-layout-header>
</template>

<script setup>
import { computed } from "vue";
import { h } from "vue";
import { useI18n } from "vue-i18n";
import { useCurrentLocale, setLocale } from "@/core/i18n";

import { useStore } from "vuex";
import { useRouter } from "vue-router";

import {
  UserOutlined,
  LogoutOutlined,
  DownOutlined,
} from "@ant-design/icons-vue";

import { MENU_KEYS, ROUTES } from "@/core/constants/navigation";
import NotificationBell from "../../../features/notifications/component/NotificationBell.vue";

const { t: $t } = useI18n();
const store = useStore();
const router = useRouter();

const currentLocale = useCurrentLocale();

const availableLanguages = [
  { code: "en", nameKey: "english", countryCode: "us" },
  { code: "vi", nameKey: "vietnamese", countryCode: "vn" },
  { code: "ja", nameKey: "japanese", countryCode: "jp" },
];

const currentLanguageDisplay = computed(() => {
  const lang = availableLanguages.find((l) => l.code === currentLocale.value);
  if (lang) {
    return { ...lang, name: $t(lang.nameKey) };
  }

  const fallbackLang = availableLanguages[0];
  return { ...fallbackLang, name: $t(fallbackLang.nameKey) };
});

const isUserAuthenticated = computed(
  () => store.getters["auth/isAuthenticated"]
);
const actualUser = computed(() => store.getters["auth/user"]);

const displayName = computed(() => {
  if (!actualUser.value) return $t("user");
  return actualUser.value.first_name || actualUser.value.username || $t("user");
});

const userInitial = computed(() => {
  if (
    actualUser.value &&
    (actualUser.value.first_name || actualUser.value.username)
  ) {
    return (actualUser.value.first_name || actualUser.value.username)
      .charAt(0)
      .toUpperCase();
  }
  return null;
});

const menuItems = computed(() => [
  {
    key: MENU_KEYS.PROFILE,
    label: $t("profile"),
    icon: () => h(UserOutlined),
  },
  {
    type: "divider",
  },
  {
    key: MENU_KEYS.LOGOUT,
    label: $t("logout"),
    icon: () => h(LogoutOutlined),
  },
]);

const handleMenuClick = ({ key }) => {
  if (key === MENU_KEYS.LOGOUT) {
    handleLogout();
  } else if (key === MENU_KEYS.PROFILE) {
    router.push(ROUTES.PROFILE);
  }
};

const handleLogout = () => {
  store.dispatch("auth/logout");
};

function changeLanguage(lang) {
  setLocale(lang);
}
</script>

<style scoped>
.app-header-container {
  background: linear-gradient(90deg, #e0f7fa 0%, #f8f9fa 100%);
  padding: 0 32px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  height: 61px;
  color: rgba(0, 0, 0, 0.92);
  border-bottom: 1px solid #e3e8ee;
  position: sticky;
  top: 0;
  z-index: 20;
  box-shadow: 0 2px 12px 0 rgba(0, 0, 0, 0.06);
  border-radius: 0 0 12px 12px;
  transition: box-shadow 0.2s;
}

.logo-title {
  color: var(--brand-primary, #0056b3);
  font-size: 1.7em;
  font-weight: 700;
  letter-spacing: 0.5px;
  text-shadow:
    0 1px 0 #fff,
    0 1.5px 2px #b2ebf2;
  margin-left: 0;
}

.header-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.header-logo {
  height: 38px;
  width: auto;
  display: block;
  margin-right: 6px;
  object-fit: contain;
  transition: height 0.2s;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 28px;
}

.user-profile-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 14px;
  height: 48px;
  border-radius: 8px;
  transition:
    background 0.2s,
    box-shadow 0.2s;
  box-shadow: 0 1px 4px 0 rgba(0, 0, 0, 0.03);
}

.user-profile-trigger:hover {
  background: #e3f2fd;
  box-shadow: 0 2px 8px 0 rgba(0, 0, 0, 0.07);
}

.user-name {
  margin-left: 10px;
  font-weight: 600;
  color: #222;
  white-space: nowrap;
  font-size: 1.08em;
}

.user-arrow {
  font-size: 0.9em;
  margin-left: 7px;
  color: #90a4ae;
}

.role-display {
  font-size: 0.85em;
  opacity: 0.7;
  margin-left: 4px;
  font-weight: 400;
}

/* Nút chọn ngôn ngữ dạng ghost/text */
.lang-btn-ghost {
  background: transparent !important;
  border: none !important;
  box-shadow: none !important;
  color: #1976d2 !important;
  font-weight: 500;
  padding: 0 10px !important;
  height: 38px;
  min-width: 48px;
  display: flex;
  align-items: center;
  transition:
    color 0.18s,
    background 0.18s;
}
.lang-btn-ghost:hover,
.lang-btn-ghost:focus {
  background: #e3f2fd !important;
  color: #0d47a1 !important;
}
.lang-code {
  font-size: 1.08em;
  font-weight: 600;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  margin-left: 2px;
}
:deep(.ant-dropdown-menu) {
  opacity: 1;
  transform: scale(1);
  transition:
    opacity 0.22s cubic-bezier(0.4, 0, 0.2, 1),
    transform 0.22s cubic-bezier(0.4, 0, 0.2, 1);
}
:deep(.ant-slide-down-appear),
:deep(.ant-slide-down-enter) {
  opacity: 0 !important;
  transform: scale(0.96) !important;
}
:deep(.ant-slide-down-appear-active),
:deep(.ant-slide-down-enter-active) {
  opacity: 1 !important;
  transform: scale(1) !important;
}
:deep(.ant-dropdown-menu-item) {
  font-size: 1em;
  padding: 8px 18px;
  display: flex;
  align-items: center;
}
:deep(.ant-dropdown-menu-item-selected),
:deep(.ant-dropdown-menu-item-active) {
  background: #e3f2fd !important;
  color: #1976d2 !important;
}
:deep(.ant-avatar) {
  background: #e3f2fd;
  color: #1976d2;
  font-weight: 700;
  border: 1.5px solid #b3e5fc;
  box-shadow: 0 1px 4px 0 rgba(25, 118, 210, 0.07);
}

/* Hiệu ứng cho NotificationBell nếu cần */
:deep(.notification-bell) {
  transition: color 0.2s;
}
:deep(.notification-bell:hover) {
  color: #1976d2;
}
</style>
