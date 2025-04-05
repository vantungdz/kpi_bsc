<template>
  <a-form
    ref="formRef"
    :model="form"
    @finish="handleChangeCreate"
    @finishFailed="onFinishFailed"
    layout="vertical"
  >
    <a-row :gutter="16">
      <a-col :span="14">
        <a-form-item
          class="textLabel"
          label="KPI Name"
          name="name"
          :rules="[{ required: true, message: 'Please enter KPI Name' }]">
          <a-input v-model:value="form.name" placeholder="KPI Name" />
        </a-form-item>
      </a-col>

      <a-col :span="5">
        <a-form-item
          class="textLabel"
          label="Unit"
          name="unit"
          :rules="[{ required: true, message: 'Please enter Unit!' }]">
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

      <a-col :span="5">
        <a-form-item
          class="textLabel"
          label="Target"
          name="target"
          :rules="[{ required: true, message: 'Please enter Target!' }]">
          <a-input v-model:value="form.target" placeholder="Target" />
        </a-form-item>
      </a-col>

      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Parent KPI"
          name="parent">
          <a-select v-model:value="form.parent" placeholder="Parent KPI">
            <a-select-option value="1">Company Revenue</a-select-option>
            <a-select-option value="2">Dept A Sales</a-select-option>
            <a-select-option value="3">Team X Leads</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>

      <a-col :span="12">
        <a-form-item
          class="textLabel"
          label="Weight (%)"
          name="weight"
          :rules="[
            { required: true, message: 'Please enter Weight!' },
            { validator: validateWeight }
          ]"
        >
          <a-input 
            v-model:value="form.weight" 
            placeholder="Weight" 
            @input="handleWeightInput"
          />
        </a-form-item>
      </a-col>

      <a-col :span="8">
        <a-form-item
          class="textLabel"
          label="Frequency"
          name="frequency"
          :rules="[{ required: true, message: 'Please select Frequency!' }]">
          <a-select v-model:value="form.frequency" placeholder="Frequency">
            <a-select-option value="daily">Daily</a-select-option>
            <a-select-option value="weekly">Weekly</a-select-option>
            <a-select-option value="monthly">Monthly</a-select-option>
            <a-select-option value="quarterly">Quarterly</a-select-option>
            <a-select-option value="yearly">Yearly</a-select-option>
          </a-select>
        </a-form-item>
      </a-col>

      <a-col :span="8">
        <a-form-item
          class="textLabel"
          label="Perspective"
          name="perspective"
          :rules="[{ required: true, message: 'Please select Perspective!' }]">
          <a-select v-model:value="form.perspective" placeholder="Perspective">
            <a-select-option value="1">Financial</a-select-option>
            <a-select-option value="2">Customer</a-select-option>
            <a-select-option value="3">Internal Processes</a-select-option>
            <a-select-option value="4">Learning & Growth</a-select-option>

          </a-select>
        </a-form-item>
      </a-col>

      <a-col :span="8">
        <a-form-item
          class="textLabel"
          label="Assigned To"
          name="assigned_to_id"
          :rules="[{ required: true, message: 'Please select Assigned To!' }]">
          <a-select v-model:value="form.assigned_to_id" placeholder="Assigned To">
            <a-select-option v-for="user in users" :key="user.id" :value="user.id">
              {{ user.first_name }} {{ user.last_name }}
            </a-select-option>
          </a-select>
        </a-form-item>
      </a-col>
    </a-row>

    <a-form-item class="textLabel" label="Description" name="description">
      <a-textarea v-model:value="form.description" placeholder="Description" allow-clear />
    </a-form-item>

    <a-form-item>
      <a-row justify="end" style="margin-top: 10px">
        <a-button style="margin-right: 10px;" type="primary" html-type="submit" :loading="loading">
          Save KPI
        </a-button>
        <a-button type="default" @click="$router.push('/kpi-list')">Back</a-button>
      </a-row>
    </a-form-item>
  </a-form>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useStore } from 'vuex';
import { notification } from 'ant-design-vue';

const router = useRouter();
const store = useStore();
const loading = ref(false);

const form = ref({
  name: '',
  unit: '',
  target: '',
  weight: '',
  frequency: '',
  perspective: '',
  parent: '',
  assigned_to_id: '',
  description: ''
});

// Lấy danh sách users từ Vuex Store
const users = computed(() => store.getters['users/userList']);

const handleWeightInput = (event) => {
  let value = event.target.value;

  value = value.replace(/[^0-9.]/g, '');

  const parts = value.split('.');
  if (parts.length > 2) {
    value = parts[0] + '.' + parts.slice(1).join('');
  }

  const regex = /^(\d{1,5})(\.\d{0,2})?$/;
  if (!regex.test(value)) {
    value = form.value.weight;
  }

  form.value.weight = value;
};

const validateWeight = async (_rule, value) => {
  if (!value) return Promise.reject('Please enter Weight!');
  if (isNaN(value)) return Promise.reject('Weight must be a number');
  const numValue = parseFloat(value);
  if (numValue < 0 || numValue > 999.99) {
    return Promise.reject('Weight must be between 0 and 999.99');
  }
  return Promise.resolve();
};

// Hàm xử lý submit form
const handleChangeCreate = async () => {
  loading.value = true;
  try {
    await store.dispatch('createKpi', form.value);
    notification.success({ message: 'KPI created successfully' });
    router.push('/kpi-list');
  } catch (error) {
    notification.error({ message: 'KPI creation failed, please try again.' });
  } finally {
    loading.value = false;
  }
};

const onFinishFailed = () => {
  notification.error({ message: 'Please double check required fields' });
};

// Gọi fetchUsers từ Vuex khi component mounted
onMounted(() => {
  store.dispatch('users/fetchUsers')
});

</script>

<style scoped>
.textLabel {
  font-weight: bold;
}
</style>
