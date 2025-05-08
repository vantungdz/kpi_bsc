<template>
  <div>
    <a-card :title="`KPI Detail: ${kpiDetailData?.name || 'Loading...'}`" style="margin-bottom: 20px">
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <template #title>
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
              ">
              <span> KPI Information </span>
              <a-button v-if="kpiDetailData?.id" @click="copyKpiAsTemplate" :disabled="loadingKpi">
                Copy as Template
              </a-button>
            </div>
          </template>
          <a-descriptions-item label="ID">
            {{ kpiDetailData.id }}
          </a-descriptions-item>
          <a-descriptions-item label="Created By Type">
            {{ kpiDetailData.created_by_type || "" }}
          </a-descriptions-item>
          <a-descriptions-item label="Frequency">
            {{ kpiDetailData.frequency }}
          </a-descriptions-item>
          <a-descriptions-item label="Perspective">
            {{ kpiDetailData.perspective?.name || "" }}
          </a-descriptions-item>
          <a-descriptions-item label="Department">
            {{ departmentNameFromSectionContext }}
          </a-descriptions-item>
          <a-descriptions-item label="Section">
            {{ sectionNameFromContext }}
          </a-descriptions-item>
          <a-descriptions-item label="Unit">
            {{ kpiDetailData.unit || "" }}
          </a-descriptions-item>
          <a-descriptions-item label="Target">
            {{ kpiDetailData.target?.toLocaleString() ?? "" }}
          </a-descriptions-item>
          <a-descriptions-item label="Weight (%)">
            {{ kpiDetailData.weight ?? "" }}
          </a-descriptions-item>

          <a-descriptions-item label="Status" :span="2">
            <a-tag :color="getKpiDefinitionStatusColor(kpiDetailData.status)" style="margin-right: 10px;"> {{
              getKpiDefinitionStatusText(kpiDetailData.status) }}</a-tag>
            <a-switch v-if="isManagerOrAdmin && kpiDetailData?.id"
              :checked="kpiDetailData.status === KpiDefinitionStatus.APPROVED" :loading="isToggling"
              :disabled="isToggling || loadingKpi" checked-children="ON" un-checked-children="OFF" size="small"
              @change="() => handleToggleStatus(kpiDetailData.id)" title="Toggle DRAFT/APPROVED status" />
            <div v-if="toggleStatusError" style="color: red; font-size: 0.9em; margin-top: 5px;">
              Lỗi: {{ toggleStatusError }}
              <a @click="clearToggleError" style="margin-left: 5px;">(Xóa)</a>
            </div>
          </a-descriptions-item>

          <a-descriptions-item label="Description" :span="2">
            {{ kpiDetailData.description || "" }}
          </a-descriptions-item>
        </a-descriptions>
        <a-empty v-else-if="!loadingKpi" description="Could not load KPI Details." />
      </a-skeleton>

      <a-row v-if="shouldShowAssignmentStats" :gutter="12" style="
          margin-top: 16px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        ">
        <a-col :span="8">
          <a-statistic title="Overall Target" :value="overallTargetValueDetail" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic title="Total Assigned" :value="totalAssignedTargetDetail" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic title="Remaining" :value="remainingTargetDetail" :precision="2"
            :value-style="isOverAssignedDetail ? { color: '#cf1322' } : {}" />
        </a-col>
      </a-row>
    </a-card>

    <a-card title="Manage Department/Section Assignments" style="margin-top: 20px"
      v-if="shouldShowDepartmentSectionAssignmentCard && canManageAssignments">
      <template #extra>
        <a-button type="primary" @click="openManageDepartmentSectionAssignments">
          <template #icon>
            <plus-outlined />
          </template>
          Add Assignment
        </a-button>
      </template>
      <a-skeleton :loading="loadingDepartmentSectionAssignments" active :paragraph="{ rows: 4 }">
        <a-table :columns="departmentSectionAssignmentColumns" :data-source="filteredAssignmentsForContextDepartment"
          row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'assignedUnit'">
              <span v-if="record.section">{{ record.section.name }} (Section)</span>
              <span v-else-if="record.department">{{ record.department.name }} (Department)</span>
              <span v-else>N/A</span>
            </template>
            <template v-else-if="column.key === 'targetValue'">
              {{ record.targetValue?.toLocaleString() ?? "-" }}
              <span v-if="kpiDetailData?.unit"> {{ kpiDetailData.unit }}</span>
            </template>

            <template v-else-if="column.key === 'actual'">
              {{ record.latest_actual_value?.toLocaleString() ?? '-' }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getAssignmentStatusColor(record.status)">
                {{ getAssignmentStatusText(record.status) }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-tooltip title="Edit Assignment">
                  <a-button type="primary" ghost shape="circle" size="small"
                    @click="openEditDepartmentSectionAssignment(record)">
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button danger shape="circle" size="small"
                    @click="confirmDeleteDepartmentSectionAssignment(record)">
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>

        </a-table>
        <a-empty v-show="currentDepartmentSectionAssignments.length === 0 &&
          !loadingDepartmentSectionAssignments
          " description="No department or section assignments yet." />
      </a-skeleton>
    </a-card>
    <a-card title="Manage Direct User Assignments" style="margin-top: 20px"
      v-if="shouldShowDirectUserAssignmentCard && canManageAssignments">
      <template #extra>
        <a-button type="primary" @click="openAssignUserModal" :disabled="loadingUserAssignments || !kpiDetailData?.id">
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </template>
      <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
        <a-alert v-if="userAssignmentError" :message="userAssignmentError" type="error" show-icon closable
          @close="clearAssignmentError" style="margin-bottom: 16px" />
        <a-table v-show="filteredDirectUserAssignments.length > 0" :columns="userAssignmentColumns"
          :data-source="filteredDirectUserAssignments" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.employee?.avatar_url" size="small" style="margin-right: 8px">
                {{ record.employee?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.employee?.first_name }}
              {{ record.employee?.last_name }} ({{ record.employee?.username }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? "" }}
              {{ kpiDetailData?.unit || "" }}
            </template>
            <template v-else-if="column.key === 'weight'">
              {{ record.weight ?? "" }} %
            </template>
            <template v-else-if="column.key === 'actual'">
              {{ record.latest_actual_value?.toLocaleString() ?? "" }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status || "" }}
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
        <a-empty v-show="filteredDirectUserAssignments.length === 0 &&
          !loadingUserAssignments &&
          !userAssignmentError
          " description="No users have been directly assigned this KPI yet." />
      </a-skeleton>
    </a-card>

    <a-card title="Manage User Assignments" style="margin-top: 20px"
      v-if="shouldShowSectionUserAssignmentCard && canManageAssignments">
      <template #extra>
        <a-button type="primary" @click="openAssignUserModal" :disabled="loadingUserAssignments || !kpiDetailData?.id">
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </template>
      <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
        <a-alert v-if="userAssignmentError" :message="userAssignmentError" type="error" show-icon closable
          @close="clearAssignmentError" style="margin-bottom: 16px" />
        <a-table v-show="filteredSectionUserAssignments.length > 0" :columns="userAssignmentColumns"
          :data-source="filteredSectionUserAssignments" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.employee?.avatar_url" size="small" style="margin-right: 8px">
                {{ record.employee?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.employee?.first_name }}
              {{ record.employee?.last_name }} ({{ record.employee?.username }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.targetValue?.toLocaleString() ?? "" }}
              {{ kpiDetailData?.unit || "" }}
            </template>
            <template v-else-if="column.key === 'actual'">
              {{ record.latest_actual_value?.toLocaleString() ?? 0 }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status || "" }}
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
        <a-empty v-show="filteredSectionUserAssignments.length === 0 &&
          !loadingUserAssignments &&
          !userAssignmentError
          " description="No users have been assigned this KPI in this section yet." />
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
      <a-form layout="vertical" :model="newEvaluation"> </a-form>
    </a-modal>

    <a-modal :open="isAssignUserModalVisible" @update:open="isAssignUserModalVisible = $event"
      :title="assignUserModalTitle" @ok="handleSaveUserAssignment" @cancel="closeAssignUserModal"
      :confirm-loading="submittingUserAssignment" :width="800" :mask-closable="false" :keyboard="false" ok-text="Save"
      cancel-text="Cancel">
      <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
        <a-descriptions v-if="
          isEditingUserAssignment && editingUserAssignmentRecord?.employee
        " :column="1" size="small" style="margin-bottom: 15px">
          <a-descriptions-item label="User">
            <a-avatar :src="editingUserAssignmentRecord.employee?.avatar_url" size="small" style="margin-right: 8px">
              {{ editingUserAssignmentRecord.employee?.first_name?.charAt(0) }}
            </a-avatar>
            {{ editingUserAssignmentRecord.employee?.first_name }}
            {{ editingUserAssignmentRecord.employee?.last_name }} ({{
            editingUserAssignmentRecord.employee?.username
            }})
          </a-descriptions-item>
        </a-descriptions>
        <a-form-item v-if="!isEditingUserAssignment" label="Select Users" required>
          <a-select v-model:value="selectedUserIds" mode="multiple" placeholder="Search and select users..."
            style="width: 100%; margin-bottom: 15px" show-search allow-clear :filter-option="(inputValue, option) =>
              option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >=
              0
              " :options="assignableUserOptions" :loading="loadingAssignableUsers" />
        </a-form-item>
        <h4 style="margin-bottom: 10px">Set Target & Weight:</h4>
        <a-table :columns="modalUserAssignmentInputColumns" :data-source="modalUserDataSource" row-key="userId"
          size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.avatar_url" size="small" style="margin-right: 8px">
                {{ record.name?.charAt(0) }}
              </a-avatar>
              {{ record.name }}
            </template>
            <template v-if="column.key === 'target'">
              <a-input-number v-model:value="userAssignmentDetails[record.userId].target" placeholder="Target"
                style="width: 100%" :min="0" :step="1" />
            </template>
          </template>
        </a-table>
        <div v-if="userAssignmentSubmitError" style="color: red; margin-top: 10px">
          {{ userAssignmentSubmitError }}
        </div>
      </a-spin>
    </a-modal>

    <a-modal :open="isDeleteUserAssignModalVisible" @update:open="isDeleteUserAssignModalVisible = $event"
      title="Confirm Deletion" @ok="handleDeleteUserAssignment" @cancel="isDeleteUserAssignModalVisible = false"
      :confirm-loading="submittingUserDeletion" ok-text="Delete" cancel-text="Cancel" ok-type="danger">
      <p v-if="userAssignmentToDelete?.employee">
        Are you sure you want to remove the assignment for user
        <strong>
          {{ userAssignmentToDelete.employee.first_name }}
          {{ userAssignmentToDelete.employee.last_name }}
        </strong>
        ?
      </p>
      <p v-else>Are you sure you want to delete this assignment?</p>
    </a-modal>

    <a-modal :open="isDepartmentSectionAssignmentModalVisible"
      @update:open="isDepartmentSectionAssignmentModalVisible = $event" :title="editingDepartmentSectionAssignment
        ? 'Edit Assignment'
        : 'Add Department/Section Assignment'
        " @ok="handleSaveDepartmentSectionAssignment" @cancel="closeManageDepartmentSectionAssignments"
      :confirm-loading="submittingDepartmentSectionAssignment" :width="600" :mask-closable="false" :keyboard="false"
      ok-text="Save" cancel-text="Cancel">
      <a-spin :spinning="
        /* Cân nhắc thêm state loading riêng khi fetch sections cho modal nếu cần */
        /* loadingDepartmentSectionAssignments || */
        submittingDepartmentSectionAssignment
        ">
        <a-form layout="vertical" :model="departmentSectionAssignmentForm" ref="departmentSectionAssignmentFormRef">
          <a-form-item label="Assign To" name="assignToTarget">
            <a-select v-model:value="departmentSectionAssignmentForm.assigned_to_department
              " placeholder="Select Department" style="width: 100%; margin-bottom: 10px"
              @change="handleDepartmentSelectInModal" :disabled="!!contextDepartmentId ||
                editingDepartmentSectionAssignment !== null
                ">
              <a-select-option v-for="dept in allDepartments" :key="dept.id" :value="dept.id">
                {{ dept.name }}
              </a-select-option>
            </a-select>

            <a-form-item name="assigned_to_section" no-style>
              <a-select v-model:value="departmentSectionAssignmentForm.assigned_to_section
                " placeholder="Select Section (Optional)" style="width: 100%" :disabled="!departmentSectionAssignmentForm.assigned_to_department ||
                  editingDepartmentSectionAssignment !== null
                  " allow-clear>
                <a-select-option v-for="section in assignableSections" :key="section.id" :value="section.id">
                  {{ section.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form-item>

          <a-form-item label="Target" required name="targetValue">
            <a-input-number v-model:value="departmentSectionAssignmentForm.targetValue" placeholder="Target"
              style="width: 100%" :min="0" :step="1" />
          </a-form-item>

          <div v-if="departmentSectionAssignmentError" style="color: red; margin-top: 10px">
            {{ departmentSectionAssignmentError }}
          </div>
        </a-form>
      </a-spin>
    </a-modal>

    <a-modal :open="isDeleteDepartmentSectionAssignmentModalVisible"
      @update:open="isDeleteDepartmentSectionAssignmentModalVisible = $event" title="Confirm Deletion"
      @ok="handleDeleteDepartmentSectionAssignment" @cancel="isDeleteDepartmentSectionAssignmentModalVisible = false"
      :confirm-loading="submittingDepartmentSectionDeletion" ok-text="Delete" cancel-text="Cancel" ok-type="danger">
      <p v-if="departmentSectionAssignmentToDelete">
        Are you sure you want to remove the assignment for
        <strong>
          <span v-if="departmentSectionAssignmentToDelete.department">
            Department:
            {{ departmentSectionAssignmentToDelete.department.name }}
          </span>
          <span v-else-if="departmentSectionAssignmentToDelete.section">
            Section: {{ departmentSectionAssignmentToDelete.section.name }}
          </span>
          <span v-else-if="departmentSectionAssignmentToDelete.team">
            Team: {{ departmentSectionAssignmentToDelete.team.name }}
          </span>
          <span v-else> this unit </span>
        </strong>
        ?
      </p>
      <p v-else>Are you sure you want to delete this assignment?</p>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";

import {
  notification,
  Descriptions as ADescriptions,
  DescriptionsItem as ADescriptionsItem,
  Avatar as AAvatar,
  Empty as AEmpty,
  Table as ATable,
  Tag as ATag,
  Card as ACard,
  Skeleton as ASkeleton,
  Button as AButton,
  Space as ASpace,
  Tooltip as ATooltip,
  Modal as AModal,
  Select as ASelect,
  InputNumber as AInputNumber,
  Form as AForm,
  FormItem as AFormItem,
  Alert as AAlert,
  Spin as ASpin,
} from "ant-design-vue";
import {
  EditOutlined,
  DeleteOutlined,
  UserAddOutlined,
} from "@ant-design/icons-vue";
import dayjs from "dayjs";
import LocalizedFormat from "dayjs/plugin/localizedFormat";
dayjs.extend(LocalizedFormat);
import {
  KpiDefinitionStatus,
  KpiDefinitionStatusText,
  KpiDefinitionStatusColor,
  KpiValueStatus,
  
} from "@/core/constants/kpiStatus";

const router = useRouter();
const store = useStore();
const route = useRoute();
const kpiId = computed(() => {
  const id = route.params.id;
  const parsedId = id ? parseInt(id, 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

const contextDepartmentId = computed(() => {
  const id = route.query.contextDepartmentId;
  const parsedId = id ? parseInt(String(id), 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

const contextSectionId = computed(() => {
  const id = route.query.contextSectionId;
  return id ? parseInt(id, 10) : null;
});
const loadingKpi = computed(() => store.getters["kpis/isLoading"]);
const kpiDetailData = computed(() => store.getters["kpis/currentKpi"]);
const currentUser = computed(() => store.getters["auth/user"]);
const allUserAssignmentsForKpi = computed(
  () => store.getters["kpis/currentKpiUserAssignments"]
);
const loadingUserAssignments = computed(
  () => store.getters["kpis/isLoadingUserAssignments"]
);
const userAssignmentError = computed(
  () => store.getters["kpis/userAssignmentError"]
);
const isToggling = computed(() => store.getters['kpis/isTogglingKpiStatus']);
const toggleStatusError = computed(() => store.getters['kpis/toggleKpiStatusError']); 
const actualUser = computed(() => store.getters["auth/user"]);
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const loadingDepartmentSectionAssignments = computed(
  () => store.getters["kpis/isLoadingDepartmentSectionAssignments"] || false
);
const departmentSectionAssignmentError = computed(
  () => store.getters["kpis/departmentSectionAssignmentError"] || null
);
const allDepartments = computed(
  () => store.getters["departments/departmentList"] || []
);
const allSections = computed(() => store.getters["sections/sectionList"] || []);

const isManagerOrAdmin = computed(() => {
  return ['manager', 'admin'].includes(effectiveRole.value);
});

const sectionNameFromContext = computed(() => {
  const currentSectionId = contextSectionId.value;
  if (
    currentSectionId === null ||
    !Array.isArray(allSections.value) ||
    allSections.value.length === 0
  ) {
    return "";
  }
  const foundSection = allSections.value.find(
    (s) => String(s.id) === String(currentSectionId)
  );
  return foundSection?.name || "";
});

const departmentNameFromSectionContext = computed(() => {
  const currentSectionId = contextSectionId.value;

  if (
    currentSectionId === null ||
    !Array.isArray(allSections.value) ||
    allSections.value.length === 0 ||
    !Array.isArray(allDepartments.value) ||
    allDepartments.value.length === 0
  ) {
    return "";
  }
  const section = allSections.value.find(
    (s) => String(s.id) === String(currentSectionId)
  );
  if (!section) {
    console.warn(
      `Department Lookup: Không tìm thấy Section với ID ${currentSectionId}.`
    );
    return "";
  }

  const departmentId = section.department.id;
  if (departmentId === null || typeof departmentId === "undefined") {
    return "";
  }
  const department = allDepartments.value.find(
    (d) => String(d.id) === String(departmentId)
  );
  if (!department) {
    console.warn(
      `Department Lookup: Không tìm thấy Department với ID ${departmentId}.`
    );
    return "";
  }
  return department.name || "";
});

const departmentHasSections = ref(null);
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
const kpiEvaluations = ref([]);
const isViewEvaluationModalVisible = ref(false);
const selectedEvaluation = ref({});
const isCreateEvaluationModalVisible = ref(false);
const newEvaluation = ref({});
const submittingEvaluation = ref(false);
const isDepartmentSectionAssignmentModalVisible = ref(false);
const editingDepartmentSectionAssignment = ref(null);
const submittingDepartmentSectionAssignment = ref(false);
const isDeleteDepartmentSectionAssignmentModalVisible = ref(false);
const departmentSectionAssignmentToDelete = ref(null);
const submittingDepartmentSectionDeletion = ref(false);
const departmentSectionAssignmentFormRef = ref(null);

const departmentSectionAssignmentForm = reactive({
  assigned_to_department: null,
  assigned_to_section: null,
  targetValue: null,
  assignmentId: null,
});

const currentDepartmentSectionAssignments = computed(() => {
  return (
    kpiDetailData.value?.assignments?.filter(
      (assign) =>
        assign.assigned_to_department !== null ||
        assign.assigned_to_section !== null
    ) || []
  );
});

const assignableSections = computed(() => {
  const selectedDepartmentIdInModal =
    departmentSectionAssignmentForm.assigned_to_department;

  if (
    selectedDepartmentIdInModal === null ||
    selectedDepartmentIdInModal === undefined ||
    selectedDepartmentIdInModal === ""
  ) {
    return [];
  }

  const sectionsForSelectedDept = store.getters[
    "sections/sectionsByDepartment"
  ](selectedDepartmentIdInModal);

  if (!Array.isArray(sectionsForSelectedDept)) {
    console.warn(
      "assignableSections: sectionsForSelectedDept is not an array",
      sectionsForSelectedDept
    );
    return [];
  }

  if (!editingDepartmentSectionAssignment.value) {
    const allCurrentAssignments = kpiDetailData.value?.assignments;
    if (!Array.isArray(allCurrentAssignments)) {
      console.warn(
        "assignableSections: Cannot get current assignments to filter."
      );
      return sectionsForSelectedDept;
    }

    const assignedSectionIds = new Set();
    allCurrentAssignments.forEach((assign) => {
      if (
        assign.assigned_to_section !== null &&
        assign.assigned_to_section !== undefined
      ) {
        const id = Number(assign.assigned_to_section);
        if (!isNaN(id)) {
          assignedSectionIds.add(id);
        }
      }
    });

    const filteredSections = sectionsForSelectedDept.filter((section) => {
      const sectionId = Number(section?.id);
      return !isNaN(sectionId) && !assignedSectionIds.has(sectionId);
    });

    console.log(
      "[AssignableSections] Filtered list (excluding already assigned):",
      filteredSections
    );
    return filteredSections;
  } else {
    console.log(
      "[AssignableSections] Editing mode - returning all sections for dept:",
      sectionsForSelectedDept
    );
    return sectionsForSelectedDept;
  }
});

const openManageDepartmentSectionAssignments = () => {
  const currentContextDeptId = contextDepartmentId.value;

  editingDepartmentSectionAssignment.value = null;
  departmentSectionAssignmentError.value = null;
  departmentSectionAssignmentForm.assignmentId = null;
  departmentSectionAssignmentForm.assigned_to_section = null;
  departmentSectionAssignmentForm.targetValue = null;

  if (currentContextDeptId !== null) {
    departmentSectionAssignmentForm.assigned_to_department =
      currentContextDeptId;
    store.dispatch("sections/fetchSectionsByDepartment", currentContextDeptId);
  } else {
    departmentSectionAssignmentForm.assigned_to_department = null;
  }
  isDepartmentSectionAssignmentModalVisible.value = true;

  departmentSectionAssignmentFormRef.value?.resetFields();
};

const openEditDepartmentSectionAssignment = (assignmentRecord) => {
  editingDepartmentSectionAssignment.value = assignmentRecord;
  departmentSectionAssignmentForm.assigned_to_department =
    assignmentRecord.assigned_to_department;
  departmentSectionAssignmentForm.assigned_to_section =
    assignmentRecord.assigned_to_section;
  departmentSectionAssignmentForm.targetValue = assignmentRecord.targetValue;
  departmentSectionAssignmentForm.assignmentId = assignmentRecord.id;
  departmentSectionAssignmentError.value = null;
  isDepartmentSectionAssignmentModalVisible.value = true;
};

const closeManageDepartmentSectionAssignments = () => {
  isDepartmentSectionAssignmentModalVisible.value = false;
  setTimeout(() => {
    editingDepartmentSectionAssignment.value = null;
    departmentSectionAssignmentForm.assigned_to_department = null;
    departmentSectionAssignmentForm.assigned_to_section = null;
    departmentSectionAssignmentForm.targetValue = null;
    departmentSectionAssignmentForm.weight = null;
    departmentSectionAssignmentForm.assignmentId = null;
    departmentSectionAssignmentError.value = null;
  }, 300);
};

const confirmDeleteDepartmentSectionAssignment = (assignmentRecord) => {
  departmentSectionAssignmentToDelete.value = assignmentRecord;
  isDeleteDepartmentSectionAssignmentModalVisible.value = true;
};

const copyKpiAsTemplate = () => {
  if (kpiDetailData.value?.id) {
    router.push({
      path: "/kpis/create",
      query: {
        templateKpiId: kpiDetailData.value.id,
      },
    });
  } else {
    notification.warning({
      message: "Cannot copy: KPI ID not available.",
    });
  }
};

const overallTargetValueDetail = computed(() => {
  const currentContextSectId = contextSectionId.value;
  const currentContextDeptId = contextDepartmentId.value;
  const kpiData = kpiDetailData.value;
  const assignments = kpiData?.assignments;

  if (!Array.isArray(assignments)) {
    const originalTarget = parseFloat(kpiData?.target);
    return isNaN(originalTarget) ? 0 : originalTarget;
  }

  if (currentContextSectId !== null && currentContextSectId !== undefined) {
    const contextAssignment = assignments.find(
      (assign) => assign.assigned_to_section === currentContextSectId
    );
    if (contextAssignment && typeof contextAssignment.targetValue !== 'undefined' && contextAssignment.targetValue !== null) {
      const contextTarget = parseFloat(contextAssignment.targetValue);
      return isNaN(contextTarget) ? 0 : contextTarget;
    }
  }
  else if (currentContextDeptId !== null && currentContextDeptId !== undefined) {
    const contextAssignment = assignments.find(
      (assign) => assign.assigned_to_department === currentContextDeptId
    );
    if (contextAssignment && typeof contextAssignment.targetValue !== 'undefined' && contextAssignment.targetValue !== null) {
      const contextTarget = parseFloat(contextAssignment.targetValue);
      return isNaN(contextTarget) ? 0 : contextTarget;
    }
  }

  const originalTarget = parseFloat(kpiData?.target);
  return isNaN(originalTarget) ? 0 : originalTarget;
});

const totalAssignedTargetDetail = computed(() => {
  let total = 0;
  const assignments = kpiDetailData.value?.assignments;
  const userAssignments = allUserAssignmentsForKpi.value;
  const currentContextSectId = contextSectionId.value;
  const currentContextDeptId = contextDepartmentId.value;
  const sectionsData = allSections.value;

  if (currentContextSectId !== null && currentContextSectId !== undefined) {
    if (userAssignments && Array.isArray(userAssignments)) {
      const sectionUserAssignments = userAssignments.filter(assign =>
        assign.employee && assign.employee.sectionId === currentContextSectId
      );
      sectionUserAssignments.forEach(assign => {
        const targetValue = assign.targetValue ?? assign.target;
        if (targetValue !== null && targetValue !== undefined && !isNaN(targetValue)) {
          total += Number(targetValue);
        }
      });
      return total;
    } else {
      return 0;
    }
  }
  else if (currentContextDeptId !== null && currentContextDeptId !== undefined) {
    if (!assignments || !Array.isArray(assignments)) { return 0; }
    if (!sectionsData || !Array.isArray(sectionsData)) {
      return 0;
    }
    const sectionToDeptMap = new Map();
    sectionsData.forEach((section) => {
      const sectionId = section?.id;
      const deptId = section?.department?.id ?? section?.department_id;
      if (typeof sectionId === 'number' && typeof deptId === 'number') {
        sectionToDeptMap.set(sectionId, deptId);
      }
    });
    assignments.forEach((assign) => {
      const sectionId = assign.assigned_to_section;
      const targetValue = assign.targetValue;
      if (sectionId !== null && sectionId !== undefined &&
        targetValue !== null && targetValue !== undefined && !isNaN(targetValue)) {
        const assignedSectionId = Number(sectionId);
        if (!isNaN(assignedSectionId) && sectionToDeptMap.get(assignedSectionId) === currentContextDeptId) {
          total += Number(targetValue);
        }
      }
    });
    return total;
  }
  else {
    if (!assignments || !Array.isArray(assignments)) { return 0; }
    if (!sectionsData || !Array.isArray(sectionsData)) {
      return 0;
    }
    const sectionToDeptMap = new Map();
    sectionsData.forEach((section) => {
      const sectionId = section?.id;
      const deptId = section?.department?.id ?? section?.department_id;
      if (typeof sectionId === 'number' && typeof deptId === 'number') {
        sectionToDeptMap.set(sectionId, deptId);
      }
    });
    const assignedSectionIds = new Set(
      assignments
        .filter(a => a.assigned_to_section !== null && a.assigned_to_section !== undefined)
        .map(a => Number(a.assigned_to_section))
        .filter(id => !isNaN(id))
    );
    assignments.forEach((assign) => {
      const targetValue = assign.targetValue;
      let shouldIncludeTarget = false;
      if (targetValue !== undefined && targetValue !== null && !isNaN(targetValue) && Number(targetValue) >= 0) {
        if (assign.assigned_to_section !== null && assign.assigned_to_section !== undefined) {
          shouldIncludeTarget = true;
        } else if (assign.assigned_to_department !== null && assign.assigned_to_department !== undefined) {
          const departmentId = Number(assign.assigned_to_department);
          if (!isNaN(departmentId)) {
            let hasAssignedChildSection = false;
            for (const sectionId of assignedSectionIds) {
              if (sectionToDeptMap.get(sectionId) === departmentId) {
                hasAssignedChildSection = true;
                break;
              }
            }
            if (!hasAssignedChildSection) {
              shouldIncludeTarget = true;
            }
          }
        }
      }
      if (shouldIncludeTarget) {
        total += Number(targetValue);
      }
    });
    return total;
  }
});

const remainingTargetDetail = computed(() => {
  const overall = parseFloat(overallTargetValueDetail.value);
  const assigned = parseFloat(totalAssignedTargetDetail.value);
  const validOverall = isNaN(overall) ? 0 : overall;
  const validAssigned = isNaN(assigned) ? 0 : assigned;
  const difference = validOverall - validAssigned;
  return parseFloat(difference.toFixed(5));
});

const isOverAssignedDetail = computed(() => {
  return remainingTargetDetail.value < -1e-9;
});

const shouldShowAssignmentStats = computed(() => {
  const kpi = kpiDetailData.value;
  if (!kpi) return false;

  return (
    (kpi.created_by_type === "company" ||
      kpi.created_by_type === "department") &&
    (kpi.assignments?.length > 0 || overallTargetValueDetail.value > 0)
  );
});

const canManageAssignments = computed(() => {
  if (!kpiDetailData.value) return false;
  const result = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
  return result;
});

const handleToggleStatus = async (kpiId) => {
  if (!kpiId || isToggling.value) return;
  store.commit('kpis/SET_TOGGLE_KPI_STATUS_ERROR', null);
  try {
    await store.dispatch('kpis/toggleKpiStatus', { kpiId });
  } catch (error) {
    console.error("Error toggling KPI status:", error);
  }
};

const getKpiDefinitionStatusText = (status) => KpiDefinitionStatusText[status] || 'N/A';

const getKpiDefinitionStatusColor = (status) => KpiDefinitionStatusColor[status] || 'default';

const clearToggleError = () => {
  store.commit('kpis/SET_TOGGLE_KPI_STATUS_ERROR', null);
};

const sectionIdForUserAssignmentsCard = computed(() => {
  if (effectiveRole.value === 'section' && currentUser.value?.sectionId) {
    return currentUser.value.sectionId;
  }

  if (contextSectionId.value) {
    return contextSectionId.value;
  }

  if (['admin', 'manager'].includes(effectiveRole.value) &&
      kpiDetailData.value?.created_by_type === 'section' && kpiDetailData.value?.created_by) {
    return kpiDetailData.value.created_by;
  }

  return null;
});

const filteredDirectUserAssignments = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const kpi = kpiDetailData.value;
  
  const currentDeptId = kpi?.created_by_type === "department" ? kpi?.created_by : null;
  

  if (!kpi || kpi.created_by_type !== "department" || !currentDeptId || !Array.isArray(allAssignments)) {
    return [];
  }

  return allAssignments.filter((assign) => {
    const isUserAssignment = assign.assigned_to_employee !== null;
    
    let employeeDepartmentId = assign.employee?.departmentId;
    let employeeHasSection = assign.employee?.sectionId !== null && assign.employee?.sectionId !== undefined;

    return isUserAssignment && employeeDepartmentId === currentDeptId && !employeeHasSection;
  });
});

const filteredSectionUserAssignments = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const sectionIdToFilterBy = sectionIdForUserAssignmentsCard.value;

  if (!sectionIdToFilterBy || !Array.isArray(allAssignments)) {
    return [];
  }

  return allAssignments.filter((assign) => {
    
    return assign.assigned_to_employee !== null &&
      assign.employee?.sectionId == sectionIdToFilterBy; 
  });
});

const shouldShowDirectUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;

  if (!kpi || kpi.created_by_type !== "department") {
    return false;
  }

  const departmentId = kpi.created_by;
  const allDepartmentsList = allDepartments.value;

  const kpiDepartment = Array.isArray(allDepartmentsList)
    ? allDepartmentsList.find((d) => d.id == departmentId)
    : undefined;

  if (!kpiDepartment) {
    return false;
  }

  const deptHasSections = departmentHasSections.value;

  if (deptHasSections === null) {
    return false;
  }
  if (deptHasSections === true) {
    return false;
  }

  const isAllowedRole = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
  if (!isAllowedRole) {
    return false;
  }

  const canManageThis = ["admin", "manager"].includes(effectiveRole.value) || (effectiveRole.value === "department" && actualUser.value?.department_id === departmentId);

  const finalResult =
    isAllowedRole && canManageThis && deptHasSections === false;

  return finalResult;
});

const shouldShowSectionUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;
  const userRole = effectiveRole.value;
  const user = currentUser.value;

  if (!kpi || !userRole || !user) return false;

  if (userRole === 'section') {
    return !!user.sectionId;
  }

  if (userRole === 'admin' || userRole === 'manager') {
    return !!sectionIdForUserAssignmentsCard.value;
  }

  if (userRole === 'department') {
    const relevantSectionId = sectionIdForUserAssignmentsCard.value;
    if (relevantSectionId && user.departmentId) {
      const sectionInfo = allSections.value.find(s => s.id == relevantSectionId); // Use == for potential type mismatch if IDs are strings vs numbers
      if (sectionInfo) {
        const sectionDeptId = sectionInfo.department_id || sectionInfo.department?.id;
        return sectionDeptId == user.departmentId; // Use == for potential type mismatch
      }
    }
    return false;
  }

  return false;
});

