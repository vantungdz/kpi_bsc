<template>
  <div v-if="canAccessCreatePage">
    <LoadingOverlay :visible="loading || loadingUsers || loadingKpiTemplate" />
    <a-form
      ref="formRef"
      :model="form"
      :rules="formRules"
      layout="vertical"
      @finish="handleChangeCreate"
      @finishFailed="onFinishFailed"
    >
      <a-form-item
        class="textLabel"
        :label="$t('performanceObjectives')"
        name="performanceObjective_id"
        :rules="[
          { required: true, message: $t('pleaseSelectPerformanceObjective') },
        ]"
      >
        <a-select
          v-model:value="form.performanceObjective_id"
          :placeholder="$t('performanceObjectives')"
        >
          <a-select-option value="1">{{ $t("rank123") }}</a-select-option>
          <a-select-option value="2">{{ $t("rank456") }}</a-select-option>
          <a-select-option value="3">{{ $t("rank789") }}</a-select-option>
        </a-select>
      </a-form-item>

      <a-row :gutter="12">
        <a-col :span="8">
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
        </a-col>
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('kpiName')" name="name">
            <a-input
              v-model:value="form.name"
              :placeholder="$t('enterKpiName')"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
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
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item class="textLabel" name="formula_id">
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
        <a-col :span="8">
          <a-form-item
            class="textLabel"
            :label="$t('frequency')"
            name="frequency"
          >
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
        </a-col>
      </a-row>
      <a-row :gutter="12">
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('target')" name="target">
            <a-input
              v-model:value="form.targetFormatted"
              :placeholder="$t('enterTarget')"
              @input="(event) => handleNumericInput('target', event)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8">
          <a-form-item class="textLabel" :label="$t('weight')" name="weight">
            <a-input
              v-model:value="form.weight"
              :placeholder="$t('enterWeight')"
              @input="(event) => handleNumericInput('weight', event)"
            />
          </a-form-item>
        </a-col>
        <a-col :span="8" />
      </a-row>

      <a-form-item
        class="textLabel"
        :label="$t('description')"
        name="description"
      >
        <v-md-editor
          v-model="form.description"
          height="400px"
          :placeholder="$t('enterDescription')"
        ></v-md-editor>
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
import { ref, computed, onMounted, watch, reactive, nextTick } from "vue";
import { useRouter, useRoute } from "vue-router";
import { useStore } from "vuex";
import { getTranslatedErrorMessage } from "@/core/services/messageTranslator";
import i18n from "@/core/i18n";
import { useNavigation } from "@/core/utils/navigation";
import {
  notification,
  Alert as AAlert,
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  Select as ASelect,
  SelectOption as ASelectOption,
  Row as ARow,
  Col as ACol,
  Button as AButton,
} from "ant-design-vue";
import { KpiUnits } from "@/core/constants/kpiConstants.js";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import { InfoCircleOutlined } from "@ant-design/icons-vue";

const router = useRouter();
const route = useRoute();
const store = useStore();
const { goBack } = useNavigation();

const loading = ref(false);
const loadingUsers = ref(false);
const formRef = ref();
const selectedTemplateKpiId = ref(null);
const loadingKpiTemplate = ref(false);
const { t: $t } = useI18n();

// Check if this is edit mode (has templateKpiId and isCopy is false or not present)
const isEditMode = computed(() => {
  const isEdit = route.query.isEdit;
  return isEdit;
});

const form = ref({
  name: "",
  formula_id: null,
  type: null,
  unit: null,
  target: null,
  weight: null,
  frequency: null,
  perspective_id: null,
  description: "",
});

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

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || [],
);

const authUser = computed(() => store.getters["auth/user"]);
const userPermissions = computed(() => {
  const u = authUser.value;
  if (!u) return [];
  const direct = Array.isArray(u.permissions) ? u.permissions : [];
  if (direct.length > 0) return direct;
  const roles = Array.isArray(u.roles) ? u.roles : [];
  return roles.flatMap((r) => (Array.isArray(r?.permissions) ? r.permissions : []));
});

function hasKpiCompanyPermission(action) {
  return userPermissions.value.some(
    (p) =>
      String(p.action ?? "").trim() === action &&
      String(p.resource ?? "").trim() === RBAC_RESOURCES.KPI &&
      p.scope === "company",
  );
}

const canAccessCreatePage = computed(() => {
  if (isEditMode.value) {
    return hasKpiCompanyPermission(RBAC_ACTIONS.UPDATE);
  }
  const copying =
    route.query.templateKpiId != null && String(route.query.templateKpiId) !== "";
  if (copying) {
    return (
      hasKpiCompanyPermission(RBAC_ACTIONS.CREATE) ||
      hasKpiCompanyPermission(RBAC_ACTIONS.COPY_TEMPLATE)
    );
  }
  return hasKpiCompanyPermission(RBAC_ACTIONS.CREATE);
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
    description: "",
  };
  if (clearTemplateSelection) {
    selectedTemplateKpiId.value = null;
  }
};

