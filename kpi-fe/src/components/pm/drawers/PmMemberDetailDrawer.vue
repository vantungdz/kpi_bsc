<script setup lang="ts">
import { computed, ref, watch, onUnmounted } from 'vue'
import EvaluationCommentBlock from '@/components/evaluation/EvaluationCommentBlock.vue'
import { pmKpiService } from '@/services/modules/kpi-pm.service'
import { KPI_TYPE } from '@/config/constants'
import {
  formatPmPortfolioActualCell,
  formatNumericTarget,
  parsePmPortfolioEvidenceString,
  normalizeEvidenceHref,
  isEvidenceImageUrl,
  CALC_RULE_AVERAGE,
} from '@/utils/memberKpiHelpers'

const props = defineProps({
  open: { type: Boolean, default: false },
  member: { type: Object, default: null },
  /** pm_comment từ BE (trước overlay localStorage trên bảng team). */
  persistedPmComment: { type: String, default: '' },
  cachedComment: { type: String, default: '' },
  cachedKpis: { type: Array, default: null }
})

const emit = defineEmits(['close', 'save', 'discard-draft'])

const activeTab = ref<'main' | 'promotion'>('main')
const memberKpis = ref<any[]>([])
const isLoadingKpis = ref(false)

const reviewComments = ref({
  memberComment: '',
  pmComment: ''
})

function assignmentFingerprint(kpis: { id: string }[]): string {
  return kpis.map((k) => String(k.id)).sort().join('|')
}

watch(
  () => props.open,
  (val) => {
    document.body.style.overflow = val ? 'hidden' : ''
    if (!val || !props.member?.id) return
    activeTab.value = 'main'
    reviewComments.value = { memberComment: '', pmComment: '' }

    fetchMemberKpis().then(() => {
      const cached = props.cachedKpis as any[] | null | undefined
      const apiIds = assignmentFingerprint(memberKpis.value)
      const cacheIds =
        cached && cached.length > 0 ? assignmentFingerprint(cached as { id: string }[]) : ''
      const hasCachedAssignments = Boolean(cacheIds)
      const cacheCompatible = !hasCachedAssignments || apiIds === cacheIds

      if (!cacheCompatible) {
        emit('discard-draft', props.member.id)
      }

      /** Không đọc draft sau discard — prop có thể chưa flush trong cùng tick. */
      const draftPm = cacheCompatible ? (props.cachedComment ?? '').trim() : ''
      const persisted = (props.persistedPmComment ?? '').trim()

      if (cacheCompatible && draftPm) {
        reviewComments.value.pmComment = props.cachedComment ?? ''
      } else {
        reviewComments.value.pmComment = persisted ? (props.persistedPmComment ?? '') : ''
      }

      if (cacheCompatible && cached && cached.length > 0) {
        memberKpis.value.forEach((kpi) => {
          const hit = cached.find((c: any) => String(c.id) === String(kpi.id))
          if (hit && hit.pmScore != null) {
            kpi.pmScore = hit.pmScore
          }
        })
      }
    })
  },
  { immediate: true },
)
onUnmounted(() => { document.body.style.overflow = '' })

