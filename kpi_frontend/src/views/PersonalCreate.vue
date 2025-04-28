<template>
  <a-form
    ref="formRef"
    :model="form"
    @finish="handleChangeCreate"
    @finishFailed="onFinishFailed"
    layout="vertical"
  >
    <a-form-item
      class="textLabel"
      label="Perspective"
      name="perspective_id"
      :rules="[{ required: true, message: 'Please select Perspective' }]"
    >
      <a-select v-model:value="form.perspective_id" placeholder="Perspective">
        <a-select-option
          v-for="perspective in perspectiveList"
          :key="perspective.id"
          :value="perspective.id"
        >
          {{ perspective.name }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item
      class="textLabel"
      label="KPI Name"
      name="name"
      :rules="[{ required: true, message: 'Please enter KPI Name' }]"
    >
      <a-input v-model:value="form.name" placeholder="KPI Name" />
    </a-form-item>
    <a-row :gutter="12">
      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Type"
          name="type"
          :rules="[{ required: true, message: 'Please enter type kpi' }]"
        >
          <a-select v-model:value="form.type" placeholder="Type KPI">
            <a-select-option value="efficiency">Hiệu suất</a-select-option>
            <a-select-option value="qualitative">Định Tính</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Unit"
          name="unit"
          :rules="[{ required: true, message: 'Please enter Unit' }]"
        >
          <a-select v-model:value="form.unit" placeholder="Unit">
            <a-select-option value="MM">MM</a-select-option>
            <a-select-option value="Point">Point</a-select-option>
            <a-select-option value="Product">Product</a-select-option>
            <a-select-option value="Project">Project</a-select-option>
            <a-select-option value="Certification"
              >Certification</a-select-option
            >
            <a-select-option value="Article">Article</a-select-option>
            <a-select-option value="Person">Person</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="12">
      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Target"
          name="target"
          :rules="[{ required: true, message: 'Please enter Target' }]"
        >
          <a-input
            v-model:value="form.target"
            placeholder="Target"
            @input="(event) => handleNumericInput('target', event)"
          />
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Weight (%)"
          name="weight"
          :rules="[
            { required: true, message: 'Please enter Weight' },
            { validator: validateWeight },
          ]"
        >
          <a-input
            v-model:value="form.weight"
            placeholder="Weight"
            @input="(event) => handleNumericInput('weight', event)"
          />
        </a-form-item>
      </a-col>
    </a-row>
    <a-form-item
      class="textLabel"
      label="Frequency"
      name="frequency"
      :rules="[{ required: true, message: 'Please select Frequency' }]"
    >
      <a-select v-model:value="form.frequency" placeholder="Frequency">
        <a-select-option value="daily">Daily</a-select-option>
        <a-select-option value="weekly">Weekly</a-select-option>
        <a-select-option value="monthly">Monthly</a-select-option>
        <a-select-option value="quarterly">Quarterly</a-select-option>
        <a-select-option value="yearly">Yearly</a-select-option>
      </a-select>
    </a-form-item>

    <a-row :gutter="12">
      <a-col :span="6">
        <a-form-item class="textLabel" label="Date Start" name="start_date">
          <a-date-picker v-model:value="form.start_date" style="width: 100%" />
        </a-form-item>
      </a-col>
      <a-col :span="6">
        <a-form-item class="textLabel" label="Date End" name="end_date">
          <a-date-picker v-model:value="form.end_date" style="width: 100%" />
        </a-form-item>
      </a-col>
    </a-row>
    <a-form-item class="textLabel" label="Description" name="description">
      <a-textarea
        v-model:value="form.description"
        placeholder="Description"
        allow-clear
      />
    </a-form-item>

    <a-form-item>
      <a-row justify="end" style="margin-top: 10px">
        <a-button
          style="margin-right: 10px"
          type="primary"
          html-type="submit"
          :loading="loading"
        >
          Save KPI
        </a-button>
        <a-button type="default" @click="$router.push('/personal')"
          >Back</a-button
        >
      </a-row>
    </a-form-item>
  </a-form>
</template>

<script setup>
import { ref, computed, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useStore } from "vuex";
import { notification } from "ant-design-vue";
import dayjs from "dayjs";

const router = useRouter();
const store = useStore();
const loading = ref(false);

const formRef = ref(null);

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
});

const perspectiveList = computed(
  () => store.getters["perspectives/perspectiveList"] || []
);

const handleNumericInput = (field, event) => {
  let value = event.target.value;

  value = value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }

  form.value[field] = value;
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

const formatToISOString = (dateValue) => {
  return dateValue ? dayjs(dateValue).toISOString() : null;
};

const handleChangeCreate = async () => {
  loading.value = true;
  try {
    await formRef.value?.validate();

    const payload = {
      name: form.value.name,
      type: form.value.type,
      unit: form.value.unit,
      target: Number(form.value.target),
      weight: Number(form.value.weight),
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      start_date: formatToISOString(form.value.start_date),
      end_date: formatToISOString(form.value.end_date),
      description: form.value.description,
      assignments: {
        from: "employee",
        to_employee:
          form.value.assigned_to_id || store.getters["auth/user"]?.id || null,
        target: Number(form.value.target),
        weight: Number(form.value.weight),
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
      assigned_to_employee: currentUserId,
      target: Number(form.value.target),
      weight: Number(form.value.weight),
    };

    console.log("Submitting Personal KPI Data:", payload);

    await store.dispatch("kpis/createKpi", payload);

    notification.success({ message: "Personal KPI created successfully" });

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

onMounted(() => {
  console.log("PersonalCreate component mounted.");

  store.dispatch("perspectives/fetchPerspectives");
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
