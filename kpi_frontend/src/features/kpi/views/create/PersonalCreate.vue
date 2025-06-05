<template>
  <div v-if="canAccessCreatePage">
    <a-form ref="formRef" :model="form" @finish="handleChangeCreate" @finishFailed="onFinishFailed" layout="vertical">
      <a-form-item class="textLabel" :label="$t('perspective')" name="perspective_id"
        :rules="[{ required: true, message: $t('pleaseSelectPerspective') }]">
        <a-select v-model:value="form.perspective_id" :placeholder="$t('perspective')">
          <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">
            {{ perspective.name }}
          </a-select-option>
        </a-select>
      </a-form-item>
      <a-row :gutter="12">
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('kpiName')" name="name"
            :rules="[{ required: true, message: $t('pleaseEnterKpiName') }]">
            <a-input v-model:value="form.name" :placeholder="$t('kpiName')" />
          </a-form-item>
        </a-col>
        <a-col :span="12">
          <a-form-item class="textLabel" :label="$t('calculationFormula')" name="formula_id"
            :rules="[{ required: true, message: $t('pleaseSelectFormula') }]">
            <a-select v-model:value="form.formula_id" :placeholder="$t('selectCalculationFormula')"
              :loading="formulaList.length === 0">
              <a-select-option v-for="formula in formulaList" :key="formula.id" :value="formula.id">
                {{ formula.name }}
              </a-select-option>
            </a-select>
          </a-form-item>
        </a-col>
      </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item class="textLabel" :label="$t('type')" name="type"
              :rules="[{ required: true, message: $t('pleaseEnterTypeKpi') }]">
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
          <a-col :span="12">
            <a-form-item class="textLabel" :label="$t('unit')" name="unit"
              :rules="[{ required: true, message: $t('pleaseEnterUnit') }]">
              <a-select v-model:value="form.unit" :placeholder="$t('unit')">
                <a-select-option v-for="(unitValue, unitKey) in KpiUnits" :key="unitKey" :value="unitValue">
                  {{ unitKey }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-col>
        </a-row>
        <a-row :gutter="12">
          <a-col :span="12">
            <a-form-item class="textLabel" :label="$t('target')" name="target"
              :rules="[{ required: true, message: $t('pleaseEnterTarget') }]">
              <a-input v-model:value="form.target" :placeholder="$t('target')"
                @input="(event) => handleNumericInput('target', event)" />
            </a-form-item>
          </a-col>
          <a-col :span="12">
            <a-form-item class="textLabel" :label="$t('weight')" name="weight" :rules="[
              { required: true, message: $t('pleaseEnterWeight') },
              { validator: validateWeight },
            ]">
              <a-input v-model:value="form.weight" :placeholder="$t('weight')"
                @input="(event) => handleNumericInput('weight', event)" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item class="textLabel" :label="$t('frequency')" name="frequency"
          :rules="[{ required: true, message: $t('pleaseSelectFrequency') }]">
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

        <a-row :gutter="12">
          <a-col :span="6">
            <a-form-item :label="$t('dateStart')" name="start_date"
              :rules="[{ required: true, message: $t('pleaseSelectStartDate') }]">
              <a-date-picker v-model:value="form.start_date" style="width: 100%" />
            </a-form-item>
          </a-col>
          <a-col :span="6">
            <a-form-item :label="$t('dateEnd')" name="end_date" :rules=" [
              { required: true, message: $t('pleaseSelectEndDate') },
              { validator: validateEndDate, trigger: 'change' },
            ]">
              <a-date-picker v-model:value="form.end_date" style="width: 100%" />
            </a-form-item>
          </a-col>
        </a-row>
        <a-form-item :label="$t('description')" name="description">
          <a-textarea v-model:value="form.description" :placeholder="$t('description')" allow-clear />
        </a-form-item>

        <a-form-item>
          <a-row justify="end" style="margin-top: 10px">
            <a-button style="margin-right: 10px" type="primary" html-type="submit" :loading="loading">
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
    <a-alert :message="$t('accessDenied')" :description="$t('accessDeniedDescription')" type="error" show-icon />
    <a-button type="default" style="margin-top: 15px" @click="$router.push('/personal')">
      {{ $t("back") }}
    </a-button>
  </div>
</template>

<script setup>
import { onMounted, ref, computed, watch } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";
import { KpiUnits } from "@/core/constants/kpiConstants.js";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";

const router = useRouter();
const store = useStore();
const loading = ref(false);
const formRef = ref(null);
const { t: $t } = useI18n();

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);
const canAccessCreatePage = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.CREATE &&
      p.resource?.trim() === RBAC_RESOURCES.KPI_EMPLOYEE
  )
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
  formula_id: null, // add formula_id to form
});

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);
const formulaList = computed(() => store.getters["formula/getFormulas"] || []);

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

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (!value || value === "") return 0;
  // Loại bỏ dấu phẩy, khoảng trắng, ký tự không phải số hoặc dấu chấm
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
      formula_id: form.value.formula_id, // use formula_id in payload
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

    console.log("Submitting Personal KPI Data:", payload);

    await store.dispatch("kpis/createKpi", payload);

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
  console.log("Form validation failed:", errorInfo);
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

watch(
  () => form.value.frequency,
  () => {
    if (form.value.end_date && formRef.value) {
      formRef.value.validateFields(["end_date"]);
    }
  }
)

onMounted(() => {
  console.log("PersonalCreate component mounted.");

  store.dispatch("perspectives/fetchPerspectives");
  store.dispatch("formula/fetchFormulas"); // fetch formulas from DB
});
</script>

<style scoped>
.textLabel label {
  font-weight: bold !important;
}

.ant-form-item {
  margin-bottom: 16px;
}
</style>
