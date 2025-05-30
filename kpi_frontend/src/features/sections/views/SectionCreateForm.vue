<template>
  <a-card class="section-create-form">
    <h2 class="form-title">{{ $t("createSection") }}</h2>
    <a-divider />
    <a-form
      :model="form"
      :rules="rules"
      ref="formRef"
      layout="vertical"
      @finish="handleSubmit"
    >
      <a-row :gutter="16">
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('sectionName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterSectionName')"
            />
          </a-form-item>
        </a-col>
        <a-col :xs="24" :md="12">
          <a-form-item :label="$t('manager')" name="managerId">
            <a-select
              v-model:value="form.managerId"
              :placeholder="$t('selectManager')"
              :options="managerOptions"
              :loading="loadingManagers"
              show-search
              :filter-option="filterManagerOption"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item :label="$t('department')" name="departmentId">
        <a-select
          v-model:value="form.departmentId"
          :placeholder="$t('selectDepartment')"
          :options="departmentOptions"
        />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" html-type="submit" :loading="loading">{{
          $t("create")
        }}</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div>
      <h3 style="margin-bottom: 12px">{{ $t("sectionList") }}</h3>
      <a-table
        :data-source="sectionList"
        :columns="sectionColumns"
        row-key="id"
        size="small"
        :pagination="false"
        bordered
        v-if="sectionList && sectionList.length"
      >
        <template #actions="{ record }">
          <a-button size="small" type="link" @click="() => editSection(record)">{{ $t('edit') }}</a-button>
          <a-popconfirm
            :title="$t('confirmDelete')"
            :ok-text="$t('delete')"
            :cancel-text="$t('cancel')"
            @confirm="() => deleteSection(record)"
          >
            <a-button size="small" type="link" danger>{{ $t('delete') }}</a-button>
          </a-popconfirm>
        </template>
      </a-table>
      <a-empty v-else :description="$t('noSections')" />
    </div>
    <a-modal
      v-model:visible="showEditModal"
      :title="$t('editSection')"
      :confirm-loading="editLoading"
      @ok="handleUpdateSection"
      @cancel="closeEditModal"
      destroy-on-close
    >
      <a-form
        :model="editForm"
        :rules="rules"
        ref="editFormRef"
        layout="vertical"
        @finish="handleUpdateSection"
      >
        <a-row :gutter="16">
          <a-col :xs="24" :md="12">
            <a-form-item :label="$t('sectionName')" name="name">
              <a-input
                v-model:value="editForm.name"
                :placeholder="$t('enterSectionName')"
              />
            </a-form-item>
          </a-col>
          <a-col :xs="24" :md="12">
            <a-form-item :label="$t('manager')" name="managerId">
              <a-select
                v-model:value="editForm.managerId"
                :placeholder="$t('selectManager')"
                :options="managerOptions"
                :loading="loadingManagers"
                show-search
                :filter-option="filterManagerOption"
              />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('department')" name="departmentId">
          <a-select
            v-model:value="editForm.departmentId"
            :placeholder="$t('selectDepartment')"
            :options="departmentOptions"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import { useI18n } from "vue-i18n";
import { message } from "ant-design-vue";
import { useStore } from "vuex";

const { t } = useI18n();
const store = useStore();
const formRef = ref();
const form = ref({ name: "", departmentId: null, managerId: null });
const editFormRef = ref();
const editForm = ref({ id: null, name: '', departmentId: null, managerId: null });
const loading = ref(false);
const editLoading = ref(false);
const departmentOptions = ref([]);
const loadingManagers = ref(false);
const managerOptions = ref([]);
const showEditModal = ref(false);

const rules = {
  name: [
    { required: true, message: t("sectionNameRequired"), trigger: "blur" },
    { min: 2, max: 100, message: t("sectionNameLength"), trigger: "blur" },
  ],
  departmentId: [
    { required: true, message: t("departmentRequired"), trigger: "change" },
  ],
  managerId: [
    { required: true, message: t("managerRequired"), trigger: "change" },
  ],
};

const filterManagerOption = (input, option) => {
  return option.label.toLowerCase().includes(input.toLowerCase());
};

