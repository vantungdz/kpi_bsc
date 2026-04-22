<script setup lang="ts">
const props = defineProps({
  selfComment: { type: String, default: '' },
  supervisorComment: { type: String, default: '' },
  selfTitle: { type: String, default: 'My Comment' },
  supervisorTitle: { type: String, default: 'Supervisor Comment' },
  isSubmitting: { type: Boolean, default: false }
})

const emit = defineEmits(['update:selfComment', 'submit'])

const updateSelfComment = (e: Event) => {
  const target = e.target as HTMLTextAreaElement
  emit('update:selfComment', target.value)
}
</script>

<template>
  <div class="shrink-0 p-5 border-t border-slate-200 bg-slate-50/30">
    <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
      <i class="fas fa-comments text-blue-600"></i>
      Comment of employee and supervisor
    </h4>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{{ selfTitle }}</label>
        <textarea 
          :value="selfComment"
          @input="updateSelfComment"
          class="w-full h-24 p-3 bg-white border border-slate-200 rounded-lg text-sm text-slate-700 focus:ring-2 focus:ring-blue-100 outline-none resize-none shadow-sm" 
          placeholder="Nhập ý kiến tự đánh giá của bạn..."
        ></textarea>
      </div>
      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">{{ supervisorTitle }}</label>
        <textarea 
          class="w-full h-24 p-3 bg-slate-100 border border-slate-200 rounded-lg text-sm text-slate-500 outline-none resize-none cursor-not-allowed" 
          placeholder="Quản lý sẽ nhập ý kiến tại đây..." 
          readonly
          :value="supervisorComment"
        ></textarea>
      </div>
    </div>

    <div class="flex justify-end mt-4">
      <button 
        @click="$emit('submit')" 
        :disabled="isSubmitting"
        class="flex items-center gap-1.5 rounded-lg bg-blue-600 px-6 py-2 text-sm font-bold text-white shadow-sm transition-colors hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <i v-if="isSubmitting" class="fas fa-spinner fa-spin text-xs"></i>
        <i v-else class="fas fa-paper-plane text-xs"></i> 
        Submit Evaluation
      </button>
    </div>
  </div>
</template>