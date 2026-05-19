<script setup lang="ts">
import { computed, ref, watch } from 'vue'

type MemberSummary = {
  userId: string
  userFullName: string
  avatar: string
  pendingCount: number
  latestDateLabel: string
  roleCodes: string[]
}

const props = withDefaults(
  defineProps<{
    members: MemberSummary[]
    loading?: boolean
    actionBusy?: boolean
  }>(),
  { loading: false, actionBusy: false },
)

const emit = defineEmits<{
  'open-member': [m: MemberSummary]
  'approve-selected': [userIds: string[]]
  'reject-selected': [payload: { userIds: string[]; reason: string }]
}>()

function roleTagClass(code: string): string {
  const u = code.toUpperCase().trim()
  if (u === 'GM') return 'bg-rose-50 text-rose-800 ring-rose-200/80'
  if (u === 'PM') return 'bg-violet-50 text-violet-800 ring-violet-200/80'
  if (u === 'LEADER') return 'bg-sky-50 text-sky-800 ring-sky-200/80'
  if (u === 'MEMBER') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'
  return 'bg-slate-100 text-slate-700 ring-slate-200/80'
}

const selectedUserIds = ref<Set<string>>(new Set())

const selectableMembers = computed(() =>
  props.members.filter((m) => m.pendingCount > 0),
)

const selectedMemberCount = computed(() => selectedUserIds.value.size)

const isAllSelected = computed(() => {
  const ids = selectableMembers.value.map((m) => m.userId)
  return ids.length > 0 && ids.every((id) => selectedUserIds.value.has(id))
})

function syncSelectedUserIds() {
  const valid = new Set(props.members.map((m) => m.userId))
  const next = new Set<string>()
  for (const id of selectedUserIds.value) {
    if (valid.has(id)) next.add(id)
  }
  selectedUserIds.value = next
}

watch(() => props.members, syncSelectedUserIds, { deep: true })

function toggleMemberSelection(userId: string, event?: Event) {
  event?.stopPropagation()
  const m = props.members.find((x) => x.userId === userId)
  if (!m?.pendingCount) return
  const next = new Set(selectedUserIds.value)
  if (next.has(userId)) next.delete(userId)
  else next.add(userId)
  selectedUserIds.value = next
}

function toggleSelectAll(event?: Event) {
  event?.stopPropagation()
  if (isAllSelected.value) {
    selectedUserIds.value = new Set()
    return
  }
  selectedUserIds.value = new Set(selectableMembers.value.map((m) => m.userId))
}

function onApproveSelected() {
  const ids = [...selectedUserIds.value]
  if (!ids.length || props.actionBusy) return
  emit('approve-selected', ids)
  selectedUserIds.value = new Set()
}

const rejectDialogOpen = ref(false)
const rejectReason = ref('')
const rejectError = ref('')

function openRejectDialog() {
  if (!selectedUserIds.value.size || props.actionBusy) return
  rejectReason.value = ''
  rejectError.value = ''
  rejectDialogOpen.value = true
}

function closeRejectDialog() {
  rejectDialogOpen.value = false
  rejectReason.value = ''
  rejectError.value = ''
}

function confirmRejectSelected() {
  const reason = rejectReason.value.trim()
  if (!reason) {
    rejectError.value = 'Vui lòng nhập lý do từ chối.'
    return
  }
  const ids = [...selectedUserIds.value]
  if (!ids.length || props.actionBusy) return
  emit('reject-selected', { userIds: ids, reason })
  selectedUserIds.value = new Set()
  closeRejectDialog()
}
</script>

