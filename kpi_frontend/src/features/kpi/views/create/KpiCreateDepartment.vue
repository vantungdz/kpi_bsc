<template>
  <div v-if="canAccessCreatePage">
    <a-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      layout="vertical"
      @finish="handleChangeCreate"
      @finishFailed="onFinishFailed"
    >
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item :label="$t('useExistingKpiTemplate')" name="templateKpi">
            <a-select
              v-model:value="selectedTemplateKpiId"
              :placeholder="$t('selectKpiTemplate')"
              show-search
              allow-clear
              :options="kpiTemplateOptions"
              :filter-option="
                (input, option) =>
                  option.label.toLowerCase().includes(input.toLowerCase())
              "
              :loading="loadingKpiTemplates"
              style="width: 100%; margin-bottom: 15px"
              @change="loadKpiTemplate"
            />
          </a-form-item>
        </a-col>
      </a-row>

      <a-form-item
        class="textLabel"
        :label="$t('department')"
        name="department_id"
        required
      >
        <a-select
          v-model:value="form.department_id"
          :placeholder="$t('selectDepartment')"
        >
          <a-select-option
            v-for="department in departmentList"
            :key="department.id"
            :value="department.id"
            >{{ department.name }}</a-select-option
          >
        </a-select>
      </a-form-item>

      <a-form-item
        class="textLabel"
        :label="$t('perspective')"
        name="perspective_id"
      >
        <a-select
          v-model:value="form.perspective_id"
          :placeholder="$t('selectPerspective')"
        >
          <a-select-option
            v-for="perspective in perspectiveList"
            :key="perspective.id"
            :value="perspective.id"
            >{{ perspective.name }}</a-select-option
          >
        </a-select>
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('kpiName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterKpiName')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item
            class="textLabel"
            :label="$t('calculationFormula')"
            name="calculation_type"
          >
            <a-select
              v-model:value="form.calculation_type"
              :placeholder="$t('selectCalculationFormula')"
            >
              <a-select-option
                v-for="formula in formulaList"
                :key="formula.id"
                :value="formula.id"
              >
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
              <a-select-option
                v-for="(unitValue, unitKey) in KpiUnits"
                :key="unitKey"
                :value="unitValue"
              >
                {{ unitKey }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('target')" name="target">
            <a-input
              v-model:value="form.target"
              :placeholder="$t('enterTarget')"
              @input="(event) => handleNumericInput('target', event)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('weight')" name="weight">
            <a-input
              v-model:value="form.weight"
              :placeholder="$t('enterWeight')"
              @input="(event) => handleNumericInput('weight', event)"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item class="textLabel" :label="$t('frequency')" name="frequency">
        <a-select
          v-model:value="form.frequency"
          :placeholder="$t('selectFrequency')"
        >
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
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('dateStart')"
            name="start_date"
          >
            <a-date-picker
              v-model:value="form.start_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('dateEnd')"
            name="end_date"
            :rules="[{ validator: validateEndDate }]"
          >
            <a-date-picker
              v-model:value="form.end_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item
        class="textLabel"
        :label="$t('description')"
        name="description"
      >
        <a-textarea
          v-model:value="form.description"
          :placeholder="$t('enterDescription')"
          allow-clear
        />
      </a-form-item>

      <a-row
        :gutter="12"
        style="
          margin-top: -10px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        "
      >
        <a-col :span="8">
          <a-statistic
            :title="$t('overallTargetDepartment')"
            :value="overallTargetValue"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('totalAssigned')"
            :value="totalAssignedTarget"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            :title="$t('remaining')"
            :value="remainingTarget"
            :precision="2"
            :value-style="isOverAssigned ? { color: '#cf1322' } : {}"
          />
        </a-col>
      </a-row>

      <a-form-item
        v-if="canAssignToSections"
        class="textLabel"
        :label="$t('assignToSections')"
        name="section_id_table"
        :help="$t('assignToSectionsHelp')"
      >
        <a-alert
          v-if="assignmentError"
          :message="assignmentError"
          type="error"
          show-icon
          style="margin-bottom: 10px"
        />
        <a-table
          :columns="columns"
          :data-source="sectionsForAssignmentTable"
          :pagination="false"
          :row-key="(record) => `section - ${record.id}`"
          :row-selection="rowSelection"
          :class="{ 'table-disabled': !!form.assigned_user_id }"
          size="small"
          bordered
        >
          <template #target="{ record }">
            <a-input-number
              :value="targetValues[`section - ${record.id}`] || null"
              :placeholder="$t('enterTarget')"
              :min="0"
              style="width: 100%"
              :disabled="
                !!form.assigned_user_id ||
                !selectedRowKeys.includes(`section - ${record.id}`)
              "
              :formatter="
                (value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
              "
              :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')"
              @change="
                (value) => handleTargetChange(`section - ${record.id}`, value)
              "
            />
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
          <a-button
            style="margin-right: 10px"
            type="primary"
            html-type="submit"
            :loading="loading"
          >
            {{ $t("saveKpi") }}
          </a-button>
          <a-button type="default" @click="goBack"> {{ $t("back") }} </a-button>
        </a-row>
      </a-form-item>
    </a-form>
  </div>
  <div v-else>
    <a-alert
      :message="$t('accessDenied')"
      :description="$t('accessDeniedDescription')"
      type="error"
      show-icon
    />
    <a-button type="default" style="margin-top: 15px" @click="goBack">
      {{ $t("back") }}
    </a-button>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, reactive } from "vue";
import { useRouter } from "vue-router";
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
const store = useStore();

const creationScope = "department";

const loading = ref(false);
const loadingInitialData = ref(false);
const targetValues = ref({});
const selectedRowKeys = ref([]);
const assignmentError = ref(null);
const formRef = ref();
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
const { t: $t } = useI18n();

const form = ref({
  name: "",
  calculation_type: null,
  type: null,
  unit: null,
  target: null,
  weight: null,
  frequency: null,
  perspective_id: null,
  department_id: null,
  start_date: null,
  end_date: null,

  section_id: [],
  assigned_user_id: null,
  description: "",
  targets: {},
});

const formulaList = ref([
  {
    id: "percentage",
    name: "Tỷ lệ hoàn thành (%)",
  },
  {
    id: "average",
    name: "Giá trị trung bình",
  },
  {
    id: "sum",
    name: "Tổng số",
  },
]);

const rawSectionsForCurrentDepartment = computed(
  () =>
    store.getters["sections/sectionsByDepartment"](form.value.department_id) ||
    []
);

const sectionsForAssignmentTable = computed(() => {
  if (
    !form.value.department_id ||
    isNaN(form.value.department_id) ||
    !rawSectionsForCurrentDepartment.value
  )
    return [];

  return rawSectionsForCurrentDepartment.value.map((section) => ({
    key: `section - ${section.id}`,
    id: section.id,
    name: section.name,
    type: "section",
    parentId: section.department_id,
  }));
});

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const departmentList = computed(
  () => store.getters["departments/departmentList"] || []
);
const kpiTemplateList = computed(() => store.getters["kpis/kpiListAll"] || []);
const loadingKpiTemplates = computed(() => store.getters["kpis/loadingAll"]);

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
      p.resource?.trim() === RBAC_RESOURCES.KPI_DEPARTMENT
  )
);
const canAssignDirectlyToUser = computed(() => false);

