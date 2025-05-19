<template>
  <div class="user-role-manager">
    <h2>{{ $t('userRoleManagement') }}</h2>
    <a-table :dataSource="users" :columns="columns" rowKey="id" :loading="loading" bordered>
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'role'">
          <a-select v-model:value="record.roleName" style="width: 140px" @change="role => onRoleChange(record, role)">
            <a-select-option v-for="role in roles" :key="role.value" :value="role.value">
              {{ $t(role.label) }}
            </a-select-option>
          </a-select>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';

const { t } = useI18n();
const store = useStore();
const users = ref([]);
const loading = ref(false);
const roles = [
  { value: 'admin', label: 'admin' },
  { value: 'manager', label: 'manager' },
  { value: 'department', label: 'department' },
  { value: 'section', label: 'section' },
  { value: 'employee', label: 'employee' },
];

const columns = computed(() => [
  { title: t('username'), dataIndex: 'username', key: 'username' },
  { title: t('emailAddress'), dataIndex: 'email', key: 'email' },
  { title: t('role'), dataIndex: 'role', key: 'role', scopedSlots: { customRender: 'role' } },
]);

const fetchUsers = async () => {
  loading.value = true;
  try {
    const rawUsers = await store.dispatch('employees/fetchUsers', { force: true });
    // Chuẩn hóa: thêm trường roleName cho binding select (role entity)
    users.value = (rawUsers || []).map(u => ({
      ...u,
      roleName: u.role?.name || '', // role entity name
    }));
  } catch (e) {
    message.error(t('errorLoadingUsers'));
  } finally {
    loading.value = false;
  }
};

const onRoleChange = async (user, newRole) => {
  loading.value = true;
  try {
    await store.dispatch('employees/updateUserRole', { id: user.id, role: newRole });
    message.success(t('roleUpdatedSuccessfully'));
    fetchUsers();
  } catch (e) {
    message.error(t('errorUpdatingRole'));
  } finally {
    loading.value = false;
  }
};

onMounted(fetchUsers);
</script>

<style scoped>
.user-role-manager {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
}
</style>
