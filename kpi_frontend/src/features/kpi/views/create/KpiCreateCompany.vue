<template>
  <div v-if="canAccessCreatePage">
    <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical" @finish="handleChangeCreate"
      @finishFailed="onFinishFailed">
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item :label="$t('useExistingKpiTemplate')" name="templateKpi">
            <a-select v-model:value="selectedTemplateKpiId" :placeholder="$t('selectKpiTemplate')" show-search
              allow-clear :options="kpiTemplateOptions" :filter-option="
                (input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
              " :loading="loadingKpiTemplates" style="width: 100%; margin-bottom: 15px" @change="loadKpiTemplate" />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item class="textLabel" :label="$t('perspective')" name="perspective_id">
        <a-select v-model:value="form.perspective_id" :placeholder="$t('selectPerspective')">
          <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">{{
            perspective.name }}</a-select-option>
        </a-select>
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('kpiName')" name="name">
            <a-input v-model:value="form.name" :placeholder="$t('enterKpiName')" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('calculationFormula')" name="formula_id">
            <a-select v-model:value="form.formula_id" :placeholder="$t('selectCalculationFormula')">
              <a-select-option v-for="formula in formulaList" :key="formula.id" :value="formula.id">
                {{ formula.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('type')" name="type">
            <a-select v-model:value="form.type" :placeholder="$t('selectType')">
              <a-select-option value="efficiency">
                {{ $t("efficiency") }}
              </a-select-option>
              <a-select-option value="qualitative">
                {{ $t("qualitative") }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('unit')" name="unit">
            <a-select v-model:value="form.unit" :placeholder="$t('selectUnit')">
              <a-select-option v-for="(unitValue, unitKey) in KpiUnits" :key="unitKey" :value="unitValue">
                {{ unitKey }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('target')" name="target">
            <a-input v-model:value="form.targetFormatted" :placeholder="$t('enterTarget')"
              @input="(event) => handleNumericInput('target', event)" />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('weight')" name="weight">
            <a-input v-model:value="form.weight" :placeholder="$t('enterWeight')"
              @input="(event) => handleNumericInput('weight', event)" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item class="textLabel" :label="$t('frequency')" name="frequency">
        <a-select v-model:value="form.frequency" :placeholder="$t('selectFrequency')">
          <a-select-option value="daily"> {{ $t("daily") }} </a-select-option>
          <a-select-option value="weekly"> {{ $t("weekly") }} </a-select-option>
          <a-select-option value="monthly">
            {{ $t("monthly") }}
          </a-select-option>
          <a-select-option value="quarterly">
            {{ $t("quarterly") }}
          </a-select-option>
          <a-select-option value="yearly"> {{ $t("yearly") }} </a-select-option>
        </a-select>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('dateStart')" name="start_date">
            <a-date-picker v-model:value="form.start_date" style="width: 100%" value-format="YYYY-MM-DD" />
          </a-form-item>
        </a-col>

        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('dateEnd')" name="end_date" :rules="[
            { required: true, message: $t('pleaseSelectEndDate') },
            { validator: validateEndDate }]">
            <a-date-picker v-model:value="form.end_date" style="width: 100%" value-format="YYYY-MM-DD" />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item class="textLabel" :label="$t('description')" name="description">
        <a-textarea v-model:value="form.description" :placeholder="$t('enterDescription')" allow-clear />
      </a-form-item>

      <a-row :gutter="12" style="
          margin-top: -10px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        ">
        <a-col :span="8">
          <a-statistic :title="$t('overallTarget')" :value="overallTargetValue" :precision="2" />
        </a-col>

        <a-col :span="8">
          <a-statistic :title="$t('totalAssigned')" :value="totalAssignedTarget" :precision="2" />
        </a-col>

        <a-col :span="8">
          <a-statistic :title="$t('remaining')" :value="remainingTarget" :precision="2"
            :value-style="isOverAssigned ? { color: '#cf1322' } : {}" />
        </a-col>
      </a-row>

      <a-form-item v-if="canAssignToUnits" class="textLabel" :label="$t('assignToDepartment')" name="section_id_table"
        :help="$t('assignToDepartmentHelp')" :extra="form.assigned_user_id ? $t('directUserAssignmentCleared') : ''">
        <a-alert v-if="assignmentError" :message="assignmentError" type="error" show-icon style="margin-bottom: 10px" />

        <a-table :columns="columns" :data-source="departmentTreeData" :pagination="false"
          :row-key="(record) => record.key" :expandable="{ childrenColumnName: 'children' }"
          :row-selection="rowSelection" :class="{ 'table-disabled': !!form.assigned_user_id }" size="small" bordered>
          <template #target="{ record }">
            <template v-if="record.type === 'department'">
              <a-input-number v-if="!hasSelectedSections(record.key)" :value="form.targets[record.key]"
                :placeholder="$t('enterTarget')" :min="0" style="width: 100%" :disabled="
                  !!form.assigned_user_id ||
                  !selectedRowKeys.includes(record.key)
                " :formatter="
                  (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                " :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')"
                @change="(value) => handleTargetChange(record.key, value)" />

              <span v-else>
                {{ formatNumber(calculatedDepartmentTargets[record.key] || 0) }}
              </span>
            </template>

            <template v-else-if="record.type === 'section'">
              <a-input-number :value="form.targets[record.key]" :placeholder="$t('enterTarget')" :min="0"
                style="width: 100%" :disabled="
                  !!form.assigned_user_id ||
                  !selectedRowKeys.includes(record.key)
                " :formatter="
                  (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                " :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')"
                @change="(value) => handleTargetChange(record.key, value)" />
            </template>
          </template>

          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span :style="{ opacity: form.assigned_user_id ? 0.5 : 1 }">
                {{ record.name }}
              </span>
            </template>
          </template>
        </a-table>
      </a-form-item>

      <a-form-item>
        <a-row justify="end" style="margin-top: 10px">
          <a-button style="margin-right: 10px" @click="resetForm(true)">
            {{ $t("clearForm") }}
          </a-button>

          <a-button style="margin-right: 10px" type="primary" html-type="submit" :loading="loading">
            {{ $t("saveKpi") }}
          </a-button>
          <a-button type="default" @click="goBack"> {{ $t("back") }} </a-button>
        </a-row>
      </a-form-item>
    </a-form>
  </div>

  <div v-else>
    <a-alert :message="$t('accessDenied')" :description="$t('accessDeniedDescription')" type="error" show-icon />

    <a-button type="default" style="margin-top: 15px" @click="goBack">
      {{ $t("back") }}
    </a-button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";

import {
  notification,
  Alert as AAlert,
  DatePicker as ADatePicker,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputNumber as AInputNumber,
  Select as ASelect,
  SelectOption as ASelectOption,
  Textarea as ATextarea,
  Row as ARow,
  Col as ACol,
  Table as ATable,
  Button as AButton,
  Statistic as AStatistic,
} from "ant-design-vue";
import dayjs from "dayjs";
import { KpiUnits } from "@/core/constants/kpiConstants.js";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";

const router = useRouter();
const route = useRoute();
const store = useStore();
const creationScope = computed(() => route.query.scope || "company");

const loading = ref(false);
const loadingUsers = ref(false);
const targetValues = ref({});
const selectedRowKeys = ref([]);
const assignmentError = ref(null);
const formRef = ref();
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
const departmentTreeData = ref([]);
const { t: $t } = useI18n();

const form = ref({
  name: "",
  formula_id: null,
  type: null,
  unit: null,
  target: null,
  weight: null,
  frequency: null,
  perspective_id: null,
  start_date: null,
  end_date: null,
  section_id: [],
  department_id: [],
  assigned_user_id: null,
  description: "",
  targets: {},
});

const formulaList = computed(() => store.getters["formula/getFormulas"] || []);

const departments = computed(
  () => store.getters["departments/departmentList"] || []
);
const rawSections = computed(() => store.getters["sections/sectionList"] || []);
const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const kpiTemplateList = computed(() => store.getters["kpis/kpiListAll"] || []);
const loadingKpiTemplates = computed(() => store.getters["kpis/loadingAll"]);

const calculatedDepartmentTargets = computed(() => {
  const sums = {};
  departmentTreeData.value.forEach((department) => {
    let departmentSum = 0;
    let hasSelectedChildrenWithTargets = false;

    if (department.children && department.children.length > 0) {
      department.children.forEach((section) => {
        const sectionKey = `section - ${section.id}`;

        if (selectedRowKeys.value.includes(sectionKey)) {
          const sectionTarget = form.value.targets[sectionKey];
          if (
            sectionTarget !== undefined &&
            sectionTarget !== null &&
            !isNaN(sectionTarget) &&
            parseFloat(sectionTarget) >= 0
          ) {
            departmentSum += parseFloat(sectionTarget);
            hasSelectedChildrenWithTargets = true;
          }
        }
      });
    }

    const departmentKey = `department - ${department.id}`;

    if (hasSelectedChildrenWithTargets) {
      sums[departmentKey] = departmentSum;
    }
  });
  return sums;
});

const hasSelectedSections = computed(() => (departmentKey) => {
  const department = departmentTreeData.value.find(
    (d) => d.key === departmentKey
  );
  if (!department || !department.children) return false;
  return department.children.some((section) =>
    selectedRowKeys.value.includes(`section - ${section.id}`)
  );
});

const formatNumber = (value) => {
  if (value === null || value === undefined || isNaN(value)) return "";

  return parseFloat(value).toLocaleString("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
};

const loadDepartmentTreeData = async () => {
  const departmentsList = departments.value || [];
  const result = [];

  for (const dept of departmentsList) {
    const sections = await store.dispatch(
      "sections/fetchSectionsByDepartment",
      dept.id
    );

    const node = {
      key: `department - ${dept.id}`,
      id: dept.id,
      name: dept.name,
      type: "department",
      children: (sections || []).map((section) => ({
        key: `section - ${section.id}`,
        id: section.id,
        name: section.name,
        type: "section",
        parentId: dept.id,
      })),
    };

    result.push(node);
  }

  departmentTreeData.value = result;
};

const kpiTemplateOptions = computed(() =>
  kpiTemplateList.value.map((kpi) => ({
    value: kpi.id,
    label: kpi.name,
  }))
);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
const canAccessCreatePage = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.CREATE &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_COMPANY
  )
);
const canAssignDirectlyToUser = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.ASSIGN &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_COMPANY
  )
);
const canAssignToUnits = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.ASSIGN &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_COMPANY
  )
);

const columns = computed(() => [
  {
    title: $t("departmentSection"),
    dataIndex: "name",
    key: "name",
  },
  {
    title: $t("target"),
    key: "target",
    slots: {
      customRender: "target",
    },
    width: "150px",
  },
]);

const rowSelection = computed(() => ({
  type: "checkbox",
  selectedRowKeys: selectedRowKeys.value,
  getCheckboxProps: (record) => ({
    disabled: !!form.value.assigned_user_id,
    name: record.name,
  }),
  onSelect: (record, selected) => {
    if (form.value.assigned_user_id) return;
    let currentSelectedKeys = [...selectedRowKeys.value];
    let currentSectionIds = [...form.value.section_id];
    const isDepartment = record.type === "department";
    const recordKey = record.key;
    const recordId = record.id;
    if (isDepartment) {
      const departmentData = departmentTreeData.value.find(
        (d) => d.key === recordKey
      );
      const childSections = departmentData?.children;
      const childSectionKeys = childSections.map((section) => section.key);
      const childSectionIds = childSections.map((section) => section.id);
      const keysToAffect = [recordKey, ...childSectionKeys];
      if (selected) {
        keysToAffect.forEach((k) => {
          if (!currentSelectedKeys.includes(k)) currentSelectedKeys.push(k);
        });
        childSectionIds.forEach((id) => {
          if (!currentSectionIds.includes(id)) currentSectionIds.push(id);
        });
      } else {
        const keysToRemoveSet = new Set(keysToAffect);
        currentSelectedKeys = currentSelectedKeys.filter(
          (key) => !keysToRemoveSet.has(key)
        );
        const childIdSet = new Set(childSectionIds);
        currentSectionIds = currentSectionIds.filter(
          (id) => !childIdSet.has(id)
        );
        keysToAffect.forEach((key) => delete targetValues.value[key]);
      }
    } else if (record.type === "section") {
      if (selected) {
        if (!currentSelectedKeys.includes(recordKey))
          currentSelectedKeys.push(recordKey);
        if (!currentSectionIds.includes(recordId))
          currentSectionIds.push(recordId);
      } else {
        currentSelectedKeys = currentSelectedKeys.filter(
          (key) => key !== recordKey
        );
        currentSectionIds = currentSectionIds.filter((id) => id !== recordId);
        delete targetValues.value[recordKey];
      }
      const parentDepartment = departmentTreeData.value.find((dept) =>
        dept.children?.some((child) => child.id === record.id)
      );
      if (parentDepartment) {
        const parentKey = parentDepartment.key;
        const parentChildrenKeys = parentDepartment.children.map(
          (child) => child.key
        );
        const tempSelectedKeysSet = new Set(currentSelectedKeys);
        const allChildrenSelected = parentChildrenKeys.every((childKey) =>
          tempSelectedKeysSet.has(childKey)
        );
        const isParentCurrentlySelected = tempSelectedKeysSet.has(parentKey);
        if (allChildrenSelected && !isParentCurrentlySelected) {
          currentSelectedKeys.push(parentKey);
        } else if (!allChildrenSelected && isParentCurrentlySelected) {
          currentSelectedKeys = currentSelectedKeys.filter(
            (key) => key !== parentKey
          );
          delete targetValues.value[parentKey];
        }
      }
    }
    selectedRowKeys.value = currentSelectedKeys;
    form.value.section_id = currentSectionIds;
    const finalSelectedKeysSet = new Set(selectedRowKeys.value);
    const selectedDepartmentIds = new Set();
    departments.value.forEach((dept) => {
      const deptKey = `department - ${dept.id}`;
      if (finalSelectedKeysSet.has(deptKey)) {
        selectedDepartmentIds.add(dept.id);
      } else {
        const currentDeptData = departmentTreeData.value.find(
          (d) => d.id === dept.id
        );
        const sectionsInDept = currentDeptData?.children;
        if (
          sectionsInDept.some((sec) =>
            finalSelectedKeysSet.has(`section - ${sec.id}`)
          )
        ) {
          selectedDepartmentIds.add(dept.id);
        }
      }
    });
    form.value.department_id = Array.from(selectedDepartmentIds).filter(
      Boolean
    );
  },
}));

const overallTargetValue = computed(() => {
  const target = parseFloat(form.value.target); // Sử dụng giá trị thực tế
  return isNaN(target) ? 0 : target;
});

const totalAssignedTarget = computed(() => {
  let total = 0;
  selectedRowKeys.value.forEach((key) => {
    const targetValue = form.value.targets[key];
    if (
      targetValue !== undefined &&
      targetValue !== null &&
      !isNaN(targetValue) &&
      targetValue >= 0
    ) {
      total += Number(targetValue);
    }
  });
  return total;
});

const remainingTarget = computed(() => {
  return parseFloat(
    (overallTargetValue.value - totalAssignedTarget.value).toFixed(5)
  );
});

const isOverAssigned = computed(() => {
  return remainingTarget.value < -1e-9;
});

const resetForm = (clearTemplateSelection = false) => {
  formRef.value?.resetFields();
  form.value = {
    name: "",
    formula_id: null,
    type: null,
    unit: null,
    target: null,
    weight: null,
    frequency: null,
    perspective_id: null,
    start_date: null,
    end_date: null,
    section_id: [],
    department_id: [],
    assigned_user_id: null,
    description: "",
    targets: {},
  };
  selectedRowKeys.value = [];
  targetValues.value = {};
  assignmentError.value = null;
  if (clearTemplateSelection) {
    selectedTemplateKpiId.value = null;
  }
};

const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    resetForm();
    return;
  }
  loadingKpiTemplate.value = true;
  assignmentError.value = null;
  try {
    await store.dispatch("kpis/fetchKpiDetail", selectedId);
    const kpiDetail = store.getters["kpis/currentKpi"];
    if (kpiDetail) {
      form.value.name = kpiDetail.name ? `${kpiDetail.name} (Copy)` : "";
      form.value.formula_id = kpiDetail.formula_id;
      form.value.type = kpiDetail.type || null;
      form.value.unit = kpiDetail.unit || null;
      form.value.target = kpiDetail.target ?? null;
      form.value.targetFormatted = kpiDetail.target !== null && kpiDetail.target !== undefined
        ? String(kpiDetail.target).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
        : "";
      form.value.weight = kpiDetail.weight ?? null;
      form.value.frequency = kpiDetail.frequency || null;
      form.value.perspective_id = kpiDetail.perspective?.id || null;
      form.value.description = kpiDetail.description || "";
      form.value.start_date = kpiDetail.start_date
        ? dayjs(kpiDetail.start_date)
        : null;
      form.value.end_date = kpiDetail.end_date
        ? dayjs(kpiDetail.end_date)
        : null;
      form.value.assigned_user_id = null;
      notification.success({
        message: `Loaded data from KPI: ${kpiDetail.name}`,
      });
    } else {
      throw new Error("KPI Detail not found.");
    }
  } catch (error) {
    console.error("Error loading KPI template:", error);
    notification.error({
      message: "Failed to load KPI template data.",
    });
    resetForm();
  } finally {
    loadingKpiTemplate.value = false;
  }
};

