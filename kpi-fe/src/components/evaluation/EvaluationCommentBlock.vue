<script setup lang="ts">
defineProps({
  employeeComment: { type: String, default: '' },
  managerComment: { type: String, default: '' },
  employeeTitle: { type: String, default: 'Nhân viên tự đánh giá' },
  managerTitle: { type: String, default: 'Quản lý nhận xét' },
  /** Anchor cho scroll validation (vd PM có 2 tab Portfolio / Promotion). */
  employeeCommentSectionId: { type: String, default: 'pm-portfolio-my-comment' },
  /** Viền đỏ (validation) cho ô My Comment */
  employeeHighlightError: { type: Boolean, default: false },

  // Cờ điều khiển ai được quyền nhập liệu
  employeeReadonly: { type: Boolean, default: false },
  managerReadonly: { type: Boolean, default: true },
})

defineEmits(['update:employeeComment', 'update:managerComment'])
</script>

<template>
  <div class="p-6 bg-slate-50/50">
    <h4 class="text-sm font-bold text-slate-800 mb-4 flex items-center gap-2">
      <i class="fas fa-comments text-blue-600"></i> Comment of employee and supervisor
    </h4>
    
    <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
      <div :id="employeeCommentSectionId">
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          {{ employeeTitle }} <span v-if="!employeeReadonly" class="text-rose-500">*</span>
        </label>
        <textarea 
          :value="employeeComment"
          @input="$emit('update:employeeComment', ($event.target as HTMLTextAreaElement).value)"
          :readonly="employeeReadonly"
          :placeholder="employeeReadonly ? '' : 'Nhập tự đánh giá của bạn...'"
          class="w-full h-24 p-3 rounded-lg text-sm outline-none resize-none transition-colors"
          :class="employeeReadonly 
            ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed shadow-inner' 
            : employeeHighlightError
              ? 'bg-white border-2 border-rose-500 text-slate-800 shadow-sm ring-2 ring-rose-200'
              : 'bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm'"
        ></textarea>
      </div>

      <div>
        <label class="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
          {{ managerTitle }} <span v-if="!managerReadonly" class="text-rose-500">*</span>
        </label>
        <textarea 
          :value="managerComment"
          @input="$emit('update:managerComment', ($event.target as HTMLTextAreaElement).value)"
          :readonly="managerReadonly"
          :placeholder="managerReadonly ? '' : 'Nhập đánh giá và nhận xét của bạn...'"
          class="w-full h-24 p-3 rounded-lg text-sm outline-none resize-none transition-colors"
          :class="managerReadonly 
            ? 'bg-slate-100 border border-slate-200 text-slate-600 cursor-not-allowed shadow-inner' 
            : 'bg-white border border-slate-300 text-slate-800 focus:ring-2 focus:ring-blue-100 focus:border-blue-400 shadow-sm'"
        ></textarea>
      </div>
    </div>
  </div>
</template>