<script setup lang="ts">

type MemberSummary = {

  userId: string

  userFullName: string

  avatar: string

  pendingCount: number

  latestDateLabel: string

  roleCodes: string[]

}

function roleTagClass(code: string): string {

  const u = code.toUpperCase().trim()

  if (u === 'GM') return 'bg-rose-50 text-rose-800 ring-rose-200/80'

  if (u === 'PM') return 'bg-violet-50 text-violet-800 ring-violet-200/80'

  if (u === 'LEADER') return 'bg-sky-50 text-sky-800 ring-sky-200/80'

  if (u === 'MEMBER') return 'bg-emerald-50 text-emerald-800 ring-emerald-200/80'

  return 'bg-slate-100 text-slate-700 ring-slate-200/80'

}



defineProps({

  members: { type: Array as () => MemberSummary[], required: true },

  loading: { type: Boolean, default: false },

})



const emit = defineEmits<{

  'open-member': [m: MemberSummary]

}>()

</script>



<template>

  <div

    class="animate-fade-in overflow-hidden rounded-2xl border border-slate-200/90 bg-white shadow-sm ring-1 ring-slate-100"

  >

    <!-- Tiêu đề + công cụ (khớp layout ảnh) -->

    <div class="flex items-center justify-between border-b border-slate-100 bg-white px-5 py-4">

      <h3 class="flex items-center gap-3 text-lg font-bold tracking-tight text-slate-800">

        <span

          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-blue-600 shadow-sm"

          aria-hidden="true"

        >

          <i class="fas fa-clipboard-check text-[17px] leading-none"></i>

        </span>

        Request Approval

      </h3>

      <div class="flex shrink-0 items-center gap-2">

        <button

          type="button"

          class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"

          aria-label="Tìm kiếm"

          title="Tìm kiếm"

          @click.stop

        >

          <i class="fas fa-search text-sm"></i>

        </button>

        <button

          type="button"

          class="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:border-slate-300 hover:bg-slate-50 hover:text-slate-700"

          aria-label="Lọc"

          title="Lọc"

          @click.stop

        >

          <i class="fas fa-filter text-sm"></i>

        </button>

      </div>

    </div>



    <div

      v-if="loading"

      class="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"

    >

      <i class="fas fa-spinner fa-spin" />

      Đang tải danh sách…

    </div>



    <div v-else class="overflow-x-auto">

      <table class="w-full min-w-[520px] table-fixed border-collapse text-left">

        <thead>

          <tr class="border-b border-slate-200 bg-white">

            <th

              class="py-3.5 pl-5 pr-3 text-[11px] font-bold uppercase tracking-wide text-slate-500"

            >

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

            <td colspan="4" class="py-14 text-center text-sm text-slate-500">

              Không có KPI nào chờ PM duyệt (402).

            </td>

          </tr>

          <tr

            v-for="m in members"

            :key="m.userId"

            class="cursor-pointer bg-white transition-colors hover:bg-slate-50/90"

            @click="emit('open-member', m)"

          >

            <td class="py-4 pl-5 pr-3 align-middle">

              <div class="flex min-w-0 items-center gap-3">

                <div

                  class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-sky-200 bg-sky-50 text-[13px] font-bold uppercase tracking-tight text-sky-800 shadow-sm"

                >

                  {{ m.avatar }}

                </div>

                <div class="min-w-0 flex-1 overflow-hidden">

                  <div

                    class="inline-flex min-w-0 max-w-full items-center gap-1.5 align-middle"

                  >

                    <span class="min-w-0 truncate text-sm font-semibold text-slate-900">

                      {{ m.userFullName }}

                    </span>

                    <div

                      v-if="m.roleCodes.length"

                      class="flex shrink-0 flex-wrap items-center gap-1"

                    >

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

  </div>

</template>