async function fetchMemberKpis() {
  if (!props.member?.id) return
  isLoadingKpis.value = true
  memberKpis.value = []
  try {
    const year = props.member.year ? Number(props.member.year) : new Date().getFullYear()
    const data = await pmKpiService.getMemberKpiDetails(props.member.id, year)
    memberKpis.value = (data ?? []).map((item: any) => {
      const parsedEvidences = parsePmPortfolioEvidenceString(item.evidences)
      return {
        id: String(item.id),
        group: item.group || 'Khác',
        code: item.code || '',
        kpiType: item.kpiTypeCode === KPI_TYPE.PROMOTION ? 'promotion'
          : item.kpiTypeCode === KPI_TYPE.TEAM ? 'cascading'
            : 'individual',
        name: item.name || '',
        target: item.target != null ? formatNumericTarget(item.target) : '',
        actualResult:
          formatPmPortfolioActualCell(
            item.evidences,
            item.calcRuleCode,
            Number(item.calcRuleCode) === CALC_RULE_AVERAGE ? 'mean' : 'list',
          ) || '-',
        weight: item.weight != null ? Number(item.weight) : 0,
        selfScore: item.selfScore != null ? Number(item.selfScore) : null,
        pmScore: item.pmScore != null ? Number(item.pmScore) : null,
  
        statusCode: item.statusCode,
        calcRuleCode: item.calcRuleCode,
        evidences: item.evidences || '',
        evidenceData: parsedEvidences.rows,
        evidenceContent: parsedEvidences.content || parsedEvidences.note || parsedEvidences.legacyPlain || '',
        evidenceAttachments: parsedEvidences.attachments ?? [],
      }
    })
  } catch (err) {
    console.error('Failed to fetch member KPI details:', err)
  } finally {
    isLoadingKpis.value = false
  }
}

const mainKpis = computed(() => memberKpis.value.filter(k => k.kpiType !== 'promotion'))
const promoKpis = computed(() => memberKpis.value.filter(k => k.kpiType === 'promotion'))
const hasPromotion = computed(() => promoKpis.value.length > 0)

const groupLabels: Record<string, string> = {
  A: '(A) Core Operations & Technical Excellence',
  B: '(B) People Development & Knowledge Sharing',
  C: '(C) Strategic Management & Governance'
}

const currentGroupedKpis = computed(() => {
  const sourceList = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value;
  const groups = sourceList.reduce((acc: any, item: any) => {
    (acc[item.group] ??= []).push(item);
    return acc;
  }, {});

  const allGroups = [...new Set(sourceList.map(k => k.group))].sort()
  return allGroups.map(key => ({
    key, label: groupLabels[key] ?? key, items: groups[key] || []
  })).filter(g => g.items.length > 0)
})

// Trọng số & tổng có trọng số — đồng bộ KPI Portfolio (PmPersonalKpiTab)
const totalWeight = computed(() => {
  const list = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value
  return list.reduce((s, k) => s + (Number(k.weight) || 0), 0)
})

function formatWeightedTotalDisplay(sum: number): string {
  const rounded = Math.round(sum * 100) / 100
  if (rounded % 1 === 0) return String(rounded)
  return String(rounded.toFixed(2).replace(/\.?0+$/, ''))
}

/** Σ(score × weight) và số dòng có điểm — giống portfolioWeightedTotals. */
const memberDrawerWeightedTotals = computed(() => {
  const list = activeTab.value === 'promotion' ? promoKpis.value : mainKpis.value
  let selfSum = 0
  let pmSum = 0
  let selfContributed = 0
  let pmContributed = 0
  for (const k of list) {
    const w = Number(k.weight)
    if (!Number.isFinite(w)) continue

    if (k.selfScore != null) {
      const s = Number(k.selfScore)
      if (Number.isFinite(s)) {
        selfSum += s * w
        selfContributed += 1
      }
    }
    if (k.pmScore != null) {
      const p = Number(k.pmScore)
      if (Number.isFinite(p)) {
        pmSum += p * w
        pmContributed += 1
      }
    }
  }
  return { selfSum, pmSum, selfContributed, pmContributed }
})

/** Hàng TỔNG CỘNG — Self / PM: Σ(điểm × weight). */
const totalWeightedSelfDisplay = computed((): string => {
  const { selfSum, selfContributed } = memberDrawerWeightedTotals.value
  if (selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum)
})

const totalWeightedPmDisplay = computed((): string => {
  const { pmSum, pmContributed } = memberDrawerWeightedTotals.value
  if (pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum)
})

/** Trung bình có trọng số = Σ(score × weight) / Σ(weight). */
const averageWeightedSelfDisplay = computed((): string => {
  const tw = totalWeight.value
  const { selfSum, selfContributed } = memberDrawerWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || selfContributed === 0 || !Number.isFinite(selfSum)) return '-'
  return formatWeightedTotalDisplay(selfSum / tw)
})

