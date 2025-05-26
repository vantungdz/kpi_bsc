<template>
  <div v-if="canViewRoleManager" class="user-role-manager">
    <h2>{{ $t("userRoleManagement") }}</h2>
    <a-table
      :dataSource="users"
      :columns="columns"
      rowKey="id"
      :loading="loading"
      bordered
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'role'">
          <a-select
            v-model:value="record.roleNames"
            mode="multiple"
            style="width: 220px"
            :disabled="!canUpdateRole"
            @change="(roles) => onRoleChange(record, roles)"
          >
            <a-select-option
              v-for="role in roles"
              :key="role.value"
              :value="role.value"
            >
              {{ $t(role.label) }}
            </a-select-option>
          </a-select>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

const { t } = useI18n();
const store = useStore();
const users = ref([]);
const loading = ref(false);
const roles = [
  { value: "admin", label: "admin" },
  { value: "manager", label: "manager" },
  { value: "department", label: "department" },
  { value: "section", label: "section" },
  { value: "employee", label: "employee" },
];

const columns = computed(() => [
  { title: t("username"), dataIndex: "username", key: "username" },
  { title: t("emailAddress"), dataIndex: "email", key: "email" },
  {
    title: t("role"),
    dataIndex: "role",
    key: "role",
    scopedSlots: { customRender: "role" },
  },
]);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const rawUsers = await store.dispatch("employees/fetchUsers", {
      force: true,
    });
    // Chuẩn hóa: thêm trường roleNames cho binding multi-select
    users.value = (rawUsers || []).map((u) => ({
      ...u,
      roleNames: Array.isArray(u.roles)
        ? u.roles
            .map((r) => (typeof r === "string" ? r : r?.name))
            .filter(Boolean)
        : [],
    }));
  } catch (e) {
    message.error(t("errorLoadingUsers"));
  } finally {
    loading.value = false;
  }
};

const onRoleChange = async (user, newRoles) => {
  loading.value = true;
  try {
    await store.dispatch("employees/updateUserRoles", {
      id: user.id,
      roles: newRoles,
    });
    message.success(t("roleUpdatedSuccessfully"));
    fetchUsers();
  } catch (e) {
    message.error(t("errorUpdatingRole"));
  } finally {
    loading.value = false;
  }
};

const user = computed(() => store.getters["auth/user"] || {});
const userPermissions = computed(() => user.value.permissions || []);
function hasPermission(action, resource) {
  return userPermissions.value?.some(
    (p) => p.action === action && p.resource === resource
  );
}
const canViewRoleManager = computed(() =>
  hasPermission(RBAC_ACTIONS.VIEW, RBAC_RESOURCES.ROLE_COMPANY)
);
const canUpdateRole = computed(() =>
  hasPermission(RBAC_ACTIONS.UPDATE, RBAC_RESOURCES.ROLE_COMPANY)
);

onMounted(fetchUsers);
</script>

<style scoped>
.user-role-manager {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
}
</style>