<template>
  <div
    class="animate-fade-in overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100"
  >
    <div class="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">
      <h3 class="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-800">
        <span
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm"
          aria-hidden="true"
        >
          <i class="fas fa-clipboard-check text-[17px] leading-none" />
        </span>
        Request Approval
      </h3>
      <div class="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <template v-if="selectedMemberCount > 0">
          <span class="text-[11px] font-semibold text-slate-500">
            Đã chọn {{ selectedMemberCount }} thành viên
          </span>
          <button
            type="button"
            :disabled="actionBusy"
            class="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800 shadow-sm hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
            @click.stop="onApproveSelected"
          >
            <i class="fas fa-check text-[11px]" aria-hidden="true" />
            Duyệt
          </button>
          <button
            type="button"
            :disabled="actionBusy"
            class="inline-flex items-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-800 shadow-sm hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-50"
            @click.stop="openRejectDialog"
          >
            <i class="fas fa-times text-[11px]" aria-hidden="true" />
            Từ chối
          </button>
        </template>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Tìm kiếm"
          title="Tìm kiếm"
          @click.stop
        >
          <i class="fas fa-search text-sm" />
        </button>
        <button
          type="button"
          class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"
          aria-label="Lọc"
          title="Lọc"
          @click.stop
        >
          <i class="fas fa-filter text-sm" />
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex items-center justify-center gap-2 py-16 text-sm text-slate-500">
      <i class="fas fa-spinner fa-spin" />
      Đang tải danh sách…
    </div>

    <div v-else class="overflow-x-auto">
      <table class="w-full min-w-[560px] table-fixed border-collapse text-left">
        <thead>
          <tr class="border-b border-slate-200 bg-white">
            <th class="w-10 py-3.5 pl-5 pr-1">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                :checked="isAllSelected"
                :disabled="!selectableMembers.length || actionBusy"
                aria-label="Chọn tất cả"
                @click.stop="toggleSelectAll"
              />
            </th>
            <th class="py-3.5 pl-2 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500">
              Thành viên
            </th>
            <th
              class="w-[9.5rem] px-3 py-3.5 text-center text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Số KPI chờ duyệt
            </th>
            <th
              class="w-[11rem] px-3 py-3.5 text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Gửi gần nhất
            </th>
            <th
              class="w-[10rem] py-3.5 pl-3 pr-5 text-right text-[11px] font-bold uppercase tracking-wide text-slate-500"
            >
              Thao tác
            </th>
          </tr>
        </thead>
        <tbody class="divide-y divide-slate-100">
          <tr v-if="!members.length">
            <td colspan="5" class="py-14 text-center text-sm text-slate-500">
              Không có KPI nào chờ PM duyệt.
            </td>
          </tr>
          <tr
            v-for="m in members"
            :key="m.userId"
            class="cursor-pointer bg-white transition-colors hover:bg-slate-50/90"
            @click="emit('open-member', m)"
          >
            <td class="py-4 pl-5 pr-1 align-middle">
              <input
                type="checkbox"
                class="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                :checked="selectedUserIds.has(m.userId)"
                :disabled="!m.pendingCount || actionBusy"
                :aria-label="`Chọn ${m.userFullName}`"
                @click.stop="toggleMemberSelection(m.userId, $event)"
              />
            </td>
            <td class="py-4 pl-2 pr-3 align-middle">
              <div class="flex min-w-0 items-center gap-3">
                <div
                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[13px] font-bold uppercase tracking-tight text-sky-800 shadow-sm"
                >
                  {{ m.avatar }}
                </div>
                <div class="min-w-0 flex-1 overflow-hidden">
                  <div class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle">
                    <span class="min-w-0 truncate text-sm font-semibold text-slate-900">
                      {{ m.userFullName }}
                    </span>
                    <div v-if="m.roleCodes.length" class="flex shrink-0 flex-wrap items-center gap-1">
                      <span
                        v-for="(rc, ri) in m.roleCodes"
                        :key="ri"
                        class="inline-flex items-center rounded-md px-2 py-0.5 font-mono text-[10px] font-bold uppercase leading-none tracking-wide ring-1"
                        :class="roleTagClass(rc)"
                        :title="rc"
                      >
                        {{ rc }}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </td>
            <td class="px-3 py-4 align-middle text-center">
              <span
                class="inline-flex h-8 min-w-[2rem] items-center justify-center rounded-full bg-orange-50 px-2.5 text-xs font-bold tabular-nums text-orange-800 ring-1 ring-orange-100"
              >
                {{ m.pendingCount }}
              </span>
            </td>
            <td class="px-3 py-4 align-middle text-sm tabular-nums text-slate-600">
              {{ m.latestDateLabel }}
            </td>
            <td class="py-4 pl-3 pr-5 align-middle text-right">
              <button
                type="button"
                class="inline-flex items-center justify-center rounded-lg border border-blue-200 bg-white px-3.5 py-2 text-xs font-bold text-blue-700 shadow-sm transition-colors hover:border-blue-300 hover:bg-blue-50/80 hover:text-blue-800"
                @click.stop="emit('open-member', m)"
              >
                Xem &amp; duyệt
              </button>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <Teleport to="body">
      <div
        v-if="rejectDialogOpen"
        class="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/55 p-4 backdrop-blur-sm"
        @click.self="closeRejectDialog"
      >
        <div class="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl">
          <div class="mb-3 flex items-center gap-3">
            <div class="rounded-full bg-rose-100 p-2 text-rose-600">
              <i class="fas fa-circle-exclamation text-lg" />
            </div>
            <h3 class="text-lg font-bold text-slate-900">Từ chối KPI đã chọn</h3>
          </div>
          <p class="mb-3 text-sm text-slate-600">
            Bạn sắp từ chối tất cả KPI chờ duyệt (402) của
            <strong>{{ selectedMemberCount }}</strong>
            thành viên. Nhập lý do áp dụng cho tất cả.
          </p>
          <label class="mb-1 block text-sm font-semibold text-slate-700">
            Lý do từ chối <span class="text-rose-500">*</span>
          </label>
          <textarea
            v-model="rejectReason"
            class="min-h-[110px] w-full resize-none rounded-lg border p-3 text-sm outline-none focus:ring-2"
            :class="
              rejectError ? 'border-rose-400 focus:ring-rose-100' : 'border-slate-300 focus:ring-rose-100'
            "
            placeholder="Nhập lý do chi tiết..."
          />
          <p v-if="rejectError" class="mt-1 text-xs font-medium text-rose-600">{{ rejectError }}</p>
          <div class="mt-4 flex justify-end gap-2">
            <button
              type="button"
              class="rounded-lg px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100"
              @click="closeRejectDialog"
            >
              Hủy
            </button>
            <button
              type="button"
              :disabled="actionBusy"
              class="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold text-white hover:bg-rose-700 disabled:opacity-50"
              @click="confirmRejectSelected"
            >
              Xác nhận từ chối
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