const averageWeightedPmDisplay = computed((): string => {
  const tw = totalWeight.value
  const { pmSum, pmContributed } = memberDrawerWeightedTotals.value
  if (!Number.isFinite(tw) || tw <= 0 || pmContributed === 0 || !Number.isFinite(pmSum)) return '-'
  return formatWeightedTotalDisplay(pmSum / tw)
})

const canEvaluate = computed(() => {
  if (!props.member || !props.member.statusCode) return false;
  const status = Number(props.member.statusCode);
  return status === 501 || status === 601;
})

const expandedEvidenceRows = ref(new Set<string>())
function toggleEvidence(id: string) {
  const s = new Set(expandedEvidenceRows.value)
  if (s.has(id)) s.delete(id)
  else s.add(id)
  expandedEvidenceRows.value = s
}

const saving = ref(false)
const saveEvaluation = async () => {
  saving.value = true
  await new Promise((r) => setTimeout(r, 600))
  saving.value = false
  emit('save', { kpis: memberKpis.value, comments: reviewComments.value, memberId: props.member.id })
  emit('close')
}
</script>

<template>
  <Teleport to="body">
    <Transition name="pm-drawer" :duration="360" appear>
      <div v-if="open && member" class="fixed inset-0 z-[100]" role="dialog">
        <div class="pm-drawer-backdrop absolute inset-0 cursor-pointer bg-slate-900/60 backdrop-blur-sm"
          @click="$emit('close')" />

        <aside
          class="pm-drawer-panel will-change-transform absolute right-0 top-0 bottom-0 flex w-full max-w-full flex-col border-l border-slate-200 bg-slate-50 shadow-2xl lg:w-[1100px] xl:w-[1280px]">

          <div class="flex flex-col shrink-0 border-b border-slate-200 bg-white shadow-sm z-10 sticky top-0">
            <div class="flex items-center justify-between px-6 py-4">
              <div class="flex items-center gap-4">
                <div class="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
                  <i class="fas fa-file-signature text-xl"></i>
                </div>
                <div>
                  <h2 class="text-lg font-bold text-slate-800 flex items-center gap-2">
                    Đánh giá KPI: <span class="text-indigo-700">{{ member.name }}</span>
                  </h2>
                  <div class="flex items-center gap-2 mt-1">
                    <span
                      class="text-[10px] uppercase font-bold text-slate-500 tracking-wider border border-slate-200 bg-slate-100 px-2 py-0.5 rounded-md">
                      {{ member.role || member.rank }}
                    </span>
                    <span class="text-xs text-slate-400">•</span>
                    <span class="text-xs text-slate-500 font-medium">Kỳ đánh giá: {{ member.year || new Date().getFullYear() }}</span>
                  </div>
                </div>
              </div>
              <button @click="$emit('close')"
                class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors"><i
                  class="fas fa-times text-xl" /></button>
            </div>

            <div v-if="hasPromotion" class="bg-white px-6 flex gap-6">
              <button @click="activeTab = 'main'"
                class="pb-3 pt-4 border-b-2 text-sm font-bold flex items-center gap-2 transition-colors"
                :class="activeTab === 'main' ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-slate-500 hover:text-slate-700'">
                <i class="fas fa-bullseye"></i> KPI Member
              </button>
              <button @click="activeTab = 'promotion'"
                class="pb-3 pt-4 border-b-2 text-sm font-bold flex items-center gap-2 transition-colors"
                :class="activeTab === 'promotion' ? 'border-purple-600 text-purple-700' : 'border-transparent text-slate-500 hover:text-slate-700'">
                <i class="fas fa-award"></i> Promotion KPI
              </button>
            </div>
          </div>

          <div class="custom-scrollbar flex-1 overflow-y-auto p-6 space-y-6">

            <div v-if="isLoadingKpis" class="flex items-center justify-center py-16 text-slate-400">
              <i class="fas fa-circle-notch fa-spin mr-3 text-xl text-indigo-500"></i>
              <span class="text-sm font-medium">Đang tải dữ liệu KPI...</span>
            </div>

            <div v-else class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <table class="w-full text-sm text-left">
                <thead
                  class="text-xs text-slate-500 uppercase bg-slate-50/80 border-b border-slate-200">
                  <tr>
                    <th class="px-4 py-3 font-semibold text-center w-12">#</th>
                    <th class="px-4 py-3 font-semibold w-1/4">Hạng Mục</th>
                    <th class="px-4 py-3 font-semibold text-center w-48">Chỉ Tiêu (Target)</th>
                    <th class="px-4 py-3 font-semibold text-center w-40">Thực tế (Actual)</th>
                    <th class="px-4 py-3 font-semibold text-center w-20">W(%)</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">Self Score</th>
                    <th class="px-4 py-3 font-semibold text-center w-32">PM Score</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-slate-100">
                  <template v-for="groupData in currentGroupedKpis" :key="groupData.key">

                    <tr class="bg-orange-50/50">
                      <td colspan="7" class="px-4 py-2.5 text-xs font-bold text-orange-800 tracking-wide border-y border-orange-100/50">{{
                        groupData.label }}</td>
                    </tr>

                    <template v-for="(item, idx) in groupData.items" :key="item.id">
                      <tr class="hover:bg-slate-50/50 transition-colors">
                        <td class="px-4 py-4 text-center font-medium text-slate-400">{{ Number(idx) + 1 }}</td>

                        <td class="px-4 py-4">
                          <p class="font-semibold text-slate-800 text-sm mb-1.5">
                            {{ item.code }} {{ item.name }}
                          </p>
                          <span
                            class="inline-flex px-1.5 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider bg-slate-100 text-slate-500 border border-slate-200"
                            :class="item.kpiType === 'promotion' ? 'bg-purple-50 text-purple-700 border-purple-200' : ''">
                            {{ item.kpiType }}
                          </span>
                          <div @click="toggleEvidence(item.id)" class="mt-2 text-xs text-indigo-600 font-medium cursor-pointer hover:underline flex items-center gap-1">
                            Evidences <i class="fas" :class="expandedEvidenceRows.has(item.id) ? 'fa-chevron-up' : 'fa-chevron-down'" />
                          </div>
                        </td>

                        <td class="px-4 py-4 text-slate-600 text-xs leading-relaxed text-center">
                          {{ item.target }}
                        </td>
                        <td class="px-4 py-4 text-center">
                          <p class="text-xs font-medium text-emerald-700 leading-relaxed">{{ item.actualResult }}</p>
                        </td>
                        <td class="px-4 py-4 text-center font-semibold text-slate-700">{{ item.weight }}</td>
                        <td class="px-4 py-4 text-center font-bold text-slate-900">{{ item.selfScore ?? '-' }}</td>

                        <td class="px-4 py-4 text-center">
                          <select v-model="item.pmScore" @click.stop
                            :disabled="item.statusCode !== 601"
                            class="w-14 rounded border border-slate-300 bg-white px-1 py-1 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 shadow-sm cursor-pointer text-center disabled:opacity-50 disabled:bg-slate-50 disabled:cursor-not-allowed">
                            <option :value="null">-</option>
                            <option v-for="n in 5" :key="n" :value="n">{{ n }}</option>
                          </select>
                        </td>
                      </tr>

                      <tr v-if="expandedEvidenceRows.has(item.id)" class="bg-slate-50/50">
                        <td colspan="7" class="p-0 border-b border-slate-200">
                          <div
                            class="px-8 py-4 bg-gradient-to-r from-indigo-50/30 to-transparent border-l-2 border-indigo-300">
                            <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-2">Evidences</p>
                            <div class="overflow-x-auto rounded-lg border border-indigo-100 shadow-sm bg-white">
                              <table class="w-full text-left text-xs">
                                <thead
                                  class="bg-indigo-50 text-indigo-800 uppercase tracking-wider text-[10px] font-bold">
                                  <tr>
                                    <th class="px-3 py-2.5 text-center"
                                      :class="item.calcMode !== 'sum' ? 'w-3/5' : 'w-2/3'">Content</th>
                                    <th v-if="item.calcMode !== 'sum'"
                                      class="px-3 py-2.5 text-center w-1/5 border-l border-indigo-100/60">Plan</th>
                                    <th class="px-3 py-2.5 text-center border-l border-indigo-100/60"
                                      :class="item.calcMode !== 'sum' ? 'w-1/5' : 'w-1/3'">Actual</th>
                                  </tr>
                                </thead>
                                <tbody class="divide-y divide-slate-100">
                                  <tr v-for="(ev, eIdx) in item.evidenceData" :key="eIdx"
                                    class="hover:bg-slate-50 transition-colors">
                                    <td class="px-3 py-2.5 font-medium text-slate-800 leading-snug">{{ ev.content || ev.comment }}
                                    </td>
                                    <td v-if="item.calcMode !== 'sum'"
                                      class="px-3 py-2.5 text-center text-slate-600 border-l border-slate-100">{{
                                        ev.plan }}</td>
                                    <td
                                      class="px-3 py-2.5 text-center font-bold text-emerald-600 border-l border-slate-100">
                                      {{ ev.actual }}</td>
                                  </tr>
                                  <tr v-if="(!item.evidenceData || item.evidenceData.length === 0) && !item.evidenceContent">
                                    <td :colspan="item.calcMode === 'sum' ? 2 : 3"
                                      class="px-3 py-3 text-center text-slate-400 font-medium italic">Không có dữ liệu
                                      khai báo chi tiết.</td>
                                  </tr>
                                  <tr v-if="item.evidenceContent">
                                    <td :colspan="item.calcMode === 'sum' ? 2 : 3" class="px-4 py-3 text-slate-700 whitespace-pre-wrap bg-yellow-50/30 border-t border-yellow-100">
                                      <p class="font-bold text-[10px] uppercase text-yellow-700/70 mb-1">Nội dung nhận xét / diễn giải:</p>
                                      {{ item.evidenceContent }}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                            </div>
                            <div
                              v-if="item.evidenceAttachments && item.evidenceAttachments.length > 0"
                              class="mt-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm"
                            >
                              <p class="mb-2 text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                Minh chứng đính kèm (URL / file)
                              </p>
                              <ul class="flex flex-col gap-3">
                                <li
                                  v-for="(att, aIdx) in item.evidenceAttachments"
                                  :key="aIdx"
                                  class="rounded-md border border-slate-100 bg-slate-50/80 p-2"
                                >
                                  <a
                                    :href="normalizeEvidenceHref(att.url)"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="break-all text-xs font-semibold text-indigo-600 underline hover:text-indigo-800"
                                  >
                                    {{ att.name || att.url }}
                                  </a>
                                  <div v-if="isEvidenceImageUrl(att.url)" class="mt-2">
                                    <img
                                      :src="normalizeEvidenceHref(att.url)"
                                      :alt="att.name || 'Evidence'"
                                      class="max-h-40 max-w-full rounded border border-slate-200 object-contain"
                                    />
                                  </div>
                                </li>
                              </ul>
                            </div>
                          </div>
                        </td>
                      </tr>

                    </template>
                  </template>

                  <tr v-if="currentGroupedKpis.length === 0">
                    <td colspan="7" class="py-8 text-center text-sm font-medium text-slate-500">Chưa có dữ liệu KPI cho
                      mục này.</td>
                  </tr>
                </tbody>

                <tbody class="border-t-2 border-slate-200">
                  <tr class="bg-slate-50">
                    <td colspan="4" class="px-4 py-3 text-right font-bold text-slate-600 text-xs tracking-wider">
                      TỔNG CỘNG (TOTAL SCORE):
                    </td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeight }} <span class="text-[10px] text-slate-400 font-normal">pts</span></td>
                    <td class="px-4 py-3 text-center font-bold text-slate-800">{{ totalWeightedSelfDisplay }}</td>
                    <td class="px-4 py-3 text-center font-bold text-slate-400">{{ totalWeightedPmDisplay }}</td>
                  </tr>
                  <tr class="bg-purple-50 border-t border-purple-100">
                    <td colspan="5" class="px-4 py-4 text-right font-bold text-purple-700 text-xs tracking-wider">
                      ĐIỂM TRUNG BÌNH (AVERAGE SCORE):
                    </td>
                    <td class="px-4 py-4 text-center text-lg font-black text-purple-700">{{ averageWeightedSelfDisplay }}</td>
                    <td class="px-4 py-4 text-center font-bold text-purple-300">{{ averageWeightedPmDisplay }}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div class="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <EvaluationCommentBlock v-model:employeeComment="reviewComments.memberComment"
                v-model:managerComment="reviewComments.pmComment" employeeTitle="My Comment"
                managerTitle="Supervisor Comment" :employeeReadonly="true" :managerReadonly="!canEvaluate" />
            </div>

            <div class="h-4"></div>
          </div>

          <div class="bg-white border-t border-slate-200 p-4 px-6 flex justify-end gap-3 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
            <button @click="$emit('close')"
              class="px-5 py-2.5 text-sm font-semibold text-slate-600 bg-white border border-slate-300 rounded-xl hover:bg-slate-50 hover:text-slate-900 transition-colors">
              Hủy
            </button>
            <button @click="saveEvaluation" :disabled="saving || !canEvaluate"
              class="px-6 py-2.5 text-sm font-semibold text-white bg-slate-900 rounded-xl hover:bg-indigo-600 hover:shadow-lg transition-all flex items-center gap-2 focus:ring-4 focus:ring-indigo-500/20 disabled:opacity-60 disabled:cursor-not-allowed">
              <i v-if="saving" class="fas fa-spinner fa-spin" />
              <i v-else class="fas fa-save" />
              {{ saving ? 'Đang lưu...' : 'Lưu đánh giá' }}
            </button>
          </div>

        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* Backdrop fade + panel slide — không fade cả overlay (tránh nhấp nháy) */
