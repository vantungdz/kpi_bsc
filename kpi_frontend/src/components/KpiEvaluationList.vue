<template>
  <div class="evaluation-list-container">
    <h4>Lịch sử Đánh giá</h4>

    <div v-if="loading" class="loading-state">
      <i class="fas fa-spinner fa-spin"></i> Đang tải danh sách đánh giá...
    </div>

    <div v-else-if="error" class="error-state">
      <i class="fas fa-exclamation-triangle"></i> Lỗi tải danh sách: {{ error }}
    </div>

    <div v-else-if="!evaluations || evaluations.length === 0" class="no-data-state">
      <i class="fas fa-info-circle"></i> Chưa có đánh giá nào.
    </div>

    <table v-else>
      <thead>
        <tr>
          <th>Kỳ Đánh giá</th>
          <th>Người Đánh giá</th>
          <th>Xếp loại</th>
          <th>Ngày Đánh giá</th>
          <th>Trạng thái</th>
          <th>Hành động</th>
        </tr>
      </thead>
      <tbody>
        <tr v-for="evaluation in evaluations" :key="evaluation.id">
          <td>
            {{ formatDate(evaluation.periodStartDate) }} - {{ formatDate(evaluation.periodEndDate) }}
          </td>
          <td>
            {{ evaluation.evaluator?.username || 'N/A' }}
          </td>
          <td>
            {{ evaluation.rating }}
          </td>
          <td>
            {{ formatDate(evaluation.evaluationDate, true) }}
          </td>
          <td>
            <span :class="`status-${evaluation.status?.toLowerCase()}`">{{ evaluation.status }}</span>
          </td>
          <td class="evaluation-actions">
            <button @click="emitViewDetails(evaluation)" class="btn-view" title="Xem chi tiết">
              <i class="fas fa-eye"></i> Xem
            </button>
            <button
                v-if="canEditOrDelete(evaluation)"
                @click="emitEdit(evaluation.id)"
                class="btn-edit"
                title="Chỉnh sửa"
             >
                <i class="fas fa-edit"></i> Sửa
             </button>
             <button
                v-if="canEditOrDelete(evaluation)"
                @click="confirmAndDelete(evaluation.id)"
                class="btn-delete"
                title="Xóa bản nháp"
             >
                 <i class="fas fa-trash-alt"></i> Xóa
              </button>
          </td>
        </tr>
      </tbody>
    </table>

    </div>
</template>

<script setup>
import { computed, onMounted, watch, defineProps, defineEmits } from 'vue';
import { useStore } from 'vuex';

// --- Props ---
// Nhận ID của KPI và/hoặc người được đánh giá để lọc danh sách
const props = defineProps({
  kpiId: {
    type: [Number, String],
    default: null,
  },
  evaluateeId: {
    type: [Number, String],
    default: null,
  },
  // Có thể thêm các props khác cho phân trang, sắp xếp nếu cần
});

// --- Emits ---
// Khai báo các sự kiện sẽ được phát ra cho component cha
const emit = defineEmits([
    'view-details',     // Khi nhấn nút Xem chi tiết (gửi kèm object evaluation)
    'edit-evaluation',  // Khi nhấn nút Sửa (gửi kèm evaluationId)
   // 'delete-evaluation' // Có thể emit thay vì xóa trực tiếp
]);

// --- Store --- 
const store = useStore();

// Lấy dữ liệu và trạng thái từ module 'kpiEvaluations' trong Vuex Store
const evaluations = computed(() => store.getters['kpiEvaluations/list'] || []);
const loading = computed(() => store.getters['kpiEvaluations/isLoading']);
const error = computed(() => store.getters['kpiEvaluations/error']);
// const pagination = computed(() => store.getters['kpiEvaluations/pagination']); // Nếu có phân trang

// --- Logic ---

// Hàm gọi action fetchEvaluations từ store
const fetchData = (page = 1) => {
  // Chỉ fetch nếu có ít nhất kpiId hoặc evaluateeId
  if (!props.kpiId && !props.evaluateeId) {
    console.warn('KpiEvaluationList: Missing kpiId or evaluateeId prop.');
    return;
  }

  const params = { page }; // Bổ sung limit nếu có phân trang
  if (props.kpiId) params.kpiId = props.kpiId;
  if (props.evaluateeId) params.evaluateeId = props.evaluateeId;

  store.dispatch('kpiEvaluations/fetchEvaluations', params); // Action này cần được tạo trong store
};