const handleTargetChange = (key, value) => {
  const targetKey = String(key);
  if (form.value.assigned_user_id) return;

  if (value === null || value === "" || isNaN(value)) {
    delete targetValues.value[targetKey];
    delete form.value.targets[targetKey];
  } else {
    const numValue = parseFloat(value);
    targetValues.value[targetKey] = numValue;
    form.value.targets[targetKey] = numValue;
  }

  formRef.value?.validateFields([["targets", targetKey]]);
  formRef.value?.validateFields(["section_id_table"]).catch(() => {});
};

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, ""); // Loại bỏ ký tự không phải số hoặc dấu chấm
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join(""); // Xử lý trường hợp có nhiều dấu chấm
  }

  // Lưu giá trị thực tế (rawTarget)
  const rawValue = parseFloat(value) || 0;

  // Format giá trị hiển thị (formattedTarget)
  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;

  // Lưu giá trị thực tế và giá trị format
  form.value[field] = rawValue; // Lưu giá trị thực tế
  form.value[`${field}Formatted`] = formatted; // Lưu giá trị format
};

const validateWeight = async (_rule, value) => {
  if (!value && value !== 0) return Promise.resolve();
  if (isNaN(value)) return Promise.reject("Weight must be a number");
  const numValue = parseFloat(value);
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};

