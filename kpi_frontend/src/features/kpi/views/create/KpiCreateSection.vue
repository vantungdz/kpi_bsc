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
          >
            {{ department.name }}
          </a-select-option>
        </a-select>
      </a-form-item>

      <a-form-item
        class="textLabel"
        :label="$t('section')"
        name="section_id"
        required
      >
        <a-select
          v-model:value="form.section_id"
          :placeholder="$t('selectSection')"
        >
          <a-select-option
            v-for="section in sectionList"
            :key="section.id"
            :value="section.id"
          >
            {{ section.name }}
          </a-select-option>
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

      <a-form-item
        v-if="canAssignDirectlyToUser"
        class="textLabel"
        :label="$t('assignToUser')"
        name="assigned_user_id"
      >
        <a-alert
          v-if="assignmentError"
          :message="assignmentError"
          type="error"
          show-icon
          style="margin-bottom: 10px"
        />
        <a-select
          v-model:value="form.assigned_user_id"
          :placeholder="$t('selectUser')"
          show-search
          allow-clear
          :options="sectionUserOptions"
          :filter-option="
            (input, option) =>
              option.label.toLowerCase().includes(input.toLowerCase())
          "
          :loading="loadingSectionUsers"
          style="width: 100%"
        />
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

const router = useRouter();
const route = useRoute();
const store = useStore();

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
  assigned_user_id: null,
  assigned_user_target: null,
  description: "",
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
const loadingSectionUsers = computed(
  () => store.getters["users/loadingBySection"] || false
);

const sectionUserOptions = computed(() =>
  sectionUserList.value.map((user) => ({
    value: user.id,
    label: `${user.first_name} ${user.last_name}`,
  }))
);

const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const canAccessCreatePage = computed(() => {
  const allowedRoles = ["admin", "manager", "section"];

  return allowedRoles.includes(effectiveRole.value);
});

const canAssignDirectlyToUser = computed(() => {
  const allowedRolesForUserAssignment = ["admin", "manager", "section"];
  return allowedRolesForUserAssignment.includes(effectiveRole.value);
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
    assigned_user_id: null,
    description: "",
  };
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
  if (canAssignDirectlyToUser.value && form.value.assigned_user_id === null) {
    assignmentError.value =
      "Assignment Required: Please select a user to assign this KPI.";
    return Promise.reject("No user selected for assignment.");
  }

  assignmentError.value = null;
  return Promise.resolve();
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

    const assignmentsPayload = {
      from: creationScope,
      assigned_to_employee: [],
      to_sections: [],
      to_departments: [],
    };

    let hasValidAssignment = false;

    if (canAssignDirectlyToUser.value && form.value.assigned_user_id !== null) {
      assignmentsPayload.assigned_to_employee = form.value.assigned_user_id;
      hasValidAssignment = true;
    }

    // Add the selected section as to_sections with target equal to main target
    if (form.value.section_id !== null && form.value.section_id !== undefined) {
      assignmentsPayload.to_sections.push({
        id: form.value.section_id,
        target: form.value.target !== null ? Number(form.value.target) : null,
      });
      hasValidAssignment = true;
    }

    // Add the selected department as to_departments with target equal to main target
    if (
      form.value.department_id !== null &&
      form.value.department_id !== undefined
    ) {
      assignmentsPayload.to_departments.push({
        id: form.value.department_id,
        target: form.value.target !== null ? Number(form.value.target) : null,
      });
      hasValidAssignment = true;
    }

    if (!hasValidAssignment) {
      assignmentError.value =
        "Assignment Required: Please select a user or section/department to assign this KPI.";
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

      section_id: form.value.section_id,
      department_id: form.value.department_id,
      assignments: assignmentsPayload,
    };

    console.log("Submitting KPI Data (Final Structure):", kpiData);

    await store.dispatch("kpis/createKpi", kpiData);

    resetForm(true);

    router.push({
      name: "KpiListSection",
      params: { sectionId: form.value.section_id },
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
      (field) => field.name[0] !== "assigned_user_id"
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
        (field) => field.name[0] === "assigned_user_id"
      )
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
  section_id: [
    {
      required: true,
      message: "Please select Section",
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

  assigned_user_id: [
    {
      validator: validateAssignment,
      required: computed(() => canAssignDirectlyToUser.value),
      message: "Please select a user for assignment",
      trigger: "change",
    },
  ],
});

watch(
  () => form.value.assigned_user_id,
  (newVal) => {
    if (!(canAssignDirectlyToUser.value && newVal === null)) {
      assignmentError.value = null;
    }

    formRef.value?.validateFields(["assigned_user_id"]).catch(() => {});
  },
  { immediate: true }
);

onMounted(async () => {
  loadingInitialData.value = true;
  try {
    await Promise.all([
      store.dispatch("perspectives/fetchPerspectives"),
      store.dispatch("kpis/fetchAllKpisForSelect"),
      store.dispatch("departments/fetchDepartments"),
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
