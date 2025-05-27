<template>
  <div class="review-cycle-create-page">
    <h2>{{ $t('reviewCycle.createTitle') }}</h2>
    <a-form layout="vertical" :model="form" @submit.prevent="handleSubmit">
      <a-form-item :label="$t('reviewCycle.name')" required>
        <a-input
          v-model:value="form.name"
          :placeholder="$t('reviewCycle.namePlaceholder')"
        />
      </a-form-item>
      <a-form-item :label="$t('reviewCycle.startDate')" required>
        <a-date-picker v-model:value="form.startDate" style="width: 100%" />
      </a-form-item>
      <a-form-item :label="$t('reviewCycle.endDate')" required>
        <a-date-picker v-model:value="form.endDate" style="width: 100%" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="handleSubmit" :loading="loading">
          {{ $t('reviewCycle.createButton') }}
        </a-button>
      </a-form-item>
      <a-alert
        v-if="successMessage"
        type="success"
        :message="successMessage"
        show-icon
        closable
        style="margin-top: 16px"
      />
      <a-alert
        v-if="errorMessage"
        type="error"
        :message="errorMessage"
        show-icon
        closable
        style="margin-top: 16px"
      />
    </a-form>

    <h3 style="margin-top: 40px">{{ $t('reviewCycle.listTitle') }}</h3>
    <a-table
      :data-source="cycles"
      :columns="columns"
      row-key="id"
      :loading="loadingCycles"
      bordered
      style="margin-top: 16px"
    >
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'actions'">
          <a-space>
            <a-button size="small" type="primary" @click="editCycle(record)">
              {{ $t('common.edit') }}
            </a-button>
            <a-popconfirm
              :title="$t('reviewCycle.confirmDelete')"
              @confirm="deleteCycle(record.id)"
              :ok-text="$t('common.delete')"
              :cancel-text="$t('common.cancel')"
            >
              <a-button size="small" danger>{{ $t('common.delete') }}</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-modal
      v-model:open="editing"
      :title="$t('reviewCycle.editTitle')"
      @ok="submitEdit"
      @cancel="cancelEdit"
      :confirm-loading="loadingEdit"
    >
      <a-form layout="vertical">
        <a-form-item :label="$t('reviewCycle.name')" required>
          <a-input v-model:value="editForm.name" />
        </a-form-item>
        <a-form-item :label="$t('reviewCycle.startDate')" required>
          <a-date-picker
            v-model:value="editForm.startDate"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item :label="$t('reviewCycle.endDate')" required>
          <a-date-picker v-model:value="editForm.endDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from "vue";
import apiClient from "@/core/services/api";
import dayjs from "dayjs";
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const form = ref({ name: "", startDate: null, endDate: null });
const loading = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const cycles = ref([]);
const loadingCycles = ref(false);

const columns = computed(() => [
  { title: t('reviewCycle.name'), dataIndex: "name", key: "name" },
  {
    title: t('reviewCycle.startDate'),
    dataIndex: "startDate",
    key: "startDate",
    customRender: ({ text }) => (text ? dayjs(text).format("YYYY-MM-DD") : ""),
  },
  {
    title: t('reviewCycle.endDate'),
    dataIndex: "endDate",
    key: "endDate",
    customRender: ({ text }) => (text ? dayjs(text).format("YYYY-MM-DD") : ""),
  },
  { title: t('common.actions'), key: "actions" },
]);

const fetchCycles = async () => {
  loadingCycles.value = true;
  try {
    const res = await apiClient.get("/review-cycles");
    cycles.value = res.data;
  } catch (e) {
    // ignore error
  } finally {
    loadingCycles.value = false;
  }
};

const handleSubmit = async () => {
  if (!form.value.name || !form.value.startDate || !form.value.endDate) {
    errorMessage.value = t('reviewCycle.missingFields');
    return;
  }
  loading.value = true;
  errorMessage.value = "";
  try {
    await apiClient.post("/review-cycles", {
      name: form.value.name,
      startDate: form.value.startDate,
      endDate: form.value.endDate,
    });
    successMessage.value = t('reviewCycle.createSuccess');
    form.value = { name: "", startDate: null, endDate: null };
    fetchCycles();
  } catch (e) {
    errorMessage.value = e?.response?.data?.message || t('reviewCycle.createError');
  } finally {
    loading.value = false;
  }
};

const deleteCycle = async (id) => {
  loadingCycles.value = true;
  try {
    await apiClient.delete(`/review-cycles/${id}`);
    fetchCycles();
  } catch (e) {
    // ignore error
  } finally {
    loadingCycles.value = false;
  }
};

// Edit logic
const editing = ref(false);
const editForm = ref({ id: null, name: "", startDate: null, endDate: null });
const loadingEdit = ref(false);

const editCycle = (cycle) => {
  editForm.value = {
    id: cycle.id,
    name: cycle.name,
    startDate: dayjs(cycle.startDate),
    endDate: dayjs(cycle.endDate),
  };
  editing.value = true;
};
const cancelEdit = () => {
  editing.value = false;
};
const submitEdit = async () => {
  if (
    !editForm.value.name ||
    !editForm.value.startDate ||
    !editForm.value.endDate
  )
    return;
  loadingEdit.value = true;
  try {
    await apiClient.put(`/review-cycles/${editForm.value.id}`, {
      name: editForm.value.name,
      startDate: editForm.value.startDate,
      endDate: editForm.value.endDate,
    });
    editing.value = false;
    fetchCycles();
  } catch (e) {
    // ignore error
  } finally {
    loadingEdit.value = false;
  }
};

onMounted(() => {
  fetchCycles();
});
</script>

<style scoped>
.review-cycle-create-page {
  margin: 0 auto;
  padding: 32px 0;
}
</style>
