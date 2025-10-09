<template>
  <select
    :value="modelValue"
    @change="handleChange"
    class="user-select-component"
    :disabled="loading || !!error"
  >
    <option :value="null" disabled>-- Chọn người dùng --</option>

    <option v-if="loading" disabled value="">Đang tải...</option>
    <option v-else-if="error" disabled value="">Lỗi tải danh sách</option>

    <option v-for="user in users" :key="user.id" :value="user.id">
      {{
        user.first_name || user.last_name
          ? `${user.first_name || ""} ${user.last_name || ""}`.trim()
          : user.username
      }}
      ({{ user.username }})
    </option>
  </select>
</template>

<script setup>
import { computed, onMounted, watch } from "vue";
import { useStore } from "vuex";

const props = defineProps({
  modelValue: {
    type: [Number, String, null],
    default: null,
  },
});

const emit = defineEmits(["update:modelValue"]);

const store = useStore();

const users = computed(() => store.getters["users/userList"] || []);
const loading = computed(() => store.getters["users/isLoading"]);
const error = computed(() => store.getters["users/error"]);

const handleChange = (event) => {
  const selectedValue = event.target.value;

  const emitValue = selectedValue ? parseInt(selectedValue, 10) : null;
  emit("update:modelValue", emitValue);
};

const fetchUserList = () => {
  if (!users.value || users.value.length === 0) {
    store.dispatch("users/fetchUsers");
  }
};

onMounted(() => {
  fetchUserList();
});
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
