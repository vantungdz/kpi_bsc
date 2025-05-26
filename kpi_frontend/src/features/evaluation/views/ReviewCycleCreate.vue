<template>
  <div class="review-cycle-create-page">
    <h2>Tạo chu kỳ đánh giá KPI</h2>
    <a-form layout="vertical" :model="form" @submit.prevent="handleSubmit">
      <a-form-item label="Tên chu kỳ" required>
        <a-input
          v-model:value="form.name"
          placeholder="Nhập tên chu kỳ (ví dụ: Quý 2/2025)"
        />
      </a-form-item>
      <a-form-item label="Ngày bắt đầu" required>
        <a-date-picker v-model:value="form.startDate" style="width: 100%" />
      </a-form-item>
      <a-form-item label="Ngày kết thúc" required>
        <a-date-picker v-model:value="form.endDate" style="width: 100%" />
      </a-form-item>
      <a-form-item>
        <a-button type="primary" @click="handleSubmit" :loading="loading"
          >Tạo chu kỳ</a-button
        >
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

    <h3 style="margin-top: 40px">Danh sách chu kỳ đã tạo</h3>
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
            <a-button size="small" type="primary" @click="editCycle(record)"
              >Sửa</a-button
            >
            <a-popconfirm
              title="Bạn chắc chắn muốn xoá chu kỳ này?"
              @confirm="deleteCycle(record.id)"
              ok-text="Xoá"
              cancel-text="Huỷ"
            >
              <a-button size="small" danger>Xoá</a-button>
            </a-popconfirm>
          </a-space>
        </template>
      </template>
    </a-table>
    <a-modal
      v-model:open="editing"
      title="Sửa chu kỳ đánh giá"
      @ok="submitEdit"
      @cancel="cancelEdit"
      :confirm-loading="loadingEdit"
    >
      <a-form layout="vertical">
        <a-form-item label="Tên chu kỳ" required>
          <a-input v-model:value="editForm.name" />
        </a-form-item>
        <a-form-item label="Ngày bắt đầu" required>
          <a-date-picker
            v-model:value="editForm.startDate"
            style="width: 100%"
          />
        </a-form-item>
        <a-form-item label="Ngày kết thúc" required>
          <a-date-picker v-model:value="editForm.endDate" style="width: 100%" />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, onMounted } from "vue";
import apiClient from "@/core/services/api";
import dayjs from "dayjs";

const form = ref({ name: "", startDate: null, endDate: null });
const loading = ref(false);
const successMessage = ref("");
const errorMessage = ref("");

const cycles = ref([]);
const loadingCycles = ref(false);

const columns = [
  { title: "Tên chu kỳ", dataIndex: "name", key: "name" },
  {
    title: "Ngày bắt đầu",
    dataIndex: "startDate",
    key: "startDate",
    customRender: ({ text }) => (text ? dayjs(text).format("YYYY-MM-DD") : ""),
  },
  {
    title: "Ngày kết thúc",
    dataIndex: "endDate",
    key: "endDate",
    customRender: ({ text }) => (text ? dayjs(text).format("YYYY-MM-DD") : ""),
  },
  { title: "Hành động", key: "actions" },
];

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
    errorMessage.value = "Vui lòng nhập đầy đủ thông tin.";
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
    successMessage.value = "Tạo chu kỳ đánh giá thành công!";
    form.value = { name: "", startDate: null, endDate: null };
    fetchCycles();
  } catch (e) {
    errorMessage.value = e?.response?.data?.message || "Tạo chu kỳ thất bại.";
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
