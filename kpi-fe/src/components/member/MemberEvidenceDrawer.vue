<script setup lang="ts">
import { inject } from 'vue'
import {
  EVIDENCE_DRAWER_KEY,
  EVIDENCE_MAX_FILES,
  EVIDENCE_MAX_URLS,
  EVIDENCE_ACCEPT_ATTR,
  averageRatioResult,
} from '@/composables/useMemberEvidenceDrawer'
import {
  ratioLabels,
  targetBannerPlain,
  formatNumericTarget,
  isBLanguageCertificateKpi,
  kpiTargetTooltip,
} from '@/utils/memberKpiHelpers'

const ctx = inject(EVIDENCE_DRAWER_KEY)!
</script>

<template>
  <Teleport to="body">
    <Transition name="evidence-drawer">
      <div
        v-if="ctx.evidencePanelOpen.value && ctx.selectedDrawerItem.value"
        class="fixed inset-0 z-[100] flex justify-end"
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-drawer-title"
      >
        <div
          class="evidence-drawer-backdrop absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          @click="ctx.closeEvidencePanel()"
        />
        <aside
          class="evidence-drawer-panel relative flex h-full max-h-[100dvh] w-full max-w-[700px] min-h-0 flex-col overflow-hidden bg-slate-50 shadow-2xl"
        >
          <!-- Header -->
          <div
            class="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6 py-4 shadow-sm"
          >
            <div>
              <h2
                id="evidence-drawer-title"
                class="flex items-center text-lg font-bold text-slate-800"
              >
                <i class="fas fa-clipboard-check mr-2 text-indigo-600" />
                Chi tiết Evidence
              </h2>
              <p class="mt-0.5 text-xs text-slate-500">
                Khai báo số liệu và đính kèm — bản nháp lưu trên trình duyệt; gửi server khi bạn
                bấm <span class="font-semibold text-slate-700">Submit Đánh Giá</span>.
              </p>
            </div>
            <button
              type="button"
              class="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
              aria-label="Đóng"
              @click="ctx.closeEvidencePanel()"
            >
              <i class="fas fa-times text-lg" />
            </button>
          </div>

          <!-- Read-only banner -->
          <div
            v-if="ctx.evidenceDrawerReadOnly.value"
            class="shrink-0 border-b border-amber-200 bg-amber-50 px-6 py-2.5 text-xs font-semibold leading-snug text-amber-950"
          >
            <i class="fas fa-eye mr-2 shrink-0 text-amber-600" />
            Chế độ chỉ xem — KPI đã nộp hoặc đang chờ duyệt; bạn vẫn xem được minh chứng, không
            lưu chỉnh sửa.
          </div>

          <div
            v-if="Number(ctx.selectedDrawerItem.value?.statusCode ?? 0) === 406
              && String(ctx.selectedDrawerItem.value?.updateReason ?? ctx.selectedDrawerItem.value?.feedbackComment ?? '').trim().length > 0"
            class="shrink-0 border-b border-rose-200 bg-rose-50 px-6 py-2.5 text-xs leading-snug text-rose-900"
          >
            <p class="font-semibold">
              <i class="fas fa-triangle-exclamation mr-2 text-rose-600" />
              KPI đã bị từ chối - vui lòng chỉnh sửa và submit lại.
            </p>
            <p class="mt-1.5 whitespace-pre-wrap text-rose-800">
              {{ String(ctx.selectedDrawerItem.value?.updateReason ?? ctx.selectedDrawerItem.value?.feedbackComment ?? '').trim() }}
            </p>
          </div>

          <!-- KPI info banner -->
          <div class="relative shrink-0 overflow-hidden bg-slate-800 p-5 text-white">
            <div class="pointer-events-none absolute -bottom-4 -right-4 opacity-[0.03]">
              <i class="fas fa-bullseye text-[10rem]" />
            </div>
            <div class="relative z-10">
              <div class="mb-1.5 flex items-center">
                <span
                  class=""
                >
                  {{ ctx.selectedDrawerItem.value.code }}
                </span>
              </div>
              <h3 class="mb-1 text-xl font-bold">{{ ctx.selectedDrawerItem.value.name }}</h3>
              <span
                  v-if="ctx.selectedDrawerItem.value.weight"
                  class="rounded bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white"
                >
                  Weight: {{ ctx.selectedDrawerItem.value.weight }}
                </span>
            </div>
          </div>

          <!-- Scrollable body -->
          <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div class="min-h-0 flex-1 overflow-y-auto overscroll-contain px-6 py-6">
              <div class="flex flex-col gap-6">

                <!-- Category B: Language certificate block -->
                <div
                  v-if="ctx.panelMode.value !== 'feedback' && ctx.drawerCase.value === 'category_b' && isBLanguageCertificateKpi(ctx.selectedDrawerItem.value)"
                  class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm"
                >
                  <div class="flex items-start gap-3">
                    <i class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600" />
                    <div class="min-w-0">
                      <p class="font-bold text-indigo-950">Mục tiêu giao & chỉ tiêu chuẩn</p>
                      <p class="mt-1 font-medium text-slate-800">
                        <span class="font-semibold text-indigo-900">Mục tiêu (assignment):</span>
                        {{ formatNumericTarget(ctx.selectedDrawerItem.value.assignmentTargetValue) }}
                        <span class="mx-2 text-slate-300">|</span>
                        <span class="font-semibold text-indigo-900">Chỉ tiêu (target_value):</span>
                        {{ formatNumericTarget(ctx.selectedDrawerItem.value.kpiTemplateTargetValue) }}
                      </p>
                      <p class="mt-1 text-xs text-slate-600">{{ targetBannerPlain(ctx.selectedDrawerItem.value) }}</p>
                    </div>
                  </div>
                  <p class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600">
                    Nếu kết quả thực tế <strong>khác</strong> mục tiêu trên - ví dụ đăng ký
                    <strong>TOEIC 700</strong> nhưng chưa đạt, trong khi bạn có
                    <strong>JLPT N2</strong> hoặc chứng chỉ tương đương - hãy ghi rõ chứng chỉ /
                    điểm số thực tế ở ô bên dưới và đính kèm bản scan hoặc link tra cứu để PM đối
                    chiếu.
                  </p>
                  <div>
                    <label class="mb-1 block text-xs font-bold text-slate-700">
                      Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                    </label>
                    <textarea
                      v-model="ctx.certificateOutcomeDraft.value"
                      rows="2"
                      placeholder="Ví dụ: JLPT N2 (12/2025) - đính kèm scan kết quả; mục tiêu TOEIC 700 chưa đạt / không thi lại trong năm."
                      :readonly="ctx.evidenceDrawerReadOnly.value"
                      class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50 read-only:text-slate-700"
                    />
                  </div>
                </div>

                <!-- Non category_b: upload_only + general/monthly forms -->
                <div v-if="ctx.panelMode.value !== 'feedback' && ctx.drawerCase.value !== 'category_b'" class="flex flex-col gap-6">

                  <!-- Upload-only: certificate target block -->
                  <div
                    v-if="ctx.isUploadOnlyDrawer.value"
                    class="space-y-3 rounded-xl border border-indigo-200 bg-indigo-50/90 p-4 text-sm text-slate-800 shadow-sm"
                  >
                    <div class="flex items-start gap-3">
                      <i class="fas fa-id-card mt-0.5 shrink-0 text-lg text-indigo-600" />
                      <div class="min-w-0">
                        <p class="font-bold text-indigo-950">Mục tiêu giao & chỉ tiêu chuẩn</p>
                        <p class="mt-1 font-medium text-slate-800">
                          <span class="font-semibold text-indigo-900">Mục tiêu (assignment):</span>
                          {{ formatNumericTarget(ctx.selectedDrawerItem.value.assignmentTargetValue) }}
                          <span class="mx-2 text-slate-300">|</span>
                          <span class="font-semibold text-indigo-900">Chỉ tiêu (target_value):</span>
                          {{ formatNumericTarget(ctx.selectedDrawerItem.value.kpiTemplateTargetValue) }}
                        </p>
                        <p class="mt-1 text-xs text-slate-600">{{ targetBannerPlain(ctx.selectedDrawerItem.value) }}</p>
                      </div>
                    </div>
                    <p class="border-t border-indigo-100/90 pt-3 text-xs leading-relaxed text-slate-600">
                      Nếu kết quả thực tế <strong>khác</strong> mục tiêu trên - ví dụ đăng ký
                      <strong>TOEIC 700</strong> nhưng chưa đạt, trong khi bạn có <strong>JLPT N2</strong>
                      hoặc chứng chỉ tương đương - hãy ghi rõ chứng chỉ / điểm số thực tế ở ô bên
                      dưới và đính kèm bản scan hoặc link tra cứu để PM đối chiếu.
                    </p>
                    <div>
                      <label class="mb-1 block text-xs font-bold text-slate-700">
                        Chứng chỉ / trình độ thực tế (minh chứng đi kèm)
                      </label>
                      <textarea
                        v-model="ctx.certificateOutcomeDraft.value"
                        rows="2"
                        placeholder="Ví dụ: JLPT N2 (12/2025) - đính kèm scan kết quả; mục tiêu TOEIC 700 chưa đạt / không thi lại trong năm."
                        :readonly="ctx.evidenceDrawerReadOnly.value"
                        class="w-full resize-none rounded-md border border-indigo-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50 read-only:text-slate-700"
                      />
                    </div>
                  </div>

                  <!-- General / monthly form (driven by CALC_RULE) -->
                  <div
                    v-show="ctx.drawerCase.value === 'general' || ctx.drawerCase.value === 'monthly'"
                    class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                  >
                    <div
                      class="flex items-center justify-between border-b px-4 py-3"
                      :class="ctx.drawerFormMode.value === 'average' ? 'border-blue-100 bg-blue-50/50' : 'border-teal-100 bg-teal-50/50'"
                    >
                      <h4
                        class="flex items-center text-sm font-bold"
                        :class="ctx.drawerFormMode.value === 'average' ? 'text-blue-800' : 'text-teal-800'"
                      >
                        <i
                          class="mr-2"
                          :class="ctx.drawerFormMode.value === 'average' ? 'fas fa-calculator text-blue-600' : 'fas fa-comment-dots text-teal-600'"
                        />
                        {{
                          ctx.drawerFormMode.value === 'average'
                            ? 'Khai báo Số liệu (Auto tính tỉ lệ)'
                            : 'Khai báo Mục tiêu / Kết quả'
                        }}
                      </h4>
                      <span
                        v-if="ctx.drawerFormMode.value === 'average' && ctx.selectedDrawerItem.value"
                        class="rounded bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-700"
                      >
                        {{ ratioLabels(ctx.selectedDrawerItem.value.calculationTypeCode).formula }}
                      </span>
                    </div>

                    <div class="p-4">
                      <div v-if="ctx.scoringRawInput.value && ctx.drawerFormMode.value === 'average'" class="mt-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                          <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy tắc chấm điểm:</p>
                          <pre class="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{{ ctx.scoringRawInput.value }}</pre>
                        </div>
                      <div
                        class="space-y-4 rounded-lg p-4 mt-4"
                        v-show="ctx.drawerFormMode.value === 'average'"
                        :class="ctx.drawerFormMode.value === 'average' ? 'border border-blue-100 bg-blue-50/20' : 'border border-teal-100 bg-teal-50/30'"
                      >
                        <div
                          v-for="row in ctx.generalPlanActualRows.value"
                          :key="row.id"
                          class="border-b bg-transparent pb-3 last:border-b-0 last:pb-0"
                          :class="ctx.drawerFormMode.value === 'average' ? 'border-blue-100/80' : 'border-teal-100/80'"
                        >
                          <div class="grid grid-cols-1 gap-3 md:grid-cols-[1fr_1fr_1fr_auto] md:items-end">
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">Comment</label>
                              <input
                                v-model="row.comment"
                                type="text"
                                :readonly="ctx.evidenceDrawerReadOnly.value"
                                placeholder="Ghi chú thêm..."
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">
                                {{
                                  ctx.drawerFormMode.value === 'average'
                                    ? ratioLabels(ctx.selectedDrawerItem.value?.calculationTypeCode).plan
                                    : 'Mục tiêu (Plan/Target)'
                                }}
                              </label>
                              <input
                                v-if="ctx.drawerFormMode.value === 'average'"
                                v-model="row.plan"
                                type="text"
                                inputmode="decimal"
                                placeholder="0"
                                :readonly="ctx.evidenceDrawerReadOnly.value"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                              <textarea
                                v-else
                                v-model="row.plan"
                                rows="2"
                                :readonly="ctx.evidenceDrawerReadOnly.value"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div>
                              <label class="mb-1 block text-xs font-bold text-slate-600">
                                {{
                                  ctx.drawerFormMode.value === 'average'
                                    ? ratioLabels(ctx.selectedDrawerItem.value?.calculationTypeCode).actual
                                    : 'Thực tế (Actual/Result)'
                                }}
                              </label>
                              <input
                                v-if="ctx.drawerFormMode.value === 'average'"
                                v-model="row.actual"
                                type="text"
                                inputmode="decimal"
                                placeholder="0"
                                :readonly="ctx.evidenceDrawerReadOnly.value"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-blue-500 read-only:bg-slate-50"
                              />
                              <textarea
                                v-else
                                v-model="row.actual"
                                rows="2"
                                :readonly="ctx.evidenceDrawerReadOnly.value"
                                class="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50"
                              />
                            </div>
                            <div class="flex items-end justify-end md:pb-[2px]">
                              <button
                                v-if="ctx.generalPlanActualRows.value.length > 1 && ctx.canAddEvidenceRecords.value"
                                type="button"
                                class="rounded p-2 text-xs text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                                title="Xóa dòng"
                                @click="ctx.removeGeneralPlanActualRow(row.id)"
                              >
                                <i class="fas fa-trash-alt" />
                              </button>
                            </div>
                          </div>
                        </div>

                        <div v-if="ctx.canAddEvidenceRecords.value" class="flex items-center justify-between">
                          <!-- Ratio preview (average mode) -->
                          <div
                            v-if="ctx.drawerFormMode.value === 'average' && ctx.selectedDrawerItem.value"
                            class="mt-2 flex items-center gap-2"
                          >
                            <span class="text-[10px] font-semibold text-slate-500">Kết quả tính:</span>
                            <span class="rounded bg-blue-50 px-2 py-0.5 text-xs font-bold text-blue-700">
                              {{
                                averageRatioResult(
                                  ctx.generalPlanActualRows.value,
                                  ctx.selectedDrawerItem.value.calculationTypeCode,
                                ) ?? '—'
                              }}
                            </span>
                          </div>
                          <button
                            type="button"
                            class="flex items-center rounded px-4 py-1.5 text-sm font-medium text-white"
                            :class="ctx.drawerFormMode.value === 'average' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-teal-600 hover:bg-teal-700'"
                            @click="ctx.addGeneralPlanActualRow()"
                          >
                            <i class="fas fa-plus mr-1" /> Thêm Record
                          </button>
                        </div>
                      </div>

                      <!-- Comment mode (CALC_RULE 803): Actual input + scoring rules hint + content textarea -->
                      <div v-if="ctx.drawerFormMode.value === 'comment'" class="flex flex-col gap-4">
                        <!-- Actual value input (only shown when scoring rules exist from targetDescription) -->
                        <div v-if="ctx.scoringRulesFromItem.value.length > 0">
                          <!-- Scoring rules hint -->
                          <div v-if="ctx.scoringRawInput.value" class="mt-1.5 rounded border border-slate-200 bg-slate-50 px-3 py-2">
                            <p class="mb-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">Quy tắc chấm điểm:</p>
                            <pre class="font-mono text-[11px] leading-relaxed text-slate-600 whitespace-pre-wrap">{{ ctx.scoringRawInput.value }}</pre>
                          </div>
                          <label class="mb-1 block text-xs font-bold text-slate-700 mt-4">
                            <i class="fas fa-chart-line mr-1 text-emerald-500" />
                            Giá trị thực tế (Actual)
                          </label>
                          <input
                            v-model="ctx.commentActualDraft.value"
                            type="number"
                            inputmode="decimal"
                            step="any"
                            placeholder="Nhập số liệu thực tế..."
                            :readonly="ctx.evidenceDrawerReadOnly.value"
                            class="w-full rounded-md border border-emerald-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-emerald-500 read-only:bg-slate-50"
                          />

                        </div>
                        <!-- Content (description/comment) textarea -->
                        <div>
                          <label class="mb-1 block text-xs font-bold text-slate-700">
                            <i class="fas fa-align-left mr-1 text-teal-500" />
                            Nội dung nhận xét / diễn giải (Content)
                          </label>
                          <textarea
                            v-model="ctx.contentDraft.value"
                            rows="4"
                            placeholder="Mô tả chi tiết bối cảnh, kết quả hoặc diễn giải thêm để PM tham chiếu khi cho điểm..."
                            :readonly="ctx.evidenceDrawerReadOnly.value"
                            class="w-full resize-none rounded-md border border-teal-200 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-teal-500 read-only:bg-slate-50 read-only:text-slate-700"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Attachment hub -->
                <div v-if="ctx.panelMode.value !== 'feedback'" class="relative overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div v-show="ctx.isUploadOnlyDrawer.value" class="absolute left-0 top-0 h-1 w-full bg-pink-500" />
                  <div class="flex items-center justify-between border-b border-slate-200 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-paperclip mr-2 text-slate-500" />
                      <span :class="ctx.isUploadOnlyDrawer.value ? 'text-pink-600' : 'text-slate-700'">
                        {{ ctx.attachmentHubTitle.value }}
                      </span>
                    </h4>
                    <span
                      v-show="ctx.isUploadOnlyDrawer.value"
                      class="rounded bg-pink-100 px-2 py-0.5 text-[10px] font-bold uppercase text-pink-700"
                    >
                      Bắt buộc
                    </span>
                  </div>
                  <div class="space-y-4 p-5">
                    <div class="grid grid-cols-1 gap-4 md:grid-cols-2">
                      <!-- File upload zone -->
                      <label
                        class="group relative block rounded-lg border-2 border-dashed border-slate-300 bg-white p-5 text-center transition-colors"
                        :class="ctx.pendingEvidenceFiles.value.length >= EVIDENCE_MAX_FILES || ctx.evidenceDrawerReadOnly.value
                          ? 'cursor-not-allowed opacity-60'
                          : 'cursor-pointer hover:border-indigo-400 hover:bg-slate-50'"
                      >
                        <input
                          v-if="ctx.pendingEvidenceFiles.value.length < EVIDENCE_MAX_FILES"
                          type="file"
                          multiple
                          :accept="EVIDENCE_ACCEPT_ATTR"
                          class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                          title="Chọn file (tối đa 5 file)"
                          :disabled="ctx.evidenceDrawerReadOnly.value"
                          @change="ctx.onEvidenceFilesChange($event)"
                        />
                        <div
                          class="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-indigo-50 text-indigo-500 transition-transform group-hover:scale-110"
                        >
                          <i class="fas fa-cloud-upload-alt text-2xl" />
                        </div>
                        <p class="text-sm font-bold text-slate-700">Tải File Lên (PC)</p>
                        <p class="mt-1 text-[10px] uppercase tracking-wider text-slate-400">
                          PDF, Word, Excel, CSV, JPG, PNG - tối đa {{ EVIDENCE_MAX_FILES }} file
                        </p>
                      </label>

                      <!-- URL input -->
                      <div class="flex flex-col rounded-lg border border-slate-200 bg-slate-50 p-5">
                        <label class="mb-1 block text-sm font-bold text-slate-700">Thêm link URL</label>
                        <p class="mb-3 text-[10px] uppercase tracking-wider text-slate-400">
                          Jira, Confluence, Drive, cổng tra cứu điểm… - tối đa {{ EVIDENCE_MAX_URLS }} link
                        </p>
                        <div class="flex flex-col gap-2 sm:flex-row sm:items-stretch">
                          <div class="relative min-w-0 flex-1">
                            <i class="fas fa-link pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                              v-model="ctx.evidenceUrlDraft.value"
                              type="text"
                              inputmode="url"
                              autocomplete="url"
                              placeholder="https://..."
                              class="w-full rounded-md border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm shadow-sm focus:ring-1 focus:ring-indigo-500"
                              :disabled="ctx.pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS || ctx.evidenceDrawerReadOnly.value"
                              @keydown="ctx.onEvidenceUrlDraftKeydown($event)"
                            />
                          </div>
                          <button
                            type="button"
                            class="shrink-0 rounded-md bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
                            :disabled="ctx.pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS"
                            @click="ctx.addPendingEvidenceUrl()"
                          >
                            Thêm URL
                          </button>
                        </div>
                        <p v-if="ctx.evidenceUrlHint.value" class="mt-2 text-xs text-amber-700">
                          {{ ctx.evidenceUrlHint.value }}
                        </p>
                      </div>
                    </div>

                    <!-- Attachment lists -->
                    <div class="space-y-4">
                      <div class="flex flex-wrap gap-4 rounded-lg border border-slate-100 bg-slate-50/90 px-3 py-2 text-xs font-semibold text-slate-700">
                        <span class="inline-flex items-center gap-2">
                          <i class="fas fa-file-alt text-slate-500" aria-hidden="true" />
                          File (máy):
                          <span class="tabular-nums text-slate-900">
                            {{ ctx.evidenceFileSectionCount.value }}/{{ EVIDENCE_MAX_FILES }}
                          </span>
                        </span>
                        <span class="hidden sm:inline text-slate-300" aria-hidden="true">|</span>
                        <span class="inline-flex items-center gap-2">
                          <i class="fas fa-link text-indigo-500" aria-hidden="true" />
                          URL / đường dẫn:
                          <span class="tabular-nums text-slate-900">
                            {{ ctx.pendingEvidenceUrls.value.length }}/{{ EVIDENCE_MAX_URLS }}
                          </span>
                        </span>
                        <span
                          v-if="ctx.pendingEvidenceFiles.value.length >= EVIDENCE_MAX_FILES || ctx.pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS"
                          class="ml-auto flex flex-wrap gap-2 text-[11px] font-medium text-amber-700"
                        >
                          <span v-if="ctx.pendingEvidenceFiles.value.length >= EVIDENCE_MAX_FILES">Đủ file máy</span>
                          <span v-if="ctx.pendingEvidenceUrls.value.length >= EVIDENCE_MAX_URLS">Đủ ô link</span>
                        </span>
                      </div>
                      <p v-if="ctx.evidenceUploadHint.value" class="text-xs text-amber-700">
                        {{ ctx.evidenceUploadHint.value }}
                      </p>

                      <!-- File attachments -->
                      <div v-if="ctx.hasFileAttachmentsSection.value">
                        <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          File đính kèm
                        </p>
                        <ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-slate-200 bg-white">
                          <li
                            v-for="row in ctx.pendingEvidenceFiles.value"
                            :key="'f-' + row.id"
                            class="flex items-center gap-3 px-3 py-2.5"
                          >
                            <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">FILE</span>
                            <i class="fas fa-file-alt shrink-0 text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-sm font-medium text-slate-800" :title="row.file.name">
                                {{ row.file.name }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa file"
                              @click="ctx.removePendingEvidenceFile(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                          <li
                            v-for="row in ctx.pendingEvidenceNamedRows.value"
                            :key="'evname-' + row.id"
                            class="flex items-center gap-3 px-3 py-2.5"
                          >
                            <span class="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-bold uppercase text-slate-600">FILE</span>
                            <i class="fas fa-file-alt shrink-0 text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <p class="truncate text-sm font-medium text-slate-800" :title="(row.name ?? '').trim()">
                                {{ (row.name ?? '').trim() }}
                              </p>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa minh chứng (gỡ cả tên và đường dẫn)"
                              @click="ctx.removePendingEvidenceUrl(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                        </ul>
                      </div>

                      <!-- URL list -->
                      <div v-if="ctx.hasEvidenceUrlList.value">
                        <p class="mb-2 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                          URL đường dẫn minh chứng
                        </p>
                        <ul class="divide-y divide-slate-100 overflow-hidden rounded-lg border border-indigo-100 bg-white">
                          <li
                            v-for="row in ctx.pendingEvidenceUrls.value"
                            :key="'u-' + row.id"
                            class="flex items-center gap-2 px-3 py-2.5"
                          >
                            <span class="shrink-0 rounded bg-indigo-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-indigo-600">URL</span>
                            <i class="fas fa-external-link-alt shrink-0 text-xs text-slate-400" />
                            <div class="min-w-0 flex-1">
                              <a
                                :href="row.url"
                                target="_blank"
                                rel="noopener noreferrer"
                                class="block truncate text-sm font-medium text-indigo-700 hover:underline"
                                :title="row.url"
                              >
                                {{ row.url }}
                              </a>
                            </div>
                            <button
                              type="button"
                              class="shrink-0 rounded p-1.5 text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              title="Xóa URL"
                              @click="ctx.removePendingEvidenceUrl(row.id)"
                            >
                              <i class="fas fa-times" />
                            </button>
                          </li>
                        </ul>
                      </div>

                      <p
                        v-if="!ctx.hasEvidenceAttachments.value"
                        class="rounded border border-dashed border-slate-200 bg-slate-50/80 px-3 py-2 text-center text-xs text-slate-500"
                      >
                        Chưa có file hoặc URL - thêm ở hai ô phía trên
                      </p>
                    </div>
                  </div>
                </div>

                <!-- Note / comment for PM -->
                <div v-if="ctx.panelMode.value !== 'feedback'" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-comment-alt mr-2 text-slate-500" />
                      Ghi chú (Comment cho PM)
                    </h4>
                  </div>
                  <div class="p-4">
                    <textarea
                      v-model="ctx.evidenceNoteDraft.value"
                      rows="3"
                      placeholder="Nhập diễn giải thêm về bằng chứng của bạn..."
                      :readonly="ctx.evidenceDrawerReadOnly.value"
                      class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50"
                    />
                  </div>
                </div>

                <!-- target_setup feedback + GM comment -->
                <div v-if="ctx.panelMode.value === 'feedback'" class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-message mr-2 text-slate-500" />
                      Feedback & GM Comment
                    </h4>
                  </div>
                  <div class="space-y-4 p-4">
                    <div>
                      <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        Feedback của Member (target setup)
                      </label>
                      <textarea
                        v-model="ctx.memberFeedbackDraft.value"
                        rows="2"
                        placeholder="Ví dụ: KPI này quá sức, cần giảm target hoặc chia milestone."
                        :readonly="ctx.evidenceDrawerReadOnly.value"
                        class="w-full resize-none rounded-md border border-slate-300 bg-white px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 read-only:bg-slate-50"
                      />
                    </div>
                    <div v-if="(ctx.gmCommentDraft.value || '').trim()">
                      <label class="mb-1 block text-xs font-bold uppercase tracking-wider text-slate-500">
                        GM Comment
                      </label>
                      <textarea
                        v-model="ctx.gmCommentDraft.value"
                        rows="2"
                        placeholder="Ghi chú từ GM cho KPI này"
                        readonly
                        class="w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                      />
                    </div>
                  </div>
                </div>

                <!-- GM comment in detail mode -->
                <div
                  v-else-if="(ctx.gmCommentDraft.value || '').trim()"
                  class="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm"
                >
                  <div class="border-b border-slate-100 bg-slate-50 px-4 py-3">
                    <h4 class="flex items-center text-sm font-bold text-slate-700">
                      <i class="fas fa-user-tie mr-2 text-slate-500" />
                      GM Comment
                    </h4>
                  </div>
                  <div class="p-4">
                    <textarea
                      v-model="ctx.gmCommentDraft.value"
                      rows="2"
                      readonly
                      class="w-full resize-none rounded-md border border-slate-300 bg-slate-50 px-3 py-2 text-sm text-slate-600"
                    />
                  </div>
                </div>

              </div>
            </div>
          </div>

          <!-- Drawer footer -->
          <div
            class="flex items-center justify-between border-t border-slate-200 bg-white p-4 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]"
          >
            <div v-if="ctx.panelMode.value !== 'feedback'" class="flex flex-col">
              <!-- Auto-computed score for CALC_RULE 803 with scoring rules -->
              <template
                v-if="
                  (ctx.drawerFormMode.value === 'comment' || ctx.drawerFormMode.value === 'average')
                  && ctx.scoringRulesFromItem.value.length > 0
                "
              >
                <label class="mb-1 text-xs font-semibold text-slate-600">Điểm (tự tính)</label>
                <div class="flex items-center gap-2 h-10">
                  <span
                    class="inline-flex min-w-[2.75rem] items-center justify-center rounded-md border px-3 py-2 text-sm font-bold"
                    :class="ctx.computedEvalScore.value !== null
                      ? 'border-emerald-300 bg-emerald-50 text-emerald-800'
                      : 'border-slate-200 bg-slate-50 text-slate-400'"
                  >
                    {{ ctx.computedEvalScore.value !== null ? ctx.computedEvalScore.value : '—' }}
                  </span>
                  <span class="text-xs text-slate-500">/ 5</span>
                  <span
                    v-if="ctx.computedEvalScore.value === null"
                    class="text-xs text-slate-400"
                  >
                    {{ ctx.drawerFormMode.value === 'average' ? 'Nhập đủ số liệu để tính' : 'Nhập Actual để tính' }}
                  </span>
                </div>
                <p
                  v-if="ctx.metricOutOfDslRule.value"
                  class="mt-1 text-xs font-medium text-rose-600"
                >
                  Giá trị Actual/Kết quả tính đang vượt mức tối đa của Quy tắc chấm điểm.
                </p>
              </template>
              <!-- Manual score dropdown for average mode or when no scoring rules -->
              <template v-else>
                <label class="mb-1 text-xs font-semibold text-slate-600">Evaluation</label>
                <select
                  class="w-40 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm font-bold text-slate-800 shadow-sm focus:ring-1 focus:ring-sky-500 disabled:cursor-default disabled:bg-slate-50"
                  :disabled="ctx.evidenceDrawerReadOnly.value || ctx.selectedDrawerItem.value?.canEditScore !== true"
                  :value="ctx.detailSelfScore.value ?? ''"
                  @change="
                    ctx.detailSelfScore.value =
                      ($event.target as HTMLSelectElement).value === ''
                        ? null
                        : parseInt(($event.target as HTMLSelectElement).value, 10)
                  "
                >
                  <option value="" disabled>- Chưa chọn -</option>
                  <option v-for="n in 5" :key="'ds-' + n" :value="n">{{ n }}</option>
                </select>
              </template>
            </div>
            <div v-else class="text-sm font-semibold text-violet-700">
              Gửi feedback cho KPI này
            </div>

            <div class="flex items-center space-x-3">
              <button
                type="button"
                class="rounded-lg border border-slate-300 bg-white px-5 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-50"
                @click="ctx.closeEvidencePanel()"
              >
                Hủy bỏ
              </button>

              <button
                v-if="!ctx.evidenceDrawerReadOnly.value"
                type="button"
                class="flex items-center rounded-lg bg-slate-800 px-5 py-2 text-sm font-bold text-white shadow-md transition-colors hover:bg-slate-900 disabled:cursor-not-allowed disabled:opacity-45"
                :disabled="!ctx.canSaveEvidence.value || ctx.saving.value"
                :title="!ctx.canSaveEvidence.value
                  ? (ctx.panelMode.value === 'feedback'
                    ? 'Vui lòng nhập feedback trước khi gửi'
                    : 'Vui lòng chọn điểm tự đánh giá (1–5) trước khi lưu')
                  : undefined"
                @click="ctx.saveEvidenceDetail()"
              >
                <i
                  :class="ctx.saving.value ? 'fas fa-spinner fa-spin' : 'fas fa-save'"
                  class="mr-2 text-sm"
                />
                {{ ctx.panelMode.value === 'feedback' ? 'Gửi Feedback' : 'Lưu Evidence' }}
              </button>
              <span
                v-else
                class="rounded-lg border border-slate-200 bg-slate-50 px-4 py-2 text-xs font-semibold text-slate-500"
              >
                Chỉ xem — không lưu chỉnh sửa
              </span>
            </div>
          </div>
        </aside>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
.evidence-drawer-enter-active,
.evidence-drawer-leave-active {
  transition: opacity 0.3s ease;
}

.evidence-drawer-enter-active .evidence-drawer-panel,
.evidence-drawer-leave-active .evidence-drawer-panel {
  transition: transform 0.3s ease-in-out;
}

.evidence-drawer-enter-from,
.evidence-drawer-leave-to {
  opacity: 0;
}

.evidence-drawer-enter-from .evidence-drawer-panel,
.evidence-drawer-leave-to .evidence-drawer-panel {
  transform: translateX(100%);
}
</style>
