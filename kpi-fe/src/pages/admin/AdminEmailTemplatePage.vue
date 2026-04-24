<script setup lang="ts">
/**
 * AdminEmailTemplatePage.vue
 * Trang Quản lý Mẫu Email — chuyển đổi từ a3.html
 */
import { ref, computed } from 'vue'
import { adminKpiService } from '@/services/modules/kpi-admin.service'
import type { EmailTemplate, TemplateGroup } from '@/mocks/admin.mock'
import { TEMPLATE_VARIABLES } from '@/mocks/admin.mock'

// ── State ──────────────────────────────────────────────────────────────────────

const templates = ref<EmailTemplate[]>([])
const loading = ref(false)
const showDrawer = ref(false)
const drawerMode = ref<'create' | 'edit'>('create')
const editingId = ref<string | null>(null)
const toastMsg = ref('')
const showToast = ref(false)

// Form state
const formName = ref('')
const formSubject = ref('')
const formBody = ref('')
const formStatus = ref<'active' | 'inactive'>('active')
const formMode = ref<'manual' | 'auto'>('manual')
const formGroup = ref<TemplateGroup>('launch')

// ── Init ───────────────────────────────────────────────────────────────────────

const init = async () => {
  loading.value = true
  try {
    templates.value = await adminKpiService.getEmailTemplates()
  } finally {
    loading.value = false
  }
}
init()

// ── Computed ───────────────────────────────────────────────────────────────────

const totalTemplates = computed(() => templates.value.length)
const activeCount = computed(() => templates.value.filter(t => t.status === 'active').length)
const autoCount = computed(() => templates.value.filter(t => t.mode === 'auto').length)

const launchTemplates = computed(() => templates.value.filter(t => t.group === 'launch'))
const reminderTemplates = computed(() => templates.value.filter(t => t.group === 'reminder'))
const approvalTemplates = computed(() => templates.value.filter(t => t.group === 'approval'))

// ── Methods ────────────────────────────────────────────────────────────────────

const openCreateDrawer = () => {
  drawerMode.value = 'create'
  formName.value = ''
  formSubject.value = ''
  formBody.value = ''
  formStatus.value = 'active'
  formMode.value = 'manual'
  formGroup.value = 'launch'
  editingId.value = null
  showDrawer.value = true
}

const openEditDrawer = (tpl: EmailTemplate) => {
  drawerMode.value = 'edit'
  formName.value = tpl.name
  formSubject.value = tpl.subject
  formBody.value = tpl.body
  formStatus.value = tpl.status
  formMode.value = tpl.mode
  formGroup.value = tpl.group
  editingId.value = tpl.id
  showDrawer.value = true
}

const closeDrawer = () => { showDrawer.value = false }

const saveTemplate = async () => {
  const payload = {
    name: formName.value,
    subject: formSubject.value,
    body: formBody.value,
    status: formStatus.value,
    mode: formMode.value,
    group: formGroup.value,
    updatedAt: 'Vừa xong',
  }

  if (drawerMode.value === 'create') {
    await adminKpiService.createEmailTemplate(payload)
    templates.value = await adminKpiService.getEmailTemplates()
    triggerToast('Đã tạo mẫu Email mới thành công!')
  } else if (editingId.value) {
    await adminKpiService.updateEmailTemplate(editingId.value, payload)
    const idx = templates.value.findIndex(t => t.id === editingId.value)
    if (idx > -1) templates.value[idx] = { id: editingId.value, ...payload }
    triggerToast('Đã lưu mẫu Email thành công!')
  }
  closeDrawer()
}

const copyVariable = async (varStr: string) => {
  try {
    await navigator.clipboard.writeText(varStr)
    triggerToast(`Đã copy biến ${varStr} vào khay nhớ tạm.`)
  } catch {
    triggerToast(`Copy: ${varStr}`)
  }
}

const triggerToast = (msg: string) => {
  toastMsg.value = msg
  showToast.value = true
  setTimeout(() => { showToast.value = false }, 3000)
}

// ── Display Helpers ────────────────────────────────────────────────────────────

const statusBadge = (status: string) => status === 'active'
  ? { cls: 'bg-green-50 text-green-600 border border-green-200', label: 'Kích hoạt' }
  : { cls: 'bg-slate-100 text-slate-500 border border-slate-200', label: 'Tạm ngưng' }

