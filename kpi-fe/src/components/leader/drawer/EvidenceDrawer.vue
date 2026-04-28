<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue'
import { useMemberKpiDraftStore } from '@/stores/member-kpi-drafts.store'
import type { EvidenceFormCase } from '@/types/kpi'
import {
  parseWeightedPayload, buildWeightedPayload,
  parseCommentPayload, buildCommentPayload,
  parseWorkAmountPayload, buildWorkAmountPayload,
  type UrlNamePair
} from '@/utils/memberKpiEvidenceDetail'

const props = defineProps<{
  open: boolean
  item: any | null // Nhận object KPI/Assignment từ Table
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'save', payload: any): void
}>()

const memberKpiDraftStore = useMemberKpiDraftStore()

// ==========================================
// 1. TRẠNG THÁI FORM NỘI BỘ (INTERNAL STATE)
// ==========================================
const saving = ref(false)
const detailSelfScore = ref<number | null>(null)
const evidenceNoteDraft = ref('')
const certificateOutcomeDraft = ref('')
const evidenceUrlDraft = ref('')
const evidenceUrlHint = ref('')

// Quản lý danh sách URL đính kèm
const pendingEvidenceUrls = ref<{ id: string; url: string; name?: string }[]>([])

// State cho mảng Plan/Actual (General Case)
type PlanActualRow = { id: string; plan: string; actual: string }
const generalPlanActualRows = ref<PlanActualRow[]>([])

// State cho mảng Work Amount (Monthly Case)
type WaTimeRow = { id: string; month: string; spent: string; standard: string }
const waTimeRows = ref<WaTimeRow[]>([])
const waFormError = ref('')

const WA_MONTH_OPTIONS = Array.from({ length: 12 }, (_, i) => ({
  value: String(i + 1),
  label: `Tháng ${i + 1}`,
}))

// ==========================================
// 2. LOGIC PHÂN LOẠI KPI (DỰA TRÊN CODE/GROUP)
// ==========================================
const drawerCase = computed<EvidenceFormCase>(() => {
  if (!props.item) return 'general'
  const it = props.item
  if (it.group === 'B' || it.group === 'P') return 'category_b'
  if (it.kpiCode?.startsWith('A.2') || it.code?.startsWith('A.2')) return 'monthly'
  return 'general'
})

const isReadOnly = computed(() => props.item?.canEditEvidence === false)

// ==========================================
// 3. KHỞI TẠO DỮ LIỆU KHI MỞ DRAWER
// ==========================================
function initForm() {
  if (!props.item) return
  const it = props.item
  const jsonSource = it.evidencesJson || '{}'

  // Khôi phục điểm và ghi chú cơ bản
  detailSelfScore.value = it.endSelfScore || it.selfScore || null
  evidenceNoteDraft.value = it.evidenceNote || ''
  certificateOutcomeDraft.value = it.certificateOutcomeNote || ''
  evidenceUrlDraft.value = ''
  waFormError.value = ''

  // Logic phân rã JSON dựa trên loại KPI
  try {
    const parsed = JSON.parse(jsonSource)

    // Khôi phục Plan/Actual
    if (parsed.planActualRecords?.length) {
      generalPlanActualRows.value = parsed.planActualRecords.map((r: any, i: number) => ({
        id: `p-${i}`, plan: r.plan, actual: r.actual
      }))
    } else {
      generalPlanActualRows.value = [{ id: 'p-0', plan: '', actual: '' }]
    }

    // Khôi phục Work Amount
    if (parsed.waTimeRecords?.length) {
      waTimeRows.value = parsed.waTimeRecords.map((r: any, i: number) => ({
        id: `w-${i}`, month: String(r.month), spent: String(r.spent), standard: String(r.standard)
      }))
    } else {
      waTimeRows.value = [{ id: 'w-0', month: '1', spent: '', standard: '' }]
    }

    // Khôi phục URLs
    const files = parsed.files || parsed.evd || []
    pendingEvidenceUrls.value = files.map((f: any, i: number) => ({
      id: `u-${i}`, url: f.url, name: f.name
    }))

  } catch (e) {
    generalPlanActualRows.value = [{ id: 'p-0', plan: '', actual: '' }]
    waTimeRows.value = [{ id: 'w-0', month: '1', spent: '', standard: '' }]
    pendingEvidenceUrls.value = []
  }
}

watch(() => props.open, (isOpen) => {
  if (isOpen) {
    initForm()
    document.body.style.overflow = 'hidden'
  } else {
    document.body.style.overflow = ''
  }
})

// ==========================================
// 4. CÁC THAO TÁC TRÊN FORM (ADD/REMOVE/URL)
// ==========================================
const addUrl = () => {
  if (!evidenceUrlDraft.value.trim()) return
  pendingEvidenceUrls.value.push({
    id: Date.now().toString(),
    url: evidenceUrlDraft.value.trim()
  })
  evidenceUrlDraft.value = ''
}

