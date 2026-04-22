<script setup lang="ts">
import { ref, watch, onUnmounted } from 'vue'

const props = defineProps({
  open: { type: Boolean, required: true },
  item: { type: Object, default: null }
})
const emit = defineEmits(['close', 'save'])

const actualResultDraft = ref('')
const selfScoreDraft = ref<number | null>(null) // State mới cho Self Score
const evidenceNoteDraft = ref('')
const pendingEvidenceFiles = ref<any[]>([])
const pendingEvidenceUrls = ref<any[]>([])
const evidenceUrlDraft = ref('')

const EVIDENCE_MAX_FILES = 5
const EVIDENCE_MAX_URLS = 5
const EVIDENCE_ACCEPT_ATTR = '.pdf,.doc,.docx,.xls,.xlsx,.csv,.jpg,.jpeg,.png'

// Reset form mỗi khi mở drawer, lấy data từ item hiện tại
watch(() => props.open, (isOpen) => {
  if (isOpen && props.item) {
    actualResultDraft.value = props.item.actualResult || ''
    selfScoreDraft.value = props.item.selfScore || null // Load điểm cũ (nếu có)
    evidenceNoteDraft.value = props.item.evidenceNote || ''
    pendingEvidenceFiles.value = []
    pendingEvidenceUrls.value = []
    evidenceUrlDraft.value = ''
  }
  document.body.style.overflow = isOpen ? 'hidden' : ''
})

onUnmounted(() => { document.body.style.overflow = '' })

const handleSave = () => {
  emit('save', {
    id: props.item?.id,
    actualResult: actualResultDraft.value,
    selfScore: selfScoreDraft.value, // Emit thêm điểm
    evidenceNote: evidenceNoteDraft.value,
    files: pendingEvidenceFiles.value,
    urls: pendingEvidenceUrls.value
  })
}

function onEvidenceFilesChange(e: Event) {
  const input = e.target as HTMLInputElement
  if (input.files) {
    Array.from(input.files).forEach(file => {
      if (pendingEvidenceFiles.value.length < EVIDENCE_MAX_FILES) {
        pendingEvidenceFiles.value.push({ id: Math.random().toString(), file })
      }
    })
  }
  input.value = ''
}

function removeFile(id: string) { pendingEvidenceFiles.value = pendingEvidenceFiles.value.filter(f => f.id !== id) }
function addUrl() {
  if (evidenceUrlDraft.value && pendingEvidenceUrls.value.length < EVIDENCE_MAX_URLS) {
    pendingEvidenceUrls.value.push({ id: Math.random().toString(), url: evidenceUrlDraft.value })
    evidenceUrlDraft.value = ''
  }
}
function removeUrl(id: string) { pendingEvidenceUrls.value = pendingEvidenceUrls.value.filter(u => u.id !== id) }
</script>

