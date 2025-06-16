<template>
  <div class="role-manager-modern">
    <a-card class="role-header-card" bordered>
      <template #title>
        <div class="role-header-flex">
          <span style="display:flex;align-items:center;gap:8px;">
            <team-outlined style="color:#2563eb;font-size:22px;" />
            <span>{{ $t('roleManagement') }}</span>
          </span>
          <a-button type="primary" @click="showAddModal">
            <template #icon><plus-outlined /></template>
            {{ $t('addRole') }}
          </a-button>
        </div>
      </template>
      <a-table :dataSource="roleList" :columns="columns" rowKey="id" :loading="loading" class="role-table-modern" style="margin-top: 16px;">
        <template #actions="{ record }">
          <a-space>
            <a-button type="link" @click="showEditModal(record)"><edit-outlined /> {{ $t('edit') }}</a-button>
            <a-popconfirm :title="$t('confirmDelete')" @confirm="deleteRole(record.id)">
              <a-button type="link" danger><delete-outlined /> {{ $t('delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </a-table>
    </a-card>
    <a-modal :open="modalVisible" :title="editRole ? $t('editRole') : $t('addRole')" @ok="submitForm"
      @cancel="closeModal" :confirm-loading="saving" destroyOnClose class="role-modal-modern">
      <a-form :model="roleForm" ref="roleFormRef" layout="vertical" :rules="formRules">
        <a-form-item :label="$t('roleName')" name="name">
          <a-input v-model:value="roleForm.name" />
        </a-form-item>
        <a-form-item :label="$t('description')" name="description">
          <a-input v-model:value="roleForm.description" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, h } from 'vue';
import { message } from 'ant-design-vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';
import { TeamOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from '@ant-design/icons-vue';

const store = useStore();
const { t } = useI18n();

const loading = computed(() => store.getters['roles/isLoading']);
const roleList = computed(() => store.getters['roles/roleList']);
const saving = ref(false);
const modalVisible = ref(false);
const editRole = ref(null);
const roleForm = ref({ name: '', description: '' });
const roleFormRef = ref();
const formRules = {
    name: [{ required: true, message: t('roleNameRequired') }],
};

const columns = computed(() =>[
    { title: t('roleName'), dataIndex: 'name', key: 'name' },
    { title: t('description'), dataIndex: 'description', key: 'description' },
    {
        title: t('actions'),
        key: 'actions',
        customRender: ({ record }) => ({
            children: h('span', [
                h('a', { onClick: () => showEditModal(record) }, t('edit')),
                h('a', {
                    style: { color: 'red', marginLeft: '8px' },
                    onClick: () => deleteRole(record.id)
                }, t('delete'))
            ])
        })
    }
]);

const fetchRoles = async () => {
    await store.dispatch('roles/fetchRoles');
};

const showAddModal = () => {
    editRole.value = null;
    roleForm.value = { name: '', description: '' };
    modalVisible.value = true;
};

const showEditModal = (role) => {
    editRole.value = role;
    roleForm.value = { name: role.name, description: role.description };
    modalVisible.value = true;
};

const closeModal = () => {
    modalVisible.value = false;
    editRole.value = null;
};

const submitForm = async () => {
    try {
        await roleFormRef.value.validate();
    } catch (validationError) {
        return;
    }
    saving.value = true;
    try {
        if (editRole.value) {
            await store.dispatch('roles/updateRole', { id: editRole.value.id, ...roleForm.value });
            message.success('Role updated successfully');
        } else {
            await store.dispatch('roles/createRole', roleForm.value);
            message.success('Role created successfully');
        }
        closeModal();
        fetchRoles();
    } catch (e) {
        message.error(e?.response?.data?.message || e?.message || 'Error');
    } finally {
        saving.value = false;
    }
};

const deleteRole = async (id) => {
    try {
        await store.dispatch('roles/deleteRole', id);
        message.success('Role deleted successfully');
        fetchRoles();
    } catch (e) {
        message.error(e?.response?.data?.message || e?.message || 'Error');
    }
};

onMounted(fetchRoles);
</script>

<style scoped>
.role-manager-modern {
  padding: 24px;
  background: #f6f8fa;
  min-height: 100vh;
}
.role-header-card {
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.04);
  margin: 32px auto 0 auto;
}
.role-table-modern .ant-table-thead > tr > th {
  background: #f1f5f9;
  font-weight: 600;
  font-size: 15px;
  color: #334155;
  border-bottom: 1.5px solid #e5e7eb;
}
.role-table-modern .ant-table-tbody > tr > td {
  font-size: 14px;
  color: #22223b;
  padding: 8px 12px;
}
.role-modal-modern .ant-modal-content {
  border-radius: 14px;
  background: #f9fafb;
}
.role-header-flex {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
}
</style>