const assignableUserOptions = computed(() => {
  const allFetchableUsers = assignableUsers.value;

  if (!Array.isArray(allFetchableUsers)) {
    return [];
  }

  const alreadyAssignedUserIds = allUserAssignmentsForKpi.value
    .filter((assign) => assign.assigned_to_employee !== null && assign.employee)
    .map((assign) => assign.employee.id);

  const alreadyAssignedUserIdsSet = new Set(alreadyAssignedUserIds);

  const filteredAssignableUsers = allFetchableUsers.filter((user) => {
    return (
      user &&
      typeof user.id !== "undefined" &&
      !alreadyAssignedUserIdsSet.has(user.id)
    );
  });

  const result = filteredAssignableUsers.map((user) => ({
    value: user.id,
    label: `${user.first_name || ""} ${user.last_name || ""} (${user.username})`,
    name: `${user.first_name || ""} ${user.last_name || ""}`,
    avatar_url: user?.avatar_url,
  }));

  return result;
});

const modalUserDataSource = computed(() => {
  if (
    isEditingUserAssignment.value &&
    editingUserAssignmentRecord.value?.employee
  ) {
    const user = editingUserAssignmentRecord.value.employee;
    ensureUserAssignmentDetail(
      user.id,
      editingUserAssignmentRecord.value.target,
      editingUserAssignmentRecord.value.weight
    );
    return [
      {
        userId: user.id,
        name: `${user.first_name || ""} ${user.last_name || ""}`,
        avatar_url: user.avatar_url,
      },
    ];
  } else if (!isEditingUserAssignment.value) {
    const newlySelectedUserIds = selectedUserIds.value;

    if (newlySelectedUserIds.length === 0) {
      return [];
    }

    const dataSource = assignableUserOptions.value
      .filter((opt) => newlySelectedUserIds.includes(opt.value))
      .map((opt) => {
        ensureUserAssignmentDetail(opt.value, null, null);

        return {
          userId: opt.value,
          name: opt.name,
          avatar_url: opt.avatar_url,
        };
      });

    return dataSource;
  }

  return [];
});