const fetchManagers = async () => {
  loadingManagers.value = true;
  try {
    // Sử dụng filter roles dạng mảng để đồng bộ backend mới
    const users = await store.dispatch("employees/fetchUsers", {
      roles: ["manager"],
      force: true,
    });
    managerOptions.value = (users || []).map((u) => ({
      value: u.id,
      label:
        `${u.first_name || ""} ${u.last_name || ""} (${u.username})`.trim(),
    }));
  } catch (e) {
    managerOptions.value = [];
  } finally {
    loadingManagers.value = false;
  }
};

const fetchDepartments = async () => {
  await store.dispatch("departments/fetchDepartments");
  const departments = store.getters["departments/departmentList"] || [];
  departmentOptions.value = departments.map((d) => ({
    label: d.name,
    value: d.id,
  }));
};

const sectionList = computed(() => store.getters["sections/sectionList"] || []);
const sectionColumns = computed(() => [
  { title: t("sectionName"), dataIndex: "name", key: "name" },
  {
    title: t("department"),
    dataIndex: "departmentName",
    key: "departmentName",
    customRender: ({ record }) => record.department?.name || "",
  },
  {
    title: t("manager"),
    dataIndex: "managerName",
    key: "managerName",
    customRender: ({ record }) => {
      if (record.manager) {
        if (record.manager.first_name || record.manager.last_name) {
          return `${record.manager.first_name || ""} ${record.manager.last_name || ""}`.trim();
        }
        return record.manager.username || "";
      }
      return "";
    },
  },
  {
    title: t("common.actions"),
    key: "actions",
    slots: { customRender: 'actions' },
  },
]);

const editSection = (record) => {
  editForm.value = {
    id: record.id,
    name: record.name,
    departmentId: record.department?.id || null,
    managerId: record.manager?.id || null,
  };
  showEditModal.value = true;
};

const closeEditModal = () => {
  showEditModal.value = false;
  editForm.value = { id: null, name: '', departmentId: null, managerId: null };
  editFormRef.value?.resetFields();
};

const handleUpdateSection = async () => {
  editLoading.value = true;
  try {
    await store.dispatch('sections/updateSection', {
      id: editForm.value.id,
      data: {
        name: editForm.value.name,
        departmentId: editForm.value.departmentId,
        managerId: editForm.value.managerId,
      },
    });
    message.success(t('sectionUpdatedSuccess'));
    closeEditModal();
    await store.dispatch('sections/fetchSections');
  } catch (e) {
    message.error(e?.message || t('sectionUpdatedError'));
  } finally {
    editLoading.value = false;
  }
};

const deleteSection = async (record) => {
  try {
    await store.dispatch("sections/deleteSection", record.id);
    message.success(t("sectionDeletedSuccess"));
    await store.dispatch("sections/fetchSections");
  } catch (e) {
    message.error(e?.message || t("sectionDeletedError"));
  }
};

onMounted(async () => {
  await Promise.all([fetchManagers(), fetchDepartments()]);
  await store.dispatch("sections/fetchSections");
});

const handleSubmit = async () => {
  loading.value = true;
  try {
    // Gọi API tạo section thực sự
    await store.dispatch("sections/createSection", {
      name: form.value.name,
      departmentId: form.value.departmentId,
      managerId: form.value.managerId,
    });
    message.success(t("sectionCreatedSuccess"));
    form.value = { name: "", departmentId: null, managerId: null };
    formRef.value?.resetFields();
    await store.dispatch("sections/fetchSections");
  } catch (e) {
    message.error(e?.message || t("sectionCreatedError"));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.section-create-form {
  margin: 0 auto;
  background: #fff;
  border-radius: 18px;
  box-shadow: 0 4px 24px #e6f7ff55;
  padding: 36px 32px 24px 32px;
  transition: box-shadow 0.2s;
}
.form-title {
  font-size: 1.5rem;
  font-weight: 600;
  margin-bottom: 0.5em;
  text-align: center;
  letter-spacing: 0.5px;
}
.ant-form-item {
  margin-bottom: 18px;
}
</style>
