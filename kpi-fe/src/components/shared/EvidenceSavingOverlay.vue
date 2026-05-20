<script setup lang="ts">
defineProps<{
  show: boolean
}>()
</script>

<template>
  <Transition name="evidence-saving-overlay">
    <div
      v-if="show"
      class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/45 backdrop-blur-[2px]"
      role="alertdialog"
      aria-modal="true"
      aria-busy="true"
      aria-live="polite"
      aria-label="Saving evidence"
    >
      <div
        class="mx-4 flex max-w-sm flex-col items-center rounded-2xl border border-slate-200/80 bg-white px-8 py-7 text-center shadow-2xl"
      >
        <div
          class="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-indigo-50 text-indigo-600"
          aria-hidden="true"
        >
          <i class="fas fa-spinner fa-spin text-2xl" />
        </div>
        <p class="text-base font-bold text-slate-800">
          Đang lưu minh chứng…
        </p>
        <p class="mt-2 text-sm leading-relaxed text-slate-500">
          Vui lòng đợi. Không đóng hoặc thao tác cho đến khi hoàn tất.
        </p>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
.evidence-saving-overlay-enter-active,
.evidence-saving-overlay-leave-active {
  transition: opacity 0.2s ease;
}

.evidence-saving-overlay-enter-from,
.evidence-saving-overlay-leave-to {
  opacity: 0;
}
</style>
