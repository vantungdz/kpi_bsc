<script setup lang="ts">
import type { MemberKpiEvaluationStatus } from '@/types/kpi'

defineProps<{
  statusCounts: Record<MemberKpiEvaluationStatus, number>
  evidenceCount: number
  evidenceTotalCount: number
  personalSelfWeightedAvg: number | null
  personalSelfPromotionAvg: number | null
  personalFinalWeightedAvg?: number | null
  promotionFinalWeightedAvg?: number | null
  activeTab: 'personal' | 'promotion'
}>()

defineEmits<{
  (e: 'scroll-to-eval'): void
}>()
</script>

<template>
  <!-- Tổng hợp nhanh trạng thái KPI -->
  <!-- <div class="grid grid-cols-1 gap-3 sm:grid-cols-3">
    <button
      type="button"
      class="rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50"
      @click="$emit('scroll-to-eval')"
    >
      <p class="text-[10px] font-bold uppercase tracking-wider text-slate-500">Chưa đánh giá</p>
      <p class="mt-1 text-2xl font-bold text-slate-800">{{ statusCounts.not_started }}</p>
      <p class="mt-1 text-[11px] font-semibold text-blue-600">Đánh giá ngay →</p>
    </button>
    <div class="rounded-xl border border-rose-200 bg-rose-50/60 p-4 shadow-sm">
      <p class="text-[10px] font-bold uppercase tracking-wider text-rose-800">Quá hạn</p>
      <p class="mt-1 text-2xl font-bold text-rose-900">{{ statusCounts.overdue }}</p>
      <p class="mt-1 text-[11px] font-semibold text-rose-800">Bổ sung gấp</p>
    </div>
    <div class="rounded-xl border border-orange-200 bg-orange-50/60 p-4 shadow-sm">
      <p class="text-[10px] font-bold uppercase tracking-wider text-orange-900">Cần làm lại</p>
      <p class="mt-1 text-2xl font-bold text-orange-950">{{ statusCounts.revision }}</p>
      <p class="mt-1 text-[11px] font-semibold text-orange-900">Cập nhật lại</p>
    </div>
  </div> -->

  <!-- Bằng chứng + điểm TB -->
  <div class="grid grid-cols-1 gap-5 md:grid-cols-2">
    <div
      class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-emerald-50" />
      <div class="z-10 rounded-xl bg-emerald-100 p-3.5 text-emerald-600">
        <i class="fa-solid fa-file-export text-xl" />
      </div>
      <div class="z-10 min-w-0">
        <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          Tình trạng bằng chứng ({{ activeTab === 'promotion' ? 'Promotion' : 'Personal' }})
        </p>
        <p class="text-2xl font-bold text-slate-800">
          {{ evidenceCount }}
          <span class="text-sm font-bold text-slate-400">/ {{ evidenceTotalCount }}</span>
          <span
            v-if="evidenceCount < evidenceTotalCount"
            class="mt-0.5 text-[11px] font-semibold text-orange-500"
          >
            Cần bổ sung {{ evidenceTotalCount - evidenceCount }} mục
          </span>
        </p>
       
      </div>
    </div>

    <div
      class="relative flex items-center gap-5 overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div class="absolute right-0 top-0 h-20 w-20 rounded-bl-full bg-violet-50" />
      <div class="z-10 rounded-xl bg-violet-100 p-3 text-violet-600">
        <i class="fa-solid fa-chart-column text-xl" />
      </div>
      <div class="z-10 min-w-0">
        <p class="mb-1 text-xs font-bold uppercase tracking-wider text-slate-500">
          {{
            (activeTab === 'promotion'
              ? promotionFinalWeightedAvg !== null && promotionFinalWeightedAvg !== undefined
              : personalFinalWeightedAvg !== null && personalFinalWeightedAvg !== undefined)
              ? `Điểm trung bình (Average score) của Final Score (${activeTab === 'promotion' ? 'Promotion' : 'Personal'}, có trọng số)`
              : `Điểm trung bình (Average score) của Self Score (${activeTab === 'promotion' ? 'Promotion' : 'Personal'}, có trọng số)`
          }}
        </p>
        <div class="flex items-baseline gap-2">
          <p class="text-2xl font-bold text-violet-700">
            {{
              (activeTab === 'promotion' ? personalSelfPromotionAvg : personalSelfWeightedAvg) !== null
                ? (activeTab === 'promotion' ? personalSelfPromotionAvg : personalSelfWeightedAvg)!.toFixed(2)
                : '0.00'
            }}
          </p>
          <p class="text-[10px] font-semibold text-violet-500">/ 5.0</p>
        </div>
      </div>
    </div>
  </div>
</template>
