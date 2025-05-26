<template>
  <a-card class="department-create-form">
    <h2 class="form-title">{{ $t("createDepartment") }}</h2>
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
          <a-form-item :label="$t('departmentName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterDepartmentName')"
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
      <a-form-item>
        <a-button type="primary" html-type="submit" :loading="loading">{{
          $t("create")
        }}</a-button>
      </a-form-item>
    </a-form>
    <a-divider />
    <div>
      <h3 style="margin-bottom: 12px">{{ $t("departmentList") }}</h3>
      <a-table
        :data-source="departmentList"
        :columns="departmentColumns"
        row-key="id"
        size="small"
        :pagination="false"
        bordered
        v-if="departmentList && departmentList.length"
      />
      <a-empty v-else :description="$t('noDepartments')" />
    </div>
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
const form = ref({ name: "", managerId: null });
const loading = ref(false);
const loadingManagers = ref(false);
const managerOptions = ref([]);

const rules = {
  name: [
    { required: true, message: t("departmentNameRequired"), trigger: "blur" },
    { min: 2, max: 100, message: t("departmentNameLength"), trigger: "blur" },
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
    // Truyền filter roles: ['manager'] để đồng bộ backend multi-role
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

const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const departmentColumns = computed(() => [
  { title: t("departmentName"), dataIndex: "name", key: "name" },
  {
    title: t("manager"),
    dataIndex: "managerName",
    key: "managerName",
    customRender: ({ record }) =>
      record.manager?.first_name
        ? `${record.manager.first_name} ${record.manager.last_name}`
        : "",
  },
]);

onMounted(async () => {
  await fetchManagers();
  await store.dispatch("departments/fetchDepartments");
});

const handleSubmit = async () => {
  loading.value = true;
  try {
    await store.dispatch("departments/createDepartment", {
      name: form.value.name,
      managerId: form.value.managerId,
    });
    message.success(t("departmentCreatedSuccess"));
    form.value = { name: "", managerId: null };
    formRef.value?.resetFields();
    await store.dispatch("departments/fetchDepartments");
  } catch (e) {
    message.error(e?.message || t("departmentCreatedError"));
  } finally {
    loading.value = false;
  }
};
</script>

<style scoped>
.department-create-form {
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