<template>
  <Teleport to="body">
    <Transition name="evidence-drawer">
      <div v-if="open && item" class="fixed inset-0 z-[100] flex justify-end" role="dialog">
        <div class="evidence-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')" />
        <aside class="evidence-drawer-panel relative flex h-full w-full max-w-[700px] flex-col overflow-hidden bg-slate-50 shadow-2xl">
          
          <div class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm">
            <div>
              <h2 class="flex items-center text-lg font-bold text-slate-800">
                <i class="fas fa-clipboard-check mr-2 text-indigo-600" /> Cập nhật KPI & Minh chứng
              </h2>
            </div>
            <button @click="$emit('close')" class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <i class="fas fa-times text-lg" />
            </button>
          </div>

          <div class="relative shrink-0 overflow-hidden bg-slate-800 p-5 text-white">
            <div class="relative z-10">
              <span class="rounded bg-indigo-500 px-2 py-0.5 text-[10px] font-bold uppercase text-white shadow-sm mb-1.5 inline-block">{{ item.code }}</span>
              <h3 class="mb-1 text-xl font-bold">{{ item.name }}</h3>
              <p class="text-sm text-slate-300">Target: {{ item.target }}</p>
            </div>
          </div>

          <div class="min-h-0 flex-1 space-y-6 overflow-y-auto p-6">
            <div class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center border-b border-teal-100 bg-teal-50/50 px-4 py-3">
                <h4 class="text-sm font-bold text-teal-800"><i class="fas fa-comment-dots mr-2 text-teal-600" /> Đánh giá & Kết quả Thực tế</h4>
              </div>
              <div class="p-4 space-y-4">
                <div class="flex items-center gap-4">
                  <label class="text-xs font-bold uppercase tracking-wider text-slate-600">Self Score:</label>
                  <select v-model="selfScoreDraft" class="w-32 rounded-md border border-slate-300 px-3 py-2 text-sm font-bold text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-sm outline-none cursor-pointer">
                    <option :value="null">-</option>
                    <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                  </select>
                </div>
                <div>
                  <label class="mb-1.5 block text-xs font-bold uppercase tracking-wider text-slate-600">Kết quả đạt được (Actual Result):</label>
                  <textarea v-model="actualResultDraft" rows="3" class="w-full rounded-md border border-slate-300 px-3 py-2 text-sm text-slate-800 focus:border-teal-500 focus:ring-1 focus:ring-teal-500 shadow-sm outline-none" placeholder="Nhập chi tiết kết quả bạn đã đạt được..." />
                </div>
              </div>
            </div>

            <div class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div class="flex items-center border-b border-slate-200 bg-slate-50 px-4 py-3">
                <h4 class="text-sm font-bold text-slate-700"><i class="fas fa-paperclip mr-2 text-slate-500" /> Minh chứng Đính kèm</h4>
              </div>
              <div class="space-y-4 p-5">
                <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <label class="group relative block rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center cursor-pointer hover:border-indigo-400 hover:bg-slate-50">
                    <input type="file" multiple :accept="EVIDENCE_ACCEPT_ATTR" class="absolute inset-0 h-full w-full cursor-pointer opacity-0" @change="onEvidenceFilesChange" />
                    <div class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500"><i class="fas fa-cloud-upload-alt text-2xl" /></div>
                    <p class="text-sm font-bold text-slate-700">Tải File Lên (PC)</p>
                  </label>
                  
                  <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5">
                    <label class="mb-1 block text-sm font-bold text-slate-700">Thêm link URL</label>
                    <div class="flex mt-2">
                      <input v-model="evidenceUrlDraft" type="text" placeholder="https://..." class="w-full rounded-l-md border border-slate-300 px-3 py-2 text-sm" />
                      <button @click="addUrl" class="rounded-r-md bg-indigo-600 px-4 py-2 text-sm text-white hover:bg-indigo-700">Thêm</button>
                    </div>
                  </div>
                </div>

                <ul v-if="pendingEvidenceFiles.length || pendingEvidenceUrls.length" class="divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white mt-4">
                  <li v-for="row in pendingEvidenceFiles" :key="row.id" class="flex items-center gap-3 px-3 py-2.5">
                    <p class="truncate text-sm flex-1">{{ row.file.name }}</p>
                    <button @click="removeFile(row.id)" class="text-slate-400 hover:text-rose-600"><i class="fas fa-times" /></button>
                  </li>
                  <li v-for="row in pendingEvidenceUrls" :key="row.id" class="flex items-center gap-3 px-3 py-2.5">
                    <a :href="row.url" target="_blank" class="truncate text-sm text-indigo-700 flex-1 hover:underline">{{ row.url }}</a>
                    <button @click="removeUrl(row.id)" class="text-slate-400 hover:text-rose-600"><i class="fas fa-times" /></button>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          <div class="flex justify-end space-x-3 border-t border-slate-200 bg-white p-4">
            <button @click="$emit('close')" class="rounded-lg border border-slate-300 px-5 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50">Hủy bỏ</button>
            <button @click="handleSave" class="flex items-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white hover:bg-slate-900"><i class="fas fa-save mr-2" />Lưu thay đổi</button>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.evidence-drawer-enter-active, .evidence-drawer-leave-active { transition: opacity 0.3s ease; }
.evidence-drawer-enter-active .evidence-drawer-panel, .evidence-drawer-leave-active .evidence-drawer-panel { transition: transform 0.3s ease-in-out; }
.evidence-drawer-enter-from, .evidence-drawer-leave-to { opacity: 0; }
.evidence-drawer-enter-from .evidence-drawer-panel, .evidence-drawer-leave-to .evidence-drawer-panel { transform: translateX(100%); }
</style>