const canAssignToSections = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.ASSIGN &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_DEPARTMENT
  )
);

const columns = computed(() => [
  {
    title: $t("section"),
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
    disabled: !!form.value.assigned_user_id || record.type !== "section",
    name: record.name,
  }),
  onSelect: (record, selected) => {
    if (form.value.assigned_user_id) return;

    let currentSelectedKeys = [...selectedRowKeys.value];
    let currentSectionIds = [...form.value.section_id];
    const recordKey = `section - ${record.id}`;
    const recordId = record.id;

    if (selected) {
      if (!currentSelectedKeys.includes(recordKey)) {
        currentSelectedKeys.push(recordKey);
      }
      if (!currentSectionIds.includes(recordId)) {
        currentSectionIds.push(recordId);
      }
    } else {
      currentSelectedKeys = currentSelectedKeys.filter(
        (key) => key !== recordKey
      );
      currentSectionIds = currentSectionIds.filter((id) => id !== recordId);

      delete targetValues.value[recordKey];
      delete form.value.targets[recordKey];
    }

    selectedRowKeys.value = currentSelectedKeys;
    form.value.section_id = currentSectionIds;
  },
}));

const overallTargetValue = computed(() => {
  const target = parseFloat(form.value.target);
  return isNaN(target) ? 0 : target;
});

