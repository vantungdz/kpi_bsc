<template>
  <div v-if="canAccessCreatePage">
    <LoadingOverlay :visible="loading" />
    <a-form
      ref="formRef"
      :model="form"
      @finish="handleChangeCreate"
      @finishFailed="onFinishFailed"
      layout="vertical"
    >
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('perspective')"
            name="perspective_id"
            :rules="[{ required: true, message: $t('pleaseSelectPerspective') }]"
          >
            <a-select
              v-model:value="form.perspective_id"
              :placeholder="$t('perspective')"
            >
              <a-select-option
                v-for="perspective in perspectiveList"
                :key="perspective.id"
                :value="perspective.id"
              >
                {{ perspective.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('kpiName')"
            name="name"
            :rules="[{ required: true, message: $t('pleaseEnterKpiName') }]"
          >
            <a-input v-model:value="form.name" :placeholder="$t('kpiName')" />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('type')"
            name="type"
            :rules="[{ required: true, message: $t('pleaseEnterTypeKpi') }]"
          >
            <a-select v-model:value="form.type" :placeholder="$t('typeKpi')">
              <a-select-option value="efficiency">{{
                $t("efficiency")
              }}</a-select-option>
              <a-select-option value="qualitative">{{
                $t("qualitative")
              }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            name="formula_id"
            :rules="[{ required: true, message: $t('pleaseSelectFormula') }]"
          >
            <template #label>
              <span class="formula-form-label-with-tip">
                {{ $t("calculationFormula") }}
                <a-tooltip
                  :title="selectedFormulaExpressionTooltip"
                  :overlayInnerStyle="formulaExpressionTooltipInnerStyle"
                >
                  <span class="formula-form-label-tip-wrap">
                    <InfoCircleOutlined class="formula-form-label-tip-icon" />
                  </span>
                </a-tooltip>
              </span>
            </template>
            <a-select
              v-model:value="form.formula_id"
              :placeholder="$t('selectCalculationFormula')"
              :loading="formulaList.length === 0"
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
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('unit')"
            name="unit"
            :rules="[{ required: true, message: $t('pleaseEnterUnit') }]"
          >
            <a-select v-model:value="form.unit" :placeholder="$t('unit')">
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
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('frequency')"
            name="frequency"
            :rules="[{ required: true, message: $t('pleaseSelectFrequency') }]"
          >
            <a-select v-model:value="form.frequency" :placeholder="$t('frequency')">
              <a-select-option value="daily">{{ $t("daily") }}</a-select-option>
              <a-select-option value="weekly">{{ $t("weekly") }}</a-select-option>
              <a-select-option value="monthly">{{ $t("monthly") }}</a-select-option>
              <a-select-option value="quarterly">{{
                $t("quarterly")
              }}</a-select-option>
              <a-select-option value="yearly">{{ $t("yearly") }}</a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('target')"
            name="target"
            :rules="[{ required: true, message: $t('pleaseEnterTarget') }]"
          >
            <a-input
              v-model:value="form.target"
              :placeholder="$t('target')"
              @input="(event) => handleNumericInput('target', event)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('weight')"
            name="weight"
            :rules="[
              { required: true, message: $t('pleaseEnterWeight') },
              { validator: validateWeight },
            ]"
          >
            <a-input
              v-model:value="form.weight"
              :placeholder="$t('weight')"
              @input="(event) => handleNumericInput('weight', event)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('dateStart')"
            name="start_date"
            :rules="[{ required: true, message: $t('pleaseSelectStartDate') }]"
          >
            <a-date-picker
              v-model:value="form.start_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
              :disabled="true"
            />
          </a-form-item>
        </a-col>
        <a-col :span="6">
          <a-form-item
            class="textLabel"
            :label="$t('dateEnd')"
            name="end_date"
            :rules="[
              { required: true, message: $t('pleaseSelectEndDate') },
              { validator: validateEndDate, trigger: 'change' },
            ]"
          >
            <a-date-picker
              v-model:value="form.end_date"
              style="width: 100%"
              value-format="YYYY-MM-DD"
              :disabled="true"
            />
          </a-form-item>
        </a-col>
      </a-row>
      <a-form-item :label="$t('description')" name="description">
        <v-md-editor
          v-model="form.description"
          height="400px"
          :placeholder="$t('description')"
        ></v-md-editor>
      </a-form-item>

      <a-form-item>
        <a-row justify="end" style="margin-top: 10px">
          <a-button
            style="margin-right: 10px"
            type="primary"
            html-type="submit"
            :loading="loading"
          >
            {{ $t("saveKpi") }}
          </a-button>
          <a-button type="default" @click="$router.push('/personal')">{{
            $t("back")
          }}</a-button>
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
    <a-button
      type="default"
      style="margin-top: 15px"
      @click="$router.push('/personal')"
    >
      {{ $t("back") }}
    </a-button>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";
import { KpiUnits } from "@/core/constants/kpiConstants.js";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";
import { watchReviewCycleAndPrefillDates } from "@/core/composables/useWatchReviewCyclePrefillDates";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { InfoCircleOutlined } from "@ant-design/icons-vue";

const router = useRouter();
const route = useRoute();
const store = useStore();
const loading = ref(false);
const formRef = ref(null);
const selectedKpiId = ref(null);
const { t: $t } = useI18n();

const actualUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);
const canAccessCreatePage = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.CREATE &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === "employee",
  ),
);