const goBack = () => {
  router.go(-1);
};

const handleChangeCreate = async () => {
  loading.value = true;
  assignmentError.value = null;

  try {
    await formRef.value?.validate();

    const assignmentsPayload = {
      from: creationScope.value,
      to_sections: [],
      to_departments: [],
      to_employees: [],
    };
    let hasValidAssignment = false;
    let missingTargetError = false;
    const assignedDepartmentIds = new Set();

    if (form.value.assigned_user_id && canAssignDirectlyToUser.value) {
      assignmentsPayload.to_employees.push({
        id: form.value.assigned_user_id,
        target: form.value.target,
      });
      hasValidAssignment = true;
    } else if (selectedRowKeys.value?.length > 0 && canAssignToUnits.value) {
      selectedRowKeys.value.forEach((key) => {
        if (key.startsWith("section - ")) {
          const sectionId = parseInt(key.split(" - ")[1], 10);
          const targetValue = form.value.targets[key];

          const isTargetEnteredAndValid =
            targetValue !== undefined &&
            targetValue !== null &&
            !isNaN(targetValue) &&
            parseFloat(targetValue) >= 0;

          if (!isNaN(sectionId)) {
            if (isTargetEnteredAndValid) {
              assignmentsPayload.to_sections.push({
                id: sectionId,
                target: parseFloat(targetValue),
              });
              hasValidAssignment = true;

              const sectionData = rawSections.value.find(
                (s) => s.id === sectionId
              );
              const deptId = sectionData?.department?.id;
              if (deptId) {
                assignedDepartmentIds.add(deptId);
              }
            } else {
              missingTargetError = true;
            }
          }
        }
      });

      assignmentsPayload.to_departments = [];
      const addedDepartmentIdsForPayload = new Set();

      departmentTreeData.value.forEach((department) => {
        const departmentKey = `department - ${department.id}`;
        const departmentId = department.id;

        const isDepartmentExplicitlySelected =
          selectedRowKeys.value.includes(departmentKey);
        const hasAssignedChildSections =
          assignedDepartmentIds.has(departmentId);

        if (hasAssignedChildSections) {
          const calculatedSum =
            calculatedDepartmentTargets.value[departmentKey] || 0;

          const sectionsAddedForThisDept =
            assignmentsPayload.to_sections.filter((s) => {
              const sectionData = rawSections.value.find(
                (rs) => rs.id === s.id
              );
              // --- SỬA ĐỔI Ở ĐÂY (TRONG FILTER) ---
              return sectionData?.department?.id === departmentId;
              // --- KẾT THÚC SỬA ĐỔI ---
            });

          if (
            sectionsAddedForThisDept.length > 0 &&
            !addedDepartmentIdsForPayload.has(departmentId)
          ) {
            assignmentsPayload.to_departments.push({
              id: departmentId,
              target: calculatedSum,
            });
            addedDepartmentIdsForPayload.add(departmentId);
            hasValidAssignment = true;
          }
        } else if (
          isDepartmentExplicitlySelected &&
          !addedDepartmentIdsForPayload.has(departmentId)
        ) {
          const targetValue = form.value.targets[departmentKey];
          const isTargetEnteredAndValid =
            targetValue !== undefined &&
            targetValue !== null &&
            !isNaN(targetValue) &&
            parseFloat(targetValue) >= 0;

          if (isTargetEnteredAndValid) {
            assignmentsPayload.to_departments.push({
              id: departmentId,
              target: parseFloat(targetValue),
            });
            addedDepartmentIdsForPayload.add(departmentId);
            hasValidAssignment = true;
          } else {
            missingTargetError = true;
          }
        }
      });

      if (missingTargetError) {
        assignmentError.value =
          "Vui lòng nhập Target hợp lệ (>= 0) cho tất cả các mục đã chọn (các phòng ban được chọn trực tiếp không có bộ phận con được chọn HOẶC các bộ phận được chọn).";
        throw new Error(assignmentError.value);
      }
    }

    if (!hasValidAssignment && !form.value.assigned_user_id) {
      assignmentError.value =
        "Yêu cầu gán: Vui lòng gán cho một người dùng HOẶC chọn ít nhất một đơn vị (phòng ban hoặc bộ phận) và nhập target hợp lệ của nó.";
      throw new Error(assignmentError.value);
    }

    const formattedStartDate = form.value.start_date
      ? dayjs(form.value.start_date).format("YYYY-MM-DD")
      : null;
    const formattedEndDate = form.value.end_date
      ? dayjs(form.value.end_date).format("YYYY-MM-DD")
      : null;
    const numericMainTarget =
      form.value.target !== null &&
      form.value.target !== "" &&
      !isNaN(form.value.target)
        ? Number(form.value.target)
        : null;
    const numericMainWeight =
      form.value.weight !== null &&
      form.value.weight !== "" &&
      !isNaN(form.value.weight)
        ? Number(form.value.weight)
        : null;

    const kpiData = {
      name: form.value.name,
      formula_id: form.value.formula_id,
      type: form.value.type,
      unit: form.value.unit,
      target: numericMainTarget,
      weight: numericMainWeight,
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      description: form.value.description,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      assignments: {
        from: creationScope.value,
        to_employees: assignmentsPayload.to_employees,
        to_departments: assignmentsPayload.to_departments,
        to_sections: assignmentsPayload.to_sections,
      },
    };

    // Chỉ xóa các trường nếu chúng không có dữ liệu
    if (!kpiData.assignments.to_employees || kpiData.assignments.to_employees.length === 0) {
      delete kpiData.assignments.to_employees;
    }
    if (!kpiData.assignments.to_departments || kpiData.assignments.to_departments.length === 0) {
      delete kpiData.assignments.to_departments;
    }
    if (!kpiData.assignments.to_sections || kpiData.assignments.to_sections.length === 0) {
      delete kpiData.assignments.to_sections;
    }

    await store.dispatch("kpis/createKpi", kpiData);
    resetForm(true);
    if (creationScope.value === "company") router.push("/kpis/company");
    else if (creationScope.value === "department")
      router.push("/kpis/department");
    else if (creationScope.value === "section") router.push("/kpis/section");
    else if (creationScope.value === "individual")
      router.push("/kpis/individual");
    else router.push("/");
  } catch (error) {
    // --- SỬA ĐỔI KHỐI CATCH (Đảo ngược logic) ---
    const isHandledAssignmentError =
      error instanceof Error && error.message === assignmentError.value;

    if (!isHandledAssignmentError) {
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        "KPI creation failed.";
      notification.error({
        message: "KPI Creation Failed",
        description: errorMessage,
        duration: 5,
      });
    }
    // --- KẾT THÚC SỬA ĐỔI KHỐI CATCH ---
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = (errorInfo) => {
  let errorMessages = "Please check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    const firstErrorField = errorInfo.errorFields[0];
    const fieldName = Array.isArray(firstErrorField.name)
      ? firstErrorField.name.join(".")
      : firstErrorField.name;
    const errors = Array.isArray(firstErrorField.errors)
      ? firstErrorField.errors.join(", ")
      : "Unknown error";
    errorMessages = `Error in field '${fieldName}': ${errors}`;
  }
  notification.error({
    message: "Form Validation Failed",
    description: errorMessages,
  });
};

const validateEndDate = async (_rule, value) => {
  if (!value || !form.value.start_date) return Promise.resolve();
  const start = dayjs(form.value.start_date);
  const end = dayjs(value);
  if (end.isBefore(start, 'day')) {
    return Promise.reject(new Error($t('endDateMustBeAfterStartDate')));
  }
  const freq = form.value.frequency;
  if (freq === 'daily') {
    // Đã kiểm tra ở trên, không cần thêm
    return Promise.resolve();
  }
  if (freq === 'weekly') {
    if (end.diff(start, 'week') < 1) {
      return Promise.reject(new Error($t('endDateAtLeastOneWeek')));
    }
  }
  if (freq === 'monthly') {
    if (end.diff(start, 'month') < 1) {
      return Promise.reject(new Error($t('endDateAtLeastOneMonth')));
    }
  }
  if (freq === 'quarterly') {
    if (end.diff(start, 'month') < 3) {
      return Promise.reject(new Error($t('endDateAtLeastOneQuarter')));
    }
  }
  if (freq === 'yearly') {
    if (end.diff(start, 'year') < 1) {
      return Promise.reject(new Error($t('endDateAtLeastOneYear')));
    }
  }
  return Promise.resolve();
};

const formRules = reactive({
  perspective_id: [
    {
      required: true,
      message: $t('pleaseSelectPerspective'),
    },
  ],
  name: [
    {
      required: true,
      message: $t('pleaseEnterKpiName'),
      trigger: 'blur',
    },
  ],
  formula_id: [
    {
      required: true,
      message: $t('pleaseSelectFormula'),
    },
  ],
  type: [
    {
      required: true,
      message: $t('pleaseSelectKpiType'),
    },
  ],
  unit: [
    {
      required: true,
      message: $t('pleaseSelectUnit'),
    },
  ],
  target: [
    {
      required: true,
      message: $t('pleaseEnterTarget'),
      trigger: 'blur',
    },
  ],
  weight: [
    {
      required: true,
      message: $t('pleaseEnterWeight'),
      trigger: 'blur',
    },
    {
      validator: validateWeight,
      trigger: 'blur',
    },
  ],
  frequency: [
    {
      required: true,
      message: $t('pleaseSelectFrequency'),
    },
  ],
  start_date: [
    {
      required: true,
      message: $t('pleaseSelectStartDate'),
    },
  ],
  end_date: [
    { required: true, message: $t('pleaseSelectEndDate') },
    { validator: validateEndDate, trigger: 'change' },
  ],
});

watch(
  () => form.value.assigned_user_id,
  (newUserId) => {
    if (newUserId && selectedRowKeys.value.length > 0) {
      selectedRowKeys.value = [];
      form.value.section_id = [];
      form.value.department_id = [];
      targetValues.value = {};
      form.value.targets = {};
      formRef.value?.clearValidate(["targets"]);
    }
  }
);
watch(
  selectedRowKeys,
  (newKeys) => {
    if (newKeys?.length > 0 && form.value.assigned_user_id) {
      form.value.assigned_user_id = null;
      formRef.value?.clearValidate(["assigned_user_id"]);
    }
  },
  {
    deep: true,
  }
);
watch(
  () => form.value.frequency,
  () => {
    if (form.value.end_date && formRef.value) {
      formRef.value.validateFields(["end_date"]);
    }
  }
);

onMounted(async () => {
  loadingUsers.value = true;
  try {
    await Promise.all([
      store.dispatch("departments/fetchDepartments"),
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("sections/fetchSections"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
      store.dispatch("formula/fetchFormulas"), // <-- fetch formulas from DB
      loadDepartmentTreeData(),
    ]);
    const templateKpiIdFromRoute = route.query.templateKpiId;
    if (templateKpiIdFromRoute) {
      const kpiId = parseInt(templateKpiIdFromRoute, 10);
      if (!isNaN(kpiId)) {
        await loadKpiTemplate(kpiId);
        selectedTemplateKpiId.value = kpiId;
      } else {
        console.error("Invalid templateKpiId in route query.");
        notification.error({ message: "Invalid template ID provided." });
      }
    }
  } catch (error) {
    console.error("Error fetching initial data:", error);
    notification.error({
      message: "Failed to load necessary data.",
    });
  } finally {
    loadingUsers.value = false;
  }
});
</script>

<style scoped>
.textLabel label {
  font-weight: bold !important;
}

.table-disabled {
  opacity: 0.5;
  pointer-events: none;
}

.ant-form-item {
  margin-bottom: 16px;
}

:deep(.ant-input-number-disabled) {
  background-color: #f5f5f5 !important;
  color: rgba(0, 0, 0, 0.25) !important;
  cursor: not-allowed !important;
}
</style>
