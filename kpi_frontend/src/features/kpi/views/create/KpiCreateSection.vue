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
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('department')" name="department_id" required>
            <a-select v-model:value="form.department_id" :placeholder="$t('selectDepartment')">
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">
                {{ department.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('section')" name="section_id" required>
            <a-select v-model:value="form.section_id" :placeholder="$t('selectSection')">
              <a-select-option v-for="section in sectionList" :key="section.id" :value="section.id">
                {{ section.name }}
              </a-select-option>
            </a-select>
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
          <a-form-item class="textLabel" :label="$t('dateStart')" name="start_date"
            :rules="[{ required: true, message: $t('pleaseSelectStartDate') }]">
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
          <a-statistic :title="$t('overallTargetDepartment')" :value="overallTargetValue" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="$t('totalAssigned')" :value="totalAssignedTarget" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="$t('remaining')" :value="remainingTarget" :precision="2"
            :value-style="isOverAssigned ? { color: '#cf1322' } : {}" />
        </a-col>
      </a-row>

      <a-form-item v-if="canAssignDirectlyToUser" class="textLabel" :label="$t('assignToUser')" name="assigned_users">
        <a-alert v-if="assignmentError" :message="assignmentError" type="error" show-icon style="margin-bottom: 10px" />
        <a-table :columns="columns" :data-source="sectionUserOptions" :pagination="false"
          :row-key="(record) => `user - ${record.value}`" :row-selection="rowSelection"
          :class="{ 'table-disabled': false }" size="small" bordered @blur="onAssignedUsersBlur">
          <template #target="{ record }">
            <a-input-number :value="targetValues[`user - ${record.value}`] || null" :placeholder="$t('enterTarget')"
              :min="0" style="width: 100%" :disabled="!selectedRowKeys.includes(`user - ${record.value}`)"
              :formatter="(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
              :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')"
              @change="(value) => handleAssignedUserTargetChange(`user - ${record.value}`, value)"
              @blur="onAssignedUsersBlur" />
          </template>
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'name'">
              <span>{{ record.label }}</span>
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
import { onMounted, ref, computed, watch, reactive } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import {
  notification,
  Alert as AAlert,
  DatePicker as ADatePicker,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  Textarea as ATextarea,
  Row as ARow,
  Col as ACol,
  Button as AButton,
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
const { t: $t } = useI18n();

const sectionId = computed(() => parseInt(route.params.sectionId, 10));

const creationScope = "section";

const loading = ref(false);
const loadingInitialData = ref(false);
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
const assignmentError = ref(null);
const formRef = ref();

const form = ref({
  name: "",
  formula_id: null,
  type: null,
  unit: null,
  target: null,
  weight: null,
  frequency: null,
  perspective_id: null,
  department_id: null,
  start_date: null,
  end_date: null,
  assigned_users: [], // [{ id: number, target: string }]
  description: "",
});

const formulaList = computed(() => store.getters["formula/getFormulas"] || []);

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const sectionList = computed(() =>
  form.value.department_id
    ? store.getters["sections/sectionsByDepartment"](form.value.department_id)
    : []
);
const kpiTemplateList = computed(() => store.getters["kpis/kpiListAll"] || []);
const loadingKpiTemplates = computed(() => store.getters["kpis/loadingAll"]);

const kpiTemplateOptions = computed(() =>
  kpiTemplateList.value.map((kpi) => ({
    value: kpi.id,
    label: kpi.name,
  }))
);

const sectionUserList = computed(
  () => store.getters["employees/usersBySection"](form.value.section_id) || []
);
// const loadingSectionUsers = computed(
//   () => store.getters["users/loadingBySection"] || false
// );

const sectionUserOptions = computed(() =>
  sectionUserList.value.map((user) => ({
    value: user.id,
    label: `${user.first_name} ${user.last_name}`,
  }))
);

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
const canAccessCreatePage = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.CREATE &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === "section"
  )
);
const canAssignDirectlyToUser = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.ASSIGN &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === "section"
  )
);

// --- Thêm các state cho assignToUser ---
const selectedRowKeys = ref([]); // ['user - 1', ...]
const targetValues = ref({}); // { 'user - 1': 10, ... }
const assignmentTouched = ref(false); // Thêm biến này để kiểm soát UX validate

