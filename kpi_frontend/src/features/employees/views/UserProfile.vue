<template>
    <div class="user-profile-container">
        <a-card :title="$t('accountInformation')" :loading="!user" v-if="user">
            <a-row :gutter="[16, 24]">
                <a-col :xs="24" :sm="24" :md="8" :lg="6" style="text-align: center;">
                    <a-avatar :size="128" :src="user.avatar_url">
                        <template #icon>
                            <span v-if="userInitial" class="avatar-initials">{{ userInitial }}</span>
                            <UserOutlined v-else />
                        </template>
                    </a-avatar>
                    <h2 class="user-profile-name">{{ fullName }}</h2>
                    <p class="user-profile-username">@{{ user.username }}</p>
                </a-col>
                <a-col :xs="24" :sm="24" :md="16" :lg="18">
                    <a-descriptions bordered :column="{ xxl: 2, xl: 2, lg: 1, md: 1, sm: 1, xs: 1 }">
                        <a-descriptions-item :label="$t('fullName')">{{ fullName }}</a-descriptions-item>
                        <a-descriptions-item :label="$t('username')">{{ user.username }}</a-descriptions-item>
                        <a-descriptions-item :label="$t('email')">{{ user.email || $t('notUpdated') }}</a-descriptions-item>
                        <a-descriptions-item :label="$t('currentRole')">
                            <a-tag color="blue">{{ effectiveRole || $t('noRole') }}</a-tag>
                        </a-descriptions-item>
                        <a-descriptions-item :label="$t('allRoles')" :span="2" v-if="user.roles && user.roles.length">
                            <a-tag v-for="role in user.roles" :key="role" color="geekblue" style="margin-right: 8px;">
                                {{ role }}
                            </a-tag>
                        </a-descriptions-item>
                        <a-descriptions-item :label="$t('department')">{{ user.department?.name || $t('notUpdated') }}</a-descriptions-item>
                        <a-descriptions-item :label="$t('section')">{{ user.section?.name || $t('notUpdated') }}</a-descriptions-item>
                        <a-descriptions-item :label="$t('dateJoined')">
                            {{ user.date_joined ? formatDate(user.date_joined) : $t('noInformation') }}
                        </a-descriptions-item>
                    </a-descriptions>
                </a-col>
            </a-row>
        </a-card>
        <a-empty v-else :description="$t('userNotFoundOrNotLoggedIn')" />
    </div>
</template>

<script setup>
import { computed } from 'vue';
import { useStore } from 'vuex';
import { UserOutlined } from '@ant-design/icons-vue';
import {
  Card as ACard,
  Row as ARow,
  Col as ACol,
  Avatar as AAvatar,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Tag as ATag,
  Empty as AEmpty,
} from 'ant-design-vue';

const store = useStore();

const user = computed(() => store.getters['auth/user']);
const effectiveRole = computed(() => store.getters['auth/effectiveRole']);

const fullName = computed(() => {
  if (!user.value) return '';
  const firstName = user.value.first_name || '';
  const lastName = user.value.last_name || '';
  return `${firstName} ${lastName}`.trim() || user.value.username;
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
  if (!dateString) return '';
  const options = { year: 'numeric', month: 'long', day: 'numeric' };
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