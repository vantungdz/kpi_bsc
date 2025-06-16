<template>
  <a-card class="competency-list-card" bordered>
    <template #title>
      <span><AppstoreOutlined style="margin-right:7px;" />{{ $t('competency.title') }}</span>
    </template>
    <a-row justify="end" style="margin-bottom: 16px">
      <a-button type="default" shape="round" size="middle" class="add-btn" @click="openAddModal">
        <template #icon><PlusOutlined /></template>
        {{ $t('competency.add') }}
      </a-button>
    </a-row>
    <a-table :columns="columns" :dataSource="skills" :loading="loading" rowKey="id" bordered class="competency-table">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'action'">
          <a-tooltip :title="$t('common.edit')">
            <a-button size="small" type="text" @click="openEditModal(record)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm :title="$t('competency.confirmDelete')" :ok-text="$t('common.delete')" :cancel-text="$t('common.cancel')" @confirm="onDelete(record)">
            <a-tooltip :title="$t('common.delete')">
              <a-button size="small" type="text" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
    <a-modal v-model:open="showModal" :title="modalTitle" @ok="handleOk" @cancel="handleCancel" :confirmLoading="saving">
      <a-form :model="form" layout="vertical">
        <a-form-item :label="$t('competency.name')" required>
          <a-input v-model:value="form.name" placeholder="" >
            <template #prefix><StarOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item :label="$t('competency.group')">
          <a-input v-model:value="form.group" placeholder="">
            <template #prefix><ClusterOutlined /></template>
          </a-input>
        </a-form-item>
        <a-form-item :label="$t('competency.description')">
          <a-input v-model:value="form.description" placeholder="">
            <template #prefix><FileTextOutlined /></template>
          </a-input>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useStore } from 'vuex';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { PlusOutlined, EditOutlined, DeleteOutlined, StarOutlined, ClusterOutlined, FileTextOutlined, AppstoreOutlined } from '@ant-design/icons-vue';

const store = useStore();
const { t: $t } = useI18n();
const showModal = ref(false);
const saving = ref(false);
const form = ref({ name: '', group: '', description: '' });
const isEditMode = ref(false);
const editingId = ref(null);

const modalTitle = computed(() => isEditMode.value ? `${$t('competency.editTitle')}` : `${$t('competency.addTitle')}`);

const columns = computed(() => [
  { title: $t('competency.name'), dataIndex: 'name', key: 'name' },
  { title: $t('competency.group'), dataIndex: 'group', key: 'group' },
  { title: $t('competency.description'), dataIndex: 'description', key: 'description' },
  { title: $t('common.actions'), key: 'action' }
]);

const skills = computed(() => store.getters['competency/competencies']);
const loading = computed(() => store.getters['competency/loading']);

onMounted(() => {
  store.dispatch('competency/fetchCompetencies');
});

function openAddModal() {
  isEditMode.value = false;
  editingId.value = null;
  form.value = { name: '', group: '', description: '' };
  showModal.value = true;
}

function openEditModal(record) {
  isEditMode.value = true;
  editingId.value = record.id;
  form.value = { name: record.name, group: record.group, description: record.description };
  showModal.value = true;
}

function handleOk() {
  if (!form.value.name) {
    message.error($t('competency.msgNameRequired'));
    return;
  }
  saving.value = true;
  if (isEditMode.value && editingId.value) {
    store.dispatch('competency/updateCompetency', { id: editingId.value, data: { ...form.value } })
      .then(() => {
        message.success($t('competency.msgUpdateSuccess'));
        showModal.value = false;
        form.value = { name: '', group: '', description: '' };
        isEditMode.value = false;
        editingId.value = null;
      })
      .catch(() => message.error($t('competency.msgError')))
      .finally(() => saving.value = false);
  } else {
    store.dispatch('competency/createCompetency', form.value)
      .then(() => {
        message.success($t('competency.msgAddSuccess'));
        showModal.value = false;
        form.value = { name: '', group: '', description: '' };
      })
      .catch(() => message.error($t('competency.msgError')))
      .finally(() => saving.value = false);
  }
}

function handleCancel() {
  showModal.value = false;
  form.value = { name: '', group: '', description: '' };
  isEditMode.value = false;
  editingId.value = null;
}

function onDelete(record) {
  const id = Number(record.id);
  if (!id || isNaN(id)) {
    message.error($t('competency.msgDeleteIdError'));
    return;
  }
  store.dispatch('competency/deleteCompetency', id)
    .then(() => message.success($t('competency.msgDeleteSuccess')))
    .catch(() => message.error($t('competency.msgDeleteError')));
}
</script>

<style scoped>
.competency-list-card {
  max-width: 900px;
  margin: 32px auto;
  border-radius: 16px;
  box-shadow: 0 2px 16px #e3eaf355;
  padding: 0 0 12px 0;
}
.add-btn {
  min-width: 120px;
  font-weight: 500;
  border-radius: 20px;
  background: #fafdff;
  color: #1976d2;
  border: 1.5px solid #b3d1f7;
  box-shadow: none;
  transition: all 0.18s;
  display: flex;
  align-items: center;
  gap: 6px;
}
.add-btn:hover, .add-btn:focus {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
}
.competency-table {
  border-radius: 10px;
  overflow: hidden;
  box-shadow: 0 2px 8px #e3eaf333;
  margin-bottom: 10px;
}
.competency-table .ant-table-thead > tr > th {
  background: #fafdff;
  color: #1976d2;
  font-weight: 500;
  font-size: 0.98rem;
}
.competency-table .ant-table-tbody > tr:hover > td {
  background: #e3f2fd55;
  transition: background 0.2s;
}
.competency-table .ant-table-tbody > tr > td {
  font-size: 0.97rem;
  padding: 8px 7px;
}
</style>
