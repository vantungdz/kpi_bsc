<template>
  <div>
    <a-card
      :title="`KPI Detail (Section View): ${kpiDetailData?.name || 'Loading...'}`"
      style="margin-bottom: 20px"
    >
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions
          v-if="kpiDetailData"
          :column="2"
          bordered
          size="small"
        >
          <a-descriptions-item label="ID">
            {{ kpiDetailData.id }}
          </a-descriptions-item>
          <a-descriptions-item label="Frequency">
            {{ kpiDetailData.frequency }}
          </a-descriptions-item>
          <a-descriptions-item label="Description" :span="2">
            {{ kpiDetailData.description }}
          </a-descriptions-item>
          <a-descriptions-item label="Perspective">
            {{ kpiDetailData.perspective?.name || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Assigned To Unit">
            {{ getAssignmentUnitName(kpiDetailData) }}
          </a-descriptions-item>
          <a-descriptions-item label="Unit">
            {{ kpiDetailData.unit || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Section Target">
            {{ kpiDetailData.target?.toLocaleString() ?? 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Weight (%)">
            {{ kpiDetailData.weight ?? 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Status">
            <a-tag :color="getStatusColor(kpiDetailData.status)">
              {{ kpiDetailData.status || 'N/A' }}
            </a-tag>
          </a-descriptions-item>
        </a-descriptions>
        <div v-else-if="!loadingKpi">
          No KPI data found or failed to load.
        </div>
      </a-skeleton>
    </a-card>

    <a-card
      v-if="canManageUserAssignments"
      title="User Assignments"
      style="margin-top: 20px"
    >
      <div style="margin-bottom: 16px; text-align: right">
        <a-button
          type="primary"
          :disabled="loadingAssignments || !isKpiAssignableToUsers"
          @click="openAssignModal"
        >
          <template #icon><user-add-outlined /></template>
          Add/Edit User Assignment
        </a-button>
      </div>
      <a-skeleton :loading="loadingAssignments" active :paragraph="{ rows: 4 }">
        <a-table
          v-show="userAssignments.length > 0"
          :columns="userAssignmentColumns"
          :data-source="userAssignments"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar
                :src="record.user?.avatar_url"
                size="small"
                style="margin-right: 8px"
              >
                {{ record.user?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.user?.first_name }} {{ record.user?.last_name }} ({{
                record.user?.username
              }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? 'N/A' }}
              {{ kpiDetailData?.unit || '' }}
            </template>
            <template v-else-if="column.key === 'weight'">
              {{ record.weight ?? 'N/A' }} %
            </template>
            <template v-else-if="column.key === 'actual'">
              {{ record.latest_actual_value?.toLocaleString() ?? 'N/A' }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status || 'N/A' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-tooltip title="Edit Assignment">
                  <a-button
                    type="primary"
                    ghost
                    shape="circle"
                    size="small"
                    @click="openEditModal(record)"
                  >
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button
                    danger
                    shape="circle"
                    size="small"
                    @click="confirmDeleteAssignment(record)"
                  >
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-show="userAssignments.length === 0"
          description="No users have been assigned this KPI in this section yet."
        />
      </a-skeleton>
    </a-card>

    <a-card title="KPI Evaluations" style="margin-top: 20px">
      <a-button
        type="primary"
        style="margin-bottom: 10px"
        :loading="loadingUsersForEval"
        @click="openEvaluationModal"
      >
        Evaluate this KPI
      </a-button>
      <a-skeleton :loading="loadingEvaluations" active>
        <a-table
          v-show="!loadingEvaluations && kpiEvaluations.length > 0"
          :data-source="kpiEvaluations"
          :columns="evaluationColumns"
          row-key="id"
          size="small"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'evaluator'">
              <span v-if="record.evaluator">
                <a-avatar :src="record.evaluator.avatar_url" style="margin-right: 8px" />
                {{ record.evaluator.first_name }} {{ record.evaluator.last_name }}
              </span>
              <span v-else>N/A</span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluatee'">
              <span v-if="record.evaluatee">
                <a-avatar :src="record.evaluatee.avatar_url" style="margin-right: 8px" />
                {{ record.evaluatee.first_name }} {{ record.evaluatee.last_name }}
              </span>
              <span v-else>N/A</span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluation_date'">
              {{ record.evaluation_date ? dayjs(record.evaluation_date).format('L') : 'N/A' }}
            </template>
            <template v-else-if="column.dataIndex === 'period'">
              {{ record.period_start_date ? dayjs(record.period_start_date).format('YYYY-MM-DD') : '?' }}
              -
              {{ record.period_end_date ? dayjs(record.period_end_date).format('YYYY-MM-DD') : '?' }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :bordered="false" :color="getStatusColor(record.status)">
                {{ record.status || 'N/A' }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <a-button type="link" @click="viewEvaluation(record)">
                View
              </a-button>
            </template>
            <template v-else>
              {{ record[column.dataIndex] }}
            </template>
          </template>
        </a-table>
        <a-empty
          v-show="!loadingEvaluations && kpiEvaluations.length === 0"
          description="No evaluations found for this KPI."
        />
      </a-skeleton>
    </a-card>

    <a-modal
      :open="isViewEvaluationModalVisible"
      title="KPI Evaluation Details"
      :width="1000"
      :footer="null"
      @update:open="isViewEvaluationModalVisible = $event"
      @cancel="closeViewEvaluationModal"
    >
      <a-descriptions
        v-if="selectedEvaluation.id"
        bordered
        :column="2"
        size="small"
      >
        </a-descriptions>
      <a-empty v-else description="Could not load evaluation details." />
      <template #footer>
        <a-button key="back" @click="closeViewEvaluationModal">Close</a-button>
      </template>
    </a-modal>

    <a-modal
      :open="isCreateEvaluationModalVisible"
      title="Create KPI Evaluation"
      :width="600"
      :confirm-loading="submittingEvaluation"
      @update:open="isCreateEvaluationModalVisible = $event"
      @ok="submitEvaluation"
      @cancel="closeCreateEvaluationModal"
    >
      <a-form layout="vertical" :model="newEvaluation">
        </a-form>
    </a-modal>

    <a-modal
      v-model:open="isAssignModalVisible"
      :title="isEditingAssignment ? 'Edit User Assignment' : 'Assign KPI to Users'"
      :width="800"
      ok-text="Save"
      cancel-text="Cancel"
      :mask-closable="false"
      :keyboard="false"
      :confirm-loading="submittingAssignment"
      @ok="handleSaveAssignment"
      @cancel="closeAssignModal"
    >
      <a-spin :spinning="loadingAssignableUsers || submittingAssignment">
        <a-descriptions
          v-if="isEditingAssignment && editingAssignmentRecord?.user"
          :column="1"
          size="small"
          style="margin-bottom: 15px"
        >
          <a-descriptions-item label="User">
            <a-avatar
              :src="editingAssignmentRecord.user.avatar_url"
              size="small"
              style="margin-right: 8px"
            >
              {{ editingAssignmentRecord.user.first_name?.charAt(0) }}
            </a-avatar>
            {{ editingAssignmentRecord.user.first_name }}
            {{ editingAssignmentRecord.user.last_name }} ({{
              editingAssignmentRecord.user.username
            }})
          </a-descriptions-item>
        </a-descriptions>

        <a-form-item v-if="!isEditingAssignment" label="Select Users" required>
          <a-select
            v-model:value="selectedUserIds"
            mode="multiple"
            placeholder="Search and select users from the section..."
            style="width: 100%; margin-bottom: 15px"
            show-search
            allow-clear
            :filter-option="
              (inputValue, option) =>
                option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0
            "
            :options="assignableUserOptions"
            :loading="loadingAssignableUsers"
          />
        </a-form-item>

        <h4 style="margin-bottom: 10px">Set Target & Weight:</h4>
        <a-table
          :columns="modalAssignmentInputColumns"
          :data-source="modalDataSource"
          row-key="userId"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar
                :src="record.avatar_url"
                size="small"
                style="margin-right: 8px"
              >
                {{ record.name?.charAt(0) }}
              </a-avatar>
              {{ record.name }}
            </template>
            <template v-if="column.key === 'target'">
              <a-input-number
                v-model:value="assignmentDetails[record.userId].target"
                placeholder="Target"
                style="width: 100%"
                :min="0"
                :step="1"
              />
            </template>
            <template v-if="column.key === 'weight'">
              <a-input-number
                v-model:value="assignmentDetails[record.userId].weight"
                placeholder="Weight"
                style="width: 100%"
                :min="0"
                :max="100"
                :step="1"
                addon-after="%"
              />
            </template>
          </template>
        </a-table>
        <div v-if="assignmentError" style="color: red; margin-top: 10px">
          {{ assignmentError }}
        </div>
      </a-spin>
    </a-modal>

    <a-modal
      :open="isDeleteAssignModalVisible"
      title="Confirm Deletion"
      ok-text="Delete"
      cancel-text="Cancel"
      ok-type="danger"
      :confirm-loading="submittingDeletion"
      @update:open="isDeleteAssignModalVisible = $event"
      @ok="handleDeleteAssignment"
      @cancel="isDeleteAssignModalVisible = false"
    >
      <p v-if="assignmentToDelete?.user">
        Are you sure you want to remove the assignment for user
        <strong>
          {{ assignmentToDelete.user.first_name }}
          {{ assignmentToDelete.user.last_name }}
        </strong>
        from this KPI?
      </p>
      <p v-else>Are you sure you want to delete this assignment?</p>
    </a-modal>
  </div>
</template>

<script setup>
// --- IMPORTS ---
import { ref, computed, watch, onMounted, reactive } from 'vue'
import { useRoute } from 'vue-router'
import { useStore } from 'vuex'
import { notification } from 'ant-design-vue'
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined
} from '@ant-design/icons-vue'
import dayjs from 'dayjs'
import LocalizedFormat from 'dayjs/plugin/localizedFormat'
dayjs.extend(LocalizedFormat)

// --- STORE, ROUTER, ROUTE INIT ---
const store = useStore()
const route = useRoute()
const kpiId = computed(() => parseInt(route.params.id, 10))

// --- FAKE DATA GENERATION ---
const generateFakeUserData = (id, prefix) => ({
  id: id,
  first_name: `${prefix}FN${id}`,
  last_name: `LN`,
  username: `${prefix.toLowerCase()}${id}`,
  avatar_url: null,
  section_id:
    prefix === 'UserS1' || prefix === 'LeadS1'
      ? 101
      : prefix === 'UserS2' || prefix === 'LeadS2'
      ? 102
      : null,
  department_id:
    prefix === 'UserS1' ||
    prefix === 'LeadS1' ||
    prefix === 'UserS2' ||
    prefix === 'LeadS2'
      ? 20
      : null
})

const allFakeUsers = [
  generateFakeUserData(1, 'Admin'),
  generateFakeUserData(10, 'HeadD'),
  generateFakeUserData(101, 'LeadS1'),
  generateFakeUserData(102, 'LeadS2'),
  generateFakeUserData(201, 'UserS1'),
  generateFakeUserData(202, 'UserS1'),
  generateFakeUserData(203, 'UserS2'),
  generateFakeUserData(204, 'UserS1')
]

const allFakeSections = [
  { id: 101, name: 'Sales Section Alpha', department_id: 20 },
  { id: 102, name: 'Sales Section Beta', department_id: 20 },
  { id: 103, name: 'Marketing Section Gamma', department_id: 30 }
]

const generateFakeKpiDetailSection = (id) => {
  const sectionId = id % 2 === 0 ? 101 : 102
  const section = allFakeSections.find((s) => s.id === sectionId)
  return {
    id: id,
    name: `Section KPI ${id}`,
    description: `Description for Section KPI ${id}.`,
    frequency: 'Monthly',
    perspective: { id: 3, name: 'Internal Process' },
    assignment_level: 'section',
    section: section,
    department:
      allFakeSections.find((s) => s.id === sectionId)?.department_id === 20
        ? { id: 20, name: 'Sales Department' }
        : null,
    assignedTo: null, // Not directly assigned at section level usually
    unit: 'Task',
    target: 50 + id * 2, // Section's target for the KPI
    weight: 15 + (id % 4), // Section's weight for the KPI
    status: id % 3 === 0 ? 'Active' : 'Pending',
    evaluations: [
      {
        id: 10 * id + 1,
        evaluator: generateFakeUserData(101, 'LeadS1'),
        evaluatee: generateFakeUserData(201, 'UserS1'),
        evaluation_date: dayjs().subtract(1, 'month').toISOString(),
        period_start_date: dayjs()
          .subtract(2, 'month')
          .startOf('month')
          .toISOString(),
        period_end_date: dayjs()
          .subtract(2, 'month')
          .endOf('month')
          .toISOString(),
        rating: 4,
        status: 'Met',
        comments: 'Good progress last period.'
      }
    ]
  }
}

const generateFakeUserAssignments = (kpiDetail) => {
  if (kpiDetail?.assignment_level !== 'section') return []
  const sectionId = kpiDetail.section.id
  const usersInSection = allFakeUsers.filter(
    (u) =>
      u.section_id === sectionId && !u.username.toLowerCase().includes('lead')
  )
  return usersInSection.slice(0, 2).map((user, index) => ({
    id: kpiDetail.id * 1000 + user.id,
    kpi_id: kpiDetail.id,
    user: user,
    target: Math.round(kpiDetail.target / (index + 1.5)), // Example distribution
    weight: Math.round(kpiDetail.weight / (index + 1.5)), // Example distribution
    latest_actual_value: Math.round(
      (kpiDetail.target / (index + 1.5)) * (0.7 + Math.random() * 0.5)
    ), // Example actual
    status: index === 0 ? 'Active' : 'Pending'
  }))
}

const loadingKpi = ref(true)
const kpiDetailData = ref(null)
const userAssignments = ref([])
const loadingAssignments = ref(false)
const isAssignModalVisible = ref(false)
const isEditingAssignment = ref(false)
const editingAssignmentRecord = ref(null)
const assignableUsers = ref([])
const loadingAssignableUsers = ref(false)
const selectedUserIds = ref([])
const assignmentDetails = reactive({}) // Reactive object to hold target/weight inputs
const submittingAssignment = ref(false)
const assignmentError = ref(null)
const isDeleteAssignModalVisible = ref(false)
const assignmentToDelete = ref(null)
const submittingDeletion = ref(false)
const loadingEvaluations = ref(false)
const loadingUsersForEval = ref(false)
const kpiEvaluations = ref([])
const isViewEvaluationModalVisible = ref(false)
const selectedEvaluation = ref({})
const isCreateEvaluationModalVisible = ref(false)
const newEvaluation = ref({})
const submittingEvaluation = ref(false)
const currentUserRole = ref('section_lead') // Example role

const canManageUserAssignments = computed(() => {
  const allowedRoles = ['section_lead', 'admin', 'kpi_owner']
  const hasPermission = allowedRoles.includes(currentUserRole.value)
  const assignableLevel = kpiDetailData.value?.assignment_level === 'section'
  return hasPermission && assignableLevel && !!kpiDetailData.value
})

const isKpiAssignableToUsers = computed(() => {
  return kpiDetailData.value?.assignment_level === 'section'
})

const assignableUserOptions = computed(() => {
  return assignableUsers.value.map((user) => ({
    value: user.id,
    label: `${user.first_name || ''} ${user.last_name || ''} (${user.username})`,
    name: `${user.first_name || ''} ${user.last_name || ''}`,
    avatar_url: user.avatar_url
  }))
})

const modalDataSource = computed(() => {
  if (isEditingAssignment.value && editingAssignmentRecord.value?.user) {
    const user = editingAssignmentRecord.value.user
    ensureAssignmentDetail(
      user.id,
      editingAssignmentRecord.value.target,
      editingAssignmentRecord.value.weight
    )
    return [
      {
        userId: user.id,
        name: `${user.first_name || ''} ${user.last_name || ''}`,
        avatar_url: user.avatar_url
      }
    ]
  } else if (!isEditingAssignment.value && selectedUserIds.value.length > 0) {
    return assignableUserOptions.value
      .filter((opt) => selectedUserIds.value.includes(opt.value))
      .map((opt) => {
        ensureAssignmentDetail(opt.value) // Ensure reactive property exists
        return {
          userId: opt.value,
          name: opt.name,
          avatar_url: opt.avatar_url
        }
      })
  }
  return [] // No users selected or invalid state
})

const userAssignmentColumns = [
  { title: 'User', key: 'user', width: '30%' },
  { title: 'Assigned Target', key: 'target', align: 'right' },
  { title: 'Weight (%)', key: 'weight', align: 'right' },
  { title: 'Latest Actual', key: 'actual', align: 'right' },
  { title: 'Status', key: 'status', align: 'center' },
  { title: 'Actions', key: 'actions', align: 'center', width: '100px' }
]

const modalAssignmentInputColumns = [
  { title: 'User', key: 'user', width: '40%' },
  { title: 'Target', key: 'target', width: '30%' },
  { title: 'Weight (%)', key: 'weight', width: '30%' }
]

const evaluationColumns = [
  { title: 'Evaluator', dataIndex: 'evaluator', key: 'evaluator' },
  { title: 'Evaluatee', dataIndex: 'evaluatee', key: 'evaluatee' },
  { title: 'Period', dataIndex: 'period', key: 'period' },
  { title: 'Rating', dataIndex: 'rating', key: 'rating' },
  { title: 'Date', dataIndex: 'evaluation_date', key: 'evaluation_date' },
  { title: 'Status', dataIndex: 'status', key: 'status' },
  { title: 'Actions', dataIndex: 'actions', key: 'actions' }
]

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case 'active':
    case 'approved':
    case 'met':
    case 'exceeded':
      return 'success'
    case 'inactive':
    case 'rejected':
    case 'not met':
      return 'error'
    case 'pending section approval': // May not apply here but keep for consistency
    case 'pending dept approval':
    case 'pending owner approval':
    case 'pending':
      return 'warning'
    case 'in progress':
      return 'processing'
    default:
      return 'default'
  }
}

const getAssignmentUnitName = (kpi) => {
  if (!kpi) return 'N/A'
  if (kpi.section) return `Section: ${kpi.section.name}`
  if (kpi.department) return `Department: ${kpi.department.name}`
  return 'Overall / Not specified'
}

// === FAKE DATA METHODS ===
const loadFakeKpiData = async (id) => {
  loadingKpi.value = true
  loadingAssignments.value = true // Use loadingAssignments for user assignments now
  loadingEvaluations.value = true
  console.log(`Loading FAKE data for Section KPI ID: ${id}`)
  await new Promise((resolve) => setTimeout(resolve, 600)) // Simulate network delay
  try {
    const fakeDetail = generateFakeKpiDetailSection(id)
    kpiDetailData.value = fakeDetail
    userAssignments.value = generateFakeUserAssignments(fakeDetail)
    kpiEvaluations.value = fakeDetail.evaluations || []
    console.log('Fake KPI Detail (Section View):', kpiDetailData.value)
    console.log('Fake User Assignments:', userAssignments.value)
  } catch (error) {
    console.error('Error generating fake data:', error)
    notification.error({ message: 'Failed to generate fake data' })
    kpiDetailData.value = null
    userAssignments.value = []
    kpiEvaluations.value = []
  } finally {
    loadingKpi.value = false
    loadingAssignments.value = false
    loadingEvaluations.value = false
  }
}

const fetchAssignableUsers = async () => {
  const sectionId = kpiDetailData.value?.section?.id
  if (!sectionId) {
    assignmentError.value = "Cannot determine the section for this KPI."
    assignableUsers.value = []
    return
  }
  loadingAssignableUsers.value = true
  assignmentError.value = null
  console.log(`Workspaceing FAKE assignable users for Section ID: ${sectionId}`)
  await new Promise((resolve) => setTimeout(resolve, 300)) // Simulate network delay
  try {
    assignableUsers.value = allFakeUsers.filter(
      (user) => user.section_id === sectionId
    )
    console.log('Fake Assignable Users:', assignableUsers.value)
  } catch (err) {
    console.error('Error faking assignable users:', err)
    assignmentError.value = `Failed to load fake users for section ${sectionId}`
    assignableUsers.value = []
  } finally {
    loadingAssignableUsers.value = false
  }
}

const ensureAssignmentDetail = (
  userId,
  initialTarget = null,
  initialWeight = null
) => {
  const key = String(userId) // Use string key for consistency
  if (!assignmentDetails[key]) {
    console.log(
      `Initializing details for user ID: ${key} with Target: ${initialTarget}, Weight: ${initialWeight}`
    )
    assignmentDetails[key] = { target: initialTarget, weight: initialWeight }
  }
}

// --- Modal Assign/Edit User Methods ---
const openAssignModal = () => {
  isEditingAssignment.value = false
  editingAssignmentRecord.value = null
  selectedUserIds.value = []
  Object.keys(assignmentDetails).forEach(key => delete assignmentDetails[key])
  assignmentError.value = null
  fetchAssignableUsers() // Fetch users first
  isAssignModalVisible.value = true // Then open modal
}

const openEditModal = (record) => {
  isEditingAssignment.value = true
  editingAssignmentRecord.value = record
  selectedUserIds.value = [record.user.id] // Only this user is relevant
  Object.keys(assignmentDetails).forEach(key => delete assignmentDetails[key])
  ensureAssignmentDetail(record.user.id, record.target, record.weight) // Initialize with current values
  assignmentError.value = null
  isAssignModalVisible.value = true
}

const closeAssignModal = () => {
  isAssignModalVisible.value = false
  setTimeout(() => {
    isEditingAssignment.value = false
    editingAssignmentRecord.value = null
    selectedUserIds.value = []
    Object.keys(assignmentDetails).forEach(key => delete assignmentDetails[key])
    assignmentError.value = null
    assignableUsers.value = [] // Clear user list
  }, 300)
}

const handleSaveAssignment = async () => {
  assignmentError.value = null

  const usersToValidate = isEditingAssignment.value
    ? [editingAssignmentRecord.value.user.id]
    : selectedUserIds.value

  if (!isEditingAssignment.value && usersToValidate.length === 0) {
      assignmentError.value = 'Please select at least one user to assign.'
      return
  }

  let invalidDetail = false
  for (const userId of usersToValidate) {
     const key = String(userId)
     const details = assignmentDetails[key]
     if (
       !details ||
       details.target === null || details.target < 0 ||
       details.weight === null || details.weight < 0 || details.weight > 100
     ) {
       invalidDetail = true
       break // Exit loop early if invalid found
     }
  }

  if (invalidDetail) {
    assignmentError.value =
      'Please enter a valid Target (>= 0) and Weight (0-100) for all selected users.'
    return
  }

  submittingAssignment.value = true
  const kpi_id = kpiDetailData.value.id
  console.log('Saving FAKE user assignment(s)...')
  await new Promise((resolve) => setTimeout(resolve, 700)) // Simulate network delay

  try {
    if (isEditingAssignment.value) {
      const assignmentId = editingAssignmentRecord.value.id
      const userId = editingAssignmentRecord.value.user.id
      const index = userAssignments.value.findIndex((a) => a.id === assignmentId)

      if (index !== -1) {
        userAssignments.value[index].target =
          assignmentDetails[String(userId)]?.target
        userAssignments.value[index].weight =
          assignmentDetails[String(userId)]?.weight
        console.log('Updated fake assignment:', userAssignments.value[index])
        notification.success({ message: 'Assignment updated (Fake)' })
      } else {
        throw new Error('Original assignment not found to update.')
      }
    } else {
      // --- ADD LOGIC ---
      const newAssignments = selectedUserIds.value.map((userId) => {
        const user =
          assignableUsers.value.find((u) => u.id === userId) ||
          allFakeUsers.find((u) => u.id === userId)
        const details = assignmentDetails[String(userId)]
        return {
          id: Date.now() + userId, // Temporary fake ID
          kpi_id: kpi_id,
          user: user,
          target: details?.target,
          weight: details?.weight,
          latest_actual_value: null, // New assignments start with null actual
          status: 'Active' // Or 'Pending', depending on workflow
        }
      })

      const newUserIdsSet = new Set(selectedUserIds.value)
      const existingAssignments = userAssignments.value.filter(
          (a) => !newUserIdsSet.has(a.user.id)
      )

      userAssignments.value = [...existingAssignments, ...newAssignments]

      console.log('Added/updated fake assignments:', newAssignments)
      notification.success({ message: 'KPI assigned to users (Fake)' })
    }
    closeAssignModal() // Close modal on success
  } catch (err) {
    console.error('Error saving fake user assignment:', err)
    assignmentError.value = `Failed to save assignment data: ${err.message || 'Unknown Error'}`
    notification.error({
      message: 'Save Failed',
      description: assignmentError.value
    })
  } finally {
    submittingAssignment.value = false
  }
}

const confirmDeleteAssignment = (record) => {
  assignmentToDelete.value = record
  isDeleteAssignModalVisible.value = true
}

const handleDeleteAssignment = async () => {
  // FAKE DELETE
  if (!assignmentToDelete.value) return
  submittingDeletion.value = true
  const assignmentIdToDelete = assignmentToDelete.value.id
  const userName = `${assignmentToDelete.value.user?.first_name || ''} ${assignmentToDelete.value.user?.last_name || 'this user'}`
  console.log(
    `Deleting FAKE user assignment ID: ${assignmentIdToDelete} for user ${userName}`
  )
  await new Promise((resolve) => setTimeout(resolve, 400)) // Simulate network delay

  try {
    const index = userAssignments.value.findIndex(
      (a) => a.id === assignmentIdToDelete
    )
    if (index !== -1) {
      userAssignments.value.splice(index, 1) // Remove from list
      notification.success({
        message: `Assignment for ${userName} removed (Fake)`
      })
      isDeleteAssignModalVisible.value = false
      assignmentToDelete.value = null
    } else {
      throw new Error('Assignment not found in the list.')
    }
  } catch (err) {
    console.error('Error deleting fake assignment:', err)
    notification.error({
      message: 'Deletion Failed',
      description: `Could not remove assignment: ${err.message || 'Unknown Error'}`
    })
    isDeleteAssignModalVisible.value = false // Close modal even on error
  } finally {
    submittingDeletion.value = false
  }
}

const viewEvaluation = (record) => {
  selectedEvaluation.value = record
  isViewEvaluationModalVisible.value = true
}

const closeViewEvaluationModal = () => {
  isViewEvaluationModalVisible.value = false
}

const openEvaluationModal = () => {
  newEvaluation.value = { kpi_id: kpiDetailData.value?.id } // Basic init
  isCreateEvaluationModalVisible.value = true
}

const closeCreateEvaluationModal = () => {
  isCreateEvaluationModalVisible.value = false
}

const submitEvaluation = async () => {
  console.log('Submitting FAKE evaluation (Section View)...')
}

watch(
  selectedUserIds,
  (newUserIds, oldUserIds = []) => {
    if (isEditingAssignment.value) return

    const newUserIdsSet = new Set(newUserIds.map(String))
    const oldUserIdsSet = new Set(oldUserIds.map(String))

    newUserIds.forEach((userId) => {
      ensureAssignmentDetail(String(userId)) // Ensure entry exists
    })

    oldUserIdsSet.forEach((oldUserIdStr) => {
      if (!newUserIdsSet.has(oldUserIdStr)) {
        delete assignmentDetails[oldUserIdStr]
        console.log(`Removed details for deselected user ID: ${oldUserIdStr}`)
      }
    })
  },
  { deep: false }
)

// --- LIFECYCLE HOOK ---
onMounted(async () => {
  await loadFakeKpiData(kpiId.value)
  try {
    loadingUsersForEval.value = true
    if (store.hasModule(['users']) && store.dispatch) {
        await store.dispatch('users/fetchUsers')
    }
  } catch (error) {
    console.error('Error fetching users for eval modal:', error)
  } finally {
      loadingUsersForEval.value = false
  }
})
</script>

<style scoped>
.ant-descriptions-item-label {
  font-weight: bold;
}
p {
  margin-bottom: 0.5em;
}

</style>