const modeBadge = (mode: string) => mode === 'auto'
  ? { cls: 'bg-orange-50 text-orange-600 border border-orange-200', icon: 'fa-bolt', label: 'Tự động (Auto)' }
  : { cls: 'bg-slate-100 text-slate-500 border border-slate-200', icon: 'fa-mouse-pointer', label: 'Gửi thủ công' }

const groupIcon = (group: TemplateGroup) => ({
  launch:   { icon: 'fa-bullhorn', cls: 'text-indigo-500', label: 'Giai đoạn Khởi tạo (Campaign Launch)' },
  reminder: { icon: 'fa-bell', cls: 'text-orange-500', label: 'Giai đoạn Nhắc nhở (Reminders)' },
  approval: { icon: 'fa-check-square', cls: 'text-green-500', label: 'Giai đoạn Phê duyệt (Approvals)' },
}[group])

const cardIconBg = (tpl: EmailTemplate) => {
  if (tpl.group === 'approval') return 'bg-green-50 text-green-600 border border-green-100'
  if (tpl.status !== 'active') return 'bg-slate-100 text-slate-600 border border-slate-200'
  const icons: Record<string, string> = {
    'tpl-1': 'bg-indigo-50 text-indigo-600 border border-indigo-100',
    'tpl-2': 'bg-orange-50 text-orange-600 border border-orange-100',
    'tpl-3': 'bg-red-50 text-red-600 border border-red-100',
    'tpl-4': 'bg-slate-100 text-slate-600 border border-slate-200',
    'tpl-5': 'bg-green-50 text-green-600 border border-green-100',
  }
  return icons[tpl.id] ?? 'bg-indigo-50 text-indigo-600 border border-indigo-100'
}

const cardIcon = (tpl: EmailTemplate) => ({
  'tpl-1': 'fa-envelope-open',
  'tpl-2': 'fa-clock',
  'tpl-3': 'fa-exclamation-circle',
  'tpl-4': 'fa-redo',
  'tpl-5': 'fa-check-circle',
}[tpl.id] ?? 'fa-envelope')
</script>

