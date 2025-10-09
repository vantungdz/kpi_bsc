<template>
  <a-card class="employee-skill-card" bordered>
    <template #title>
      <span
        ><TeamOutlined style="margin-right: 7px" />{{
          $t("employeeSkill.title")
        }}</span
      >
    </template>
    <a-row
      justify="center"
      align="middle"
      :gutter="16"
      style="margin-bottom: 24px"
    >
      <a-col :span="6">
        <a-select
          v-model:value="selectedDepartmentId"
          :options="departmentOptions"
          :placeholder="$t('employeeSkill.departmentPlaceholder')"
          allow-clear
          show-search
          style="width: 100%"
          :filter-option="filterEmployee"
        >
          <template #suffixIcon><ApartmentOutlined /></template>
        </a-select>
      </a-col>
      <a-col :span="6">
        <a-select
          v-model:value="selectedSectionId"
          :options="sectionOptions"
          :placeholder="$t('employeeSkill.sectionPlaceholder')"
          allow-clear
          show-search
          style="width: 100%"
          :filter-option="filterEmployee"
          :disabled="!selectedDepartmentId"
        >
          <template #suffixIcon><ClusterOutlined /></template>
        </a-select>
      </a-col>
      <a-col :span="8">
        <a-select
          v-model:value="selectedEmployeeId"
          :options="employeeOptions"
          :placeholder="$t('employeeSkill.employeePlaceholder')"
          show-search
          style="width: 100%"
          :filter-option="filterEmployee"
          :disabled="false"
        >
          <template #suffixIcon><UserOutlined /></template>
        </a-select>
      </a-col>
      <a-col :span="4" style="text-align: left">
        <a-button
          type="default"
          shape="round"
          :disabled="!selectedEmployeeId"
          @click="openAddModal"
          class="add-btn"
        >
          <template #icon><PlusOutlined /></template>
          {{ $t("employeeSkill.add") }}
        </a-button>
      </a-col>
    </a-row>
    <a-table
      :columns="columns"
      :dataSource="employeeSkills"
      :loading="loading"
      rowKey="id"
      bordered
      v-if="selectedEmployeeId"
      :pagination="false"
      class="custom-skill-table"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'level'">
          <div style="text-align: center">
            <a-rate
              v-model:value="record.level"
              :count="5"
              allow-half
              disabled
            />
          </div>
        </template>
        <template v-else-if="column.key === 'action'">
          <a-tooltip :title="$t('common.edit')">
            <a-button size="small" type="text" @click="openEditModal(record)">
              <template #icon><EditOutlined /></template>
            </a-button>
          </a-tooltip>
          <a-popconfirm
            :title="$t('employeeSkill.confirmDelete')"
            :ok-text="$t('common.delete')"
            :cancel-text="$t('common.cancel')"
            @confirm="onDelete(record)"
          >
            <a-tooltip :title="$t('common.delete')">
              <a-button size="small" type="text" danger>
                <template #icon><DeleteOutlined /></template>
              </a-button>
            </a-tooltip>
          </a-popconfirm>
        </template>
      </template>
    </a-table>
    <div v-else style="margin: 48px 0 32px 0; text-align: center">
      <a-empty :description="$t('employeeSkill.emptyText')" />
    </div>
    <a-modal
      v-model:open="showModal"
      :title="modalTitle"
      @ok="handleOk"
      @cancel="handleCancel"
      :confirmLoading="saving"
    >
      <a-form :model="form" layout="vertical">
        <a-form-item :label="$t('employeeSkill.skill')" required>
          <a-select
            v-model:value="form.skillIds"
            :options="skillOptions"
            :placeholder="$t('employeeSkill.skillPlaceholder')"
            mode="multiple"
            :disabled="isEditMode"
            style="width: 100%"
          >
            <template #suffixIcon><StarOutlined /></template>
          </a-select>
        </a-form-item>
        <a-form-item
          v-if="form.skillIds.length > 0"
          :label="$t('employeeSkill.levelLabel')"
          required
        >
          <div
            v-for="skillId in form.skillIds"
            :key="skillId"
            style="display: flex; align-items: center; margin-bottom: 8px"
          >
            <span style="min-width: 120px"
              ><StarOutlined style="margin-right: 4px; color: #faad14" />{{
                skillOptions.find((s) => s.value === skillId)?.label
              }}</span
            >
            <a-rate
              v-model:value="form.levels[skillId]"
              :count="5"
              allow-half
              style="margin-left: 16px"
            />
          </div>
        </a-form-item>
        <a-form-item :label="$t('employeeSkill.note')">
          <a-input v-model:value="form.note" placeholder="">
            <template #prefix><FileTextOutlined /></template>
          </a-input>
        </a-form-item>
      </a-form>
    </a-modal>
  </a-card>
