<template>
  <div>
    <a-card :title="`KPI Detail: ${kpiDetailData?.name || 'Loading...'}`" style="margin-bottom: 20px;">
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <template #title>
            <div style="display: flex; justify-content: space-between; align-items: center; width: 100%;">
              <span>
                KPI Information
              </span>
              <a-button v-if="kpiDetailData?.id" @click="copyKpiAsTemplate" :disabled="loadingKpi">
                Copy as Template
              </a-button>
            </div>
          </template>
          <a-descriptions-item label="ID">
            {{ kpiDetailData.id }}
          </a-descriptions-item>
          <a-descriptions-item label="Created By Type">
            {{ kpiDetailData.created_by_type || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Frequency">
            {{ kpiDetailData.frequency }}
          </a-descriptions-item>
          <a-descriptions-item label="Perspective">
            {{ kpiDetailData.perspective?.name || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Department">
            {{ kpiDetailData.department?.name || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Section">
            {{ kpiDetailData.section?.name || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Assigned To (Direct)">
            <span v-if="kpiDetailData.assignedTo">
              {{ kpiDetailData.assignedTo.first_name }} {{ kpiDetailData.assignedTo.last_name
              }}
            </span>
            <span v-else>
              N/A
            </span>
          </a-descriptions-item>
          <a-descriptions-item label="Unit">
            {{ kpiDetailData.unit || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Target">
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
          <a-descriptions-item label="Description" :span="2">
            {{ kpiDetailData.description || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item label="Memo" :span="2">
            {{ kpiDetailData.memo || 'N/A' }}
          </a-descriptions-item>
          <a-descriptions-item v-if="kpiDetailData.assignments && kpiDetailData.assignments.length > 0"
            label="Assigned Down To" :span="2">
            <ul style="margin: 0; padding-left: 20px;">
              <li v-for="assign in kpiDetailData.assignments" :key="assign.id">
                <span v-if="assign.deparment">
                  Dept: {{ assign.deparment.name }} (Target: {{ assign.targetValue?.toLocaleString()
                  ?? 'N/A' }}) - Status: {{ assign.status }}
                </span>
                <span v-else-if="assign.section">
                  Section: {{ assign.section.name }} (Target: {{ assign.targetValue?.toLocaleString()
                  ?? 'N/A' }}) - Status: {{ assign.status }}
                </span>
                <span v-else-if="assign.employee">
                  User: {{ assign.employee.first_name }} (Target: {{ assign.targetValue?.toLocaleString()
                  ?? 'N/A' }}) - Status: {{ assign.status }}
                </span>
              </li>
            </ul>
          </a-descriptions-item>
        </a-descriptions>
        <a-empty v-else-if="!loadingKpi" description="Could not load KPI Details." />
      </a-skeleton>
        <a-row v-if="shouldShowAssignmentStats" :gutter="12" style="margin-top: 16px; margin-bottom: 16px; background: #f0f2f5; padding: 8px; border-radius: 4px;">
          <a-col :span="8">
            <a-statistic title="Overall Target" :value="overallTargetValueDetail" :precision="2"/>
          </a-col>
            <a-col :span="8">
            <a-statistic title="Total Assigned" :value="totalAssignedTargetDetail" :precision="2"/>
          </a-col>
          <a-col :span="8">
            <a-statistic title="Remaining" :value="remainingTargetDetail" :precision="2" :value-style="isOverAssignedDetail ? { color: '#cf1322' } : {}"/>
          </a-col>
        </a-row>
    </a-card>
    <a-card title="Direct User Assignments" style="margin-top: 20px;" v-if="shouldShowDirectUserAssignmentCard">
      <div style="margin-bottom: 16px; text-align: right;">
        <a-button type="primary" @click="openAssignUserModal" :disabled="loadingUserAssignments || !kpiDetailData?.id">
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </div>
      <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
        <a-alert v-if="userAssignmentError" :message="userAssignmentError" type="error" show-icon closable
          @close="clearAssignmentError" style="margin-bottom: 16px;" />
        <a-table v-show="filteredDirectUserAssignments.length > 0" :columns="userAssignmentColumns"
          :data-source="filteredDirectUserAssignments" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.user?.avatar_url" size="small" style="margin-right: 8px;">
                {{ record.user?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.user?.first_name }} {{ record.user?.last_name }} ({{ record.user?.username
              }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? 'N/A' }} {{ kpiDetailData?.unit
              || '' }}
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
                  <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty v-show="filteredDirectUserAssignments.length === 0 && !loadingUserAssignments && !userAssignmentError"
          description="No users have been directly assigned this KPI yet." />
      </a-skeleton>
    </a-card>
    <a-card title="User Assignments" style="margin-top: 20px;" v-else-if="shouldShowSectionUserAssignmentCard">
      <div style="margin-bottom: 16px; text-align: right;">
        <a-button type="primary" @click="openAssignUserModal" :disabled="loadingUserAssignments || !kpiDetailData?.id">
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </div>
      <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
        <a-alert v-if="userAssignmentError" :message="userAssignmentError" type="error" show-icon closable
          @close="clearAssignmentError" style="margin-bottom: 16px;" />
        <a-table v-show="filteredSectionUserAssignments.length > 0" :columns="userAssignmentColumns"
          :data-source="filteredSectionUserAssignments" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.user?.avatar_url" size="small" style="margin-right: 8px;">
                {{ record.user?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.user?.first_name }} {{ record.user?.last_name }} ({{ record.user?.username
              }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? 'N/A' }} {{ kpiDetailData?.unit
              || '' }}
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
                  <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty v-show="filteredSectionUserAssignments.length === 0 && !loadingUserAssignments && !userAssignmentError"
          description="No users have been assigned this KPI in this section yet." />
      </a-skeleton>
    </a-card>
    <a-alert message="Checking department structure..." type="info"
      v-if="kpiDetailData && kpiDetailData.created_by_type === 'department' && departmentHasSections === null && canManageAssignments"
      style="margin-top: 20px;">
    </a-alert>
    <a-card title="KPI Evaluations" style="margin-top: 20px;">
      <a-button type="primary" style="margin-bottom: 10px;" @click="openEvaluationModal" :loading="loadingUsersForEval"
        v-if="canEvaluateKpi">
        Evaluate this KPI
      </a-button>
      <a-skeleton :loading="loadingEvaluations" active>
        <a-table v-show="!loadingEvaluations && kpiEvaluations.length > 0" :data-source="kpiEvaluations"
          :columns="evaluationColumns" row-key="id" size="small">
          <template #bodyCell="{ column, record }">
            <template v-if="column.dataIndex === 'evaluator'">
              <span v-if="record.evaluator">
                <a-avatar :src="record.evaluator.avatar_url" style="margin-right: 8px" />
                {{ record.evaluator.first_name }} {{ record.evaluator.last_name }}
              </span>
              <span v-else>
                N/A
              </span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluatee'">
              <span v-if="record.evaluatee">
                <a-avatar :src="record.evaluatee.avatar_url" style="margin-right: 8px" />
                {{ record.evaluatee.first_name }} {{ record.evaluatee.last_name }}
              </span>
              <span v-else>
                N/A
              </span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluation_date'">
              {{ record.evaluation_date ? dayjs(record.evaluation_date).format('L')
              : 'N/A' }}
            </template>
            <template v-else-if="column.dataIndex === 'period'">
              {{ record.period_start_date ? dayjs(record.period_start_date).format('YYYY-MM-DD')
              : '?' }} - {{ record.period_end_date ? dayjs(record.period_end_date).format('YYYY-MM-DD')
              : '?' }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :bordered="false" :color="getEvaluationStatusColor(record.status)">
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
        <a-empty v-show="!loadingEvaluations && kpiEvaluations.length === 0"
          description="No evaluations found for this KPI." />
      </a-skeleton>
    </a-card>
    <a-modal :open="isViewEvaluationModalVisible" @update:open="isViewEvaluationModalVisible = $event"
      title="KPI Evaluation Details" :width="1000" :footer="null" @cancel="closeViewEvaluationModal">
      <a-descriptions bordered :column="2" v-if="selectedEvaluation.id" size="small">
      </a-descriptions>
      <a-empty v-else description="Could not load evaluation details." />
      <template #footer>
        <a-button key="back" @click="closeViewEvaluationModal">
          Close
        </a-button>
      </template>
    </a-modal>
    <a-modal :open="isCreateEvaluationModalVisible" @update:open="isCreateEvaluationModalVisible = $event"
      title="Create KPI Evaluation" :width="600" @ok="submitEvaluation" @cancel="closeCreateEvaluationModal"
      :confirm-loading="submittingEvaluation">
      <a-form layout="vertical" :model="newEvaluation">
      </a-form>
    </a-modal>
    <a-modal :open="isAssignUserModalVisible" @update:open="isAssignUserModalVisible = $event"
      :title="assignUserModalTitle" @ok="handleSaveUserAssignment" @cancel="closeAssignUserModal"
      :confirm-loading="submittingUserAssignment" :width="800" :mask-closable="false" :keyboard="false" ok-text="Save"
      cancel-text="Cancel">
      <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
        <a-descriptions v-if="isEditingUserAssignment && editingUserAssignmentRecord?.user" :column="1" size="small"
          style="margin-bottom: 15px;">
          <a-descriptions-item label="User">
            <a-avatar :src="editingUserAssignmentRecord.user.avatar_url" size="small" style="margin-right: 8px;">
              {{ editingUserAssignmentRecord.user.first_name?.charAt(0) }}
            </a-avatar>
            {{ editingUserAssignmentRecord.user.first_name }} {{ editingUserAssignmentRecord.user.last_name
            }} ({{ editingUserAssignmentRecord.user.username }})
          </a-descriptions-item>
        </a-descriptions>
        <a-form-item v-if="!isEditingUserAssignment" label="Select Users" required>
          <a-select v-model:value="selectedUserIds" mode="multiple" placeholder="Search and select users..."
            style="width: 100%; margin-bottom: 15px;" show-search allow-clear
            :filter-option="(inputValue, option) => option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0"
            :options="assignableUserOptions" :loading="loadingAssignableUsers" />
        </a-form-item>
        <h4 style="margin-bottom: 10px;">
          Set Target & Weight:
        </h4>
        <a-table :columns="modalUserAssignmentInputColumns" :data-source="modalUserDataSource" row-key="userId"
          size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.avatar_url" size="small" style="margin-right: 8px;">
                {{ record.name?.charAt(0) }}
              </a-avatar>
              {{ record.name }}
            </template>
            <template v-if="column.key === 'target'">
              <a-input-number v-model:value="userAssignmentDetails[record.userId].target" placeholder="Target"
                style="width: 100%" :min="0" :step="1" />
            </template>
            <template v-if="column.key === 'weight'">
              <a-input-number v-model:value="userAssignmentDetails[record.userId].weight" placeholder="Weight"
                style="width: 100%" :min="0" :max="100" :step="1" addon-after="%" />
            </template>
          </template>
        </a-table>
        <div v-if="userAssignmentSubmitError" style="color: red; margin-top: 10px;">
          {{ userAssignmentSubmitError }}
        </div>
      </a-spin>
    </a-modal>
    <a-modal :open="isDeleteUserAssignModalVisible" @update:open="isDeleteUserAssignModalVisible = $event"
      title="Confirm Deletion" @ok="handleDeleteUserAssignment" @cancel="isDeleteUserAssignModalVisible = false"
      :confirm-loading="submittingUserDeletion" ok-text="Delete" cancel-text="Cancel" ok-type="danger">
      <p v-if="userAssignmentToDelete?.user">
        Are you sure you want to remove the assignment for user
        <strong>
          {{ userAssignmentToDelete.user.first_name }} {{ userAssignmentToDelete.user.last_name
          }}
        </strong>
        ?
      </p>
      <p v-else>
        Are you sure you want to delete this assignment?
      </p>
    </a-modal>
  </div>
</template>
<script setup>
  // --- IMPORTS ---
  import { ref, computed, watch, onMounted, reactive } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useStore } from 'vuex';
  // Import các component AntD cần thiết
  import { notification, Descriptions as ADescriptions, DescriptionsItem as ADescriptionsItem, Avatar as AAvatar, Empty as AEmpty, Table as ATable, Tag as ATag, Card as ACard, Skeleton as ASkeleton, Button as AButton, Space as ASpace, Tooltip as ATooltip, Modal as AModal, Select as ASelect, InputNumber as AInputNumber, Form as AForm, FormItem as AFormItem, Alert as AAlert, Spin as ASpin } from 'ant-design-vue';
  import { EditOutlined, DeleteOutlined, UserAddOutlined } from '@ant-design/icons-vue';
  import dayjs from 'dayjs';
  import LocalizedFormat from 'dayjs/plugin/localizedFormat';
  dayjs.extend(LocalizedFormat);

// --- STORE, ROUTER, ROUTE INIT ---
const router = useRouter();
  const store = useStore();
  const route = useRoute();
  const kpiId = computed(() =>{
    const id = route.params.id;
    const parsedId = id ? parseInt(id, 10) : null;
    return ! isNaN(parsedId) ? parsedId: null;
  });

  // --- STATE ---
  // Lấy state từ store
  const loadingKpi = computed(() =>store.getters['kpis/isLoading']);
  const kpiDetailData = computed(() =>store.getters['kpis/currentKpi']);
  const allUserAssignmentsForKpi = computed(() =>store.getters['kpis/currentKpiUserAssignments']);
  const loadingUserAssignments = computed(() =>store.getters['kpis/isLoadingUserAssignments']);
  const userAssignmentError = computed(() =>store.getters['kpis/userAssignmentError']); // <<< Đổi tên getter cho đúng
  const actualUser = computed(() =>store.getters['auth/user']);
  const effectiveRole = computed(() =>store.getters['auth/effectiveRole']);

  // State cục bộ
  const departmentHasSections = ref(null);
  // User Assignment Modal State
  const isAssignUserModalVisible = ref(false);
  const isEditingUserAssignment = ref(false);
  const editingUserAssignmentRecord = ref(null);
  const assignableUsers = ref([]);
  const loadingAssignableUsers = ref(false);
  const selectedUserIds = ref([]);
  const userAssignmentDetails = reactive({});
  const submittingUserAssignment = ref(false);
  const userAssignmentSubmitError = ref(null);
  const isDeleteUserAssignModalVisible = ref(false);
  const userAssignmentToDelete = ref(null);
  const submittingUserDeletion = ref(false);
  // Evaluations State
  const loadingEvaluations = ref(false);
  const loadingUsersForEval = ref(false);
  const kpiEvaluations = ref([]);
  const isViewEvaluationModalVisible = ref(false);
  const selectedEvaluation = ref({});
  const isCreateEvaluationModalVisible = ref(false);
  const newEvaluation = ref({});
const submittingEvaluation = ref(false);

const copyKpiAsTemplate = () => {
  if (kpiDetailData.value?.id) {
    router.push({
      path: '/kpis/create', 
      query: {
        templateKpiId: kpiDetailData.value.id
      }
    });
  } else {
    notification.warning({
      message: "Cannot copy: KPI ID not available."
    });
  }
};

// --- COMPUTED PROPERTIES ---
const overallTargetValueDetail = computed(() => {
  // Lấy target tổng từ dữ liệu chi tiết KPI
  const target = parseFloat(kpiDetailData.value?.target);
  return isNaN(target) ? 0 : target;
});

const totalAssignedTargetDetail = computed(() => {
  let total = 0;
  const assignments = kpiDetailData.value?.assignments;
  if (assignments && assignments.length > 0) {
    assignments.forEach(assign => {
      // Cộng dồn targetValue từ các assignment trực tiếp của KPI này
      // Giả định assignments ở đây là các phân bổ trực tiếp từ cấp của KPI này xuống cấp dưới.
      const targetValue = assign.targetValue;
      if (
        targetValue !== undefined &&
        targetValue !== null &&
        !isNaN(targetValue) &&
        targetValue >= 0
      ) {
        total += Number(targetValue);
      }
    });
  }
  return total;
});

const remainingTargetDetail = computed(() => {
  // Tính toán mục tiêu còn lại
  return parseFloat((overallTargetValueDetail.value - totalAssignedTargetDetail.value).toFixed(5));
});

const isOverAssignedDetail = computed(() => {
  // Kiểm tra xem có bị phân bổ vượt quá mục tiêu tổng không
  return remainingTargetDetail.value < -1e-9; // Sử dụng ngưỡng nhỏ để xử lý sai số dấu phẩy động
});

// Kiểm tra xem có nên hiển thị phần thống kê này không
// Thường chỉ hiển thị khi KPI được tạo ở cấp Company hoặc Department
const shouldShowAssignmentStats = computed(() => {
  const kpi = kpiDetailData.value;
  if (!kpi) return false;
  // Hiển thị nếu KPI được tạo ở cấp Company hoặc Department VÀ có assignments
  return (kpi.created_by_type === 'company' || kpi.created_by_type === 'department') && (kpi.assignments?.length > 0 || overallTargetValueDetail.value > 0);
});
  // Quyền truy cập và quản lý
  const canManageAssignments = computed(() => {
    // Thêm kiểm tra kpiDetailData có tồn tại không
    if (!kpiDetailData.value) return false;
    return ['admin', 'manager', 'department', 'section'].includes(effectiveRole.value);
});
const canEvaluateKpi = computed(() => {
    // Thêm kiểm tra kpiDetailData có tồn tại không
    if (!kpiDetailData.value) return false;
  return ['admin', 'manager', 'department', 'section'].includes(effectiveRole.value);
});
  // Helper kiểm tra quyền sở hữu/quản lý
  const isMyDepartment = (deptId) =>{
    if (!deptId || !actualUser.value) return false;
    if (['admin', 'manager'].includes(actualUser.value ?.role)) return true;
    return actualUser.value ?.department_id === deptId;
  };
  const isMySection = (sectId) =>{
    if (!sectId || !actualUser.value) return false;
    if (['admin', 'manager'].includes(actualUser.value ?.role)) return true;
    if (actualUser.value ?.role === 'department') {
      const allSections = store.getters['sections/sectionList'] || [];
      return allSections.some(s =>s.id === sectId && s.department_id === actualUser.value ?.department_id);
    }
    return actualUser.value ?.section_id === sectId;
  };

  // === LỌC USER ASSIGNMENTS PHÍA CLIENT ===
  const filteredDirectUserAssignments = computed(() => {
    const kpi = kpiDetailData.value;
    // <<< Thêm kiểm tra đầy đủ hơn
    if (!kpi || kpi.created_by_type !== 'department' || departmentHasSections.value !== false || !kpi.department?.id) return [];
    const currentDeptId = kpi.department.id;
    return allUserAssignmentsForKpi.value.filter(assign => assign.user?.department_id === currentDeptId && !assign.user?.section_id);
  });
  const filteredSectionUserAssignments = computed(() => {
    const kpi = kpiDetailData.value;
     // <<< Thêm kiểm tra đầy đủ hơn
    if (!kpi || kpi.created_by_type !== 'section' || !kpi.section?.id) return [];
    const currentSectionId = kpi.section.id;
    return allUserAssignmentsForKpi.value.filter(assign => assign.user?.section_id === currentSectionId);
  });
// Điều kiện hiển thị Card User Assignment (DÙNG created_by_type)

console.log('kpiDetailData.value', kpiDetailData.value);
console.log('departmentHasSections.value', departmentHasSections.value);
console.log('effectiveRole.value', effectiveRole.value);
  const shouldShowDirectUserAssignmentCard = computed(() =>{
    const kpi = kpiDetailData.value;
    return kpi ?.created_by_type === 'department' && 
      departmentHasSections.value === false && 
      (['admin', 'manager'].includes(effectiveRole.value) || 
      (effectiveRole.value === 'department' && isMyDepartment(kpi.department?.id)));
  });
  const shouldShowSectionUserAssignmentCard = computed(() =>{
    const kpi = kpiDetailData.value;
    if (!kpi || !(kpi.section || kpi.department)) return false;
    const isAllowedRole = ['admin', 'manager', 'department', 'section'].includes(effectiveRole.value);
    const canManageThis = ['admin', 'manager'].includes(effectiveRole.value) || (effectiveRole.value === 'department' && isMyDepartment(kpi.department?.id)) || (effectiveRole.value === 'section' && isMySection(kpi.section ?.id));
    return isAllowedRole && canManageThis && kpi.created_by_type === 'section';
  });

  // Quyền Approve/Reject (Placeholder)
  // const isPendingForMyApproval = (assignmentRecord) => { console.warn("isPendingForMyApproval needs real data & logic"); return false; };
  // const canApproveRejectAsDeptHead = computed(() => effectiveRole.value === 'department' && isMyDepartment(kpiDetailData.value?.department?.id));
  // const canApproveRejectAsSectionLead = computed(() => effectiveRole.value === 'section' && isMySection(kpiDetailData.value?.section?.id));

  // Options cho các select box
  // const allUserList = computed(() => store.getters['users/userList'] || []);
  // const evaluationUserOptions = computed(() => allUserList.value.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.username})` })));
  const assignableUserOptions = computed(() =>assignableUsers.value.map(user =>({
    value: user.id,
    label: `${
      user.first_name || ''
    }
    ${
      user.last_name || ''
    } (${
      user.username
    })`,
    name: `${
      user.first_name || ''
    }
    ${
      user.last_name || ''
    }`,
    avatar_url: user.avatar_url,
  })));
  const modalUserDataSource = computed(() =>{
    if (isEditingUserAssignment.value && editingUserAssignmentRecord.value ?.user) {
      const user = editingUserAssignmentRecord.value.user;
      ensureUserAssignmentDetail(user.id, editingUserAssignmentRecord.value.target, editingUserAssignmentRecord.value.weight);
      return [{
        userId: user.id,
        name: `${
          user.first_name || ''
        }
        ${
          user.last_name || ''
        }`,
        avatar_url: user.avatar_url
      }];
    } else if (!isEditingUserAssignment.value && selectedUserIds.value.length > 0) {
      return assignableUserOptions.value.filter(opt =>selectedUserIds.value.includes(opt.value)).map(opt =>{
        ensureUserAssignmentDetail(opt.userId, null, null);
        return {
          userId: opt.value,
          name: opt.name,
          avatar_url: opt.avatar_url
        };
      });
    }
    return [];
  });
  const assignUserModalTitle = computed(() =>{
    if (isEditingUserAssignment.value) {
      return 'Edit User Assignment';
    }
    if (kpiDetailData.value ?.created_by_type === 'section') {
      return`Assign KPI to Users(Section: ${
        kpiDetailData.value.section ?.name || 'N/A'
      })`;
    }
    if (kpiDetailData.value ?.created_by_type === 'department') {
      return`Assign KPI Directly to Users(Dept: ${
        kpiDetailData.value.department ?.name || 'N/A'
      })`;
    }
    return 'Assign KPI to Users';
  });

  // --- TABLE COLUMNS ---
  const userAssignmentColumns = [{
    title: 'User',
    key: 'user',
    dataIndex: 'user',
    width: '25%'
  },
  {
    title: 'Target',
    key: 'target',
    dataIndex: 'target',
    align: 'right'
  },
  {
    title: 'Weight (%)',
    key: 'weight',
    dataIndex: 'weight',
    align: 'right'
  },
  {
    title: 'Latest Actual',
    key: 'actual',
    dataIndex: 'latest_actual_value',
    align: 'right'
  },
  {
    title: 'Status',
    key: 'status',
    dataIndex: 'status',
    align: 'center'
  },
  {
    title: 'Actions',
    key: 'actions',
    align: 'center',
    width: '150px'
  },
  ];
  const modalUserAssignmentInputColumns = [{
    title: 'User',
    key: 'user',
    width: '40%'
  },
  {
    title: 'Target',
    key: 'target',
    width: '30%'
  },
  {
    title: 'Weight (%)',
    key: 'weight',
    width: '30%'
  },
  ];
  const evaluationColumns = [{
    title: 'Evaluator',
    dataIndex: 'evaluator',
    key: 'evaluator'
  },
  {
    title: 'Evaluatee',
    dataIndex: 'evaluatee',
    key: 'evaluatee'
  },
  {
    title: 'Period',
    dataIndex: 'period',
    key: 'period'
  },
  {
    title: 'Rating',
    dataIndex: 'rating',
    key: 'rating'
  },
  {
    title: 'Date',
    dataIndex: 'evaluation_date',
    key: 'evaluation_date'
  },
  {
    title: 'Status',
    dataIndex: 'status',
    key: 'status'
  },
  {
    title: 'Actions',
    dataIndex: 'actions',
    key: 'actions'
  }];

  // --- METHODS ---
  // Helper methods
  const getStatusColor = (status) =>{
    switch (status ?.toLowerCase()) {
    case 'active':
    case 'approved':
    case 'met':
    case 'exceeded':
      return 'success';
    case 'inactive':
    case 'rejected':
    case 'not met':
      return 'error';
    case 'pending section approval':
    case 'pending dept approval':
    case 'pending owner approval':
    case 'pending':
    case 'draft':
      return 'warning';
    case 'in progress':
      return 'processing';
    default:
      return 'default';
    }
  }; // Thêm draft vào warning
  const getEvaluationStatusColor = (status) =>{
    switch (status ?.toLowerCase()) {
    case 'met':
    case 'exceeded':
      return 'success';
    case 'not met':
      return 'error';
    case 'in progress':
      return 'processing';
    case 'not started':
      return 'default';
    default:
      return 'default';
    }
  };
  // Hàm getAssignmentUnitName bị báo unused -> Xóa nếu không dùng ở đâu khác
  // const getAssignmentUnitName = (kpi) => { if (!kpi) return 'N/A'; if (kpi.section) return `Section: ${kpi.section.name}`; if (kpi.department) return `Department: ${kpi.department.name}`; return 'KPI not assigned to specific unit'; };
  // const calculateProgress = (current, target) => { const currentValue = parseFloat(current); const targetValue = parseFloat(target); if (isNaN(currentValue) || isNaN(targetValue) || targetValue === 0) return 0; const percent = (currentValue / targetValue) * 100; return parseFloat(Math.min(percent, 100).toFixed(2)); };
  const ensureUserAssignmentDetail = (userId, initialTarget = null, initialWeight = null) =>{
    const key = String(userId);
    if (!userAssignmentDetails[key]) {
      userAssignmentDetails[key] = {
        target: initialTarget,
        weight: initialWeight
      };
    }
  };

  // Fetch data methods
  const loadInitialData = async() =>{
    const currentKpiId = kpiId.value;
    if (!currentKpiId) {
      notification.error({
        message: "Invalid KPI ID in URL."
      });
      return;
    }
    try {
      console.log(`loadInitialData: Fetching KPI Detail
      for ID: ${
        currentKpiId
      }`);
      await store.dispatch('kpis/fetchKpiDetail', currentKpiId); // Action này đã set loadingKpi
      // Watcher sẽ lo việc gọi loadAssignmentsAndCheckStructure
      console.log("loadInitialData: Fetching users for evaluation modal...");
      loadingUsersForEval.value = true;
      await store.dispatch('users/fetchUsers', {
        params: {}
      });
    } catch(error) {
      notification.error({
        message: `Failed to load initial KPI data: ${
          error.message || 'Unknown error'
        }`
      });
      console.error("Error loading initial data:", error);
    } finally {
      loadingUsersForEval.value = false;
    }
  };
  const loadAssignmentsAndCheckStructure = async(kpiData) =>{
    if (!kpiData || !kpiData.id) {
      console.log("loadAssignments skipped: Invalid kpiData");
      return;
    }
    departmentHasSections.value = null;
    const currentKpiId = kpiData.id;

    // Fetch user assignments trước
    await fetchKpiUserAssignmentsData(currentKpiId);

    // Kiểm tra cấu trúc Department nếu KPI thuộc cấp Department
    if (kpiData.created_by_type === 'department' && kpiData.department ?.id) {
      console.warn("Checking 'departmentHasSections'. Requires store action 'sections/fetchSections' with department filter.");
      try {
        const sections = await store.dispatch('sections/fetchSections', {
          params: {
            department_id: kpiData.department.id,
            limit: 1
          },
          forceRefresh: true
        });
        departmentHasSections.value = sections && sections.length > 0;
      } catch(e) {
        departmentHasSections.value = null;
        console.error("Error checking sections:", e);
        notification.error({
          message: "Could not determine department structure."
        });
      }
    } else {
      departmentHasSections.value = null;
    } // Không áp dụng cho các level khác
    console.log("Check result: Department Has Sections?", departmentHasSections.value);
  };
  const fetchKpiUserAssignmentsData = async(id) =>{
    if (!id || typeof id !== 'number') {
      console.error("fetchKpiUserAssignmentsData: Invalid ID.", id);
      store.commit('kpis/SET_KPI_USER_ASSIGNMENTS', []);
      return;
    }
    console.log(`Dispatching fetchKpiUserAssignments
    for KPI ID: ${
      id
    }`);
    try {
      await store.dispatch('kpis/fetchKpiUserAssignments', id);
    } catch(error) {
      console.error("Error dispatching fetchKpiUserAssignments:", error);
      /* Lỗi đã được set trong store */
    }
  };
  const fetchAssignableUsersData = async() =>{
    let params = {};
    let fetchNeeded = false;
    const kpi = kpiDetailData.value;
    if (!kpi) {
      assignableUsers.value = [];
      return;
    }
    // Xác định context để filter user
    if (kpi.created_by_type === 'section' && kpi.section ?.id) {
      params = {
        section_id: kpi.section.id
      };
      fetchNeeded = true;
    } else if (kpi.created_by_type === 'department' && departmentHasSections.value === false && kpi.department ?.id) {
      params = {
        department_id: kpi.department.id,
        section_id: 'null'
      };
      fetchNeeded = true;
    }
    if (!fetchNeeded) {
      assignableUsers.value = [];
      return;
    }
    loadingAssignableUsers.value = true;
    userAssignmentSubmitError.value = null;
    try {
      console.warn("Fetching assignable users requires backend filtering...");
      await store.dispatch('users/fetchUsers', {
        params: params,
        forceRefresh: true
      });
      const allUsers = store.getters['users/userList'];
      if (params.section_id) assignableUsers.value = allUsers.filter(u =>u.section_id === params.section_id);
      else if (params.department_id) assignableUsers.value = allUsers.filter(u =>u.department_id === params.department_id && u.section_id === null);
      else assignableUsers.value = [];
    } catch(err) {
      userAssignmentSubmitError.value = `Failed to load users: ${
        err.message || 'Unknown'
      }`;
      assignableUsers.value = [];
    } finally {
      loadingAssignableUsers.value = false;
    }
  };

  // User Assignment Methods (GỌI ACTION THẬT)
  const openAssignUserModal = () =>{
    isEditingUserAssignment.value = false;
    editingUserAssignmentRecord.value = null;
    selectedUserIds.value = allUserAssignmentsForKpi.value.map(a =>a.user.id);
    Object.keys(userAssignmentDetails).forEach(key =>delete userAssignmentDetails[key]);
    userAssignmentSubmitError.value = null;
    isAssignUserModalVisible.value = true;
    fetchAssignableUsersData();
  };
  const openEditUserModal = (record) =>{
    isEditingUserAssignment.value = true;
    editingUserAssignmentRecord.value = record;
    selectedUserIds.value = [record.user.id];
    Object.keys(userAssignmentDetails).forEach(key =>delete userAssignmentDetails[key]);
    ensureUserAssignmentDetail(record.user.id, record.target, record.weight);
    userAssignmentSubmitError.value = null;
    isAssignUserModalVisible.value = true;
  };
  const closeAssignUserModal = () =>{
    isAssignUserModalVisible.value = false;
    setTimeout(() =>{
      isEditingUserAssignment.value = false;
      editingUserAssignmentRecord.value = null;
      selectedUserIds.value = [];
      Object.keys(userAssignmentDetails).forEach(key =>delete userAssignmentDetails[key]);
      userAssignmentSubmitError.value = null;
      assignableUsers.value = [];
    },
    300);
  };
  const handleSaveUserAssignment = async() =>{
    userAssignmentSubmitError.value = null;
    if (!isEditingUserAssignment.value && selectedUserIds.value.length === 0) {
      userAssignmentSubmitError.value = "Select user(s).";
      return;
    }
    let invalidDetail = false;
    const usersToValidate = isEditingUserAssignment.value ? [editingUserAssignmentRecord.value.user.id] : selectedUserIds.value;
    usersToValidate.forEach(userId =>{
      const details = userAssignmentDetails[String(userId)];
      if (!details || details.target === null || details.target < 0 || details.weight === null || details.weight < 0 || details.weight > 100) {
        invalidDetail = true;
      }
    });
    if (invalidDetail) {
      userAssignmentSubmitError.value = "Invalid Target/Weight.";
      return;
    }
    submittingUserAssignment.value = true;
    const currentKpiId = kpiId.value;
    if (!currentKpiId) {
      userAssignmentSubmitError.value = "Cannot get KPI ID.";
      submittingUserAssignment.value = false;
      return;
    }
    try {
      if (isEditingUserAssignment.value) {
        const userId = editingUserAssignmentRecord.value.user.id;
        const assignmentData = {
          target: userAssignmentDetails[String(userId)] ?.target,
          weight: userAssignmentDetails[String(userId)] ?.weight
        };
        console.warn("Need specific 'updateUserAssignment' action/API.");
        const assignmentsPayload = {
          assignments: [{
            user_id: userId,
            target: assignmentData.target,
            weight: assignmentData.weight
          }]
        };
        await store.dispatch('kpis/saveUserAssignments', {
          kpiId: currentKpiId,
          assignmentsPayload: assignmentsPayload
        });
        notification.success({
          message: "Assignment updated!"
        });
      } else {
        const assignmentsPayload = {
          assignments: selectedUserIds.value.map(userId =>({
            user_id: userId,
            target: userAssignmentDetails[String(userId)] ?.target,
            weight: userAssignmentDetails[String(userId)] ?.weight
          }))
        };
        await store.dispatch('kpis/saveUserAssignments', {
          kpiId: currentKpiId,
          assignmentsPayload: assignmentsPayload
        });
        notification.success({
          message: "Users assigned successfully!"
        });
      }
      closeAssignUserModal();
      await fetchKpiUserAssignmentsData(currentKpiId);
    } catch(err) {
      userAssignmentSubmitError.value = store.getters['kpis/assignmentError'] || err.message || 'Failed to save.';
      notification.error({
        message: "Save Failed",
        description: userAssignmentSubmitError.value
      });
    } finally {
      submittingUserAssignment.value = false;
    }
  };
  const confirmDeleteUserAssignment = (record) =>{
    userAssignmentToDelete.value = record;
    isDeleteUserAssignModalVisible.value = true;
  };
  const handleDeleteUserAssignment = async() =>{
    if (!userAssignmentToDelete.value || !userAssignmentToDelete.value.id) {
      notification.error({
        message: "Cannot delete: Missing assignment ID."
      });
      return;
    }
    submittingUserDeletion.value = true;
    const assignmentIdToDelete = userAssignmentToDelete.value.id;
    const userName = `${
      userAssignmentToDelete.value.user ?.first_name || ''
    }
    ${
      userAssignmentToDelete.value.user ?.last_name || ''
    }`;
    const currentKpiId = kpiId.value;
    try {
      await store.dispatch('kpis/deleteUserAssignment', {
        kpiId: currentKpiId,
        assignmentId: assignmentIdToDelete
      });
      notification.success({
        message: `Assignment
        for ${
          userName
        }
        removed.`
      });
      isDeleteUserAssignModalVisible.value = false;
      userAssignmentToDelete.value = null;
      /* Action fetch lại */
    } catch(err) {
      notification.error({
        message: "Deletion Failed",
        description: store.getters['kpis/assignmentError'] || err.message
      });
      isDeleteUserAssignModalVisible.value = false;
    } finally {
      submittingUserDeletion.value = false;
    }
  };

  // === Approval Methods (Placeholder) ===
  // const handleApprove = async (record) => { console.warn("Approve action needs real API call & logic", record); notification.info({ message: "Approve action not implemented." }) };
  // const handleReject = async (record) => { console.warn("Reject action needs real API call & logic", record); notification.info({ message: "Reject action not implemented." }) };

  // --- Evaluations Methods ---
  const viewEvaluation = (record) =>{
    selectedEvaluation.value = record;
    isViewEvaluationModalVisible.value = true;
  };
  const closeViewEvaluationModal = () =>{
    isViewEvaluationModalVisible.value = false;
  };
  const openEvaluationModal = () =>{
    newEvaluation.value = {
      kpi_id: kpiId.value,
      evaluator_id: actualUser.value ?.id,
      evaluatee_id: null
    };
    isCreateEvaluationModalVisible.value = true;
  };
  const closeCreateEvaluationModal = () =>{
    isCreateEvaluationModalVisible.value = false;
  };
  const submitEvaluation = async() =>{
    submittingEvaluation.value = true;
    try {
      const[startDate, endDate] = newEvaluation.value.period_dates || [];
      const payload = {...newEvaluation.value,
        period_start_date: startDate ?.toISOString(),
        period_end_date: endDate ?.toISOString()
      };
      delete payload.period_dates;
      console.warn("Store action 'evaluations/createEvaluation' needs implementation.");
      await store.dispatch('evaluations/createEvaluation', payload);
      notification.success({
        message: 'Evaluation created! (Placeholder)'
      });
      closeCreateEvaluationModal();
      await store.dispatch('kpis/fetchKpiDetail', kpiId.value);
    } catch(error) {
      notification.error({
        message: 'Failed to create evaluation.'
      });
    } finally {
      submittingEvaluation.value = false;
    }
  };

  // --- WATCHERS ---
  // Watcher chính để load assignment khi kpiDetailData thay đổi
  watch(kpiDetailData, async(newDetail, oldDetail) =>{
    const newKpiId = newDetail ?.id;
    const oldKpiId = oldDetail ?.id;
    if (newKpiId && typeof newKpiId === 'number' && newKpiId !== oldKpiId) {
      console.log(`Watcher triggered: KPI data updated
      for ID ${
        newKpiId
      }`);
      store.commit('kpis/SET_KPI_USER_ASSIGNMENTS', []); // Reset assignments trước
      kpiEvaluations.value = newDetail.evaluations || []; // Cập nhật evaluations từ detail mới
      await loadAssignmentsAndCheckStructure(newDetail); // Gọi hàm kiểm tra và load assignments thật
    } else if (!newKpiId && oldKpiId) {
      console.log(`Watcher triggered: KPI data reset.`);
      store.commit('kpis/SET_KPI_USER_ASSIGNMENTS', []);
      kpiEvaluations.value = [];
      departmentHasSections.value = null;
    }
  },
  {
    deep: false
  });

  // Watcher cho modal user assignment
  watch(selectedUserIds, (newUserIds, oldUserIds = []) =>{
    if (isEditingUserAssignment.value) return;
    const newUserIdsSet = new Set(newUserIds.map(String));
    const oldUserIdsSet = new Set(oldUserIds.map(String));
    newUserIds.forEach(userId =>{
      ensureUserAssignmentDetail(String(userId));
    });
    oldUserIdsSet.forEach(oldUserId =>{
      if (!newUserIdsSet.has(oldUserId)) {
        delete userAssignmentDetails[oldUserId];
      }
    });
  },
  {
    deep: true
  });

  // --- LIFECYCLE HOOK ---
  onMounted(async() =>{
    console.log("KpiDetail Component Mounted. Fetching initial data...");
    await loadInitialData(); // Gọi hàm load data tổng hợp
  });
</script>
<style scoped>
  .ant-descriptions-item-label { font-weight: bold; } p { margin-bottom:
  0.5em; }
</style>