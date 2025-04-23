<template>
  <a-form ref="formRef" :model="form" @finish="handleChangeCreate" @finishFailed="onFinishFailed" layout="vertical">
    <a-form-item class="textLabel" label="Perspective" name="perspective_id"
      :rules="[{ required: true, message: 'Please select Perspective' }]">
      <a-select v-model:value="form.perspective_id" placeholder="Perspective">
        <a-select-option v-for="perspective in perspectiveList" :key="perspective.id" :value="perspective.id">
          {{ perspective.name }}
        </a-select-option>
      </a-select>
    </a-form-item>

    <a-form-item class="textLabel" label="KPI Name" name="name"
      :rules="[{ required: true, message: 'Please enter KPI Name' }]">
      <a-input v-model:value="form.name" placeholder="KPI Name" />
    </a-form-item>
    <a-row :gutter="12">
      <a-col :span="12">
        <a-form-item class="textLabel" label="Type" name="type"
          :rules="[{ required: true, message: 'Please enter type kpi' }]">
          <a-select v-model:value="form.type" placeholder="Type KPI">
            <a-select-option value="efficiency">Hiệu suất</a-select-option>
            <a-select-option value="qualitative">Định Tính</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item class="textLabel" label="Unit" name="unit"
          :rules="[{ required: true, message: 'Please enter Unit' }]">
          <a-select v-model:value="form.unit" placeholder="Unit">
            <a-select-option value="MM">MM</a-select-option>
            <a-select-option value="Point">Point</a-select-option>
            <a-select-option value="Product">Product</a-select-option>
            <a-select-option value="Project">Project</a-select-option>
            <a-select-option value="Certification">Certification</a-select-option>
            <a-select-option value="Article">Article</a-select-option>
            <a-select-option value="Person">Person</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>
    <a-row :gutter="12">
      <a-col :span="12">
        <a-form-item class="textLabel" label="Target" name="target"
          :rules="[{ required: true, message: 'Please enter Target' }]">
          <a-input v-model:value="form.target" placeholder="Target"
            @input="(event) => handleNumericInput('target', event)" />
        </a-form-item>
      </a-col>
      <a-col :span="12">
        <a-form-item class="textLabel" label="Weight (%)" name="weight"
          :rules="[{ required: true, message: 'Please enter Weight' }, { validator: validateWeight }]">
          <a-input v-model:value="form.weight" placeholder="Weight"
            @input="(event) => handleNumericInput('weight', event)" />
        </a-form-item>
      </a-col>
    </a-row>
    <a-form-item class="textLabel" label="Frequency" name="frequency"
      :rules="[{ required: true, message: 'Please select Frequency' }]">
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
      <a-textarea v-model:value="form.description" placeholder="Description" allow-clear />
    </a-form-item>

    <a-form-item>
      <a-row justify="end" style="margin-top: 10px">
        <a-button style="margin-right: 10px" type="primary" html-type="submit" :loading="loading">
          Save KPI
        </a-button>
        <a-button type="default" @click="$router.push('/personal')">Back</a-button>
      </a-row>
    </a-form-item>
  </a-form>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue'; // Removed watch, defineProps
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { notification } from 'ant-design-vue';
import dayjs from 'dayjs'; // Assuming dayjs is needed for date handling

const router = useRouter();
const store = useStore();
const loading = ref(false);

// No props needed for scope

const formRef = ref(null); // Added formRef declaration

const form = ref({
  name: '',
  type: '',
  unit: '',
  target: '',
  weight: '',
  frequency: '',
  perspective_id: null, // Changed to null for select
  parent: null, // Parent KPI (if personal KPIs can have parents)
  assigned_to_id: null, // This will be the current user's ID, set in payload or backend
  start_date: null,
  end_date: null,
  description: '',
});

// Fetch only Perspectives for the dropdown
const perspectiveList = computed(() => store.getters['perspectives/perspectiveList'] || []);
// No need to fetch users, departments, sections lists