.pm-drawer-enter-active,
.pm-drawer-leave-active {
  transition-duration: 0.36s;
}

.pm-drawer-enter-active .pm-drawer-backdrop,
.pm-drawer-leave-active .pm-drawer-backdrop {
  transition: opacity 0.36s ease;
}

.pm-drawer-enter-active .pm-drawer-panel,
.pm-drawer-leave-active .pm-drawer-panel {
  transition: transform 0.36s cubic-bezier(0.16, 1, 0.3, 1);
}

.pm-drawer-enter-from .pm-drawer-backdrop,
.pm-drawer-leave-to .pm-drawer-backdrop {
  opacity: 0;
}

.pm-drawer-enter-to .pm-drawer-backdrop,
.pm-drawer-leave-from .pm-drawer-backdrop {
  opacity: 1;
}

.pm-drawer-enter-from .pm-drawer-panel,
.pm-drawer-leave-to .pm-drawer-panel {
  transform: translate3d(100%, 0, 0);
}

.pm-drawer-enter-to .pm-drawer-panel,
.pm-drawer-leave-from .pm-drawer-panel {
  transform: translate3d(0, 0, 0);
}

@media (prefers-reduced-motion: reduce) {

  .pm-drawer-enter-active,
  .pm-drawer-leave-active,
  .pm-drawer-enter-active .pm-drawer-backdrop,
  .pm-drawer-leave-active .pm-drawer-backdrop,
  .pm-drawer-enter-active .pm-drawer-panel,
  .pm-drawer-leave-active .pm-drawer-panel {
    transition-duration: 0.01ms !important;
  }

  .pm-drawer-enter-from .pm-drawer-panel,
  .pm-drawer-leave-to .pm-drawer-panel {
    transform: none;
  }
}

.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
  height: 6px;
}

.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}

.custom-scrollbar::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 10px;
}

.custom-scrollbar::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}
</style>