// Flag to prevent perspective reset when loading template
const isLoadingTemplate = ref(false);

const loadKpiTemplate = async (selectedId) => {
  if (!selectedId) {
    resetForm();
    return;
  }
  loadingKpiTemplate.value = true;
  isLoadingTemplate.value = true; // Set flag to prevent perspective reset
  try {
    // Load template from templates store, not KPIs
    await store.dispatch("templates/fetchItemById", selectedId);
    const templateDetail = store.getters["templates/detail"];

    if (templateDetail) {
      // Save perspective_id BEFORE setting performanceObjective_id
      // to prevent it from being reset by change handler
      const savedPerspectiveId =
        templateDetail.perspective?.id || templateDetail.perspective_id || null;

      // Only add "(Copy)" if this is copy mode, not edit mode
      form.value.name = templateDetail.name
        ? (isEditMode.value ? templateDetail.name : `${templateDetail.name} (Copy)`)
        : "";
      form.value.performanceObjective_id =
        templateDetail.typePerformance || "1";
      form.value.formula_id = templateDetail.formula_id || null;
      form.value.type = templateDetail.type || null;
      form.value.unit = templateDetail.unit || null;
      form.value.target = templateDetail.target ?? null;
      form.value.targetFormatted =
        templateDetail.target !== null && templateDetail.target !== undefined
          ? String(templateDetail.target).replace(/\B(?=(\d{3})+(?!\d))/g, ",")
          : "";
      form.value.weight = templateDetail.weight ?? null;
      form.value.frequency = templateDetail.frequency || null;

      // Set perspective_id AFTER performanceObjective_id to ensure it's not reset
      form.value.perspective_id = savedPerspectiveId;

      form.value.description = templateDetail.description || "";

      // Use nextTick to ensure perspective is set after all reactive updates
      await nextTick();
      form.value.perspective_id = savedPerspectiveId;

      // Only show notification if not in edit mode (to avoid confusion)
      if (!isEditMode.value) {
        notification.success({
          message: `Loaded data from Template: ${templateDetail.name}`,
        });
      }
    } else {
      throw new Error("Template Detail not found.");
    }
  } catch (error) {
    console.error("Error loading template:", error);
    notification.error({
      message: "Failed to load template data.",
    });
    resetForm();
  } finally {
    loadingKpiTemplate.value = false;
    isLoadingTemplate.value = false; // Reset flag
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

const validateWeight = async (_rule, value) => {
  if (!value && value !== 0) return Promise.resolve();
  if (isNaN(value)) return Promise.reject("Weight must be a number");
  const numValue = parseFloat(value);
  if (numValue < 0 || numValue > 100)
    return Promise.reject("Weight must be between 0 and 100");
  return Promise.resolve();
};

const handleChangeCreate = async () => {
  loading.value = true;

  try {
    await formRef.value?.validate();

    // Format numeric values
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

    // Prepare template data (templates don't have assignments)
    const templateData = {
      name: form.value.name,
      typePerformance: form.value.performanceObjective_id || "1", // Map performanceObjective_id to typePerformance
      formula_id: form.value.formula_id,
      type: form.value.type,
      unit: form.value.unit,
      target: numericMainTarget,
      weight: numericMainWeight,
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      description: form.value.description || "",
    };

    if (isEditMode.value && selectedTemplateKpiId.value) {
      // Update existing template
      await store.dispatch("templates/updateItem", {
        id: selectedTemplateKpiId.value,
        data: templateData,
      });

      // Show success notification
      notification.success({
        message: $t("templateUpdatedSuccessfully"),
        duration: 3,
      });

      // Navigate to templates list page
      router.push("/kpis/templates");
    } else {
      // Create new template
      await store.dispatch("templates/createItem", templateData);

      // Show success notification
      notification.success({
        message: $t("templateCreatedSuccessfully"),
        duration: 3,
      });

      // Reset form
      resetForm(true);

      // Navigate to templates list page
      router.push("/kpis/templates");
    }
  } catch (error) {
    console.error("Error creating template:", error);
    const errorMessage =
      getTranslatedErrorMessage(error?.response?.data?.message) ||
      error?.message ||
      i18n.global.t("errors.unknownError");
    notification.error({
      message:
        i18n.global.t("errors.unknownError") || "Error creating template",
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

const formRules = reactive({
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
});

watch(
  () => form.value.frequency,
  () => {
    // Frequency change handler - no date validation needed for templates
  },
);

onMounted(async () => {
  loadingUsers.value = true;
  try {
    await Promise.all([
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("formula/fetchFormulas"),
    ]);
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
