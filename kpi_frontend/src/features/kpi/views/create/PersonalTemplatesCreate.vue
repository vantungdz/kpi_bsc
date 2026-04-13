<template>
  <div v-if="canAccessCreatePage">
    <LoadingOverlay :visible="loading" />
    <a-form ref="formRef" :model="form" @finish="handleChangeCreate" @finishFailed="onFinishFailed" layout="vertical">
      <a-form-item class="textLabel" :label="$t('performanceObjectives')" name="performanceObjective_id"
        :rules="[{ required: true, message: $t('pleaseSelectPerformanceObjective') }]">
        <a-select v-model:value="form.performanceObjective_id" :placeholder="$t('performanceObjectives')">
          <a-select-option value="1">{{
            $t("rank123")
            }}</a-select-option>
          <a-select-option value="2">{{
            $t("rank456")
            }}</a-select-option>
          <a-select-option value="3">{{
            $t("rank789")
            }}</a-select-option>
        </a-select>
      </a-form-item>

      <!-- Template selection table -->
      <a-form-item v-if="showTemplateTable">
        <div style="margin-top: 20px; margin-bottom: 20px">
          <a-table :columns="templateTableColumns" :dataSource="filteredTemplateList" :rowSelection="rowSelection"
            :pagination="false" rowKey="id" size="small" bordered>
            <template #bodyCell="{ column, record }">
              <template v-if="column.dataIndex === 'name'">
                <span
                  :style="isTemplateAlreadyCreated(record) ? { color: '#999', textDecoration: 'line-through' } : {}">
                  {{ record.name }}
                </span>
                <a-tag v-if="isTemplateAlreadyCreated(record)" color="orange" style="margin-left: 8px">
                  {{ $t('alreadyCreated') || 'Already Created' }}
                </a-tag>
              </template>
              <template v-else-if="column.dataIndex === 'target'">
                <span>{{ `${Number(record.target || 0).toLocaleString()} ${record.unit || ''}` }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'weight'">
                <span>{{ record.weight || 0 }}</span>
              </template>
              <template v-else-if="column.dataIndex === 'description'">
                <span>{{ record.description || '-' }}</span>
              </template>
            </template>
          </a-table>
        </div>
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
import { Tag as ATag } from "ant-design-vue";
import {
  RBAC_ACTIONS,
  RBAC_RESOURCES,
} from "@/core/constants/rbac.constants.js";
import { useI18n } from "vue-i18n";
import LoadingOverlay from "@/core/components/common/LoadingOverlay.vue";
import dayjs from "dayjs";

const router = useRouter();
const store = useStore();
const loading = ref(false);
const formRef = ref(null);
const { t: $t } = useI18n();

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || [],
);

const templateKpiList = computed(() => store.getters["templates/list"] || []);

async function ensureReviewCyclesLoaded() {
  if (!store.getters["reviewCycle/loaded"]) {
    await store.dispatch("reviewCycle/fetchCycles");
  }
}

function startEndFromStoreSelectedCycle() {
  const cycle = store.getters["reviewCycle/selectedCycle"];
  if (!cycle) return { startDate: null, endDate: null };
  const start = cycle.startDate || cycle.start_date;
  const end = cycle.endDate || cycle.end_date;
  if (!start || !end) return { startDate: null, endDate: null };
  return {
    startDate: dayjs(start).format("YYYY-MM-DD"),
    endDate: dayjs(end).format("YYYY-MM-DD"),
  };
}

// My assigned KPIs to check if template already created
const myAssignments = ref([]);
const loadingMyAssignments = ref(false);

// Filter templates based on performanceObjective_id only
const showTemplateTable = computed(() => {
  // Show table when performanceObjective_id is selected
  return !!form.value.performanceObjective_id;
});

const filteredTemplateList = computed(() => {
  if (!showTemplateTable.value || !form.value.performanceObjective_id) {
    return [];
  }

  const selectedTypePerformance = form.value.performanceObjective_id;


  const filtered = templateKpiList.value.filter((template) => {
    // Match typePerformance (can be string '1' or number 1)
    const templateTypePerformance = template.typePerformance;
    const matchesTypePerformance =
      String(templateTypePerformance) === String(selectedTypePerformance) ||
      Number(templateTypePerformance) === Number(selectedTypePerformance);

    return matchesTypePerformance;
  });

  return filtered;
});

// Selected template IDs
const selectedTemplateIds = ref([]);

