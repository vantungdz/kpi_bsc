<template>
    <div>
        <a-button type="primary" @click="showAddModal">{{ $t('addRole') }}</a-button>
        <a-table :dataSource="roleList" :columns="columns" rowKey="id" :loading="loading" style="margin-top: 16px;">
            <template #actions="{ record }">
                <a-space>
                    <a-button type="link" @click="showEditModal(record)">{{ $t('edit') }}</a-button>
                    <a-popconfirm :title="$t('confirmDelete')" @confirm="deleteRole(record.id)">
                        <a-button type="link" danger>{{ $t('delete') }}</a-button>
                    </a-popconfirm>
                </a-space>
            </template>
        </a-table>

        <a-modal :open="modalVisible" :title="editRole ? $t('editRole') : $t('addRole')" @ok="submitForm"
            @cancel="closeModal" :confirm-loading="saving" destroyOnClose>
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
import { ref, onMounted, computed,h } from 'vue';
import { message } from 'ant-design-vue';
import { useStore } from 'vuex';
import { useI18n } from 'vue-i18n';

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