const totalAssignedTarget = computed(() => {
  let total = 0;

  selectedRowKeys.value.forEach((key) => {
    if (key.startsWith("section - ")) {
      const targetValue = form.value.targets[key];
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
    calculation_type: null,
    type: null,
    unit: null,
    target: null,
    weight: null,
    frequency: null,
    perspective_id: null,
    start_date: null,
    end_date: null,
    section_id: [],
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
  console.log("Form Reset");
};

const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    resetForm();
    return;
  }
  loadingKpiTemplate.value = true;
  assignmentError.value = null;
  console.log(`Loading template KPI ID: ${selectedId}`);
  try {
    await store.dispatch("kpis/fetchKpiDetail", selectedId);
    const kpiDetail = store.getters["kpis/currentKpi"];
    if (kpiDetail) {
      form.value.name = kpiDetail.name ? `${kpiDetail.name} (Copy)` : "";
      form.value.calculation_type = kpiDetail.calculation_type || null;
      form.value.type = kpiDetail.type || null;
      form.value.unit = kpiDetail.unit || null;
      form.value.target = kpiDetail.target ?? null;
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
      selectedRowKeys.value = [];
      form.value.section_id = [];
      form.value.targets = {};
      targetValues.value = {};

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
  if (form.value.assigned_user_id) return;

  const sectionKey = String(key);
  if (value === null || value === "" || isNaN(value)) {
    delete targetValues.value[sectionKey];
    delete form.value.targets[sectionKey];
  } else {
    const numValue = parseFloat(value);
    if (numValue < 0) {
      targetValues.value[sectionKey] = null;
      delete form.value.targets[sectionKey];
      assignmentError.value = `Target for ${sectionKey.split(" - ")[1]} cannot be negative.`;
      formRef.value?.validateFields([["targets", sectionKey]]);
      return;
    }
    targetValues.value[sectionKey] = numValue;
    form.value.targets[sectionKey] = numValue;
    assignmentError.value = null;
  }
};
const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  // Format phần nguyên với dấu phẩy
  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;
  form.value[field] = formatted;
};
const validateWeight = async (_, value) => {
  if (value === null || value === "") return Promise.resolve();
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return Promise.reject("Weight must be a number");
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};

const validateAssignment = async (_, value) => {
  if (value === null || value === "") return Promise.resolve();
  if (canAssignToSections.value && selectedRowKeys.value.length > 0) {
    let missingTarget = false;
    selectedRowKeys.value.forEach((key) => {
      const targetValue = form.value.targets[key];
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
        "Please enter a valid Target (>= 0) for all selected Sections.";
      return Promise.reject("Missing target for selected sections.");
    }

    const total = totalAssignedTarget.value;
    const overall = overallTargetValue.value;

    const isTotalMismatch = Math.abs(total - overall) > 1e-9;

    if (isTotalMismatch) {
      assignmentError.value = `Total assigned target (${total.toFixed(2)}) does not match Overall Target (${overall.toFixed(2)}). Remaining: ${remainingTarget.value.toFixed(2)}`;
      return Promise.reject("Assigned targets mismatch overall target.");
    } else {
      assignmentError.value = null;
      return Promise.resolve();
    }
  } else if (
    canAssignDirectlyToUser.value &&
    form.value.assigned_user_id !== null
  ) {
    if (form.value.assigned_user_id === null) {
      assignmentError.value = "Please select a user to assign this KPI.";
      return Promise.reject("No user selected for assignment.");
    }
    assignmentError.value = null;
    return Promise.resolve();
  } else {
    assignmentError.value =
      "Assignment Required: Please select at least one section and enter its target, or assign to a user.";
    return Promise.reject("No assignment selected.");
  }
};

const goBack = () => {
  router.go(-1);
};

const formatToDateString = (dateValue) => {
  return dateValue ? dayjs(dateValue).format("YYYY-MM-DD") : null;
};

const handleChangeCreate = async () => {
  loading.value = true;
  assignmentError.value = null;

  try {
    await formRef.value?.validate();

    const assignmentsPayload = {
      from: creationScope,
      to_departments: [],
      to_sections: [],
      to_user: null,
    };

    assignmentsPayload.to_departments.push({
      id: form.value.department_id,
      target: form.value.target,
    });

    let hasValidAssignment = false;

    if (canAssignToSections.value && selectedRowKeys.value.length > 0) {
      selectedRowKeys.value.forEach((key) => {
        if (key.startsWith("section - ")) {
          const sectionId = parseInt(key.split(" - ")[1], 10);
          const targetValue = form.value.targets[key];
          if (
            !isNaN(sectionId) &&
            targetValue !== undefined &&
            targetValue !== null &&
            !isNaN(targetValue)
          ) {
            assignmentsPayload.to_sections.push({
              id: sectionId,
              target: Number(targetValue),
            });
            hasValidAssignment = true;
          }
        }
      });
      if (
        assignmentsPayload.to_sections.length !== selectedRowKeys.value.length
      ) {
        assignmentError.value = "Missing target for some selected sections.";
        throw new Error(assignmentError.value);
      }
    } else if (
      canAssignDirectlyToUser.value &&
      form.value.assigned_user_id !== null
    ) {
      assignmentsPayload.to_user = { id: form.value.assigned_user_id };
      hasValidAssignment = true;
    }

    if (!hasValidAssignment) {
      assignmentError.value =
        "Assignment Required: Please select at least one section and enter its target, or assign to a user.";
      throw new Error(assignmentError.value);
    }

    if (
      canAssignToSections.value &&
      assignmentsPayload.to_sections.length > 0
    ) {
      const total = assignmentsPayload.to_sections.reduce(
        (sum, item) => sum + item.target,
        0
      );
      const overall = overallTargetValue.value;
      const isTotalMismatch = Math.abs(total - overall) > 1e-9;
      if (isTotalMismatch) {
        assignmentError.value = `Total assigned target (${total.toFixed(2)}) does not match Overall Target (${overall.toFixed(2)}). Remaining: ${remainingTarget.value.toFixed(2)}`;
        throw new Error(assignmentError.value);
      }
    }

    const formattedStartDate = formatToDateString(form.value.start_date);
    const formattedEndDate = formatToDateString(form.value.end_date);
    const numericMainTarget =
      form.value.target !== null ? Number(form.value.target) : null;
    const numericMainWeight =
      form.value.weight !== null ? Number(form.value.weight) : null;

    const kpiData = {
      name: form.value.name,
      calculation_type: form.value.calculation_type,
      type: form.value.type,
      unit: form.value.unit,
      target: numericMainTarget,
      weight: numericMainWeight,
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      description: form.value.description,
      start_date: formattedStartDate,
      end_date: formattedEndDate,
      department_id: form.value.department_id,
      assignments: assignmentsPayload,
    };

    if (kpiData.assignments.to_user) {
      delete kpiData.assignments.to_sections;
    } else {
      delete kpiData.assignments.to_user;
    }

    console.log("Submitting KPI Data (Final Structure):", kpiData);

    await store.dispatch("kpis/createKpi", kpiData);

    resetForm(true);

    router.push({
      name: "KpiListDepartment",
      params: { departmentId: form.value.department_id },
    });
  } catch (error) {
    if (error instanceof Error && error.message === assignmentError.value) {
      console.log("Assignment validation failed:", assignmentError.value);
    } else {
      console.error("KPI creation failed:", error);
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
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = (errorInfo) => {
  console.log("Form validation failed:", errorInfo);
  let errorMessages = "Please check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    const nonAssignmentErrors = errorInfo.errorFields.filter(
      (field) => field.name[0] !== "assignment" && field.name[0] !== "targets"
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
      errorInfo.errorFields.some(
        (field) => field.name[0] === "assignment" || field.name[0] === "targets"
      )
    ) {
      if (assignmentError.value) {
        errorMessages = assignmentError.value;
      } else {
        errorMessages = "Please check the assignment section.";
      }
    }
  }

  notification.error({
    message: "Form Validation Failed",
    description: errorMessages,
  });
};

const validateEndDate = async (_, value) => {
  if (
    value &&
    form.value.start_date &&
    dayjs(value).isBefore(dayjs(form.value.start_date))
  ) {
    return Promise.reject("End Date must be after Start Date");
  }
  return Promise.resolve();
};

const formRules = reactive({
  department_id: [
    {
      required: true,
      message: "Please select Department",
    },
  ],
  perspective_id: [
    {
      required: true,
      message: "Please select Perspective",
    },
  ],
  name: [
    {
      required: true,
      message: "Please enter KPI Name",
      trigger: "blur",
    },
  ],
  calculation_type: [
    {
      required: true,
      message: "Please select Calculation Formula",
    },
  ],
  type: [
    {
      required: true,
      message: "Please select KPI Type",
    },
  ],
  unit: [
    {
      required: true,
      message: "Please select Unit",
    },
  ],
  target: [
    {
      required: true,
      message: "Please enter Target",
      trigger: "blur",
    },

    {
      validator: async (_, value) => {
        const numValue = parseFloat(value);
        if (value === null || value === "" || isNaN(numValue) || numValue < 0) {
          return Promise.reject("Target must be a non-negative number");
        }
        return Promise.resolve();
      },
      trigger: "blur",
    },
  ],
  weight: [
    {
      required: true,
      message: "Please enter Weight",
      trigger: "blur",
    },
    {
      validator: validateWeight,
      trigger: "blur",
    },
  ],
  frequency: [
    {
      required: true,
      message: "Please select Frequency",
    },
  ],
  start_date: [
    {
      required: true,
      message: "Please select Start Date",
    },
  ],
  end_date: [
    {
      required: true,
      message: "Please select End Date",
    },
    {
      validator: validateEndDate,
      trigger: "change",
    },
  ],

  assignment: [
    {
      validator: validateAssignment,
      trigger: ["change", "blur", "finish"],
    },
  ],

  targets: reactive(
    Object.keys(form.value.targets).reduce((acc, key) => {
      acc[key] = [
        {
          validator: (_, value) => {
            const numValue = parseFloat(value);
            if (
              value === undefined ||
              value === null ||
              value === "" ||
              isNaN(numValue) ||
              numValue < 0
            ) {
              if (selectedRowKeys.value.includes(key)) {
                assignmentError.value = `Target for selected section is required and must be >= 0.`;
                return Promise.reject(`Target is required and must be >= 0.`);
              }
            } else {
              formRef.value?.clearValidate([["targets", key]]);

              formRef.value?.validateFields(["assignment"]).catch(() => {});
            }

            return Promise.resolve();
          },
          trigger: ["change", "blur"],
        },
      ];
      return acc;
    }, {})
  ),
});

watch(
  () => form.value.assigned_user_id,
  (newUserId) => {
    if (newUserId !== null) {
      selectedRowKeys.value = [];
      form.value.section_id = [];
      targetValues.value = {};
      form.value.targets = {};
      formRef.value?.clearValidate(["targets", "assignment"]);
    }

    formRef.value?.validateFields(["assignment"]).catch(() => {});
  }
);

watch(
  selectedRowKeys,
  (newKeys) => {
    if (newKeys?.length > 0) {
      form.value.assigned_user_id = null;

      formRef.value?.validateFields(["assignment"]).catch(() => {});
    } else if (newKeys?.length === 0 && form.value.assigned_user_id === null) {
      formRef.value?.validateFields(["assignment"]).catch(() => {});
    }

    formRules.targets = reactive(
      newKeys
        .filter((key) => key.startsWith("section - "))
        .reduce((acc, key) => {
          acc[key] = [
            {
              validator: (_, value) => {
                const numValue = parseFloat(value);
                if (
                  value === undefined ||
                  value === null ||
                  value === "" ||
                  isNaN(numValue) ||
                  numValue < 0
                ) {
                  assignmentError.value = `Target for selected section is required and must be >= 0.`;
                  return Promise.reject(`Target is required and must be >= 0.`);
                } else {
                  formRef.value?.clearValidate([["targets", key]]);

                  formRef.value?.validateFields(["assignment"]).catch(() => {});
                }
                return Promise.resolve();
              },
              trigger: ["change", "blur"],
            },
          ];
          return acc;
        }, {})
    );
  },
  {
    deep: true,
  }
);

watch(
  () => form.value.targets,
  () => {
    formRef.value?.validateFields(["assignment"]).catch(() => {});
  },
  {
    deep: true,
  }
);

watch(
  () => form.value.target,
  () => {
    formRef.value?.validateFields(["assignment"]).catch(() => {});
  }
);

onMounted(async () => {
  loadingInitialData.value = true;
  try {
    await Promise.all([
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("departments/fetchDepartments"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
    ]);
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
  () => form.value.department_id,
  async (newDepartmentId) => {
    if (!newDepartmentId || isNaN(newDepartmentId)) {
      selectedRowKeys.value = [];
      form.value.section_id = [];
      targetValues.value = {};
      form.value.targets = {};
      return;
    }
    loadingInitialData.value = true;
    try {
      await store.dispatch(
        "sections/fetchSectionsByDepartment",
        newDepartmentId
      );
      selectedRowKeys.value = [];
      form.value.section_id = [];
      targetValues.value = {};
      form.value.targets = {};
    } catch (error) {
      console.error("Error fetching sections for department:", error);
      notification.error({
        message: "Failed to load sections for selected department.",
        description: error.message || "An error occurred.",
        duration: 5,
      });
    } finally {
      loadingInitialData.value = false;
    }
  }
);
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
