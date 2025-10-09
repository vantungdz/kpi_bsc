<template>
  <select
    :value="modelValue"
    @change="handleChange"
    class="perspective-select-component"
    :disabled="loading || !!error"
  >
    <option :value="null" disabled>{{ $t("selectBscPerspective") }}</option>
    <option v-if="loading" disabled value="">{{ $t("loading") }}</option>
    <option v-else-if="error" disabled value="">
      {{ $t("loadingError") }}
    </option>
    <option
      v-for="perspective in perspectives"
      :key="perspective.id"
      :value="perspective.id"
    >
      {{ perspective.name }}
    </option>
  </select>
</template>

<script setup>
import { computed, onMounted } from "vue";
import { useStore } from "vuex";

const props = defineProps({
  modelValue: {
    type: [Number, String, null],
    default: null,
  },
});

const emit = defineEmits(["update:modelValue"]);

const store = useStore();

const perspectives = computed(() => store.getters["perspectives/list"] || []);
const loading = computed(() => store.getters["perspectives/isLoading"]);
const error = computed(() => store.getters["perspectives/error"]);

const handleChange = (event) => {
  const selectedValue = event.target.value;

  const emitValue = selectedValue ? parseInt(selectedValue, 10) : null;
  emit("update:modelValue", emitValue);
};

onMounted(() => {
  if (!perspectives.value || perspectives.value.length === 0) {
    store.dispatch("perspectives/fetchPerspectives");
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