// --- Table columns cho user assignment ---
const columns = computed(() => [
  {
    title: $t('user'),
    dataIndex: 'label',
    key: 'name',
  },
  {
    title: $t('target'),
    key: 'target',
    slots: { customRender: 'target' },
    width: '150px',
  },
]);

// --- rowSelection cho table user ---
const rowSelection = computed(() => ({
  type: 'checkbox',
  selectedRowKeys: selectedRowKeys.value,
  getCheckboxProps: (record) => ({
    disabled: false,
    name: record.label,
  }),
  onSelect: (record, selected) => {
    let currentSelectedKeys = [...selectedRowKeys.value];
    const recordKey = `user - ${record.value}`;
    if (selected) {
      if (!currentSelectedKeys.includes(recordKey)) {
        currentSelectedKeys.push(recordKey);
      }
    } else {
      currentSelectedKeys = currentSelectedKeys.filter((key) => key !== recordKey);
      delete targetValues.value[recordKey];
    }
    selectedRowKeys.value = currentSelectedKeys;
  },
  onSelectAll: (selected, selectedRows) => {
    if (selected) {
      selectedRowKeys.value = selectedRows.map((r) => `user - ${r.value}`);
    } else {
      selectedRowKeys.value = [];
      targetValues.value = {};
    }
  },
}));

// --- Tổng target đã assign ---
const overallTargetValue = computed(() => {
  const target = parseFloat(form.value.target);
  return isNaN(target) ? 0 : target;
});
const totalAssignedTarget = computed(() => {
  let total = 0;
  selectedRowKeys.value.forEach((key) => {
    if (key.startsWith('user - ')) {
      const targetValue = targetValues.value[key];
      if (
        targetValue !== undefined &&
        targetValue !== null &&
        !isNaN(targetValue) &&
        targetValue >= 0
      ) {
        total += Number(targetValue);
      }
    }
  });
  return total;
});
const remainingTarget = computed(() => {
  return parseFloat((overallTargetValue.value - totalAssignedTarget.value).toFixed(5));
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
    assigned_users: [],
    description: "",
  };
  assignmentError.value = null;
  assignmentTouched.value = false; // Reset khi clear form
  if (clearTemplateSelection) {
    selectedTemplateKpiId.value = null;
  }
  console.log("Form Reset");
};

const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    resetForm();
    return;
  }
  loadingKpiTemplate.value = true;
  assignmentError.value = null;
  assignmentTouched.value = false; // Reset khi load template
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
      form.value.assigned_users = [];
      // Reset assignment state khi load template
      selectedRowKeys.value = [];
      targetValues.value = {};
      assignmentError.value = null;
      assignmentTouched.value = false; // Reset khi load template
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

const validateWeight = async (_, value) => {
  if (value === null || value === "") return Promise.resolve();
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return Promise.reject("Weight must be a number");
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};

// const handleAssignedUsersChange = (userIds) => {
//   const prev = form.value.assigned_users || [];
//   form.value.assigned_users = userIds.map((id) => {
//     const found = prev.find((u) => u.id === id);
//     return found ? found : { id, target: "" };
//   });
// };

// --- Xử lý thay đổi target từng user ---
const handleAssignedUserTargetChange = (key, value) => {
  assignmentTouched.value = true; // Đánh dấu đã thao tác
  if (value === null || value === '' || isNaN(value)) {
    delete targetValues.value[key];
  } else {
    const numValue = parseFloat(value);
    if (numValue < 0) {
      targetValues.value[key] = null;
      assignmentError.value = `Target for ${key.split(' - ')[1]} cannot be negative.`;
      formRef.value?.validateFields(['assigned_users']);
      return;
    }
    targetValues.value[key] = numValue;
    assignmentError.value = null;
  }
};