// Table columns for templates
const templateTableColumns = computed(() => [
  {
    title: $t('kpiName'),
    dataIndex: 'name',
    key: 'name',
    width: '25%',
  },
  {
    title: $t('target'),
    dataIndex: 'target',
    key: 'target',
    width: '20%',
  },
  {
    title: $t('weight'),
    dataIndex: 'weight',
    key: 'weight',
    width: '15%',
  },
  {
    title: $t('description') || 'Description',
    dataIndex: 'description',
    key: 'description',
    width: '40%',
  },
]);

// Check if template is already created as KPI
const isTemplateAlreadyCreated = (template) => {
  if (!template || !myAssignments.value || myAssignments.value.length === 0) {
    return false;
  }

  const currentTypePerformance = form.value.performanceObjective_id;

  return myAssignments.value.some((kpi) => {
    // Compare key attributes to determine if KPI was created from this template
    const templateTarget = parseNumber(template.target || 0);
    const kpiTarget = parseNumber(kpi.target || 0);

    const templateWeight = parseNumber(template.weight || 0);
    const kpiWeight = parseNumber(kpi.weight || 0);

    const templateFormulaId = template.formula_id || template.formula?.id || null;
    const kpiFormulaId = kpi.formula_id || kpi.formula?.id || null;

    // Compare name (exact match) - most important
    const nameMatches = kpi.name === template.name;

    // Compare target (with small tolerance for floating point)
    const targetMatches = Math.abs(templateTarget - kpiTarget) < 0.01;

    // Compare unit
    const unitMatches = (kpi.unit || '') === (template.unit || '');

    // Compare weight (with small tolerance)
    const weightMatches = Math.abs(templateWeight - kpiWeight) < 0.01;

    // Compare description
    const descriptionMatches = (kpi.description) === template.description;

    // Compare formula_id
    const formulaMatches = templateFormulaId === kpiFormulaId;

    // Compare perspective_id - use template's perspective_id
    const perspectiveMatches = kpi.perspective_id === template.perspective_id;

    // Compare typePerformance - use current form value since KPI is created with form's typePerformance
    const typePerformanceMatches = currentTypePerformance ?
      (kpi.typePerformance === currentTypePerformance || kpi.typePerformance === String(currentTypePerformance)) :
      (!kpi.typePerformance || kpi.typePerformance === template.typePerformance ||
        kpi.typePerformance === String(template.typePerformance));

    // Template is considered already created if most key attributes match
    // We require name, target, unit, and weight to match (weight is critical to distinguish templates with same name)
    // Plus at least 1 other attribute (formula, perspective, or typePerformance)
    const requiredMatches = nameMatches && targetMatches && unitMatches && weightMatches && descriptionMatches;
    const additionalMatches = [formulaMatches, perspectiveMatches, typePerformanceMatches].filter(Boolean).length;

    return requiredMatches && additionalMatches >= 1;
  });
};

// Row selection configuration with disabled state for already created templates
const rowSelection = computed(() => ({
  type: 'checkbox',
  selectedRowKeys: selectedTemplateIds.value,
  getCheckboxProps: (record) => ({
    disabled: isTemplateAlreadyCreated(record),
  }),
  onChange: (selectedKeys) => {
    // Filter out already created templates
    const validKeys = selectedKeys.filter(key => {
      const template = filteredTemplateList.value.find(t => t.id === key);
      return template && !isTemplateAlreadyCreated(template);
    });
    selectedTemplateIds.value = validKeys;
  },
  onSelectAll: (selected) => {
    if (selected) {
      // Only select templates that are not already created
      selectedTemplateIds.value = filteredTemplateList.value
        .filter(t => !isTemplateAlreadyCreated(t))
        .map(t => t.id);
    } else {
      selectedTemplateIds.value = [];
    }
  },
}));

const canAccessCreatePage = computed(() =>
  userPermissions.value.some(
    (p) =>
      p.action?.trim() === RBAC_ACTIONS.CREATE &&
      p.resource?.trim() === RBAC_RESOURCES.KPI &&
      p.scope === "employee",
  ),
);

const form = ref({
  performanceObjective_id: null,
  name: "",
  type: "",
  unit: "",
  target: "",
  weight: "",
  frequency: "",
  parent: null,
  assigned_to_id: null,
  description: "",
  formula_id: null,
});

const parseNumber = (value) => {
  if (typeof value === "number") return value;
  if (!value || value === "") return 0;

  const cleaned = String(value).replace(/[^\d.]/g, "");
  const num = Number(cleaned);
  return isNaN(num) ? 0 : num;
};