// Re-implement numeric input handling
const handleNumericInput = (field, event) => {
  let value = event.target.value;

  // Allow decimal numbers
  value = value.replace(/[^0-9.]/g, '');
  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }

  // Keep original value as string for form, convert to number for payload later
  form.value[field] = value;
};

// Re-implement weight validation
const validateWeight = async (_rule, value) => {
  if (value === null || value === '') return Promise.resolve(); // Allow empty/null if not required
  const numValue = parseFloat(value);
  if (isNaN(numValue)) return Promise.reject('Weight must be a number');
  if (numValue < 0 || numValue > 999.99) { // Check your required range
    return Promise.reject('Weight must be between 0 and 999.99');
  }
  return Promise.resolve();
};

// Helper for date formatting for payload if needed
const formatToISOString = (dateValue) => {
  return dateValue ? dayjs(dateValue).toISOString() : null;
};


// Hàm xử lý submit form
const handleChangeCreate = async () => {
  loading.value = true;
  try {
    // Validate form before submitting
    await formRef.value?.validate();

    // Build payload for personal KPI
    const payload = {
      name: form.value.name,
      type: form.value.type,
      unit: form.value.unit,
      target: Number(form.value.target), // Convert target to number
      weight: Number(form.value.weight), // Convert weight to number
      frequency: form.value.frequency,
      perspective_id: form.value.perspective_id,
      start_date: formatToISOString(form.value.start_date),
      end_date: formatToISOString(form.value.end_date),
      description: form.value.description,
      assignments: {
        from: 'employee',
        to_employee: form.value.assigned_to_id || store.getters['auth/user']?.id || null, // Assign to selected user (if field was kept) or current user
        target: Number(form.value.target), // Assuming assignment target is same as KPI target
        weight: Number(form.value.weight), // Assuming assignment weight is same as KPI weight
      }
    };

    // If 'Assigned To' field was removed from the form, the 'assigned_to_id' in form.value will be null.
    // We need to ensure the assignments payload correctly uses the current user's ID.
    const currentUserId = store.getters['auth/user']?.id || null;
    if (!currentUserId) {
      notification.error({ message: 'Error', description: 'Could not determine current user for assignment.' });
      loading.value = false;
      return;
    }
    // Rebuild assignments payload explicitly using current user ID
    payload.assignments = {
      from: 'employee', // Consistent with personal KPI scope
      assigned_to_employee: currentUserId, // Assign to the logged-in user
      target: Number(form.value.target),
      weight: Number(form.value.weight),
    };


    console.log("Submitting Personal KPI Data:", payload);

    // Dispatch createKpi action
    await store.dispatch('kpis/createKpi', payload);

    notification.success({ message: 'Personal KPI created successfully' });
    // Navigate back to the personal KPI list page
    router.push('/personal'); // Assuming /personal is the route for KpiPersonal.vue

  } catch (error) {
    console.error('Personal KPI creation failed:', error);
    const errorMessage =
      error?.response?.data?.message ||
      error?.message ||
      'Personal KPI creation failed.';
    notification.error({
      message: 'Creation Failed',
      description: errorMessage,
      duration: 5,
    });
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = (errorInfo) => {
  console.log('Form validation failed:', errorInfo);
  let errorMessages = 'Please check required fields and input formats.';
  if (errorInfo?.errorFields?.length > 0) {
    const firstErrorField = errorInfo.errorFields[0];
    const fieldName = Array.isArray(firstErrorField.name)
      ? firstErrorField.name.join('.')
      : firstErrorField.name;
    const errors = Array.isArray(firstErrorField.errors)
      ? firstErrorField.errors.join(', ')
      : 'Unknown error';
    errorMessages = `Error in field '${fieldName}': ${errors}`;
  }
  notification.error({
    message: 'Form Validation Failed',
    description: errorMessages,
  });
};


// --- Lifecycle Hook ---
onMounted(() => {
  console.log('PersonalCreate component mounted.');
  // Fetch only Perspectives for the dropdown
  store.dispatch('perspectives/fetchPerspectives');
  // No need to fetch users, departments, sections lists if not used in form
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