</template>

<script setup>
import { ref, computed, onMounted, watch } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import {
  ApartmentOutlined,
  ClusterOutlined,
  UserOutlined,
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  StarOutlined,
  FileTextOutlined,
  TeamOutlined,
} from "@ant-design/icons-vue";

const store = useStore();
const { t: $t } = useI18n();
const showModal = ref(false);
const saving = ref(false);
const isEditMode = ref(false);
const editingId = ref(null);
const selectedEmployeeId = ref(null);
const selectedDepartmentId = ref(null);
const selectedSectionId = ref(null);

const form = ref({ skillIds: [], levels: {}, note: "" });

const columns = computed(() => [
  {
    title: $t("employeeSkill.skill"),
    dataIndex: "skillName",
    key: "skillName",
  },
  { title: $t("employeeSkill.group"), dataIndex: "group", key: "group" },
  { title: $t("employeeSkill.level"), key: "level" },
  { title: $t("employeeSkill.note"), dataIndex: "note", key: "note" },
  { title: $t("common.actions"), key: "action" },
]);

const departmentOptions = computed(
  () =>
    store.getters["departments/departmentList"]?.map((d) => ({
      label: d.name,
      value: d.id,
    })) || []
);
const sectionOptions = computed(() => {
  if (!selectedDepartmentId.value) return [];
  return (
    store.getters["sections/sectionsByDepartment"](
      selectedDepartmentId.value
    )?.map((s) => ({ label: s.name, value: s.id })) || []
  );
});
const employeeOptions = computed(() => {
  if (selectedSectionId.value) {
    return (
      store.getters["employees/usersBySection"](selectedSectionId.value)?.map(
        (u) => ({ label: `${u.first_name} ${u.last_name}`, value: u.id })
      ) || []
    );
  } else if (selectedDepartmentId.value) {
    return (
      store.getters["employees/usersByDepartment"](
        selectedDepartmentId.value
      )?.map((u) => ({
        label: `${u.first_name} ${u.last_name}`,
        value: u.id,
      })) || []
    );
  } else {
    return store.getters["employees/employeeOptions"] || [];
  }
});
const skillOptions = computed(() => {
  const skills = store.getters["competency/competencies"] || [];

  if (!isEditMode.value && employeeSkills.value.length > 0) {
    const existingSkillIds = employeeSkills.value.map((s) => s.skillId);
    return skills
      .filter((s) => !existingSkillIds.includes(s.id))
      .map((s) => ({ label: s.name, value: s.id, group: s.group }));
  }
  return skills.map((s) => ({ label: s.name, value: s.id, group: s.group }));
});
const loading = computed(() => store.getters["employeeSkill/loading"]);
const employeeSkills = computed(
  () =>
    store.getters["employeeSkill/skillsByEmployee"][selectedEmployeeId.value] ||
    []
);
const modalTitle = computed(() =>
  isEditMode.value
    ? `${$t("employeeSkill.editTitle")}`
    : `${$t("employeeSkill.addTitle")}`
);

onMounted(() => {
  store.dispatch("departments/fetchDepartments");
  store.dispatch("sections/fetchSections");
  store.dispatch("employees/fetchUsers");
  store.dispatch("competency/fetchCompetencies");
});