const assignUserModalTitle = computed(() => {
  const sectionIdForTitle = sectionIdForUserAssignmentsCard.value;

  if (sectionIdForTitle) {
    const sectionInfo = allSections.value.find(
      (s) => s.id == sectionIdForTitle
    );
    const sectionName = sectionInfo?.name || `ID ${sectionIdForTitle}`;
    return `Assign KPI to Users in Section: ${sectionName}`;
  }

  if (isEditingUserAssignment.value) {
    return "Edit User Assignment";
  }
  return "Assign KPI to Users";
});

const departmentSectionAssignmentColumns = ref([
  { title: "Assigned Unit", key: "assignedUnit", width: "30%" },
  { title: "Target Value", key: "targetValue", dataIndex: 'targetValue', width: "15%", align: 'right' },
  { title: "Latest Actual", key: "actual", dataIndex: 'latest_actual_value', width: "15%", align: 'right' },
  { title: "Status", key: "status", dataIndex: 'status', width: "15%", align: 'center' },
  { title: "Actions", key: "actions", align: "center", width: "100px" },
]);

const userAssignmentColumns = [
  {
    title: "User",
    key: "user",
    dataIndex: "user",
    width: "25%",
  },
  {
    title: "Target",
    key: "target",
    dataIndex: "target",
    align: "right",
    width: "25%",
  },
  {
    title: "Latest Actual",
    key: "actual",
    dataIndex: "latest_actual_value",
    align: "right",
    width: "20%",
  },
  {
    title: "Status",
    key: "status",
    dataIndex: "status",
    align: "center",
    width: "20%",
  },
  {
    title: "Actions",
    key: "actions",
    align: "center",
    width: "150px",
  },
];
const modalUserAssignmentInputColumns = [
  {
    title: "User",
    key: "user",
    width: "40%",
  },
  {
    title: "Target",
    key: "target",
    width: "30%",
  },
];


