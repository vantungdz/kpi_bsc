<template>
  <a-layout-header class="app-header-container">
    <div class="header-left">
      <div class="logo-title">{{ $t("kpiDashboard") }}</div>
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
            <span class="role-display"> ({{ userRoleDisplay }})</span>
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
        <a-button>
          <flag
            :iso="currentLanguageDisplay.countryCode"
            style="margin-right: 8px; font-size: 1.2em"
          />
          {{ currentLanguageDisplay.name }}
          <DownOutlined />
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
  SettingOutlined,
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
  { code: "en", nameKey: "english", countryCode: "us" }, // Sử dụng cờ Mỹ cho tiếng Anh
  { code: "vi", nameKey: "vietnamese", countryCode: "vn" },
  { code: "ja", nameKey: "japanese", countryCode: "jp" },
];

const currentLanguageDisplay = computed(() => {
  const lang = availableLanguages.find((l) => l.code === currentLocale.value);
  if (lang) {
    return { ...lang, name: $t(lang.nameKey) };
  }
  // Fallback nếu currentLocale không nằm trong availableLanguages
  // Điều này không nên xảy ra nếu locale được quản lý đúng cách
  const fallbackLang = availableLanguages[0]; // Hoặc một ngôn ngữ mặc định cụ thể
  return { ...fallbackLang, name: $t(fallbackLang.nameKey) };
});

const isUserAuthenticated = computed(
  () => store.getters["auth/isAuthenticated"]
);
const actualUser = computed(() => store.getters["auth/user"]);

// Lấy mảng roles từ user, fallback nếu chưa có
const userRoles = computed(() => {
  if (!actualUser.value) return [];
  // Chuẩn hóa: roles là mảng string hoặc mảng object {name}
  if (Array.isArray(actualUser.value.roles)) {
    return actualUser.value.roles
      .map((r) => (typeof r === "string" ? r : r?.name))
      .filter(Boolean);
  }
  // Fallback: nếu backend trả về role đơn lẻ
  if (actualUser.value.role) {
    if (typeof actualUser.value.role === "string")
      return [actualUser.value.role];
    if (
      typeof actualUser.value.role === "object" &&
      actualUser.value.role?.name
    )
      return [actualUser.value.role.name];
  }
  return [];
});

const roleLabelMap = computed(() => ({
  admin: $t("roleAdmin"),
  manager: $t("roleManager"),
  department: $t("roleDepartment"),
  section: $t("roleSection"),
  employee: $t("roleEmployee"),
}));

// Hiển thị tất cả roles, phân cách bằng dấu phẩy
const userRoleDisplay = computed(() => {
  if (!userRoles.value.length) return $t("noRole");
  return userRoles.value.map((r) => roleLabelMap.value[r] || r).join(", ");
});

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
    key: MENU_KEYS.SETTINGS,
    label: $t("settings"),
    icon: () => h(SettingOutlined),
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
  } else if (key === MENU_KEYS.SETTINGS) {
    router.push(ROUTES.SETTINGS);
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

.logo-title {
  color: var(--brand-primary, #0056b3);
  font-size: 1.4em;
  font-weight: 600;
}

.header-right {
  display: flex;
  align-items: center;
  gap: 20px;
  /* Tăng khoảng cách để chứa NotificationBell */
}

/* Loại bỏ .role-selector và .role-label nếu không còn sử dụng */
.user-profile-trigger {
  display: flex;
  align-items: center;
  cursor: pointer;
  padding: 0 12px;
  height: 100%;
  transition: background-color 0.3s;
  border-radius: 4px;
}

.user-profile-trigger:hover {
  background-color: rgba(0, 0, 0, 0.025);
}

.user-name {
  margin-left: 8px;
  font-weight: 500;
  color: rgba(0, 0, 0, 0.85);
  white-space: nowrap;
}

.user-arrow {
  font-size: 0.8em;
  margin-left: 5px;
  color: rgba(0, 0, 0, 0.45);
}

.role-display {
  font-size: 0.8em;
  opacity: 0.7;
  margin-left: 4px;
  font-weight: 400;
}
</style>