const addPlanRow = () => generalPlanActualRows.value.push({ id: Date.now().toString(), plan: '', actual: '' })
const removePlanRow = (id: string) => {
  if (generalPlanActualRows.value.length > 1)
    generalPlanActualRows.value = generalPlanActualRows.value.filter(r => r.id !== id)
}

const addWaRow = () => waTimeRows.value.push({ id: Date.now().toString(), month: '1', spent: '', standard: '' })

// ==========================================
// 5. XỬ LÝ LƯU (SAVE)
// ==========================================
const handleSave = async () => {
  if (!props.item) return
  saving.value = true

  try {
    const payload = {
      selfScore: detailSelfScore.value,
      evidenceNote: evidenceNoteDraft.value,
      certificateOutcomeNote: certificateOutcomeDraft.value,
      evidencesJson: JSON.stringify({
        note: evidenceNoteDraft.value,
        files: pendingEvidenceUrls.value.map(u => ({ url: u.url, name: u.name })),
        planActualRecords: generalPlanActualRows.value.filter(r => r.plan || r.actual),
        waTimeRecords: waTimeRows.value.filter(r => r.spent || r.standard),
        result: drawerCase.value === 'monthly' ? "Calculated" : evidenceNoteDraft.value // Tùy logic BE
      })
    }

    emit('save', payload)
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <Transition name="evidence-drawer">
      <div v-if="open && item" class="fixed inset-0 z-[100] flex justify-end">
        <div class="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" @click="$emit('close')" />

        <aside class="relative flex h-full w-full max-w-[700px] flex-col bg-slate-50 shadow-2xl overflow-hidden">

          <div class="flex shrink-0 items-center justify-between border-b bg-white px-6 py-4 shadow-sm">
            <div>
              <h2 class="text-lg font-bold text-slate-800">
                <i class="fas fa-clipboard-check mr-2 text-indigo-600" />
                Chi tiết Evidence
              </h2>
              <p class="text-xs text-slate-500">Mã KPI: {{ item.kpiCode || item.code }}</p>
            </div>
            <button @click="$emit('close')" class="rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700">
              <i class="fas fa-times text-lg" />
            </button>
          </div>

          <div v-if="isReadOnly" class="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-semibold text-amber-950">
            <i class="fas fa-eye mr-2 text-amber-600" /> Chế độ chỉ xem.
          </div>

          <div class="shrink-0 bg-slate-800 p-5 text-white">
            <h3 class="text-xl font-bold">{{ item.kpiName || item.name }}</h3>
            <p class="mt-2 text-xs text-slate-300">
              <i class="fas fa-crosshairs mr-1 text-indigo-400" />
              Chỉ tiêu: {{ item.targetDescription || item.target || '—' }}
            </p>
          </div>

          <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

            <div v-if="drawerCase === 'category_b'" class="rounded-xl border border-indigo-200 bg-indigo-50/80 p-4 shadow-sm">
              <label class="mb-2 block text-sm font-bold text-indigo-900">Chứng chỉ / Trình độ thực tế đạt được</label>
              <textarea v-model="certificateOutcomeDraft" :readonly="isReadOnly"
                        class="w-full rounded-lg border-indigo-200 p-3 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-white/50"
                        rows="3" placeholder="Ví dụ: TOEIC 800, JLPT N2..."/>
            </div>

            <div v-if="drawerCase === 'monthly'" class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div class="bg-blue-50 px-4 py-2 border-b font-bold text-blue-800 text-sm">Khai báo Work Amount</div>
              <div class="p-4 overflow-x-auto">
                <table class="w-full text-left text-sm">
                  <thead>
                  <tr class="text-slate-500 text-xs uppercase"><th class="py-2">Tháng</th><th>Spent(h)</th><th>Std(h)</th><th></th></tr>
                  </thead>
                  <tbody>
                  <tr v-for="row in waTimeRows" :key="row.id">
                    <td class="py-1">
                      <select v-model="row.month" :disabled="isReadOnly" class="border rounded p-1 text-sm">
                        <option v-for="m in WA_MONTH_OPTIONS" :key="m.value" :value="m.value">{{ m.label }}</option>
                      </select>
                    </td>
                    <td><input v-model="row.spent" :readonly="isReadOnly" type="number" class="border rounded p-1 w-20 text-sm"/></td>
                    <td><input v-model="row.standard" :readonly="isReadOnly" type="number" class="border rounded p-1 w-20 text-sm"/></td>
                    <td><button v-if="!isReadOnly" @click="waTimeRows.splice(waTimeRows.indexOf(row), 1)" class="text-rose-500"><i class="fas fa-trash-alt"/></button></td>
                  </tr>
                  </tbody>
                </table>
                <button v-if="!isReadOnly" @click="addWaRow" class="mt-3 text-xs font-bold text-blue-600 hover:underline">+ Thêm tháng</button>
              </div>
            </div>

            <div v-if="drawerCase === 'general'" class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div class="bg-teal-50 px-4 py-2 border-b font-bold text-teal-800 text-sm">Khai báo Hành vi / Sự kiện</div>
              <div class="p-4 space-y-4">
                <div v-for="row in generalPlanActualRows" :key="row.id" class="relative rounded-lg border p-3 space-y-2">
                  <button v-if="!isReadOnly && generalPlanActualRows.length > 1" @click="removePlanRow(row.id)" class="absolute top-2 right-2 text-slate-400 hover:text-rose-500"><i class="fas fa-times"/></button>
                  <div class="grid grid-cols-2 gap-3">
                    <div><label class="text-[10px] font-bold text-slate-400 uppercase">Mục tiêu</label><textarea v-model="row.plan" :readonly="isReadOnly" class="w-full border rounded p-2 text-sm" rows="2"/></div>
                    <div><label class="text-[10px] font-bold text-slate-400 uppercase">Thực tế</label><textarea v-model="row.actual" :readonly="isReadOnly" class="w-full border rounded p-2 text-sm" rows="2"/></div>
                  </div>
                </div>
                <button v-if="!isReadOnly" @click="addPlanRow" class="w-full rounded-lg border-2 border-dashed py-2 text-xs font-bold text-teal-600 hover:bg-teal-50 transition-colors">+ Thêm bản ghi</button>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <label class="mb-2 block text-sm font-bold text-slate-700">Link minh chứng (URL)</label>
              <div v-if="!isReadOnly" class="flex gap-2">
                <input v-model="evidenceUrlDraft" @keyup.enter="addUrl" class="flex-1 rounded-lg border px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500" placeholder="Dán link Jira, Drive..."/>
                <button @click="addUrl" class="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">Thêm</button>
              </div>
              <div class="mt-3 space-y-2">
                <div v-for="(link, i) in pendingEvidenceUrls" :key="i" class="flex items-center justify-between rounded-lg bg-slate-50 p-2 text-xs border">
                  <a :href="link.url" target="_blank" class="truncate font-medium text-blue-600 hover:underline mr-4">{{ link.url }}</a>
                  <button v-if="!isReadOnly" @click="pendingEvidenceUrls.splice(i, 1)" class="text-slate-400 hover:text-rose-500"><i class="fas fa-trash-alt"/></button>
                </div>
              </div>
            </div>

            <div class="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div class="bg-slate-50 px-4 py-2 border-b font-bold text-slate-700 text-sm">Ghi chú bổ sung</div>
              <div class="p-4">
                <textarea v-model="evidenceNoteDraft" :readonly="isReadOnly" class="w-full rounded-lg border p-3 text-sm focus:ring-1" rows="3" placeholder="Nhập diễn giải cho PM..."/>
              </div>
            </div>
          </div>

          <div class="flex shrink-0 items-center justify-between border-t bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <div class="flex flex-col">
              <span class="text-[10px] font-bold uppercase text-slate-500 mb-1">Tự đánh giá (1-5)</span>
              <select v-model="detailSelfScore" :disabled="isReadOnly" class="w-32 rounded-lg border border-slate-300 p-2 text-sm font-bold focus:ring-1 focus:ring-sky-500">
                <option :value="null" disabled>Chọn điểm</option>
                <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
              </select>
            </div>
            <div class="flex gap-3">
              <button @click="$emit('close')" class="rounded-lg border px-6 py-2 text-sm font-bold text-slate-600 hover:bg-slate-50 transition-colors">Hủy</button>
              <button v-if="!isReadOnly" @click="handleSave" :disabled="saving || !detailSelfScore"
                      class="flex items-center rounded-lg bg-slate-800 px-6 py-2 text-sm font-bold text-white shadow-md hover:bg-slate-900 disabled:opacity-50">
                <i v-if="saving" class="fas fa-spinner fa-spin mr-2" />
                <i v-else class="fas fa-save mr-2" />
                Lưu Evidence
              </button>
            </div>
          </div>

        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.evidence-drawer-enter-active, .evidence-drawer-leave-active { transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1); }
.evidence-drawer-enter-from, .evidence-drawer-leave-to { opacity: 0; transform: translateX(100%); }

.custom-scrollbar::-webkit-scrollbar { width: 4px; }
.custom-scrollbar::-webkit-scrollbar-thumb { background: #e2e8f0; border-radius: 10px; }
</style>