const getAssignmentStatusText = (status) => {
  if (status === KpiDefinitionStatus.APPROVED) return 'Active';
  if (status === KpiDefinitionStatus.DRAFT) return 'Inactive';
  return status || 'N/A';
};
const getAssignmentStatusColor = (status) => {
  if (status === KpiDefinitionStatus.APPROVED) return 'success';
  if (status === KpiDefinitionStatus.DRAFT) return 'default';
  return 'default';
};


const filteredAssignmentsForContextDepartment = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const deptIdContext = contextDepartmentId.value; 

  
  const sectionToDeptMap = new Map();
  allSections.value.forEach((section) => {
    const sectionId = section?.id;
    
    const deptId = section?.department?.id || section?.department_id;
    if (typeof sectionId === "number" && typeof deptId === "number") {
      sectionToDeptMap.set(sectionId, deptId);
    }
  });

  if (deptIdContext === null || deptIdContext === undefined || !Array.isArray(allAssignments)) {
    return [];
  }

  
  return allAssignments.filter((assign) => {
    if (assign.assigned_to_section !== null && assign.assigned_to_section !== undefined) {
      const sectionId = Number(assign.assigned_to_section);
      if (!isNaN(sectionId) && sectionToDeptMap.get(sectionId) === deptIdContext) {
        return true; 
      }
    }
    
    return false;
  });
});

const shouldShowDepartmentSectionAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;
  const hasDeptContext = !!contextDepartmentId.value;
  const hasSectionContext = !!contextSectionId.value;

  if (!kpi || hasSectionContext) {
    return false;
  }

  if (hasDeptContext) {
    return true;
  }

  if (
    kpi.created_by_type !== "company" &&
    kpi.created_by_type !== "department"
  ) {
    return false;
  }

  if (kpi.created_by_type === "department") {
    const deptHasSections = departmentHasSections.value;
    if (deptHasSections === null) {
      return false;
    }
    if (deptHasSections === false) {
      return false;
    }
  }
  return true;
});

const handleDeleteDepartmentSectionAssignment = async () => {
  if (
    !departmentSectionAssignmentToDelete.value ||
    !departmentSectionAssignmentToDelete.value.id
  ) {
    notification.error({
      message: "Error",
      description: "Cannot identify assignment to delete.",
    });
    return;
  }

  submittingDepartmentSectionDeletion.value = true;
  departmentSectionAssignmentError.value = null;

  const assignmentIdToDelete = departmentSectionAssignmentToDelete.value.id;
  const kpiIdForRefresh = kpiId.value;

  try {
    await store.dispatch("kpis/deleteDepartmentSectionAssignment", {
      assignmentId: assignmentIdToDelete,
      kpiId: kpiIdForRefresh,
    });

    notification.success({ message: "Assignment deleted successfully!" });

    isDeleteDepartmentSectionAssignmentModalVisible.value = false;
    departmentSectionAssignmentToDelete.value = null;

    await loadDetail();
  } catch (error) {
    console.error("Failed to delete Department/Section assignment:", error);
    const errorMessage =
      store.getters["kpis/error"] ||
      error.message ||
      "Failed to delete assignment.";
    departmentSectionAssignmentError.value = errorMessage;
    notification.error({
      message: "Deletion Failed",
      description: errorMessage,
    });
  } finally {
    submittingDepartmentSectionDeletion.value = false;
  }
};

