<template>
  <div class="user-profile-container">
    <LoadingOverlay :visible="!user" />
    <a-card :title="$t('accountInformation')" v-if="user">
      <a-row :gutter="[16, 24]">
        <a-col :xs="24" :sm="24" :md="8" :lg="6" style="text-align: center">
          <a-avatar :size="128" :src="user.avatar_url">
            <template #icon>
              <span v-if="userInitial" class="avatar-initials">{{
                userInitial
              }}</span>
              <UserOutlined v-else />
            </template>
          </a-avatar>
          <h2 class="user-profile-name">{{ fullName }}</h2>
          <p class="user-profile-username">@{{ user.username }}</p>
        </a-col>
        <a-col :xs="24" :sm="24" :md="16" :lg="18">
          <a-descriptions
            bordered
            :column="{ xxl: 2, xl: 2, lg: 1, md: 1, sm: 1, xs: 1 }"
          >
            <a-descriptions-item :label="$t('fullName')">{{
              fullName
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('username')">{{
              user.username
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('email')">{{
              user.email || $t("notUpdated")
            }}</a-descriptions-item>
            <a-descriptions-item
              :label="$t('roles')"
              :span="2"
              v-if="userRoles.length"
            >
              <a-tag
                v-for="role in userRoles"
                :key="role.id || role.name"
                color="blue"
                style="margin-right: 8px"
                :title="role.description"
              >
                {{ role.name }}
              </a-tag>
            </a-descriptions-item>
            <a-descriptions-item :label="$t('department')">{{
              user.department?.name || $t("notUpdated")
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('section')">{{
              user.section?.name || $t("notUpdated")
            }}</a-descriptions-item>
            <a-descriptions-item :label="$t('dateJoined')">
              {{
                user.updated_at
                  ? formatDate(user.updated_at)
                  : $t("noInformation")
              }}
            </a-descriptions-item>
          </a-descriptions>
        </a-col>
      </a-row>
    </a-card>
    <a-empty v-else :description="$t('userNotFoundOrNotLoggedIn')" />

    <div style="display: flex; justify-content: flex-end;">
      <a-button type="default" style="margin-top: 15px; margin-bottom: 15px;" @click="goBack">
        {{ $t("back") }}
      </a-button>
    </div>
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useStore } from "vuex";
import { UserOutlined } from "@ant-design/icons-vue";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { useNavigation } from "@/core/utils/navigation";
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Avatar as AAvatar,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Tag as ATag,
  Empty as AEmpty,
} from "ant-design-vue";
import { getFullName } from "@/core/utils/format";

const store = useStore();
const { goBack } = useNavigation();

const user = computed(() => store.getters["auth/user"]);

const userRoles = computed(() => {
  if (!user.value) return [];
  if (Array.isArray(user.value.roles)) {
    return user.value.roles.filter((role) => role && role.name);
  }
  if (user.value.role) {
    if (typeof user.value.role === "object" && user.value.role?.name) {
      return [user.value.role];
    }
    if (typeof user.value.role === "string") {
      return [{ name: user.value.role }];
    }
  }
  return [];
});

const fullName = computed(() => {
  if (!user.value) return "";
  return getFullName(user.value) || user.value.username;
});

const userInitial = computed(() => {
  if (user.value) {
    if (user.value.first_name) {
      return user.value.first_name.charAt(0).toUpperCase();
    } else if (user.value.username) {
      return user.value.username.charAt(0).toUpperCase();
    }
  }
  return null;
});

const formatDate = (dateString) => {
  if (!dateString) return "";
  const options = { year: "numeric", month: "long", day: "numeric" };
  return new Date(dateString).toLocaleDateString(undefined, options);
};
</script>

<style scoped>
.user-profile-container {
  padding: 24px;
  background-color: #f0f2f5;
  min-height: calc(100vh - 64px); /* Adjust based on your header height */
}

.avatar-initials {
  font-size: 64px; /* Adjust size as needed */
  color: #fff; /* Ensure visibility if avatar background is dark */
}

.user-profile-name {
  margin-top: 16px;
  font-size: 1.5em;
  font-weight: 600;
}

.user-profile-username {
  color: #888;
  margin-bottom: 20px;
}

:deep(.ant-descriptions-item-label) {
  font-weight: 500;
}
</style>