<template>
  <div class="flex-1 flex flex-col overflow-hidden">

    <!-- HEADER -->
    <header class="bg-white border-b border-slate-200 px-8 py-4 flex justify-between items-center shrink-0">
      <div>
        <h1 class="text-2xl font-bold text-slate-800">Quản lý Mẫu Email (Email Templates)</h1>
        <p class="text-sm text-slate-500 mt-1">Tùy chỉnh nội dung các thông báo tự động và thủ công của hệ thống</p>
      </div>
      <div>
        <button
          class="bg-indigo-600 text-white px-4 py-2 rounded-md text-sm font-bold hover:bg-indigo-700 shadow-sm flex items-center transition-colors"
          @click="openCreateDrawer"
        >
          <i class="fas fa-plus mr-2" /> Tạo Mẫu Mới
        </button>
      </div>
    </header>

    <main class="flex-1 overflow-auto p-8 bg-slate-50/50">
      <div class="max-w-[1400px] mx-auto space-y-8">

        <!-- SUMMARY CARDS -->
        <div class="grid grid-cols-3 gap-5">
          <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-indigo-500">
            <div>
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tổng số Mẫu Email</div>
              <div class="text-3xl font-black text-slate-800">{{ totalTemplates }}</div>
            </div>
            <div class="w-12 h-12 bg-indigo-50 text-indigo-500 rounded-full flex items-center justify-center">
              <i class="fas fa-layer-group text-xl" />
            </div>
          </div>
          <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-green-500">
            <div>
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Đang Kích hoạt (Active)</div>
              <div class="text-3xl font-black text-slate-700">{{ activeCount }}</div>
            </div>
            <div class="w-12 h-12 bg-green-50 text-green-500 rounded-full flex items-center justify-center">
              <i class="fas fa-check-circle text-xl" />
            </div>
          </div>
          <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between border-l-4 border-l-orange-500">
            <div>
              <div class="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">Tự động (Automation)</div>
              <div class="text-3xl font-black text-slate-700">{{ autoCount }}</div>
            </div>
            <div class="w-12 h-12 bg-orange-50 text-orange-500 rounded-full flex items-center justify-center">
              <i class="fas fa-bolt text-xl" />
            </div>
          </div>
        </div>

        <!-- SKELETON -->
        <div v-if="loading" class="grid grid-cols-3 gap-5">
          <div v-for="i in 3" :key="i" class="bg-white border border-slate-200 rounded-xl p-5 animate-pulse">
            <div class="h-10 w-10 bg-slate-200 rounded mb-4" />
            <div class="h-5 bg-slate-200 rounded w-3/4 mb-2" />
            <div class="h-4 bg-slate-200 rounded w-full mb-1" />
            <div class="h-4 bg-slate-200 rounded w-4/5" />
          </div>
        </div>

        <!-- TEMPLATE GROUPS -->
        <div v-else class="space-y-6">

          <!-- Group: Launch -->
          <div v-if="launchTemplates.length">
            <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 flex items-center">
              <i :class="`fas ${groupIcon('launch').icon} mr-2 ${groupIcon('launch').cls}`" />
              {{ groupIcon('launch').label }}
            </h2>
            <div class="grid grid-cols-3 gap-5">
              <div
                v-for="tpl in launchTemplates"
                :key="tpl.id"
                class="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors flex flex-col group cursor-pointer"
                @click="openEditDrawer(tpl)"
              >
                <div class="p-5 border-b border-slate-100 flex justify-between items-start">
                  <div class="w-10 h-10 rounded flex items-center justify-center shrink-0" :class="cardIconBg(tpl)">
                    <i :class="`fas ${cardIcon(tpl)} text-lg`" />
                  </div>
                  <div class="flex flex-col items-end space-y-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="statusBadge(tpl.status).cls">
                      {{ statusBadge(tpl.status).label }}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="modeBadge(tpl.mode).cls">
                      <i :class="`fas ${modeBadge(tpl.mode).icon} mr-1 text-xs`" /> {{ modeBadge(tpl.mode).label }}
                    </span>
                  </div>
                </div>
                <div class="p-5 flex-1">
                  <h3 class="font-bold text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-colors">{{ tpl.name }}</h3>
                  <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">{{ tpl.body.slice(0, 120).replace(/\n/g, ' ') }}...</p>
                </div>
                <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] font-medium text-slate-400 flex justify-between items-center rounded-b-xl">
                  <span>Cập nhật: {{ tpl.updatedAt }}</span>
                  <span class="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Chỉnh sửa &rarr;</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Group: Reminder -->
          <div v-if="reminderTemplates.length">
            <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 mt-8 flex items-center">
              <i :class="`fas ${groupIcon('reminder').icon} mr-2 ${groupIcon('reminder').cls}`" />
              {{ groupIcon('reminder').label }}
            </h2>
            <div class="grid grid-cols-3 gap-5">
              <div
                v-for="tpl in reminderTemplates"
                :key="tpl.id"
                class="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors flex flex-col group cursor-pointer"
                @click="openEditDrawer(tpl)"
              >
                <div class="p-5 border-b border-slate-100 flex justify-between items-start">
                  <div class="w-10 h-10 rounded flex items-center justify-center shrink-0" :class="cardIconBg(tpl)">
                    <i :class="`fas ${cardIcon(tpl)} text-lg`" />
                  </div>
                  <div class="flex flex-col items-end space-y-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="statusBadge(tpl.status).cls">
                      {{ statusBadge(tpl.status).label }}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="modeBadge(tpl.mode).cls">
                      <i :class="`fas ${modeBadge(tpl.mode).icon} mr-1 text-xs`" /> {{ modeBadge(tpl.mode).label }}
                    </span>
                  </div>
                </div>
                <div class="p-5 flex-1">
                  <h3 class="font-bold text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-colors">{{ tpl.name }}</h3>
                  <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">{{ tpl.body.slice(0, 120).replace(/\n/g, ' ') }}...</p>
                </div>
                <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] font-medium text-slate-400 flex justify-between items-center rounded-b-xl">
                  <span>Cập nhật: {{ tpl.updatedAt }}</span>
                  <span class="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Chỉnh sửa &rarr;</span>
                </div>
              </div>
            </div>
          </div>

          <!-- Group: Approval -->
          <div v-if="approvalTemplates.length">
            <h2 class="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4 mt-8 flex items-center">
              <i :class="`fas ${groupIcon('approval').icon} mr-2 ${groupIcon('approval').cls}`" />
              {{ groupIcon('approval').label }}
            </h2>
            <div class="grid grid-cols-3 gap-5">
              <div
                v-for="tpl in approvalTemplates"
                :key="tpl.id"
                class="bg-white border border-slate-200 rounded-xl shadow-sm hover:border-indigo-300 transition-colors flex flex-col group cursor-pointer"
                @click="openEditDrawer(tpl)"
              >
                <div class="p-5 border-b border-slate-100 flex justify-between items-start">
                  <div class="w-10 h-10 rounded flex items-center justify-center shrink-0" :class="cardIconBg(tpl)">
                    <i :class="`fas ${cardIcon(tpl)} text-lg`" />
                  </div>
                  <div class="flex flex-col items-end space-y-1">
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="statusBadge(tpl.status).cls">
                      {{ statusBadge(tpl.status).label }}
                    </span>
                    <span class="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold" :class="modeBadge(tpl.mode).cls">
                      <i :class="`fas ${modeBadge(tpl.mode).icon} mr-1 text-xs`" /> {{ modeBadge(tpl.mode).label }}
                    </span>
                  </div>
                </div>
                <div class="p-5 flex-1">
                  <h3 class="font-bold text-slate-800 text-base mb-1 group-hover:text-indigo-600 transition-colors">{{ tpl.name }}</h3>
                  <p class="text-xs text-slate-500 line-clamp-2 leading-relaxed">{{ tpl.body.slice(0, 120).replace(/\n/g, ' ') }}...</p>
                </div>
                <div class="px-5 py-3 bg-slate-50 border-t border-slate-100 text-[11px] font-medium text-slate-400 flex justify-between items-center rounded-b-xl">
                  <span>Cập nhật: {{ tpl.updatedAt }}</span>
                  <span class="text-indigo-600 font-bold opacity-0 group-hover:opacity-100 transition-opacity">Chỉnh sửa &rarr;</span>
                </div>
              </div>
            </div>
          </div>

        </div>
      </div>
    </main>
  </div>

  <!-- ── DRAWER: EDIT / CREATE TEMPLATE ─────────────────────────────────────── -->
  <Transition name="backdrop">
    <div
      v-if="showDrawer"
      class="fixed inset-0 bg-slate-900/40 z-40"
      @click="closeDrawer"
    />
  </Transition>

  <Transition name="drawer">
    <div
      v-if="showDrawer"
      class="fixed top-0 right-0 h-full w-full max-w-[800px] bg-slate-50 shadow-2xl z-50 flex flex-col"
    >
      <!-- Drawer Header -->
      <div class="px-6 py-4 border-b border-slate-200 bg-white flex justify-between items-center shrink-0 shadow-sm">
        <h2 class="text-lg font-bold text-slate-800 flex items-center">
          <i class="fas fa-file-alt mr-2 text-indigo-600" />
          {{ drawerMode === 'create' ? 'Tạo Mẫu Email Mới' : 'Chỉnh sửa Mẫu Email' }}
        </h2>
        <button class="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition-colors" @click="closeDrawer">
          <i class="fas fa-times" />
        </button>
      </div>

      <!-- Two-column layout: Editor | Variables -->
      <div class="flex-1 overflow-y-auto flex">

        <!-- Editor Area -->
        <div class="flex-1 p-6 space-y-5">

          <div class="bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                  Tên Mẫu (Internal Name) <span class="text-red-500">*</span>
                </label>
                <input
                  v-model="formName"
                  type="text"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                >
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Trạng thái Kích hoạt</label>
                <select
                  v-model="formStatus"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white font-bold"
                  :class="formStatus === 'active' ? 'text-green-600' : 'text-slate-500'"
                >
                  <option value="active">Active (Sử dụng)</option>
                  <option value="inactive">Inactive (Tạm ngưng)</option>
                </select>
              </div>
            </div>
            <div class="grid grid-cols-2 gap-4 mb-4">
              <div>
                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Loại gửi</label>
                <select
                  v-model="formMode"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-700"
                >
                  <option value="manual">Gửi thủ công</option>
                  <option value="auto">Tự động (Auto)</option>
                </select>
              </div>
              <div>
                <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">Nhóm</label>
                <select
                  v-model="formGroup"
                  class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500 bg-white font-medium text-slate-700"
                >
                  <option value="launch">Khởi tạo (Campaign Launch)</option>
                  <option value="reminder">Nhắc nhở (Reminders)</option>
                  <option value="approval">Phê duyệt (Approvals)</option>
                </select>
              </div>
            </div>
            <div>
              <label class="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-1">
                Tiêu đề Email (Subject) <span class="text-red-500">*</span>
              </label>
              <input
                v-model="formSubject"
                type="text"
                class="w-full border border-slate-300 rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-indigo-500"
              >
              <p class="text-[10px] text-slate-400 mt-1">Hỗ trợ biến số: &#123;&#123;KPI_Period&#125;&#125;, &#123;&#123;Employee_Name&#125;&#125;, ...</p>
            </div>
          </div>

          <!-- Body Editor -->
          <div class="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col" style="height: 400px;">
            <!-- Mock Toolbar -->
            <div class="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center space-x-1">
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Bold">
                <i class="fas fa-bold text-xs" />
              </button>
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Italic">
                <i class="fas fa-italic text-xs" />
              </button>
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Underline">
                <i class="fas fa-underline text-xs" />
              </button>
              <div class="w-px h-4 bg-slate-300 mx-1" />
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Align Left">
                <i class="fas fa-align-left text-xs" />
              </button>
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Align Center">
                <i class="fas fa-align-center text-xs" />
              </button>
              <div class="w-px h-4 bg-slate-300 mx-1" />
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Insert Link">
                <i class="fas fa-link text-xs" />
              </button>
              <button class="px-2 py-1 rounded text-slate-500 hover:bg-slate-200 text-sm" title="Insert Image">
                <i class="fas fa-image text-xs" />
              </button>
            </div>
            <textarea
              v-model="formBody"
              class="flex-1 p-4 w-full focus:outline-none resize-none text-sm text-slate-700 leading-relaxed font-sans"
              placeholder="Nhập nội dung Email ở đây..."
            />
          </div>
        </div>

        <!-- Variables Panel -->
        <div class="w-64 bg-slate-100 border-l border-slate-200 p-5 shrink-0 flex flex-col">
          <h3 class="font-bold text-slate-700 text-sm mb-2 flex items-center">
            <i class="fas fa-code mr-2 text-indigo-500" /> Biến số khả dụng
          </h3>
          <p class="text-[10px] text-slate-500 mb-4 leading-relaxed">
            Click vào biến để copy, sau đó dán (paste) vào Tiêu đề hoặc Nội dung bên trái.
          </p>

          <div class="space-y-4 flex-1 overflow-y-auto pr-1">
            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thông tin Người nhận</div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.recipient"
                  :key="v.key"
                  class="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-indigo-600 hover:border-indigo-400 cursor-pointer shadow-sm transition-colors"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >{{ v.key }}</div>
              </div>
            </div>

            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Thông tin Chiến dịch</div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.campaign"
                  :key="v.key"
                  class="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-emerald-600 hover:border-emerald-400 cursor-pointer shadow-sm transition-colors"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >{{ v.key }}</div>
              </div>
            </div>

            <div>
              <div class="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Dành cho Nhắc nhở</div>
              <div class="space-y-1.5">
                <div
                  v-for="v in TEMPLATE_VARIABLES.reminder"
                  :key="v.key"
                  class="bg-white border border-slate-200 rounded px-2.5 py-1.5 text-xs font-mono text-orange-600 hover:border-orange-400 cursor-pointer shadow-sm transition-colors"
                  :title="v.desc"
                  @click="copyVariable(v.key)"
                >{{ v.key }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Drawer Footer -->
      <div class="p-4 border-t border-slate-200 bg-white shrink-0 flex justify-between items-center shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.05)]">
        <button class="px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors flex items-center">
          <i class="fas fa-eye mr-1.5" /> Xem trước (Preview)
        </button>
        <div class="flex space-x-3">
          <button
            class="px-5 py-2 text-sm font-medium text-slate-600 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition-colors"
            @click="closeDrawer"
          >Hủy bỏ</button>
          <button
            class="px-5 py-2 text-sm font-bold text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 shadow-sm transition-colors flex items-center"
            @click="saveTemplate"
          >
            <i class="fas fa-save mr-2" /> Lưu Mẫu Email
          </button>
        </div>
      </div>
    </div>
  </Transition>

  <!-- TOAST -->
  <Transition name="toast">
    <div
      v-if="showToast"
      class="fixed top-5 right-5 bg-slate-800 text-white px-4 py-3 rounded-lg shadow-lg flex items-center z-50"
    >
      <i class="fas fa-check-circle mr-3 text-green-400" />
      <span class="text-sm font-medium">{{ toastMsg }}</span>
    </div>
  </Transition>
</template>

<style scoped>
.drawer-enter-active, .drawer-leave-active { transition: transform 0.3s ease-in-out; }
.drawer-enter-from, .drawer-leave-to { transform: translateX(100%); }

.backdrop-enter-active, .backdrop-leave-active { transition: opacity 0.3s; }
.backdrop-enter-from, .backdrop-leave-to { opacity: 0; }

.toast-enter-active, .toast-leave-active { transition: transform 0.3s; }
.toast-enter-from, .toast-leave-to { transform: translateX(120%); }
</style>