const form = ref({
  name: "",
  type: "",
  unit: "",
  target: "",
  weight: "",
  frequency: "",
  perspective_id: null,
  parent: null,
  assigned_to_id: null,
  start_date: null,
  end_date: null,
  description: "",
  formula_id: null,
});

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || [],
);
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

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;
  form.value[field] = formatted;
};

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (!value || value === "") return 0;

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const validateWeight = async (_rule, value) => {
  if (value === null || value === "") return Promise.resolve();
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return Promise.reject("Weight must be a number");
  if (numValue < 0 || numValue > 999.99) {
    return Promise.reject("Weight must be between 0 and 999.99");
  }
  return Promise.resolve();
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

const formatToDateString = (dateValue) => {
  return dateValue ? dayjs(dateValue).format("YYYY-MM-DD") : null;
};

const handleChangeCreate = async () => {
  loading.value = true;
  try {
    await formRef.value?.validate();

    const targetValue = parseNumber(form.value.target);
    const weightValue = parseNumber(form.value.weight);

    const payload = {
      name: form.value.name,
      type: form.value.type,
      unit: form.value.unit,
      target: targetValue,
      weight: weightValue,
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      start_date: formatToDateString(form.value.start_date),
      end_date: formatToDateString(form.value.end_date),
      description: form.value.description,
      formula_id: form.value.formula_id,
      assignments: {
        from: "employee",
        assigned_to_employee: store.getters["auth/user"]?.id || null,
        target: targetValue,
        weight: weightValue,
      },
    };

    const currentUserId = store.getters["auth/user"]?.id || null;
    if (!currentUserId) {
      notification.error({
        message: "Error",
        description: "Could not determine current user for assignment.",
      });
      loading.value = false;
      return;
    }

    payload.assignments = {
      from: "employee",
      to_employees: [
        {
          id: currentUserId,
          target: targetValue,
          weight: weightValue,
        },
      ],
    };

    if (selectedKpiId.value) {
      await store.dispatch("kpis/updateKpi", {
        id: selectedKpiId.value,
        kpiData: payload,
      });
    } else {
      await store.dispatch("kpis/createKpi", payload);
    }

    router.push("/personal");
  } catch (error) {
    console.error("Personal KPI creation failed:", error);
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      "Personal KPI creation failed.";
    notification.error({
      message: "Creation Failed",
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
    const firstErrorField = errorInfo.errorFields[0];

    const errors = Array.isArray(firstErrorField.errors)
      ? firstErrorField.errors.join(", ")
      : "Unknown error";
    errorMessages = `${errors}`;
  }
  notification.error({
    message: "Form Validation Failed",
    description: errorMessages,
  });
};

const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    return;
  }
  try {
    await store.dispatch("kpis/fetchKpiDetail", selectedId);
    const kpiDetail = store.getters["kpis/currentKpi"];
    const targetAssignment = kpiDetail.assignments.find(
      (assign) => assign.assigned_to_employee === actualUser.value?.id
    );

    if (kpiDetail) {
      form.value.name = kpiDetail.name;
      form.value.formula_id = kpiDetail.formula_id;
      form.value.type = kpiDetail.type || null;
      form.value.unit = kpiDetail.unit || null;
      form.value.target = targetAssignment.targetValue || "";
      form.value.weight = kpiDetail.weight ?? null;
      form.value.frequency = kpiDetail.frequency || null;
      form.value.perspective_id = kpiDetail.perspective?.id || null;
      form.value.parent = kpiDetail.parent || null;
      form.value.description = kpiDetail.memo || kpiDetail.description || "";
      await ensureReviewCyclesLoaded();
      prefillStartEndFromStoreCycle();
    }
  } catch (error) {
    console.error("Error loading KPI template:", error);
    notification.error({
      message: "Failed to load KPI template data.",
    });
  }
}

watch(
  () => form.value.frequency,
  () => {
    if (form.value.end_date && formRef.value) {
      formRef.value.validateFields(["end_date"]);
    }
  },
);

onMounted(async () => {
  await Promise.all([
    store.dispatch("perspectives/fetchPerspectives"),
    store.dispatch("formula/fetchFormulas"),
    ensureReviewCyclesLoaded().then(() => prefillStartEndFromStoreCycle()),
  ]);
  const templateKpiIdFromRoute = route.query.templateKpiId;
  if (templateKpiIdFromRoute) {
    selectedKpiId.value = templateKpiIdFromRoute;
    loadKpiTemplate(selectedKpiId.value);
  }
});
</script>

<style scoped>
.textLabel label {
  font-weight: bold !important;
}

.ant-form-item {
  margin-bottom: 16px;
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