watch(selectedDepartmentId, (id) => {
  selectedSectionId.value = null;
  if (id) {
    store.dispatch("sections/fetchSectionsByDepartment", id);

    store.dispatch("employees/fetchUsersByDepartment", id);
  }
});
watch(selectedSectionId, (id) => {
  selectedEmployeeId.value = null;
  if (id) store.dispatch("employees/fetchUsersBySection", id);
});
watch(selectedEmployeeId, (id) => {
  if (id) store.dispatch("employeeSkill/fetchSkillsByEmployee", id);
});
watch(
  () => form.value.skillIds,
  (newSkillIds) => {
    const newLevels = {};
    newSkillIds.forEach((id) => {
      newLevels[id] = form.value.levels[id] || 3;
    });
    form.value.levels = newLevels;
  }
);

function filterEmployee(input, option) {
  return option.label.toLowerCase().includes(input.toLowerCase());
}

function openAddModal() {
  isEditMode.value = false;
  editingId.value = null;
  form.value = { skillIds: [], levels: {}, note: "" };
  showModal.value = true;
}

function openEditModal(record) {
  isEditMode.value = true;
  editingId.value = record.id;
  form.value = {
    skillIds: [record.skillId],
    levels: { [record.skillId]: record.level },
    note: record.note,
  };
  showModal.value = true;
}

function handleOk() {
  if (!form.value.skillIds || form.value.skillIds.length === 0) {
    message.error($t("employeeSkill.msgSkillRequired"));
    return;
  }
  for (const skillId of form.value.skillIds) {
    if (!form.value.levels[skillId]) {
      message.error($t("employeeSkill.msgLevelRequired"));
      return;
    }
  }
  saving.value = true;
  if (isEditMode.value) {
    const skillId = form.value.skillIds[0];
    store
      .dispatch("employeeSkill/updateEmployeeSkill", {
        id: editingId.value,
        data: {
          employeeId: selectedEmployeeId.value,
          level: form.value.levels[skillId],
          note: form.value.note,
        },
      })
      .then(() => {
        message.success($t("employeeSkill.msgUpdateSuccess"));
        showModal.value = false;
        store.dispatch(
          "employeeSkill/fetchSkillsByEmployee",
          selectedEmployeeId.value
        );
      })
      .catch(() => message.error($t("employeeSkill.msgError")))
      .finally(() => (saving.value = false));
  } else {
    const addSkillPromises = form.value.skillIds.map((skillId) =>
      store.dispatch("employeeSkill/addEmployeeSkill", {
        employeeId: selectedEmployeeId.value,
        skillId,
        level: form.value.levels[skillId],
        note: form.value.note,
      })
    );
    Promise.all(addSkillPromises)
      .then(() => {
        message.success($t("employeeSkill.msgAddSuccess"));
        showModal.value = false;
        store.dispatch(
          "employeeSkill/fetchSkillsByEmployee",
          selectedEmployeeId.value
        );
      })
      .catch(() => message.error($t("employeeSkill.msgError")))
      .finally(() => (saving.value = false));
  }
}

function handleCancel() {
  showModal.value = false;
  form.value = { skillIds: [], levels: {}, note: "" };
  isEditMode.value = false;
  editingId.value = null;
}

function onDelete(record) {
  store
    .dispatch("employeeSkill/deleteEmployeeSkill", record.id)
    .then(() => {
      message.success($t("employeeSkill.msgDeleteSuccess"));
      store.dispatch(
        "employeeSkill/fetchSkillsByEmployee",
        selectedEmployeeId.value
      );
    })
    .catch(() => message.error($t("employeeSkill.msgDeleteError")));
}
</script>

<style scoped>
.employee-skill-card {
  max-width: 950px;
  margin: 32px auto;
  background: #fff;
  box-shadow: 0 2px 8px #f0f1f2;
  border-radius: 16px;
  padding-bottom: 12px;
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
.add-btn:hover,
.add-btn:focus {
  background: #e3f2fd;
  color: #1565c0;
  border-color: #90caf9;
}
.custom-skill-table .ant-table-thead > tr > th {
  background: #f5f7fa;
  font-weight: 600;
  text-align: center;
}
.custom-skill-table .ant-table-tbody > tr > td {
  vertical-align: middle;
}
.custom-skill-table .ant-table-tbody > tr > td:nth-child(3) {
  text-align: center;
}
</style>