const handleSaveDepartmentSectionAssignment = async () => {
  const isEditing = !!editingDepartmentSectionAssignment.value;
  const hasContext = !!contextDepartmentId.value;

  if (
    hasContext &&
    !isEditing &&
    !departmentSectionAssignmentForm.assigned_to_section
  ) {
    departmentSectionAssignmentError.value =
      "Please select a Section to assign within this Department.";
    return;
  }

  submittingDepartmentSectionAssignment.value = true;
  departmentSectionAssignmentError.value = null;

  try {
    await departmentSectionAssignmentFormRef.value?.validate();

    if (
      departmentSectionAssignmentForm.targetValue === null ||
      typeof departmentSectionAssignmentForm.targetValue === "undefined"
    ) {
      departmentSectionAssignmentError.value = "Target value is required.";
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    let assignmentPayload = {
      assignmentId: departmentSectionAssignmentForm.assignmentId,
      assigned_to_department: null,
      assigned_to_section: null,
      targetValue: Number(departmentSectionAssignmentForm.targetValue),
    };

    if (isEditing) {
      assignmentPayload.assigned_to_department =
        editingDepartmentSectionAssignment.value.assigned_to_department;
      assignmentPayload.assigned_to_section =
        editingDepartmentSectionAssignment.value.assigned_to_section;
    } else if (hasContext) {
      
      assignmentPayload.assigned_to_department = null; 
      assignmentPayload.assigned_to_section =
        departmentSectionAssignmentForm.assigned_to_section;
      assignmentPayload.status = kpiDetailData.value?.status; 
    } else {
      
      assignmentPayload.assigned_to_department =
        departmentSectionAssignmentForm.assigned_to_department || null;
      assignmentPayload.assigned_to_section =
        departmentSectionAssignmentForm.assigned_to_section || null;
      assignmentPayload.status = kpiDetailData.value?.status; 
    }
    if (
      !assignmentPayload.assigned_to_department &&
      !assignmentPayload.assigned_to_section
    ) {
      departmentSectionAssignmentError.value =
        "An assignment target (Department or Section) is required.";
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    const assignmentsArray = [assignmentPayload];

    await store.dispatch("kpis/saveDepartmentSectionAssignment", {
      kpiId: kpiId.value,
      assignmentsArray: assignmentsArray,
    });

    notification.success({
      message: isEditing
        ? "Assignment updated successfully!"
        : "Assignment added successfully!",
    });

    closeManageDepartmentSectionAssignments();
    await loadDetail();
  } catch (error) {
    console.error("Failed to save Department/Section assignment:", error);
    const errMsg =
      store.getters["kpis/departmentSectionAssignmentSaveError"] ||
      error?.response?.data?.message ||
      error?.message ||
      "Save Failed";
    departmentSectionAssignmentError.value = errMsg;
    if (error?.response?.data?.errors) {
      const fieldErrors = Object.values(error.response.data.errors).flat().join(' ');
      departmentSectionAssignmentError.value = `${errMsg}: ${fieldErrors}`;
    }
    notification.error({
      message: "Save Failed",
      description: errMsg,
    });
  } finally {
    submittingDepartmentSectionAssignment.value = false;
  }
};

const handleDepartmentSelectInModal = (departmentId) => {
  store.dispatch("sections/fetchSectionsByDepartment", departmentId);
};

const getStatusColor = (status) => {
  switch (status) {
    case KpiDefinitionStatus.APPROVED:
    case KpiValueStatus.APPROVED:
      return "success";
    case KpiDefinitionStatus.DRAFT:
    case KpiValueStatus.DRAFT:
    case KpiValueStatus.REJECTED_BY_SECTION:
    case KpiValueStatus.REJECTED_BY_DEPT:
    case KpiValueStatus.REJECTED_BY_MANAGER:
      return "error";
    case KpiValueStatus.PENDING_SECTION_APPROVAL:
    case KpiValueStatus.PENDING_DEPT_APPROVAL:
    case KpiValueStatus.PENDING_MANAGER_APPROVAL: 
      return "warning";
    default:
      if (status?.toLowerCase() === "active" || status?.toLowerCase() === "met" || status?.toLowerCase() === "exceeded") return "success";
      if (status?.toLowerCase() === "inactive" || status?.toLowerCase() === "rejected" || status?.toLowerCase() === "not met") return "error";
      if (status?.toLowerCase() === "pending" || status?.toLowerCase() === "in progress") return "processing"; 
      return "default";
  }
};


const ensureUserAssignmentDetail = (
  userId,
  initialTarget = null,
  initialWeight = null
) => {
  const key = String(userId);
  if (!userAssignmentDetails[key]) {
    userAssignmentDetails[key] = {
      target: initialTarget,
      weight: initialWeight,
    };
  }
};

const loadDetail = async () => {
  const id = kpiId.value;
  if (id && !isNaN(id)) {
    console.log(`KpiDetail: Fetching details for KPI ID: ${id}`);
    
    await store.dispatch("kpis/fetchKpiDetail", id);
    
    store.commit('kpis/SET_TOGGLE_KPI_STATUS_ERROR', null);
  } else {
    console.error("KpiDetail: Invalid KPI ID from route params:", route.params.id);
    
    
    
  }
};

const fetchKpiUserAssignmentsData = async (id) => {
  if (!id || typeof id !== "number") {
    console.error("fetchKpiUserAssignmentsData: Invalid ID.", id);
    store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
    return;
  }
  try {
    await store.dispatch("kpis/fetchKpiUserAssignments", id);
  } catch (error) {
    console.error("Error dispatching fetchKpiUserAssignments:", error);
    /* Lỗi đã được set trong store */
  }
};
const fetchAssignableUsersData = async () => {
  const kpi = kpiDetailData.value;

  let fetchedUsersList = [];

  assignableUsers.value = [];
  loadingAssignableUsers.value = true;
  userAssignmentSubmitError.value = null;

  try {
    if (contextSectionId.value) {
      await store.dispatch(
        "employees/fetchUsersBySection",
        contextSectionId.value
      );

      fetchedUsersList = store.getters["employees/usersBySection"](
        contextSectionId.value
      );
    } else if (
      kpi?.created_by_type === "department" &&
      kpi.created_by &&
      departmentHasSections.value === false
    ) {
      const departmentId = kpi.created_by;

      await store.dispatch("employees/fetchUsersByDepartment", departmentId);

      fetchedUsersList =
        store.getters["employees/usersByDepartment"](departmentId);
    }

    if (Array.isArray(fetchedUsersList)) {
      assignableUsers.value = fetchedUsersList;
    } else {
      console.error(
        "fetchAssignableUsersData: Fetched users list is NOT an array.",
        fetchedUsersList
      );
      assignableUsers.value = [];
      userAssignmentSubmitError.value = "Failed to process user list.";
    }
  } catch (err) {
    console.error(
      "fetchAssignableUsersData: Error during dispatch or getter access:",
      err
    );
    userAssignmentSubmitError.value =
      store.getters["employees/error"] ||
      err.message ||
      "Failed to load assignable users.";
    assignableUsers.value = [];
  } finally {
    loadingAssignableUsers.value = false;
  }
};

const openAssignUserModal = () => {
  isEditingUserAssignment.value = false;
  editingUserAssignmentRecord.value = null;
  selectedUserIds.value = [];
  Object.keys(userAssignmentDetails).forEach(
    (key) => delete userAssignmentDetails[key]
  );
  userAssignmentSubmitError.value = null;
  fetchAssignableUsersData("openAssignUserModal");
  isAssignUserModalVisible.value = true;
};

const openEditUserModal = (record) => {
  isEditingUserAssignment.value = true;
  editingUserAssignmentRecord.value = record;
  selectedUserIds.value = [record.employee.id];
  Object.keys(userAssignmentDetails).forEach(
    (key) => delete userAssignmentDetails[key]
  );
  ensureUserAssignmentDetail(record.employee.id, record.target, record.weight);
  userAssignmentSubmitError.value = null;
  isAssignUserModalVisible.value = true;
};
const closeAssignUserModal = () => {
  isAssignUserModalVisible.value = false;
  setTimeout(() => {
    isEditingUserAssignment.value = false;
    editingUserAssignmentRecord.value = null;
    selectedUserIds.value = [];
    Object.keys(userAssignmentDetails).forEach(
      (key) => delete userAssignmentDetails[key]
    );
    userAssignmentSubmitError.value = null;
    assignableUsers.value = [];
  }, 300);
};

const handleSaveUserAssignment = async () => {
  userAssignmentSubmitError.value = null;
  if (!isEditingUserAssignment.value && selectedUserIds.value.length === 0) {
    userAssignmentSubmitError.value = "Select user(s).";
    return;
  }
  let invalidDetail = false;
  const usersToValidate = isEditingUserAssignment.value
    ? [editingUserAssignmentRecord.value.employee.id]
    : selectedUserIds.value;
  usersToValidate.forEach((userId) => {
    const details = userAssignmentDetails[String(userId)];
    if (!details || details.target === null || details.target < 0) {
      invalidDetail = true;
    }
  });
  if (invalidDetail) {
    userAssignmentSubmitError.value = "Invalid Target.";
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
      const userId = editingUserAssignmentRecord.value.employee.id;
      const assignmentData = {
        target: userAssignmentDetails[String(userId)]?.target,
      };

      const weightForUpdate =
        editingUserAssignmentRecord.value?.weight ??
        kpiDetailData.value?.weight;

      const assignmentsPayload = {
        assignments: [
          {
            user_id: userId,
            target: assignmentData.target,
            weight: weightForUpdate,
          },
        ],
      };
      await store.dispatch("kpis/saveUserAssignments", {
        kpiId: currentKpiId,
        assignmentsPayload: assignmentsPayload,
      });
      notification.success({
        message: "Assignment updated!",
      });
    } else {
      const assignmentsPayload = {
        assignments: selectedUserIds.value.map((userId) => ({
          user_id: userId,
          target: userAssignmentDetails[String(userId)]?.target,
          weight: kpiDetailData.value?.weight,
          status: kpiDetailData.value?.status,
        })),
      };
      await store.dispatch("kpis/saveUserAssignments", {
        kpiId: currentKpiId,
        assignmentsPayload: assignmentsPayload,
      });
      notification.success({
        message: "Users assigned successfully!",
      });
    }
    closeAssignUserModal();
    await fetchKpiUserAssignmentsData(currentKpiId);
  } catch (err) {
    userAssignmentSubmitError.value =
      store.getters["kpis/assignmentError"] || err.message || "Failed to save.";
    notification.error({
      message: "Save Failed",
      description: userAssignmentSubmitError.value,
    });
  } finally {
    submittingUserAssignment.value = false;
  }
};
const confirmDeleteUserAssignment = (record) => {
  userAssignmentToDelete.value = record;
  isDeleteUserAssignModalVisible.value = true;
};
const handleDeleteUserAssignment = async () => {
  if (!userAssignmentToDelete.value || !userAssignmentToDelete.value.id) {
    notification.error({
      message: "Cannot delete: Missing assignment ID.",
    });
    return;
  }
  submittingUserDeletion.value = true;
  const assignmentIdToDelete = userAssignmentToDelete.value.id;
  const userName = `${userAssignmentToDelete.value.employee?.first_name || ""}
    ${userAssignmentToDelete.value.employee?.last_name || ""}`;
  const currentKpiId = kpiId.value;
  try {
    await store.dispatch("kpis/deleteUserAssignment", {
      kpiId: currentKpiId,
      assignmentId: assignmentIdToDelete,
    });
    notification.success({
      message: `Assignment
        for ${userName}
        removed.`,
    });
    isDeleteUserAssignModalVisible.value = false;
    userAssignmentToDelete.value = null;
    /* Action fetch lại */
  } catch (err) {
    notification.error({
      message: "Deletion Failed",
      description: store.getters["kpis/assignmentError"] || err.message,
    });
    isDeleteUserAssignModalVisible.value = false;
  } finally {
    submittingUserDeletion.value = false;
  }
};

const closeViewEvaluationModal = () => {
  isViewEvaluationModalVisible.value = false;
};

const closeCreateEvaluationModal = () => {
  isCreateEvaluationModalVisible.value = false;
};
const submitEvaluation = async () => {
  submittingEvaluation.value = true;
  try {
    const [startDate, endDate] = newEvaluation.value.period_dates || [];
    const payload = {
      ...newEvaluation.value,
      period_start_date: startDate?.toISOString(),
      period_end_date: endDate?.toISOString(),
    };
    delete payload.period_dates;

    await store.dispatch("evaluations/createEvaluation", payload);
    notification.success({
      message: "Evaluation created! (Placeholder)",
    });
    closeCreateEvaluationModal();
    await store.dispatch("kpis/fetchKpiDetail", kpiId.value);
  } catch (error) {
    notification.error({
      message: "Failed to create evaluation.",
    });
  } finally {
    submittingEvaluation.value = false;
  }
};

watch(
  kpiDetailData,
  async (newDetail, oldDetail) => {
    const newKpiId = newDetail?.id;
    const oldKpiId = oldDetail?.id;
    if (newKpiId && typeof newKpiId === "number" && newKpiId !== oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
      kpiEvaluations.value = newDetail.evaluations || [];
      try {
        await Promise.all([
          store.dispatch("sections/fetchSections", { forceRefresh: true }),
          store.dispatch("departments/fetchDepartments", {
            forceRefresh: true,
          }),
        ]);
      } catch (fetchError) {
        console.error("Error fetching all sections/departments:", fetchError);
        notification.error({
          message:
            "Could not load all sections/departments for assignment logic.",
        });
      }

      departmentHasSections.value = null;
      if (newDetail.created_by_type === "department" && newDetail.created_by) {
        const departmentId = newDetail.created_by;
        const allDepartmentsList = allDepartments.value;

        const kpiDepartment = Array.isArray(allDepartmentsList)
          ? allDepartmentsList.find((d) => d.id == departmentId)
          : undefined;

        if (kpiDepartment) {
          try {
            const sections = await store.dispatch("sections/fetchSections", {
              params: { department_id: departmentId },
              limit: 1,
              forceRefresh: true,
            });
            const sectionData =
              sections?.data?.data || sections?.data || sections;
            departmentHasSections.value =
              Array.isArray(sectionData) && sectionData.length > 0;
          } catch (e) {
            departmentHasSections.value = null;
            console.error(
              "Error checking sections for department:",
              departmentId,
              e
            );
          }
        } else {
          departmentHasSections.value = null;
        }
      } else {
        departmentHasSections.value = null;
      }

      await fetchKpiUserAssignmentsData(newKpiId);
    } else if (!newKpiId && oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
      kpiEvaluations.value = [];
      departmentHasSections.value = null;
    }
  },
  {
    deep: false,
  }
);

watch(
  selectedUserIds,
  (newUserIds, oldUserIds = []) => {
    if (isEditingUserAssignment.value) return;
    const newUserIdsSet = new Set(newUserIds.map(String));
    const oldUserIdsSet = new Set(oldUserIds.map(String));
    newUserIds.forEach((userId) => {
      ensureUserAssignmentDetail(String(userId));
    });
    oldUserIdsSet.forEach((oldUserId) => {
      if (!newUserIdsSet.has(oldUserId)) {
        delete userAssignmentDetails[oldUserId];
      }
    });
  },
  {
    deep: true,
  }
);

watch(kpiId, (newId, oldId) => {
  if (newId !== oldId && newId !== null && !isNaN(newId)) {
    loadDetail(); 
  }
});

onMounted(loadDetail);

</script>
<style scoped>
.ant-descriptions-item-label {
  font-weight: bold;
}

p {
  margin-bottom: 0.5em;
}
</style>
