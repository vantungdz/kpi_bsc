<template>
  <div>
    <!-- Company Overview Mode -->
    <KpiDetailCompany v-if="isCompanyOverviewMode" />

    <!-- Department Context Mode -->
    <KpiDetailDepartment v-else-if="contextDepartmentId" />

    <!-- Section Context Mode -->
    <KpiDetailSection v-else-if="contextSectionId" />

    <!-- Default fallback -->
    <KpiDetailCompany v-else />
  </div>
</template>

<script setup>
import { computed } from "vue";
import { useRoute } from "vue-router";
import KpiDetailCompany from "./KpiDetailCompany.vue";
import KpiDetailDepartment from "./KpiDetailDepartment.vue";
import KpiDetailSection from "./KpiDetailSection.vue";

const route = useRoute();

const contextDepartmentId = computed(() => {
  const id = route.query.contextDepartmentId;
  const parsedId = id ? parseInt(String(id), 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

const contextSectionId = computed(() => {
  const id = route.query.contextSectionId;
  return id ? parseInt(id, 10) : null;
});

const isCompanyOverviewMode = computed(() => {
  const noDeptContext = !contextDepartmentId.value;
  const noSectionContext = !contextSectionId.value;
  return noDeptContext && noSectionContext;
});
</script>

<style scoped>
/* Add any specific styles if needed */
</style>
