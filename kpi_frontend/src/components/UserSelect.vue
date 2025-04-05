<template>
  <select :value="modelValue" @change="handleChange" class="user-select-component" :disabled="loading || !!error">
    <option :value="null" disabled>-- Chọn người dùng --</option>

    <option v-if="loading" disabled value="">Đang tải...</option>
    <option v-else-if="error" disabled value="">Lỗi tải danh sách</option>

    <option v-for="user in users" :key="user.id" :value="user.id">
      {{ user.first_name || user.last_name ? `${user.first_name || ''} ${user.last_name || ''}`.trim() : user.username }}
      ({{ user.username }})
    </option>
  </select>
</template>

<script setup>
import { computed, onMounted, watch } from 'vue';
import { useStore } from 'vuex';

// --- Props ---
// Sử dụng defineProps để nhận giá trị từ v-model của component cha
const props = defineProps({
  modelValue: { // Tên prop mặc định cho v-model
    type: [Number, String, null], // Cho phép null và cả string (từ giá trị select)
    default: null,
  },
  // (Tùy chọn) Thêm các props để lọc người dùng nếu cần, ví dụ: theo vai trò, phòng ban
  // filterRole: {
  //   type: String,
  //   default: null
  // },
  // departmentId: {
  //  type: [Number, String, null],
  //  default: null
  // }
});

// --- Emits ---
// Sử dụng defineEmits để khai báo sự kiện cập nhật cho v-model
const emit = defineEmits(['update:modelValue']);

// --- Vuex Store ---
const store = useStore();

// Lấy state và getters từ module 'users' của Vuex store
const users = computed(() => store.getters['users/userList'] || []); // Đảm bảo là mảng
const loading = computed(() => store.getters['users/isLoading']);
const error = computed(() => store.getters['users/error']);

// --- Logic ---
// Hàm xử lý khi người dùng thay đổi lựa chọn trong dropdown
const handleChange = (event) => {
  const selectedValue = event.target.value;
  // Chuyển đổi giá trị về Number nếu nó không rỗng, nếu rỗng thì là null
  const emitValue = selectedValue ? parseInt(selectedValue, 10) : null;
  emit('update:modelValue', emitValue); // Phát sự kiện để cập nhật v-model ở component cha
};

// Hàm gọi action để fetch danh sách người dùng
const fetchUserList = () => {
    // Chỉ fetch nếu danh sách chưa có hoặc rỗng
    // Hoặc có thể thêm logic để fetch lại nếu filter thay đổi
    if (!users.value || users.value.length === 0) {
        // Có thể truyền tham số lọc vào action nếu cần
        // const params = { role: props.filterRole, departmentId: props.departmentId };
        store.dispatch('users/fetchUsers'); // Gọi action fetchUsers từ store
    }
};

// --- Lifecycle Hooks ---
// Gọi fetchUserList khi component được mounted
onMounted(() => {
  fetchUserList();
});

// (Tùy chọn) Theo dõi sự thay đổi của props filter để fetch lại nếu cần
// watch(() => [props.filterRole, props.departmentId], () => {
//     fetchUserList(); // Fetch lại khi filter thay đổi
// });

</script>

<style scoped>
/* Kế thừa style chung của thẻ select từ main.css */
/* Bạn có thể thêm các style cụ thể cho component này nếu muốn */
.user-select-component {
  /* Ví dụ: đảm bảo chiều rộng tối thiểu */
  min-width: 200px;
}

select:disabled {
  background-color: #e9ecef;
  opacity: 0.65;
  cursor: not-allowed;
}
</style>