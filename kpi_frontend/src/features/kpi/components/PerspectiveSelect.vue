<template>
  <select
    :value="modelValue"
    @change="handleChange"
    class="perspective-select-component"
    :disabled="loading || !!error"
  >
    <option :value="null" disabled>{{ $t('selectBscPerspective') }}</option>
    <option v-if="loading" disabled value="">{{ $t('loading') }}</option>
    <option v-else-if="error" disabled value="">{{ $t('loadingError') }}</option>
    <option v-for="perspective in perspectives" :key="perspective.id" :value="perspective.id">
      {{ perspective.name }}
    </option>
  </select>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useStore } from 'vuex';

// --- Props ---
// Nhận giá trị từ v-model của component cha
const props = defineProps({
  modelValue: { // Tên prop mặc định cho v-model
    type: [Number, String, null],
    default: null,
  }
});

// --- Emits ---
// Khai báo sự kiện cập nhật cho v-model
const emit = defineEmits(['update:modelValue']);

// --- Vuex Store ---
const store = useStore();

// Lấy state và getters từ module 'perspectives'
// Đảm bảo bạn đã tạo module này trong store (`src/store/modules/perspectives.js`)
const perspectives = computed(() => store.getters['perspectives/list'] || []);
const loading = computed(() => store.getters['perspectives/isLoading']);
const error = computed(() => store.getters['perspectives/error']);

// --- Logic ---
// Hàm xử lý khi người dùng thay đổi lựa chọn
const handleChange = (event) => {
  const selectedValue = event.target.value;
  // Chuyển đổi về Number hoặc null trước khi emit
  const emitValue = selectedValue ? parseInt(selectedValue, 10) : null;
  emit('update:modelValue', emitValue);
};

// --- Lifecycle Hooks ---
// Gọi action để fetch danh sách khía cạnh khi component được mounted (nếu chưa có trong store)
onMounted(() => {
  if (!perspectives.value || perspectives.value.length === 0) {
    store.dispatch('perspectives/fetchPerspectives'); // Action này cần được định nghĩa trong store
  }
});
</script>

<style scoped>
/* Kế thừa style chung của thẻ select từ main.css */
.perspective-select-component {
  /* Ví dụ: đảm bảo chiều rộng tối thiểu */
  min-width: 200px;
}

select:disabled {
  background-color: #e9ecef;
  opacity: 0.65;
  cursor: not-allowed;
}
</style>