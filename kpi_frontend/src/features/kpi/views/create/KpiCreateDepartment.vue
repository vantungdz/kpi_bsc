<template>
  <div v-if="canAccessCreatePage">
    <LoadingOverlay :visible="loading || loadingInitialData || loadingKpiTemplate" />
    <a-form ref="formRef" :model="form" :rules="formRules" layout="vertical" @finish="handleChangeCreate"
      @finishFailed="onFinishFailed">
      <!-- Row 1 -->
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item class="textLabel" :label="$t('perspective')" name="perspective_id">
            <a-select v-model:value="form.perspective_id" :placeholder="$t('selectPerspective')">
              <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">{{
                perspective.name }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
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
        <a-col :span="6">
          <a-form-item class="textLabel" name="formula_id">
            <template #label>
              <span class="formula-form-label-with-tip">
                {{ $t("calculationFormula") }}
                <a-tooltip :title="selectedFormulaExpressionTooltip"
                  :overlayInnerStyle="formulaExpressionTooltipInnerStyle">
                  <span class="formula-form-label-tip-wrap">
                    <InfoCircleOutlined class="formula-form-label-tip-icon" />
                  </span>
                </a-tooltip>
              </span>
            </template>
            <a-select v-model:value="form.formula_id" :placeholder="$t('selectCalculationFormula')">
              <a-select-option v-for="formula in formulaList" :key="formula.id" :value="formula.id">
                {{ formula.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="6">
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
        </a-col>
      </a-row>
      <!-- Row 2 -->
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item class="textLabel" :label="$t('kpiName')" name="name">
            <a-input v-model:value="form.name" :placeholder="$t('enterKpiName')" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item class="textLabel" :label="$t('target')" name="target">
            <a-input v-model:value="form.targetFormatted" :placeholder="$t('enterTarget')"
              @input="(event) => handleNumericInput('target', event)" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item class="textLabel" :label="$t('weight')" name="weight">
            <a-input v-model:value="form.weight" :placeholder="$t('enterWeight')"
              @input="(event) => handleNumericInput('weight', event)" />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item class="textLabel" :label="$t('unit')" name="unit">
            <a-select v-model:value="form.unit" :placeholder="$t('selectUnit')">
              <a-select-option v-for="(unitValue, unitKey) in KpiUnits" :key="unitKey" :value="unitValue">
                {{ unitKey }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>

      </a-row>
      <!-- Row 3: department + validity dates from header cycle (read-only dates) -->
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('department')" name="department_id" required>
            <a-select v-model:value="form.department_id" :placeholder="$t('selectDepartment')"
              :disabled="isDepartmentSelectDisabled">
              <a-select-option v-for="department in departmentList" :key="department.id" :value="department.id">{{
                department.name }}</a-select-option>
            </a-select>
          </a-form-item>

        </a-col>
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('dateStart')" name="start_date">
            <a-date-picker
              v-model:value="form.start_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
              :disabled="true"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('dateEnd')" name="end_date" :rules="[
            { required: true, message: $t('pleaseSelectEndDate') },
            { validator: validateEndDate },
          ]">
            <a-date-picker
              v-model:value="form.end_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
              :disabled="true"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item class="textLabel" :label="$t('description')" name="description">
        <v-md-editor v-model="form.description" height="400px" :placeholder="$t('enterDescription')"></v-md-editor>
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

      <a-form-item v-if="canAssignToSections" class="textLabel" :label="$t('assignToSections')" name="section_id_table"
        :help="$t('assignToSectionsHelp')">
        <a-alert v-if="assignmentError" :message="assignmentError" type="error" show-icon style="margin-bottom: 10px" />
        <a-table :columns="columns" :data-source="sectionsForAssignmentTable" :pagination="false"
          :row-key="(record) => `section - ${record.id}`" :row-selection="rowSelection"
          :class="{ 'table-disabled': !!form.assigned_user_id }" size="small" bordered>
          <template #target="{ record }">
            <a-input-number :value="targetValues[`section - ${record.id}`] || null" :placeholder="$t('enterTarget')"
              :min="0" style="width: 100%" :disabled="!!form.assigned_user_id ||
                !selectedRowKeys.includes(`section - ${record.id}`)
                " :formatter="(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
                " :parser="(value) => String(value).replace(/\$\s?|(,*)/g, '')" @change="
                (value) => handleTargetChange(`section - ${record.id}`, value)
              " />
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
import { onMounted, ref, computed, watch, reactive } from "vue";
import { watchReviewCycleAndPrefillDates } from "@/core/composables/useWatchReviewCyclePrefillDates";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";
import i18n from "@/core/i18n";
import { useNavigation } from "@/core/utils/navigation";
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
  SCOPES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { InfoCircleOutlined } from "@ant-design/icons-vue";

const { t: $t } = useI18n();
const router = useRouter();
const route = useRoute();
const store = useStore();
const { goBack } = useNavigation();

const creationScope = "department";

const loading = ref(false);
const loadingInitialData = ref(false);
const applyingScopedOrg = ref(false);
const targetValues = ref({});
const selectedRowKeys = ref([]);
const assignmentError = ref(null);
const formRef = ref();
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
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

  section_id: [],
  assigned_user_id: null,
  description: "",
  targets: {},
});

const isCopy = computed(() => route.query.isCopy || false);
const selectedDepartmentId = computed(() => parseInt(route.query.contextDepartmentId, 10) || null);

const formulaList = computed(() => store.getters["formula/getFormulas"] || []);

const formulaExpressionTooltipInnerStyle = {
  maxWidth: "min(420px, 90vw)",
  whiteSpace: "pre-wrap",
  textAlign: "left",
};

const selectedFormulaExpressionTooltip = computed(() => {
  const id = form.value.formula_id;
  if (id === null || id === undefined || id === "") {
    return $t("formulaNameTooltipEmpty");
  }
  const found = formulaList.value.find(
    (f) => f.id === id || String(f.id) === String(id),
  );
  if (!found) return $t("formulaNameTooltipEmpty");
  const expr = found.expression;
  if (expr === null || expr === undefined || String(expr).trim() === "") {
    return $t("formulaExpressionTooltipMissing");
  }
  return String(expr);
});

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

async function ensureReviewCyclesLoaded() {
  if (!store.getters["reviewCycle/loaded"]) {
    await store.dispatch("reviewCycle/fetchCycles");
  }
}

/** Set start/end from the header-selected review cycle; clear dates when no cycle is selected. */
function prefillStartEndFromStoreCycle() {
  const cycle = store.getters["reviewCycle/selectedCycle"];
  if (!cycle) {
    form.value.start_date = null;
    form.value.end_date = null;
    return;
  }
  const start = cycle.startDate || cycle.start_date;
  const end = cycle.endDate || cycle.end_date;
  if (!start || !end) return;
  form.value.start_date = dayjs(start).format("YYYY-MM-DD");
  form.value.end_date = dayjs(end).format("YYYY-MM-DD");
  formRef.value?.validateFields(["end_date"]).catch(() => {});
}

watchReviewCycleAndPrefillDates(store, prefillStartEndFromStoreCycle);

const currentUser = computed(
  () => store.getters["auth/currentUser"] || store.getters["auth/user"],
);
const userPermissions = computed(() => {
  const u = store.getters["auth/user"];
  if (!u) return [];
  const direct = Array.isArray(u.permissions) ? u.permissions : [];
  if (direct.length > 0) return direct;
  const roles = Array.isArray(u.roles) ? u.roles : [];
  return roles.flatMap((r) => (Array.isArray(r?.permissions) ? r.permissions : []));
});

function matchKpiCreatePermission(scope) {
  return userPermissions.value.some(
    (p) =>
      String(p.action ?? "").trim() === RBAC_ACTIONS.CREATE &&
      String(p.resource ?? "").trim() === RBAC_RESOURCES.KPI &&
      p.scope === scope,
  );
}

const canCreateKpiCompany = computed(() =>
  matchKpiCreatePermission(SCOPES.COMPANY),
);

const canAccessCreatePage = computed(() =>
  matchKpiCreatePermission(SCOPES.DEPARTMENT),
);

/** Without company-level KPI create: department head is limited to their own department. */
const isDepartmentSelectDisabled = computed(
  () => canAccessCreatePage.value && !canCreateKpiCompany.value,
);

function lockedDepartmentId() {
  if (canCreateKpiCompany.value) return null;
  const u = currentUser.value;
  const id = u?.departmentId ?? u?.department_id ?? u?.department?.id ?? null;
  if (id == null || Number.isNaN(Number(id))) return null;
  return Number(id);
}

async function applyOrgScopeFromUser() {
  if (!canAccessCreatePage.value || canCreateKpiCompany.value) return;
  const deptId = lockedDepartmentId();
  if (deptId == null) return;
  applyingScopedOrg.value = true;
  loadingInitialData.value = true;
  try {
    form.value.department_id = deptId;
    await store.dispatch("sections/fetchSectionsByDepartment", deptId);
  } finally {
    loadingInitialData.value = false;
    applyingScopedOrg.value = false;
  }
}

/** After loading a template: drop section assignments outside the locked department. */
function sanitizeSectionAssignmentsForLockedDepartment() {
  if (canCreateKpiCompany.value || !form.value.department_id) return;
  const list =
    store.getters["sections/sectionsByDepartment"](form.value.department_id) ||
    [];
  const validIds = new Set(list.map((s) => Number(s.id)));
  const keys = [...selectedRowKeys.value].filter((k) =>
    k.startsWith("section - "),
  );
  keys.forEach((k) => {
    const sid = parseInt(k.split(" - ")[1], 10);
    if (Number.isNaN(sid) || !validIds.has(sid)) {
      selectedRowKeys.value = selectedRowKeys.value.filter((x) => x !== k);
      delete targetValues.value[k];
      delete form.value.targets[k];
    }
  });
  form.value.section_id = (form.value.section_id || []).filter((id) =>
    validIds.has(Number(id)),
  );
}
const canAssignDirectlyToUser = computed(() => false);
const canAssignToSections = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.ASSIGN &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === "department"
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
  const deptId = lockedDepartmentId();
  form.value = {
    name: "",
    formula_id: null,
    type: null,
    unit: null,
    target: null,
    targetFormatted: "",
    weight: null,
    frequency: null,
    perspective_id: null,
    department_id: canCreateKpiCompany.value ? null : deptId,
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
  void applyOrgScopeFromUser();
  void ensureReviewCyclesLoaded().then(() => prefillStartEndFromStoreCycle());
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
      let targetVal = 0;
      if (selectedDepartmentId.value) {
        form.value.department_id = parseInt(selectedDepartmentId.value, 10);
        const targetAssignment = kpiDetail.assignments.find(
          (assign) => assign.assigned_to_department === selectedDepartmentId.value
        );
        targetVal = targetAssignment ? parseInt(targetAssignment.targetValue) : null
      }
      form.value.name = kpiDetail.name ? `${kpiDetail.name}${isCopy.value ? " (Copy)" : ""}` : "";
      form.value.formula_id = kpiDetail.formula_id;
      form.value.type = kpiDetail.type || null;
      form.value.unit = kpiDetail.unit || null;
      form.value.target = targetVal ?? null;
      form.value.targetFormatted = targetVal ? Number(targetVal).toLocaleString('en-US') : 0;
      form.value.weight = kpiDetail.weight ?? null;
      form.value.frequency = kpiDetail.frequency || null;
      form.value.perspective_id = kpiDetail.perspective?.id || null;
      form.value.description = kpiDetail.description || "";
      // Reset assignment fields - user will select department/sections manually
      selectedRowKeys.value = [];
      form.value.section_id = [];
      targetValues.value = {};
      form.value.targets = {};
      assignmentError.value = null;

      // Assign to Sections
      if (!isCopy.value) {
        const sectionAssignments = kpiDetail.assignments.filter(item => {
          return (item.assigned_to_section !== null);
        });

        if (sectionAssignments) {
          const newSelectedKeys = [];
          const newTargets = {};
          const keysToExpand = new Set();

          sectionAssignments.forEach(sec => {
            const targetKey = `section - ${sec.assigned_to_section}`
            newSelectedKeys.push(targetKey);
            newTargets[targetKey] = parseFloat(sec.targetValue);
            targetValues.value[targetKey] = parseFloat(sec.targetValue);
            keysToExpand.add(targetKey);
          });

          selectedRowKeys.value = newSelectedKeys;
          form.value.targets = newTargets;
        }
      }

      if (!canCreateKpiCompany.value) {
        await applyOrgScopeFromUser();
        sanitizeSectionAssignmentsForLockedDepartment();
      }

      await ensureReviewCyclesLoaded();
      prefillStartEndFromStoreCycle();
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

  const rawValue = parseFloat(value) || 0;

  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;

  form.value[field] = rawValue;
  form.value[`${field}Formatted`] = formatted;
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
    assignmentError.value = null;
    return Promise.resolve();
  }
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
      to_employees: [],
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
        assignmentError.value = $t("pleaseEnterValidTargetForSelectedItems");
        throw new Error(assignmentError.value);
      }
    } else if (
      canAssignDirectlyToUser.value &&
      form.value.assigned_user_id !== null
    ) {
      assignmentsPayload.to_employees.push({
        id: form.value.assigned_user_id,
        target: form.value.target,
      });
      hasValidAssignment = true;
    } else {
      hasValidAssignment = true;
    }

    if (!hasValidAssignment) {
      assignmentError.value = $t("assignmentRequirementMessage");
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

      // Check if total assigned exceeds overall target
      if (total > overall) {
        assignmentError.value = $t("totalAssignedTargetExceedsKpiTarget", {
          totalAssigned: total,
          kpiTarget: overall
        });
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
      department_id: form.value.department_id,
      assignments: assignmentsPayload,
    };

    if (
      !kpiData.assignments.to_employees ||
      kpiData.assignments.to_employees.length === 0
    ) {
      delete kpiData.assignments.to_employees;
    }
    if (
      !kpiData.assignments.to_departments ||
      kpiData.assignments.to_departments.length === 0
    ) {
      delete kpiData.assignments.to_departments;
    }
    if (
      !kpiData.assignments.to_sections ||
      kpiData.assignments.to_sections.length === 0
    ) {
      delete kpiData.assignments.to_sections;
    }

    // If isCopy is true, always create new KPI, don't update the template
    if (selectedTemplateKpiId.value && !isCopy.value) {
      await store.dispatch("kpis/updateKpi", {
        id: selectedTemplateKpiId.value,
        kpiData: kpiData,
      });
    } else {
      await store.dispatch("kpis/createKpi", kpiData);
    }

    resetForm(true);

    router.push({
      name: "KpiListDepartment",
      params: { departmentId: form.value.department_id },
    });
  } catch (error) {
    if (error instanceof Error && error.message === assignmentError.value) {
      // Assignment validation failed - error is already handled by assignmentError
      return;
    }

    const errorMessage =
      getTranslatedErrorMessage(error?.response?.data?.message) ||
      error?.message ||
      i18n.global.t("errors.unknownError");
    notification.error({
      message: i18n.global.t("errors.unknownError"),
      description: errorMessage,
      duration: 5,
    });
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = (errorInfo) => {
  let errorMessages = "Please check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    const nonAssignmentErrors = errorInfo.errorFields.filter(
      (field) => field.name[0] !== "assignment" && field.name[0] !== "targets"
    );
    if (nonAssignmentErrors.length > 0) {
      const firstErrorField = nonAssignmentErrors[0];
      const errors = Array.isArray(firstErrorField.errors)
        ? firstErrorField.errors.join(", ")
        : "Unknown error";
      errorMessages = `${errors}`;
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

const validateEndDate = async (_rule, value) => {
  if (!value || !form.value.start_date) return Promise.resolve();
  const start = dayjs(form.value.start_date);
  const end = dayjs(value);
  if (end.isBefore(start, "day")) {
    return Promise.reject(new Error($t("endDateMustBeAfterStartDate")));
  }
  const freq = form.value.frequency;
  if (freq === "daily") {
    return Promise.resolve();
  }
  if (freq === "weekly") {
    if (end.diff(start, "day") < 6) {
      return Promise.reject(new Error($t("endDateAtLeastOneWeek")));
    }
  }
  if (freq === "monthly") {
    if (end.diff(start, "day") < 29) {
      return Promise.reject(new Error($t("endDateAtLeastOneMonth")));
    }
  }
  if (freq === "quarterly") {
    if (end.diff(start, "day") < 89) {
      return Promise.reject(new Error($t("endDateAtLeastOneQuarter")));
    }
  }
  if (freq === "yearly") {
    if (end.diff(start, "day") < 364) {
      return Promise.reject(new Error($t("endDateAtLeastOneYear")));
    }
  }
  return Promise.resolve();
};

const formRules = reactive({
  department_id: [
    {
      required: true,
      message: $t("pleaseSelectDepartment"),
    },
  ],
  perspective_id: [
    {
      required: true,
      message: $t("pleaseSelectPerspective"),
    },
  ],
  name: [
    {
      required: true,
      message: $t("pleaseEnterKpiName"),
      trigger: "blur",
    },
  ],
  formula_id: [
    {
      required: true,
      message: $t("pleaseSelectFormula"),
    },
  ],
  type: [
    {
      required: true,
      message: $t("pleaseSelectKpiType"),
    },
  ],
  unit: [
    {
      required: true,
      message: $t("pleaseSelectUnit"),
    },
  ],
  target: [
    {
      required: true,
      message: $t("pleaseEnterTarget"),
      trigger: "blur",
    },
    {
      validator: async (_, value) => {
        const numValue = parseFloat(value);
        if (value === null || value === "" || isNaN(numValue) || numValue < 0) {
          return Promise.reject($t("targetMustBeNonNegative"));
        }
        return Promise.resolve();
      },
      trigger: "blur",
    },
  ],
  weight: [
    {
      required: true,
      message: $t("pleaseEnterWeight"),
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
      message: $t("pleaseSelectFrequency"),
    },
  ],
  start_date: [
    {
      required: true,
      message: $t("pleaseSelectStartDate"),
    },
  ],
  end_date: [
    { required: true, message: $t("pleaseSelectEndDate") },
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

              formRef.value?.validateFields(["assignment"]).catch(() => { });
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

    formRef.value?.validateFields(["assignment"]).catch(() => { });
  }
);

watch(
  selectedRowKeys,
  (newKeys) => {
    if (newKeys?.length > 0) {
      form.value.assigned_user_id = null;

      formRef.value?.validateFields(["assignment"]).catch(() => { });
    } else if (newKeys?.length === 0 && form.value.assigned_user_id === null) {
      formRef.value?.validateFields(["assignment"]).catch(() => { });
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

                  formRef.value?.validateFields(["assignment"]).catch(() => { });
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
  () => form.value.frequency,
  () => {
    if (form.value.end_date && formRef.value) {
      formRef.value.validateFields(["end_date"]);
    }
  }
);

watch(
  () => form.value.targets,
  () => {
    formRef.value?.validateFields(["assignment"]).catch(() => { });
  },
  {
    deep: true,
  }
);

watch(
  () => form.value.department_id,
  async (newDepartmentId) => {
    if (loadingInitialData.value) return;
    if (applyingScopedOrg.value) return;

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

onMounted(async () => {
  loadingInitialData.value = true;
  try {
    await Promise.all([
      store.dispatch("departments/fetchDepartments"),
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("sections/fetchSections"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
      store.dispatch("formula/fetchFormulas"),
      ensureReviewCyclesLoaded().then(() => prefillStartEndFromStoreCycle()),
    ]);

    await applyOrgScopeFromUser();

    // Handle edit/copy KPI from templateKpiId query param
    const templateKpiIdFromRoute = route.query.templateKpiId;
    if (templateKpiIdFromRoute) {
      const kpiId = parseInt(templateKpiIdFromRoute, 10);
      if (!isNaN(kpiId)) {
        selectedTemplateKpiId.value = kpiId;
        await loadKpiTemplate(kpiId);

      } else {
        console.error("Invalid templateKpiId in route query.");
        notification.error({ message: "Invalid template ID provided." });
      }
    }
  } catch (error) {
    notification.error({
      message: "Failed to load necessary data.",
      description: error.message || "An error occurred.",
      duration: 5,
    });
  } finally {
    loadingInitialData.value = false;
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

.formula-form-label-with-tip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.formula-form-label-tip-wrap {
  display: inline-flex;
  align-items: center;
  cursor: help;
}

.formula-form-label-tip-icon {
  color: #94a3b8;
  font-size: 14px;
}
</style>