const validateAssignment = async () => {
  if (!assignmentTouched.value) {
    assignmentError.value = null;
    return Promise.resolve();
  }
  if (!selectedRowKeys.value || selectedRowKeys.value.length === 0) {
    assignmentError.value =
      'Assignment Required: Please select at least one user to assign this KPI.';
    return Promise.reject('No user selected for assignment.');
  }
  let missingTarget = false;
  selectedRowKeys.value.forEach((key) => {
    const targetValue = targetValues.value[key];
    if (
      targetValue === undefined ||
      targetValue === null ||
      isNaN(targetValue) ||
      targetValue < 0
    ) {
      missingTarget = true;
    }
  });
  if (missingTarget) {
    assignmentError.value =
      'Please enter a valid Target (>= 0) for all selected users.';
    return Promise.reject('Missing target for selected users.');
  }
  const total = totalAssignedTarget.value;
  const overall = overallTargetValue.value;
  const isTotalMismatch = Math.abs(total - overall) > 1e-9;
  if (isTotalMismatch) {
    assignmentError.value = `Total assigned target (${total.toFixed(2)}) does not match Overall Target (${overall.toFixed(2)}). Remaining: ${remainingTarget.value.toFixed(2)}`;
    return Promise.reject('Assigned targets mismatch overall target.');
  } else {
    assignmentError.value = null;
    return Promise.resolve();
  }
};

const goBack = () => {
  router.push({
    name: "KpiListSection",
    params: { sectionId: sectionId.value },
  });
};

const formatToDateString = (dateValue) => {
  return dateValue ? dayjs(dateValue).format("YYYY-MM-DD") : null;
};

const handleChangeCreate = async () => {
  loading.value = true;
  assignmentError.value = null;
  try {
    await formRef.value?.validate();
    // Build assignments array for users
    const userAssignments = selectedRowKeys.value
      .filter((key) => key.startsWith('user - '))
      .map((key) => {
        const userId = parseInt(key.split(' - ')[1], 10);
        const target = targetValues.value[key];
        return { id: userId, target: Number(target) };
      });
    // Section and department assignments (nếu cần giữ)
    const sectionAssignments = [];
    if (form.value.section_id !== null && form.value.section_id !== undefined) {
      sectionAssignments.push({
        id: form.value.section_id,
        target: form.value.target !== null ? Number(form.value.target) : null,
      });
    }
    const departmentAssignments = [];
    if (
      form.value.department_id !== null &&
      form.value.department_id !== undefined
    ) {
      departmentAssignments.push({
        id: form.value.department_id,
        target: form.value.target !== null ? Number(form.value.target) : null,
      });
    }
    // Chuẩn hóa assignments object
    let assignments = {
      from: creationScope,
      to_employees: [],
      to_departments: [],
      to_sections: [],
    };
    let hasValidAssignment = false;
    if (userAssignments.length > 0) {
      assignments.to_employees = userAssignments;
      hasValidAssignment = true;
    }
    if (sectionAssignments.length > 0) {
      assignments.to_sections = sectionAssignments;
      hasValidAssignment = true;
    }
    if (departmentAssignments.length > 0) {
      assignments.to_departments = departmentAssignments;
      hasValidAssignment = true;
    }
    if (!hasValidAssignment) {
      assignmentError.value =
        'Assignment Required: Please select a user or section/department to assign this KPI.';
      throw new Error(assignmentError.value);
    }
    const formattedStartDate = formatToDateString(form.value.start_date);
    const formattedEndDate = formatToDateString(form.value.end_date);
    const numericMainTarget =
      form.value.target !== null ? Number(form.value.target) : null;
    const numericMainWeight =
      form.value.weight !== null ? Number(form.value.weight) : null;
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
      section_id: form.value.section_id,
      department_id: form.value.department_id,
      assignments,
    };
    await store.dispatch('kpis/createKpi', kpiData);
    resetForm(true);
    router.push({
      name: 'KpiListSection',
      params: { sectionId: form.value.section_id },
    });
  } catch (error) {
    if (error instanceof Error && error.message === assignmentError.value) {
      console.log('Assignment validation failed:', assignmentError.value);
    } else {
      console.error('KPI creation failed:', error);
      const errorMessage =
        error?.response?.data?.message ||
        error?.message ||
        'KPI creation failed.';
      notification.error({
        message: 'KPI Creation Failed',
        description: errorMessage,
        duration: 5,
      });
    }
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = (errorInfo) => {
  console.log("Form validation failed:", errorInfo);
  let errorMessages = "Please check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    const nonAssignmentErrors = errorInfo.errorFields.filter(
      (field) => field.name[0] !== "assigned_users"
    );
    if (nonAssignmentErrors.length > 0) {
      const firstErrorField = nonAssignmentErrors[0];
      const fieldName = Array.isArray(firstErrorField.name)
        ? firstErrorField.name.join(".")
        : firstErrorField.name;
      const errors = Array.isArray(firstErrorField.errors)
        ? firstErrorField.errors.join(", ")
        : "Unknown error";
      errorMessages = `Error in field '${fieldName}': ${errors}`;
    } else if (
      errorInfo.errorFields.some((field) => field.name[0] === "assigned_users")
    ) {
      if (assignmentError.value) {
        errorMessages = assignmentError.value;
      } else {
        errorMessages = "Please select a user for assignment.";
      }
    }
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
  section_id: [
    {
      required: true,
      message: $t('pleaseSelectSection'),
    },
  ],
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
    {
      validator: async (_, value) => {
        const numValue = parseFloat(value);
        if (value === null || value === '' || isNaN(numValue) || numValue < 0) {
          return Promise.reject($t('targetMustBeNonNegative'));
        }
        return Promise.resolve();
      },
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
    {
      required: true,
      message: $t('pleaseSelectEndDate'),
    },
    {
      validator: validateEndDate,
      trigger: 'change',
    },
  ],

  assigned_users: [
    { validator: validateAssignment, trigger: ['finish'] },
  ],
});