// Hàm định dạng ngày tháng
const formatDate = (dateString, includeTime = false) => {
  if (!dateString) return '--';
  try {
    const options = { year: 'numeric', month: '2-digit', day: '2-digit' };
    if (includeTime) {
      options.hour = '2-digit';
      options.minute = '2-digit';
    }
    // Sử dụng locale 'vi-VN' để có định dạng DD/MM/YYYY
    return new Date(dateString).toLocaleDateString('vi-VN', options);
  } catch (e) {
    return dateString; // Trả về chuỗi gốc nếu lỗi
  }
};

// Hàm kiểm tra quyền sửa/xóa (Placeholder - cần logic thực tế)
const canEditOrDelete = (evaluation) => {
  const currentUser = store.getters['auth/user']; // Lấy user hiện tại
  // Chỉ cho phép sửa/xóa khi status là 'Draft'
  // Và user hiện tại là admin hoặc là người đã tạo ra đánh giá đó (evaluator)
  return evaluation.status === 'Draft' &&
         currentUser && // Đảm bảo đã login
         (currentUser.role === 'admin' || currentUser.id === evaluation.evaluator?.id); // Cần có evaluator.id trong data trả về
};

// --- Event Handlers ---
// Phát sự kiện khi nhấn nút Xem chi tiết
const emitViewDetails = (evaluation) => {
  emit('view-details', evaluation); // Gửi cả object evaluation cho component cha
};

// Phát sự kiện khi nhấn nút Sửa
const emitEdit = (evaluationId) => {
    emit('edit-evaluation', evaluationId);
};

// Hàm xác nhận và gọi action xóa
const confirmAndDelete = (evaluationId) => {
    if (confirm('Bạn có chắc chắn muốn xóa bản đánh giá nháp này không?')) {
        store.dispatch('kpiEvaluations/deleteEvaluation', evaluationId)
            .then(() => {
                // Thành công (có thể hiển thị thông báo nhẹ)
                console.log(`Evaluation ${evaluationId} deleted.`);
                 // Không cần fetch lại vì mutation REMOVE_EVALUATION đã cập nhật store
            })
            .catch(err => {
                // Xử lý lỗi (hiển thị thông báo lỗi)
                alert('Xóa đánh giá thất bại. Vui lòng thử lại.');
                console.error('Delete evaluation error:', err);
            });
    }
};

// --- Lifecycle Hooks & Watchers ---
// Fetch dữ liệu lần đầu khi component được gắn vào DOM
onMounted(() => {
  fetchData();
});

// Theo dõi sự thay đổi của props và fetch lại dữ liệu nếu cần
watch(() => [props.kpiId, props.evaluateeId], () => {
  fetchData();
});

</script>

<style scoped>
.evaluation-list-container {
  margin-top: 1.5rem; /* Thêm khoảng cách trên */
}

.evaluation-list-container h4 {
    margin-top: 0;
    margin-bottom: 1rem;
    font-size: 1.15em; /* Tăng kích thước tiêu đề */
    color: #495057;
    padding-bottom: 0.5rem;
    border-bottom: 1px solid #eee; /* Thêm đường kẻ dưới */
}

table {
  /* Kế thừa style chung */
  font-size: 0.9em;
}
th {
    white-space: nowrap; /* Không xuống dòng ở tiêu đề cột */
}
td {
    vertical-align: middle; /* Căn giữa nội dung ô theo chiều dọc */
}

.evaluation-actions button {
  font-size: 0.85em;
  padding: 4px 8px;
  margin-right: 5px;
  vertical-align: middle; /* Căn giữa nút */
}
.evaluation-actions button i {
    margin-right: 4px; /* Khoảng cách giữa icon và text */
}
.btn-view { background-color: #0dcaf0; color: #000; border-color: #0dcaf0; }
.btn-edit { background-color: #ffc107; color: #000; border-color: #ffc107; }
.btn-delete { background-color: #dc3545; color: #fff; border-color: #dc3545; }


/* Loading/Error/NoData States */
.loading-state, .error-state, .no-data-state {
    padding: 20px;
    text-align: center;
    color: #6c757d;
    background-color: #f8f9fa;
    border: 1px dashed #dee2e6;
    border-radius: 4px;
    margin-top: 10px;
}
.loading-state i, .error-state i, .no-data-state i {
    margin-right: 8px;
    font-size: 1.1em;
}
.error-state { color: #dc3545; background-color: #f8d7da; border-color: #f5c2c7;}

/* Status styling */
.status-draft { font-style: italic; color: #6c757d; }
.status-submitted { color: #0d6efd; font-weight: 500; }
.status-acknowledged { color: #198754; font-weight: 500; }

</style>