const handleChangeCreate = async () => {
  loading.value = true;
  try {
    await formRef.value?.validate();

    const currentUserId = store.getters["auth/user"]?.id || null;
    if (!currentUserId) {
      notification.error({
        message: "Error",
        description: "Could not determine current user for assignment.",
      });
      loading.value = false;
      return;
    }

    // If template table is shown, require at least one template to be selected
    if (showTemplateTable.value) {
      if (selectedTemplateIds.value.length === 0) {
        notification.warning({
          message: $t('noSelectedTemplates'),
          description: $t('descriptionNoSelectedTemplates'),
        });
        loading.value = false;
        return;
      }

      // Check if any selected template is already created
      const selectedTemplates = filteredTemplateList.value.filter(t =>
        selectedTemplateIds.value.includes(t.id)
      );
      const alreadyCreatedTemplates = selectedTemplates.filter(t => isTemplateAlreadyCreated(t));

      if (alreadyCreatedTemplates.length > 0) {
        notification.error({
          message: $t('templateAlreadyCreated') || "Template Already Created",
          description: $t('cannotCreateTemplateAgain', {
            names: alreadyCreatedTemplates.map(t => t.name).join(', ')
          }) || `Cannot create template(s) that have already been created: ${alreadyCreatedTemplates.map(t => t.name).join(', ')}`,
          duration: 5,
        });
        loading.value = false;
        return;
      }
    }

    // If templates are selected, create KPIs from templates
    if (showTemplateTable.value && selectedTemplateIds.value.length > 0) {
      await ensureReviewCyclesLoaded();
      const { startDate, endDate } = startEndFromStoreSelectedCycle();

      const selectedTemplates = filteredTemplateList.value.filter(t =>
        selectedTemplateIds.value.includes(t.id)
      );

      // Create KPI for each selected template
      const createPromises = selectedTemplates.map(async (template) => {
        const targetValue = parseNumber(template.target || 0);
        const weightValue = parseNumber(template.weight || 0);

        const payload = {
          name: template.name,
          type: template.type || "",
          unit: template.unit || "",
          target: targetValue,
          weight: weightValue,
          frequency: template.frequency || "",
          perspective_id: template.perspective_id || null,
          description: template.description || "",
          formula_id: template.formula_id || template.formula?.id || null,
          typePerformance: form.value.performanceObjective_id,
          start_date: startDate,
          end_date: endDate,
          assignments: {
            from: "employee",
            to_employees: [
              {
                id: currentUserId,
                target: targetValue,
                weight: weightValue,
              },
            ],
          },
        };

        return store.dispatch("kpis/createKpi", payload);
      });

      await Promise.all(createPromises);

      notification.success({
        message: "Success",
        description: `Successfully created ${selectedTemplates.length} KPI(s) from templates.`,
      });

      router.push("/personal");
      return;
    }
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
);

// Fetch templates from API
const fetchTemplates = async () => {
  try {
    await store.dispatch("templates/fetchItems");
  } catch (error) {
    console.error("Error fetching templates:", error);
  }
};

// Fetch my assigned KPIs to check for already created templates
const fetchMyAssignedKpis = async () => {
  const currentUserId = store.getters["auth/user"]?.id;
  if (!currentUserId) {
    return;
  }
  loadingMyAssignments.value = true;
  try {
    const assignmentsData = await store.dispatch(
      "kpis/fetchMyAssignments",
      currentUserId
    );
    myAssignments.value = assignmentsData || [];
  } catch (error) {
    console.error("Error fetching my assignments:", error);
    myAssignments.value = [];
  } finally {
    loadingMyAssignments.value = false;
  }
};

// Reset selected templates when performanceObjective_id changes
watch(
  () => form.value.performanceObjective_id,
  async (newValue) => {
    selectedTemplateIds.value = [];
    // Fetch templates when performanceObjective_id is selected
    if (newValue) {
      await fetchTemplates();
      // Refresh assignments when filters change to update already created status
      if (showTemplateTable.value) {
        fetchMyAssignedKpis();
      }
    }
  },
);

// Watch for template table visibility to fetch assignments
watch(
  () => showTemplateTable.value,
  (isVisible) => {
    if (isVisible) {
      fetchMyAssignedKpis();
    }
  },
);

onMounted(async () => {
  // Fetch templates on mount
  await fetchTemplates();
  // Fetch my assignments to check for already created templates
  await fetchMyAssignedKpis();
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