watch(
  () => form.value.assigned_users,
  (newVal) => {
    if (!(canAssignDirectlyToUser.value && newVal.length === 0)) {
      assignmentError.value = null;
    }

    formRef.value?.validateFields(["assigned_users"]).catch(() => {});
  },
  { immediate: true }
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
  loadingInitialData.value = true;
  try {
    await Promise.all([
      store.dispatch("departments/fetchDepartments"),
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("sections/fetchSections"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
      store.dispatch("formula/fetchFormulas"), // fetch formulas from DB
    ]);

    if (form.value.department_id) {
      await store.dispatch(
        "sections/fetchSectionsByDepartment",
        form.value.department_id
      );
    }

    if (form.value.section_id) {
      await store.dispatch(
        "employees/fetchUsersBySection",
        form.value.section_id
      );
    }

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
      description: error.message || "An error occurred.",
      duration: 5,
    });
  } finally {
    loadingInitialData.value = false;
  }
});
watch(
  () => form.value.section_id,
  async (newSectionId, oldSectionId) => {
    if (newSectionId && newSectionId !== oldSectionId) {
      loadingInitialData.value = true;
      try {
        await store.dispatch("employees/fetchUsersBySection", newSectionId);
      } catch (error) {
        console.error("Error fetching users by section:", error);
        notification.error({
          message: "Failed to load users for selected section.",
          description: error.message || "An error occurred.",
          duration: 5,
        });
      } finally {
        loadingInitialData.value = false;
      }
      // Reset các user đã chọn và target khi đổi section
      selectedRowKeys.value = [];
      targetValues.value = {};
      assignmentError.value = null;
      assignmentTouched.value = false; // Reset khi đổi section
    }
  }
);
watch(
  () => form.value.department_id,
  async (newDepartmentId, oldDepartmentId) => {
    if (newDepartmentId && newDepartmentId !== oldDepartmentId) {
      loadingInitialData.value = true;
      try {
        await store.dispatch(
          "sections/fetchSectionsByDepartment",
          newDepartmentId
        );
        form.value.section_id = null;
      } catch (error) {
        console.error("Error fetching sections by department:", error);
        notification.error({
          message: "Failed to load sections for selected department.",
          description: error.message || "An error occurred.",
          duration: 5,
        });
      } finally {
        loadingInitialData.value = false;
      }
      // Reset các user đã chọn và target khi đổi department
      selectedRowKeys.value = [];
      targetValues.value = {};
      assignmentError.value = null;
      assignmentTouched.value = false; // Reset khi đổi department
    }
  }
);

// --- Khi blur vào bảng user hoặc nhập target, set assignmentTouched ---
const onAssignedUsersBlur = () => {
  assignmentTouched.value = true;
};
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
