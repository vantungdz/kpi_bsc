<template>
  <div>
    <a-card
      :title="`KPI Detail: ${kpiDetailData?.name || 'Loading...'}`"
      style="margin-bottom: 20px"
    >
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <template #title>
            <div
              style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
              "
            >
              <span> KPI Information </span>
              <a-button
                v-if="kpiDetailData?.id"
                @click="copyKpiAsTemplate"
                :disabled="loadingKpi"
              >
                Copy as Template
              </a-button>
            </div>
          </template>
          <a-descriptions-item label="ID">
            {{ kpiDetailData.id }}
          </a-descriptions-item>
          <a-descriptions-item label="Created By Type">
            {{ kpiDetailData.created_by_type || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Frequency">
            {{ kpiDetailData.frequency }}
          </a-descriptions-item>
          <a-descriptions-item label="Perspective">
            {{ kpiDetailData.perspective?.name || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Department">
            {{ kpiDetailData.department?.name || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Section">
            {{ kpiDetailData.section?.name || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Assigned To (Direct)">
            <span v-if="kpiDetailData.assignedTo">
              {{ kpiDetailData.assignedTo.first_name }}
              {{ kpiDetailData.assignedTo.last_name }}
            </span>
            <span v-else> N/A </span>
          </a-descriptions-item>
          <a-descriptions-item label="Unit">
            {{ kpiDetailData.unit || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Target">
            {{ kpiDetailData.target?.toLocaleString() ?? "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Weight (%)">
            {{ kpiDetailData.weight ?? "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Status">
            <a-tag :color="getStatusColor(kpiDetailData.status)">
              {{ kpiDetailData.status || "N/A" }}
            </a-tag>
          </a-descriptions-item>
          <a-descriptions-item label="Description" :span="2">
            {{ kpiDetailData.description || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item label="Memo" :span="2">
            {{ kpiDetailData.memo || "N/A" }}
          </a-descriptions-item>
          <a-descriptions-item
            v-if="
              kpiDetailData.assignments && kpiDetailData.assignments.length > 0
            "
            label="Assigned Down To"
            :span="2"
          >
            <ul style="margin: 0; padding-left: 20px">
              <li v-for="assign in kpiDetailData.assignments" :key="assign.id">
                <span v-if="assign.department">
                  Dept: {{ assign.department.name }} (Target:
                  {{ assign.targetValue?.toLocaleString() ?? "N/A" }}) - Status:
                  {{ assign.status }}
                </span>
                <span v-else-if="assign.section">
                  Section: {{ assign.section.name }} (Target:
                  {{ assign.targetValue?.toLocaleString() ?? "N/A" }}) - Status:
                  {{ assign.status }}
                </span>
                <span v-else-if="assign.employee">
                  User: {{ assign.employee.first_name }} (Target:
                  {{ assign.targetValue?.toLocaleString() ?? "N/A" }}) - Status:
                  {{ assign.status }}
                </span>
                <span v-else-if="assign.team">
                  Team: {{ assign.team.name }} (Target:
                  {{ assign.targetValue?.toLocaleString() ?? "N/A" }}) - Status:
                  {{ assign.status }}
                </span>
                <span v-else>
                  Unassigned Type (Target:
                  {{ assign.targetValue?.toLocaleString() ?? "N/A" }}) - Status:
                  {{ assign.status }}
                </span>
              </li>
            </ul>
          </a-descriptions-item>
        </a-descriptions>
        <a-empty
          v-else-if="!loadingKpi"
          description="Could not load KPI Details."
        />
      </a-skeleton>

      <a-row
        v-if="shouldShowAssignmentStats"
        :gutter="12"
        style="
          margin-top: 16px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        "
      >
        <a-col :span="8">
          <a-statistic
            title="Overall Target"
            :value="overallTargetValueDetail"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="Total Assigned"
            :value="totalAssignedTargetDetail"
            :precision="2"
          />
        </a-col>
        <a-col :span="8">
          <a-statistic
            title="Remaining"
            :value="remainingTargetDetail"
            :precision="2"
            :value-style="isOverAssignedDetail ? { color: '#cf1322' } : {}"
          />
        </a-col>
      </a-row>
    </a-card>

    <a-card
      title="Manage Department/Section Assignments"
      style="margin-top: 20px"
      v-if="shouldShowDepartmentSectionAssignmentCard && canManageAssignments"
    >
      <template #extra>
        <a-button
          type="primary"
          @click="openManageDepartmentSectionAssignments"
        >
          <template #icon>
            <plus-outlined />
          </template>
          Add Assignment
        </a-button>
      </template>
      <a-skeleton
        :loading="loadingDepartmentSectionAssignments"
        active
        :paragraph="{ rows: 4 }"
      >
        <a-table
          :columns="departmentSectionAssignmentColumns"
          :data-source="currentDepartmentSectionAssignments"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'assignedUnit'">
              <span v-if="record.department"
                >{{ record.department.name }} (Department)</span
              >
              <span v-else-if="record.section"
                >{{ record.section.name }} (Section)</span
              >
              <span v-else-if="record.team">{{ record.team.name }} (Team)</span>
              <span v-else>N/A</span>
            </template>
            <template v-else-if="column.key === 'targetValue'">
              {{ record.targetValue?.toLocaleString() ?? "N/A" }}
              {{ kpiDetailData?.unit || "" }}
            </template>
            <template v-else-if="column.key === 'weight'">
              {{ record.weight ?? "N/A" }} %
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-tooltip title="Edit Assignment">
                  <a-button
                    type="primary"
                    ghost
                    shape="circle"
                    size="small"
                    @click="openEditDepartmentSectionAssignment(record)"
                  >
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button
                    danger
                    shape="circle"
                    size="small"
                    @click="confirmDeleteDepartmentSectionAssignment(record)"
                  >
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-show="
            currentDepartmentSectionAssignments.length === 0 &&
            !loadingDepartmentSectionAssignments
          "
          description="No department or section assignments yet."
        />
      </a-skeleton>
    </a-card>
    <a-card
      title="Manage Direct User Assignments"
      style="margin-top: 20px"
      v-if="shouldShowDirectUserAssignmentCard && canManageAssignments"
    >
      <template #extra>
        <a-button
          type="primary"
          @click="openAssignUserModal"
          :disabled="loadingUserAssignments || !kpiDetailData?.id"
        >
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </template>
      <a-skeleton
        :loading="loadingUserAssignments"
        active
        :paragraph="{ rows: 4 }"
      >
        <a-alert
          v-if="userAssignmentError"
          :message="userAssignmentError"
          type="error"
          show-icon
          closable
          @close="clearAssignmentError"
          style="margin-bottom: 16px"
        />
        <a-table
          v-show="filteredDirectUserAssignments.length > 0"
          :columns="userAssignmentColumns"
          :data-source="filteredDirectUserAssignments"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar
                :src="record.employee?.avatar_url"
                size="small"
                style="margin-right: 8px"
              >
                {{ record.employee?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.employee?.first_name }}
              {{ record.employee?.last_name }} ({{ record.employee?.username }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? "N/A" }}
              {{ kpiDetailData?.unit || "" }}
            </template>
            <template v-else-if="column.key === 'weight'">
              {{ record.weight ?? "N/A" }} %
            </template>
            <template v-else-if="column.key === 'actual'">
              {{ record.latest_actual_value?.toLocaleString() ?? "N/A" }}
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status || "N/A" }}
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
                    @click="openEditUserModal(record)"
                  >
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button
                    danger
                    shape="circle"
                    size="small"
                    @click="confirmDeleteUserAssignment(record)"
                  >
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-show="
            filteredDirectUserAssignments.length === 0 &&
            !loadingUserAssignments &&
            !userAssignmentError
          "
          description="No users have been directly assigned this KPI yet."
        />
      </a-skeleton>
    </a-card>

    <a-card
      title="Manage User Assignments"
      style="margin-top: 20px"
      v-if="shouldShowSectionUserAssignmentCard && canManageAssignments"
    >
      <template #extra>
        <a-button
          type="primary"
          @click="openAssignUserModal"
          :disabled="loadingUserAssignments || !kpiDetailData?.id"
        >
          <template #icon>
            <user-add-outlined />
          </template>
          Add/Edit User Assignment
        </a-button>
      </template>
      <a-skeleton
        :loading="loadingUserAssignments"
        active
        :paragraph="{ rows: 4 }"
      >
        <a-alert
          v-if="userAssignmentError"
          :message="userAssignmentError"
          type="error"
          show-icon
          closable
          @close="clearAssignmentError"
          style="margin-bottom: 16px"
        />
        <a-table
          v-show="filteredSectionUserAssignments.length > 0"
          :columns="userAssignmentColumns"
          :data-source="filteredSectionUserAssignments"
          row-key="id"
          size="small"
          bordered
          :pagination="false"
        >
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar
                :src="record.employee?.avatar_url"
                size="small"
                style="margin-right: 8px"
              >
                {{ record.employee?.first_name?.charAt(0) }}
              </a-avatar>
              {{ record.employee?.first_name }}
              {{ record.employee?.last_name }} ({{ record.employee?.username }})
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.targetValue?.toLocaleString() ?? "N/A" }}
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
                  <a-button
                    type="primary"
                    ghost
                    shape="circle"
                    size="small"
                    @click="openEditUserModal(record)"
                  >
                    <edit-outlined />
                  </a-button>
                </a-tooltip>
                <a-tooltip title="Delete Assignment">
                  <a-button
                    danger
                    shape="circle"
                    size="small"
                    @click="confirmDeleteUserAssignment(record)"
                  >
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty
          v-show="
            filteredSectionUserAssignments.length === 0 &&
            !loadingUserAssignments &&
            !userAssignmentError
          "
          description="No users have been assigned this KPI in this section yet."
        />
      </a-skeleton>
    </a-card>

    <a-card title="KPI Evaluations" style="margin-top: 20px">
      <a-button
        type="primary"
        style="margin-bottom: 10px"
        @click="openEvaluationModal"
        :loading="loadingUsersForEval"
        v-if="canEvaluateKpi"
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
                <a-avatar
                  :src="record.evaluator.avatar_url"
                  size="small"
                  style="margin-right: 8px"
                />
                {{ record.evaluator.first_name }}
                {{ record.evaluator.last_name }}
              </span>
              <span v-else> N/A </span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluatee'">
              <span v-if="record.evaluatee">
                <a-avatar
                  :src="record.evaluatee.avatar_url"
                  size="small"
                  style="margin-right: 8px"
                />
                {{ record.evaluatee.first_name }}
                {{ record.evaluatee.last_name }}
              </span>
              <span v-else> N/A </span>
            </template>
            <template v-else-if="column.dataIndex === 'evaluation_date'">
              {{
                record.evaluation_date
                  ? dayjs(record.evaluation_date).format("L")
                  : "N/A"
              }}
            </template>
            <template v-else-if="column.dataIndex === 'period'">
              {{
                record.period_start_date
                  ? dayjs(record.period_start_date).format("YYYY-MM-DD")
                  : "?"
              }}
              -
              {{
                record.period_end_date
                  ? dayjs(record.period_end_date).format("YYYY-MM-DD")
                  : "?"
              }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag
                :bordered="false"
                :color="getEvaluationStatusColor(record.status)"
              >
                {{ record.status || "N/A" }}
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
      @update:open="isViewEvaluationModalVisible = $event"
      title="KPI Evaluation Details"
      :width="1000"
      :footer="null"
      @cancel="closeViewEvaluationModal"
    >
      <a-descriptions
        bordered
        :column="2"
        v-if="selectedEvaluation.id"
        size="small"
      >
      </a-descriptions>
      <a-empty v-else description="Could not load evaluation details." />
      <template #footer>
        <a-button key="back" @click="closeViewEvaluationModal">
          Close
        </a-button>
      </template>
    </a-modal>

    <a-modal
      :open="isCreateEvaluationModalVisible"
      @update:open="isCreateEvaluationModalVisible = $event"
      title="Create KPI Evaluation"
      :width="600"
      @ok="submitEvaluation"
      @cancel="closeCreateEvaluationModal"
      :confirm-loading="submittingEvaluation"
    >
      <a-form layout="vertical" :model="newEvaluation"> </a-form>
    </a-modal>

    <a-modal
      :open="isAssignUserModalVisible"
      @update:open="isAssignUserModalVisible = $event"
      :title="assignUserModalTitle"
      @ok="handleSaveUserAssignment"
      @cancel="closeAssignUserModal"
      :confirm-loading="submittingUserAssignment"
      :width="800"
      :mask-closable="false"
      :keyboard="false"
      ok-text="Save"
      cancel-text="Cancel"
    >
      <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
        <a-descriptions
          v-if="
            isEditingUserAssignment && editingUserAssignmentRecord?.employee
          "
          :column="1"
          size="small"
          style="margin-bottom: 15px"
        >
          <a-descriptions-item label="User">
            <a-avatar
              :src="editingUserAssignmentRecord.employee?.avatar_url"
              size="small"
              style="margin-right: 8px"
            >
              {{ editingUserAssignmentRecord.employee?.first_name?.charAt(0) }}
            </a-avatar>
            {{ editingUserAssignmentRecord.employee?.first_name }}
            {{ editingUserAssignmentRecord.employee?.last_name }} ({{
              editingUserAssignmentRecord.employee?.username
            }})
          </a-descriptions-item>
        </a-descriptions>
        <a-form-item
          v-if="!isEditingUserAssignment"
          label="Select Users"
          required
        >
          <a-select
            v-model:value="selectedUserIds"
            mode="multiple"
            placeholder="Search and select users..."
            style="width: 100%; margin-bottom: 15px"
            show-search
            allow-clear
            :filter-option="
              (inputValue, option) =>
                option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >=
                0
            "
            :options="assignableUserOptions"
            :loading="loadingAssignableUsers"
          />
        </a-form-item>
        <h4 style="margin-bottom: 10px">Set Target & Weight:</h4>
        <a-table
          :columns="modalUserAssignmentInputColumns"
          :data-source="modalUserDataSource"
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
                v-model:value="userAssignmentDetails[record.userId].target"
                placeholder="Target"
                style="width: 100%"
                :min="0"
                :step="1"
              />
            </template>
          </template>
        </a-table>
        <div
          v-if="userAssignmentSubmitError"
          style="color: red; margin-top: 10px"
        >
          {{ userAssignmentSubmitError }}
        </div>
      </a-spin>
    </a-modal>

    <a-modal
      :open="isDeleteUserAssignModalVisible"
      @update:open="isDeleteUserAssignModalVisible = $event"
      title="Confirm Deletion"
      @ok="handleDeleteUserAssignment"
      @cancel="isDeleteUserAssignModalVisible = false"
      :confirm-loading="submittingUserDeletion"
      ok-text="Delete"
      cancel-text="Cancel"
      ok-type="danger"
    >
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

    <a-modal
      :open="isDepartmentSectionAssignmentModalVisible"
      @update:open="isDepartmentSectionAssignmentModalVisible = $event"
      :title="
        editingDepartmentSectionAssignment
          ? 'Edit Assignment'
          : 'Add Department/Section Assignment'
      "
      @ok="handleSaveDepartmentSectionAssignment"
      @cancel="closeManageDepartmentSectionAssignments"
      :confirm-loading="submittingDepartmentSectionAssignment"
      :width="600"
      :mask-closable="false"
      :keyboard="false"
      ok-text="Save"
      cancel-text="Cancel"
    >
      <a-spin
        :spinning="
          loadingDepartmentSectionAssignments ||
          submittingDepartmentSectionAssignment
        "
      >
        <a-form
          layout="vertical"
          :model="departmentSectionAssignmentForm"
          ref="departmentSectionAssignmentFormRef"
        >
          <a-form-item label="Assign To" required>
            <a-select
              v-model:value="
                departmentSectionAssignmentForm.assigned_to_department
              "
              placeholder="Select Department"
              style="width: 100%; margin-bottom: 10px"
              @change="handleDepartmentSelectInModal"
              :disabled="editingDepartmentSectionAssignment !== null"
            >
              <a-select-option value="" disabled
                >Select Department</a-select-option
              >
              <a-select-option
                v-for="dept in allDepartments"
                :key="dept.id"
                :value="dept.id"
              >
                {{ dept.name }}
              </a-select-option>
            </a-select>
            <a-form-item name="assigned_to_section">
              <a-select
                v-model:value="
                  departmentSectionAssignmentForm.assigned_to_section
                "
                placeholder="Select Section (Optional)"
                style="width: 100%"
                :disabled="
                  !departmentSectionAssignmentForm.assigned_to_department ||
                  editingDepartmentSectionAssignment !== null
                "
              >
                <a-select-option value="" disabled
                  >Select Section</a-select-option
                >
                <a-select-option
                  v-for="section in assignableSections"
                  :key="section.id"
                  :value="section.id"
                >
                  {{ section.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form-item>

          <a-form-item label="Target" required name="targetValue">
            <a-input-number
              v-model:value="departmentSectionAssignmentForm.targetValue"
              placeholder="Target"
              style="width: 100%"
              :min="0"
              :step="1"
            />
          </a-form-item>

          <div
            v-if="departmentSectionAssignmentError"
            style="color: red; margin-top: 10px"
          >
            {{ departmentSectionAssignmentError }}
          </div>
        </a-form>
      </a-spin>
    </a-modal>
    <a-modal
      :open="isDeleteDepartmentSectionAssignmentModalVisible"
      @update:open="isDeleteDepartmentSectionAssignmentModalVisible = $event"
      title="Confirm Deletion"
      @ok="handleDeleteDepartmentSectionAssignment"
      @cancel="isDeleteDepartmentSectionAssignmentModalVisible = false"
      :confirm-loading="submittingDepartmentSectionDeletion"
      ok-text="Delete"
      cancel-text="Cancel"
      ok-type="danger"
    >
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
// --- IMPORTS ---
import { ref, computed, watch, onMounted, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
// Import các component AntD cần thiết
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

// --- STORE, ROUTER, ROUTE INIT ---
const router = useRouter();
const store = useStore();
const route = useRoute();
const kpiId = computed(() => {
  const id = route.params.id;
  const parsedId = id ? parseInt(id, 10) : null;
  return !isNaN(parsedId) ? parsedId : null;
});

// --- STATE ---
// Lấy state từ store
const loadingKpi = computed(() => store.getters["kpis/isLoading"]);
const kpiDetailData = computed(() => {
  const kpi = store.getters["kpis/currentKpi"];
  console.log(">>> kpiDetailData computed evaluated. Value from getter:", kpi); // <-- LOG NÀY
  console.log(
    ">>> kpiDetailData computed evaluated. created_by_type:",
    kpi?.created_by_type
  ); // <-- LOG NÀY
  console.log(
    ">>> kpiDetailData computed evaluated. created_by:",
    kpi?.created_by
  ); // <-- LOG NÀY
  return kpi;
});
const allUserAssignmentsForKpi = computed(() => {
  const assignments = store.getters["kpis/currentKpiUserAssignments"];

  return assignments;
});

const loadingUserAssignments = computed(
  () => store.getters["kpis/isLoadingUserAssignments"]
);
const userAssignmentError = computed(
  () => store.getters["kpis/userAssignmentError"]
); // <<< Đổi tên getter cho đúng
const actualUser = computed(() => store.getters["auth/user"]);
const effectiveRole = computed(() => store.getters["auth/effectiveRole"]);
const loadingDepartmentSectionAssignments = computed(
  () => store.getters["kpis/isLoadingDepartmentSectionAssignments"] || false
); // Loading riêng cho fetch assignments loại này
const departmentSectionAssignmentError = computed(
  () => store.getters["kpis/departmentSectionAssignmentError"] || null
); // Lỗi riêng cho assignments loại này
const allDepartments = computed(
  () => store.getters["departments/departmentList"] || []
);
const allSections = computed(() => store.getters["sections/sectionList"] || []);

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
const isDepartmentSectionAssignmentModalVisible = ref(false);
const editingDepartmentSectionAssignment = ref(null);
const submittingDepartmentSectionAssignment = ref(false);
const isDeleteDepartmentSectionAssignmentModalVisible = ref(false); // State quản lý hiển thị modal xác nhận xóa
const departmentSectionAssignmentToDelete = ref(null); // Lưu bản ghi assignment cần xóa
const submittingDepartmentSectionDeletion = ref(false);
const departmentSectionAssignmentFormRef = ref(null);

const departmentSectionAssignmentForm = reactive({
  assigned_to_department: null,
  assigned_to_section: null,
  targetValue: null,
  assignmentId: null,
});

console.log("KPI Detail Data for Filtering Context:", kpiDetailData.value); // <-- LOG 1: Kiểm tra toàn bộ object KPI
console.log(
  "departmentHasSections.value (for filtering context):",
  departmentHasSections.value
); // <-- LOG 2: Kiểm tra biến departmentHasSections

const currentDepartmentSectionAssignments = computed(() => {
  // Lọc mảng kpiDetailData.assignments chỉ lấy các assignment có assigned_to_department HOẶC assigned_to_section khác null
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
  if (!selectedDepartmentIdInModal) {
    return [];
  }
  const sectionsForSelectedDept = store.getters[
    "sections/sectionsByDepartment"
  ](selectedDepartmentIdInModal);
  console.log(
    "assignableSections computed for dept:",
    selectedDepartmentIdInModal,
    "found sections:",
    sectionsForSelectedDept
  );
  return sectionsForSelectedDept;
});

const openManageDepartmentSectionAssignments = () => {
  // Reset form và state
  editingDepartmentSectionAssignment.value = null;
  departmentSectionAssignmentForm.assigned_to_department = null;
  departmentSectionAssignmentForm.assigned_to_section = null;
  departmentSectionAssignmentForm.targetValue = null;
  departmentSectionAssignmentForm.assignmentId = null;
  departmentSectionAssignmentError.value = null;

  isDepartmentSectionAssignmentModalVisible.value = true;
};

// Phương thức mở modal để sửa một assignment Department/Section hiện có
const openEditDepartmentSectionAssignment = (assignmentRecord) => {
  // Set state cho chế độ sửa
  editingDepartmentSectionAssignment.value = assignmentRecord;
  departmentSectionAssignmentForm.assigned_to_department =
    assignmentRecord.assigned_to_department;
  departmentSectionAssignmentForm.assigned_to_section =
    assignmentRecord.assigned_to_section;
  departmentSectionAssignmentForm.targetValue = assignmentRecord.targetValue;
  departmentSectionAssignmentForm.assignmentId = assignmentRecord.id;
  departmentSectionAssignmentError.value = null;

  // Mở modal
  isDepartmentSectionAssignmentModalVisible.value = true;

  // Có thể cần fetch danh sách departments và sections nếu chưa có
  // store.dispatch('departments/fetchDepartments');
  // store.dispatch('sections/fetchSections'); // Consider fetching all sections or only relevant ones
};

const closeManageDepartmentSectionAssignments = () => {
  isDepartmentSectionAssignmentModalVisible.value = false;
  // Reset state sau khi đóng modal (có thể dùng setTimeout nếu cần animation)
  setTimeout(() => {
    editingDepartmentSectionAssignment.value = null;
    departmentSectionAssignmentForm.assigned_to_department = null;
    departmentSectionAssignmentForm.assigned_to_section = null;
    departmentSectionAssignmentForm.targetValue = null;
    departmentSectionAssignmentForm.weight = null;
    departmentSectionAssignmentForm.assignmentId = null;
    departmentSectionAssignmentError.value = null;
  }, 300); // Giả định animation 300ms
};

const confirmDeleteDepartmentSectionAssignment = (assignmentRecord) => {
  departmentSectionAssignmentToDelete.value = assignmentRecord; // Lưu lại bản ghi cần xóa
  isDeleteDepartmentSectionAssignmentModalVisible.value = true; // Mở modal xác nhận
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
    assignments.forEach((assign) => {
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
  return parseFloat(
    (overallTargetValueDetail.value - totalAssignedTargetDetail.value).toFixed(
      5
    )
  );
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
  return (
    (kpi.created_by_type === "company" ||
      kpi.created_by_type === "department") &&
    (kpi.assignments?.length > 0 || overallTargetValueDetail.value > 0)
  );
});
// Quyền truy cập và quản lý
const canManageAssignments = computed(() => {
  // Thêm kiểm tra kpiDetailData có tồn tại không
  if (!kpiDetailData.value) return false;
  const result = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
  return result;
});
const canEvaluateKpi = computed(() => {
  // Thêm kiểm tra kpiDetailData có tồn tại không
  if (!kpiDetailData.value) return false;
  return ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
});
// Helper kiểm tra quyền sở hữu/quản lý
const isMyDepartment = (deptId) => {
  if (!deptId || !actualUser.value) return false;
  // Admin/Manager có thể quản lý mọi department
  if (["admin", "manager"].includes(actualUser.value?.role)) return true;
  // Department Lead chỉ quản lý department của mình
  if (
    actualUser.value?.role === "department" &&
    actualUser.value?.department_id === deptId
  )
    return true;
  // Các vai trò khác không được quản lý department khác department của mình (hoặc không quản lý department nào)
  return false;
};

const isMySection = (sectId) => {
  if (!sectId || !actualUser.value) return false;
  // Admin/Manager có thể quản lý mọi section
  if (["admin", "manager"].includes(actualUser.value?.role)) return true;
  // Section Lead chỉ quản lý section của mình
  if (
    actualUser.value?.role === "section" &&
    actualUser.value?.section_id === sectId
  )
    return true;
  // Department Lead có thể quản lý các section TRONG department của mình
  if (
    actualUser.value?.role === "department" &&
    actualUser.value?.department_id
  ) {
    const allSectionsList = allSections.value; // Lấy danh sách sections
    // Tìm section với sectId và kiểm tra department_id của nó
    return Array.isArray(allSectionsList)
      ? allSectionsList.some(
          (s) =>
            s.id == sectId && s.department_id === actualUser.value.department_id
        )
      : false;
  }
  // Các vai trò khác không được quản lý section khác section/department của mình
  return false;
};

// === LỌC USER ASSIGNMENTS PHÍA CLIENT ===
const filteredDirectUserAssignments = computed(() => {
  const kpi = kpiDetailData.value;
  const currentDeptId =
    kpi?.created_by_type === "department" ? kpi?.created_by : null;

  const userAssignments = allUserAssignmentsForKpi.value;

  if (
    !kpi ||
    kpi.created_by_type !== "department" ||
    departmentHasSections.value !== false ||
    !currentDeptId
  ) {
    return [];
  }

  if (!Array.isArray(userAssignments)) {
    console.error(
      "filteredDirectUserAssignments: userAssignments is NOT an array!",
      userAssignments
    );
    return [];
  }

  const result = userAssignments.filter((assign) => {
    // <<< LẶP QUA TỪNG ASSIGNMENT >>>
    // Kiểm tra đây có phải assignment gán cho employee không
    const isUserAssignment = assign.assigned_to_employee !== null;

    // <<< THAY ĐỔI CÁCH TRUY CẬP employeeDepartmentId và employeeHasSection >>>
    let employeeDepartmentId = undefined;
    let employeeHasSection = false;
    // Chỉ cố gắng lấy thông tin department/section nếu assignment là user assignment VÀ có object employee được load
    if (isUserAssignment && assign.employee) {
      employeeDepartmentId = assign.employee.department_id; // Truy cập trực tiếp department_id
      // Kiểm tra xem employee có thuộc section nào không
      employeeHasSection =
        assign.employee.sectionId !== null &&
        assign.employee.sectionId !== undefined;
      // console.log(`Debug: Found employee object. employee.department_id = ${assign.employee.department_id}, employee.sectionId = ${assign.employee.sectionId}`); // Debug thêm
    } else {
      // console.log(`Debug: Not a user assignment or employee object is null.`); // Debug thêm
    }
    // <<< KẾT THÚC THAY ĐỔI >>>

    const matchesDepartment = employeeDepartmentId === currentDeptId; // So sánh với Department ID của KPI (nên dùng === cho số)
    return isUserAssignment && matchesDepartment && !employeeHasSection; // Điều kiện lọc cuối cùng
  });

  console.log("filteredDirectUserAssignments: Filtered result:", result);

  return result;
});

const filteredSectionUserAssignments = computed(() => {
  console.log("--- Evaluating filteredSectionUserAssignments ---");
  const kpi = kpiDetailData.value;
  const userAssignments = allUserAssignmentsForKpi.value;
  if (!kpi || kpi.created_by_type !== "section") {
    return [];
  }
  const sectionId = kpi.created_by;
  if (!Array.isArray(userAssignments)) {
    console.error(
      "filteredSectionUserAssignments: userAssignments is NOT an array!",
      userAssignments
    );
    return [];
  }

  const result = userAssignments.filter((assign) => {
    // <<< LẶP QUA TỪNG ASSIGNMENT >>>

    // Kiểm tra đây có phải assignment gán cho employee không
    const isUserAssignment = assign.assigned_to_employee !== null;

    // <<< THAY ĐỔI CÁCH TRUY CẬP employeeSectionId >>>
    let employeeSectionId = undefined;
    // Chỉ cố gắng lấy employeeSectionId nếu assignment là user assignment VÀ có object employee được load
    if (isUserAssignment && assign.employee) {
      employeeSectionId = assign.employee.sectionId; // Truy cập trực tiếp sectionId
      // console.log(`Debug: Found employee object. employee.sectionId = ${assign.employee.sectionId}`); // Debug thêm
    } else {
      // console.log(`Debug: Not a user assignment or employee object is null.`); // Debug thêm
    }
    // <<< KẾT THÚC THAY ĐỔI >>>

    const matchesSection = employeeSectionId == sectionId; // So sánh với Section ID của KPI (vẫn dùng == cho linh hoạt)

    return isUserAssignment && matchesSection; // Trả về true nếu thỏa mãn điều kiện lọc
  });

  return result;
});

const shouldShowDirectUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;
  // Logs cũ (tùy chọn, giữ lại nếu muốn debug)

  // Check 1 (Đã điều chỉnh): KPI data phải load và phải là loại 'department'
  if (!kpi || kpi.created_by_type !== "department") {
    return false;
  }

  // KPI đã load và là loại "department"
  const departmentId = kpi.created_by; // Giả định created_by là ID của Department
  const allDepartmentsList = allDepartments.value;

  // Check 2 (Đã điều chỉnh): Tìm Department object tương ứng trong danh sách Departments của frontend
  // Nếu không tìm thấy department object cho ID từ created_by, coi như dữ liệu thiếu hoặc sai
  const kpiDepartment = Array.isArray(allDepartmentsList)
    ? allDepartmentsList.find((d) => d.id == departmentId)
    : undefined; // Dùng == để so sánh number/string

  if (!kpiDepartment) {
    return false;
  }

  // Check 3 (Giữ nguyên logic departmentHasSections)
  // Logic này phụ thuộc vào việc loadAssignmentsAndCheckStructure set departmentHasSections
  // (Code trong watcher đã được chỉnh để dùng created_by, nên phần này có thể hoạt động đúng)
  const deptHasSections = departmentHasSections.value;
  // Thêm kiểm tra nếu departmentHasSections đang null (chưa tính toán xong)
  if (deptHasSections === null) {
    return false; // Hoặc có thể hiện loading indicator
  }
  if (deptHasSections === true) {
    return false; // Card này chỉ cho department KHÔNG CÓ sections
  }

  // Check 4 (Giữ nguyên logic quyền)
  const isAllowedRole = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
  if (!isAllowedRole) {
    // Fail fast
    return false;
  }

  // Check 5 (Điều chỉnh logic quyền quản lý KPI cụ thể này)
  // Sử dụng thông tin department_id từ object kpiDepartment tìm được
  const canManageThis =
    ["admin", "manager"].includes(effectiveRole.value) ||
    (effectiveRole.value === "department" && isMyDepartment(departmentId)); // Dùng departmentId (created_by)

  // Final combination: KPI loại department, không có sections, user có quyền chung, user có quyền quản lý department này
  const finalResult =
    isAllowedRole && canManageThis && deptHasSections === false;

  return finalResult;
});

const shouldShowSectionUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;

  // Check 1 (Đã điều chỉnh): KPI data phải load và phải là loại 'section'
  // (Kết hợp check loại KPI vào đây luôn)
  if (!kpi || kpi.created_by_type !== "section") {
    return false;
  }

  // KPI đã load và là loại "section"
  const sectionId = kpi.created_by; // Giả định created_by là ID của Section
  const allSectionsList = allSections.value;

  // Check 2 (Đã điều chỉnh): Tìm Section object tương ứng trong danh sách Sections của frontend
  // Nếu không tìm thấy section object cho ID từ created_by, coi như dữ liệu thiếu hoặc sai
  const kpiSection = Array.isArray(allSectionsList)
    ? allSectionsList.find((s) => s.id == sectionId)
    : undefined; // Dùng == để so sánh number/string

  if (!kpiSection) {
    return false;
  }

  // Check 3 (Giữ nguyên logic quyền, nhưng dùng thông tin từ kpiSection tìm được)
  const isAllowedRole = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );

  // Check 4 (Điều chỉnh logic quyền quản lý KPI cụ thể này)
  // Sử dụng thông tin department_id từ object kpiSection tìm được
  const canManageThis =
    ["admin", "manager"].includes(effectiveRole.value) ||
    (effectiveRole.value === "department" &&
      isMyDepartment(kpiSection.department_id)) || // Dùng department_id TỪ SECTION tìm được
    (effectiveRole.value === "section" && isMySection(sectionId)); // Dùng sectionId (created_by)

  const finalResult = isAllowedRole && canManageThis; // isSectionType check đã kết hợp vào Check 1

  return finalResult;
});

// Quyền Approve/Reject (Placeholder)
// const isPendingForMyApproval = (assignmentRecord) => { console.warn("isPendingForMyApproval needs real data & logic"); return false; };
// const canApproveRejectAsDeptHead = computed(() => effectiveRole.value === 'department' && isMyDepartment(kpiDetailData.value?.department?.id));
// const canApproveRejectAsSectionLead = computed(() => effectiveRole.value === 'section' && isMySection(kpiDetailData.value?.section?.id));

// Options cho các select box
// const allUserList = computed(() => store.getters['employees/userList'] || []);
// const evaluationUserOptions = computed(() => allUserList.value.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.username})` })));
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
  }); // Map danh sách user đã lọc sang format options cho select box

  const result = filteredAssignableUsers.map((user) => ({
    value: user.id, // Giá trị option là ID user
    label: `${user.first_name || ""} ${user.last_name || ""} (${user.username})`, // Text hiển thị
    name: `${user.first_name || ""} ${user.last_name || ""}`, // Tên đầy đủ
    avatar_url: user?.avatar_url, // URL avatar
  }));

  console.log("assignableUserOptions: Output result (filtered):", result); // Log kết quả sau khi lọc
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
  if (isEditingUserAssignment.value) {
    return "Edit User Assignment";
  }
  if (kpiDetailData.value?.created_by_type === "section") {
    // Lấy ID của section tạo ra KPI
    const creatingSectionId = kpiDetailData.value.created_by; // Tìm đối tượng section trong danh sách tất cả sections
    const creatingSection = allSections.value.find(
      (section) => section.id == creatingSectionId
    ); // Sử dụng == để so sánh ID (number/string)
    // Lấy tên section, mặc định là 'N/A' nếu không tìm thấy
    const sectionName = creatingSection?.name || "N/A"; // Trả về tiêu đề với tên section
    return `Assign KPI to Users(Section: ${sectionName})`;
  }
  if (kpiDetailData.value?.created_by_type === "department") {
    // Tương tự, lấy tên department. Có thể bạn đã có thuộc tính department trên KPI detail
    // hoặc cần tìm department bằng kpiDetailData.value.created_by từ danh sách allDepartments
    // Dựa trên code hiện tại, giả định kpiDetailData.value.department?.name hoạt động
    return `Assign KPI Directly to Users(Dept: ${
      kpiDetailData.value.department?.name || "N/A"
    })`;
  }
  return "Assign KPI to Users"; // Tiêu đề mặc định cho các trường hợp khác
});

const departmentSectionAssignmentColumns = [
  {
    title: "Assigned Unit",
    key: "assignedUnit",
    width: "30%",
  },
  {
    title: "Target Value",
    key: "targetValue",
    width: "20%",
  },
  {
    title: "Status",
    key: "status",
    width: "15%",
  },
  {
    title: "Actions",
    key: "actions",
    align: "center",
    width: "100px", // Adjusted width
  },
];

// --- TABLE COLUMNS ---
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
  },
  {
    title: "Latest Actual",
    key: "actual",
    dataIndex: "latest_actual_value",
    align: "right",
  },
  {
    title: "Status",
    key: "status",
    dataIndex: "status",
    align: "center",
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
const evaluationColumns = [
  {
    title: "Evaluator",
    dataIndex: "evaluator",
    key: "evaluator",
  },
  {
    title: "Evaluatee",
    dataIndex: "evaluatee",
    key: "evaluatee",
  },
  {
    title: "Period",
    dataIndex: "period",
    key: "period",
  },
  {
    title: "Rating",
    dataIndex: "rating",
    key: "rating",
  },
  {
    title: "Date",
    dataIndex: "evaluation_date",
    key: "evaluation_date",
  },
  {
    title: "Status",
    dataIndex: "status",
    key: "status",
  },
  {
    title: "Actions",
    dataIndex: "actions",
    key: "actions",
  },
];

// --- METHODS ---

const shouldShowDepartmentSectionAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;
  // Logs cũ (tùy chọn, giữ lại nếu muốn debug)

  // Check 1 (Đã điều chỉnh): KPI data phải load và phải là loại 'company' HOẶC 'department'
  if (
    !kpi ||
    (kpi.created_by_type !== "company" && kpi.created_by_type !== "department")
  ) {
    return false;
  }

  // KPI đã load và là loại "company" hoặc "department"
  const createdByType = kpi.created_by_type;

  // Check 2 (Điều chỉnh): Xác định đơn vị (Department) mà KPI này cho phép gán xuống
  let departmentId = null;
  let kpiDepartment = undefined;

  if (createdByType === "department") {
    // Nếu KPI loại department, đơn vị gốc để gán xuống là chính department đó
    departmentId = kpi.created_by; // Giả định created_by là ID của Department
    const allDepartmentsList = allDepartments.value;
    kpiDepartment = Array.isArray(allDepartmentsList)
      ? allDepartmentsList.find((d) => d.id == departmentId)
      : undefined;

    // Nếu là loại department nhưng không tìm thấy department object, coi như lỗi dữ liệu
    if (!kpiDepartment) {
      return false;
    }

    // Check 3 (Điều chỉnh cho KPI loại Department):
    // Card này chỉ hiện cho KPI loại Department NẾU Department đó CÓ sections
    const deptHasSections = departmentHasSections.value;
    if (deptHasSections === null) {
      return false; // Hoặc loading
    }
    if (deptHasSections === false) {
      return false; // Card này chỉ cho department CÓ sections
    }
  }
  // else if createdByType === 'company':
  // KPI loại Company có thể gán xuống bất kỳ Department/Section nào.
  // Check 3 không áp dụng cho loại Company.

  // Check 4 (Giữ nguyên logic quyền)
  const isAllowedRole = ["admin", "manager", "department", "section"].includes(
    effectiveRole.value
  );
  if (!isAllowedRole) {
    // Fail fast
    return false;
  }

  // Check 5 (Điều chỉnh logic quyền quản lý KPI cụ thể này)
  // Quyền dựa vào loại KPI:
  let canManageThis = false;
  if (createdByType === "company") {
    canManageThis = ["admin", "manager"].includes(effectiveRole.value);
  } else if (createdByType === "department" && kpiDepartment) {
    // KPI loại Department CÓ Sections: Quyền dựa vào department của KPIDepartment tìm được
    canManageThis =
      ["admin", "manager"].includes(effectiveRole.value) ||
      (effectiveRole.value === "department" && isMyDepartment(departmentId)); // Dùng departmentId (created_by)
  } else {
    return false;
  }

  const finalResult = isAllowedRole && canManageThis; // Check createdByType & deptHasSections đã làm ở trên

  return finalResult;
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
  const kpiIdForRefresh = kpiId.value; // Lấy KPI ID để refresh dữ liệu sau khi xóa

  try {
    await store.dispatch("kpis/deleteDepartmentSectionAssignment", {
      assignmentId: assignmentIdToDelete,
      kpiId: kpiIdForRefresh,
    });

    notification.success({ message: "Assignment deleted successfully!" });

    // Đóng modal xác nhận
    isDeleteDepartmentSectionAssignmentModalVisible.value = false;
    departmentSectionAssignmentToDelete.value = null; // Clear state

    // Refresh dữ liệu KPI Detail để bảng assignment cập nhật
    await loadInitialData(); // <== BỎ COMMENT DÒNG NÀY
  } catch (error) {
    console.error("Failed to delete Department/Section assignment:", error);
    const errorMessage =
      store.getters["kpis/error"] ||
      error.message ||
      "Failed to delete assignment."; // Lấy error chung hoặc specific error nếu có
    departmentSectionAssignmentError.value = errorMessage; // Hiển thị lỗi
    notification.error({
      message: "Deletion Failed",
      description: errorMessage,
    });
  } finally {
    submittingDepartmentSectionDeletion.value = false;
  }
};

const handleSaveDepartmentSectionAssignment = async () => {
  submittingDepartmentSectionAssignment.value = true;
  departmentSectionAssignmentError.value = null;

  try {
    await departmentSectionAssignmentFormRef.value?.validate();

    if (
      !departmentSectionAssignmentForm.assigned_to_department &&
      !departmentSectionAssignmentForm.assigned_to_section
    ) {
      departmentSectionAssignmentError.value =
        "Please select either a Department or a Section for assignment.";
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    // === CHỈNH SỬA: Xây dựng mảng các assignment data ===
    // Tạo mảng chứa dữ liệu assignment (chỉ có 1 item trong trường hợp modal này)
    const assignmentsArray = [
      {
        assignmentId: departmentSectionAssignmentForm.assignmentId, // Include ID for update case
        assigned_to_department:
          departmentSectionAssignmentForm.assigned_to_department || null,
        assigned_to_section:
          departmentSectionAssignmentForm.assigned_to_section || null,
        targetValue: Number(departmentSectionAssignmentForm.targetValue),
        // weight property removed previously - ADD BACK IF NEEDED BY BACKEND
        // weight: Number(departmentSectionAssignmentForm.weight), // Nếu backend save cần weight
        // assignedFrom, assignedBy, status, kpiId nên được set bởi backend service
      },
    ];
    // ==================================================

    // === CHỈNH SỬA: Dispatch store action với payload khớp signature action ===
    // Pass kpiId và mảng assignment data dưới key 'assignmentsArray'
    await store.dispatch("kpis/saveDepartmentSectionAssignment", {
      kpiId: kpiId.value, // Truyền kpiId riêng
      assignmentsArray: assignmentsArray, // <== Pass mảng assignment data dưới key 'assignmentsArray'
    });
    // ==================================================================

    notification.success({
      message: editingDepartmentSectionAssignment.value
        ? "Assignment updated successfully!"
        : "Assignment added successfully!",
    });

    closeManageDepartmentSectionAssignments();
    await loadInitialData();
  } catch (error) {
    console.error("Failed to save Department/Section assignment:", error);
    await store.dispatch(
      "kpis/SET_DEPARTMENT_SECTION_ASSIGNMENT_SAVE_ERROR",
      error
    ); // Sử dụng mutation error riêng
    // notification error có thể dùng error message từ getter
    notification.error({
      message: "Save Failed",
      description: store.getters["kpis/departmentSectionAssignmentSaveError"],
    }); // Lấy message từ getter lỗi riêng
  } finally {
    submittingDepartmentSectionAssignment.value = false;
  }
};

const handleDepartmentSelectInModal = (departmentId) => {
  store.dispatch("sections/fetchSectionsByDepartment", departmentId);
};

const getStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "active":
    case "approved":
    case "met":
    case "exceeded":
      return "success";
    case "inactive":
    case "rejected":
    case "not met":
      return "error";
    case "pending section approval":
    case "pending dept approval":
    case "pending owner approval":
    case "pending":
    case "draft":
      return "warning";
    case "in progress":
      return "processing";
    default:
      return "default";
  }
}; // Thêm draft vào warning
const getEvaluationStatusColor = (status) => {
  switch (status?.toLowerCase()) {
    case "met":
    case "exceeded":
      return "success";
    case "not met":
      return "error";
    case "in progress":
      return "processing";
    case "not started":
      return "default";
    default:
      return "default";
  }
};
// Hàm getAssignmentUnitName bị báo unused -> Xóa nếu không dùng ở đâu khác
// const getAssignmentUnitName = (kpi) => { if (!kpi) return 'N/A'; if (kpi.section) return `Section: ${kpi.section.name}`; if (kpi.department) return `Department: ${kpi.department.name}`; return 'KPI not assigned to specific unit'; };
// const calculateProgress = (current, target) => { const currentValue = parseFloat(current); const targetValue = parseFloat(target); if (isNaN(currentValue) || isNaN(targetValue) || targetValue === 0) return 0; const percent = (currentValue / targetValue) * 100; return parseFloat(Math.min(percent, 100).toFixed(2)); };
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

// Fetch data methods
const loadInitialData = async () => {
  const currentKpiId = kpiId.value;
  if (!currentKpiId) {
    notification.error({
      message: "Invalid KPI ID in URL.",
    });
    return;
  }
  try {
    await store.dispatch("kpis/fetchKpiDetail", currentKpiId); // Action này đã set loadingKpi
    // Watcher sẽ lo việc gọi loadAssignmentsAndCheckStructure
    loadingUsersForEval.value = true;
    await store.dispatch("employees/fetchUsers", {
      params: {},
    });
  } catch (error) {
    notification.error({
      message: `Failed to load initial KPI data: ${
        error.message || "Unknown error"
      }`,
    });
    console.error("Error loading initial data:", error);
  } finally {
    loadingUsersForEval.value = false;
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
  console.log(">>> fetchAssignableUsersData function started <<<");
  const kpi = kpiDetailData.value;

  let fetchedUsersList = [];

  assignableUsers.value = [];
  loadingAssignableUsers.value = true;
  userAssignmentSubmitError.value = null;

  try {
    // Case 1: KPI loại Section
    if (kpi?.created_by_type === "section" && kpi.created_by) {
      const sectionId = kpi.created_by;
      console.log(
        `WorkspaceAssignableUsersData: Dispatching fetchUsersBySection for section ${sectionId}...`
      );
      // Đợi action hoàn thành, action này sẽ commit dữ liệu vào state
      await store.dispatch("employees/fetchUsersBySection", sectionId);
      console.log(
        `WorkspaceAssignableUsersData: Dispatch fetchUsersBySection finished.`
      );
      // Lấy dữ liệu từ getter sau khi action đã commit
      fetchedUsersList = store.getters["employees/usersBySection"](sectionId);
      console.log(
        `WorkspaceAssignableUsersData: Data fetched from getter 'usersBySection':`,
        fetchedUsersList
      ); // <-- LOG 1
    }
    // Case 2: KPI loại Department VÀ Department đó KHÔNG có sections
    else if (
      kpi?.created_by_type === "department" &&
      kpi.created_by &&
      departmentHasSections.value === false
    ) {
      const departmentId = kpi.created_by;
      console.log(
        `WorkspaceAssignableUsersData: Dispatching fetchUsersByDepartment for department ${departmentId}...`
      );
      await store.dispatch("employees/fetchUsersByDepartment", departmentId);
      console.log(
        `WorkspaceAssignableUsersData: Dispatch fetchUsersByDepartment finished.`
      );
      fetchedUsersList =
        store.getters["employees/usersByDepartment"](departmentId);
      console.log(
        `WorkspaceAssignableUsersData: Data fetched from getter 'usersByDepartment':`,
        fetchedUsersList
      ); // <-- LOG 2
    }
    // Case 3: KPI loại Company (hoặc các loại khác cần fetch tất cả users?)
    // Dựa trên code bạn, trường hợp này có vẻ đang không được xử lý để fetch user cụ thể?
    // Cần xem xét logic này dựa trên yêu cầu nghiệp vụ của bạn.
    // Tạm thời, nếu kpi.created_by_type === 'company', có thể bạn muốn fetch TẤT CẢ users hoặc user có thể gán?
    // if (kpi?.created_by_type === 'company') {
    //   await store.dispatch('employees/fetchUsers'); // Fetch tất cả users
    //   fetchedUsersList = store.getters['employees/userList'];
    //   console.log('fetchAssignableUsersData: Data fetched from getter userList:', fetchedUsersList);
    // }

    console.log(
      "fetchAssignableUsersData: Final fetchedUsersList before assignment:",
      fetchedUsersList
    ); // <-- LOG 3
    if (Array.isArray(fetchedUsersList)) {
      assignableUsers.value = fetchedUsersList;
      console.log(
        "fetchAssignableUsersData: assignableUsers.value AFTER assignment:",
        assignableUsers.value
      ); // <-- LOG 4
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
    console.log("fetchAssignableUsersData: Finally block executed.");
  }
};

// User Assignment Methods (GỌI ACTION THẬT)
const openAssignUserModal = () => {
  isEditingUserAssignment.value = false; // Chế độ thêm mới
  editingUserAssignmentRecord.value = null; // <<< Khởi tạo selectedUserIds.value là mảng rỗng để input select trống >>>

  selectedUserIds.value = []; // Reset userAssignmentDetails (dữ liệu target/weight cho từng user được chọn)

  Object.keys(userAssignmentDetails).forEach(
    (key) => delete userAssignmentDetails[key]
  ); // Bạn có thể muốn pre-fill target/weight mặc định cho user mới ở đây nếu cần
  userAssignmentSubmitError.value = null;
  isAssignUserModalVisible.value = true; // Fetch danh sách các user có thể gán (để hiển thị trong dropdown select)

  fetchAssignableUsersData();
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
      console.warn("Need specific 'updateUserAssignment' action/API.");
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

// === Approval Methods (Placeholder) ===
// const handleApprove = async (record) => { console.warn("Approve action needs real API call & logic", record); notification.info({ message: "Approve action not implemented." }) };
// const handleReject = async (record) => { console.warn("Reject action needs real API call & logic", record); notification.info({ message: "Reject action not implemented." }) };

// --- Evaluations Methods ---
const viewEvaluation = (record) => {
  selectedEvaluation.value = record;
  isViewEvaluationModalVisible.value = true;
};
const closeViewEvaluationModal = () => {
  isViewEvaluationModalVisible.value = false;
};
const openEvaluationModal = () => {
  newEvaluation.value = {
    kpi_id: kpiId.value,
    evaluator_id: actualUser.value?.id,
    evaluatee_id: null,
  };
  isCreateEvaluationModalVisible.value = true;
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
    console.warn(
      "Store action 'evaluations/createEvaluation' needs implementation."
    );
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

// --- WATCHERS ---
// Watcher chính để load assignment khi kpiDetailData thay đổi
watch(
  kpiDetailData,
  async (newDetail, oldDetail) => {
    const newKpiId = newDetail?.id;
    const oldKpiId = oldDetail?.id;
    if (newKpiId && typeof newKpiId === "number" && newKpiId !== oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []); // Reset assignments trước
      kpiEvaluations.value = newDetail.evaluations || []; // Cập nhật evaluations từ detail mới

      // === Cần đảm bảo fetch all sections và all departments ở đây hoặc global ===
      // Logic adjusted computed properties relies on these lists
      try {
        // Cần action trong sections store để fetch ALL sections
        // Cần action trong departments store để fetch ALL ALL departments
        // Sử dụng Promise.all để chạy song song nếu API cho phép
        await Promise.all([
          store.dispatch("sections/fetchSections", { forceRefresh: true }), // Giả định action này fetch ALL sections khi KHÔNG có params
          store.dispatch("departments/fetchDepartments", {
            forceRefresh: true,
          }), // Giả định action này fetch ALL departments
        ]);
      } catch (fetchError) {
        console.error("Error fetching all sections/departments:", fetchError);
        notification.error({
          message:
            "Could not load all sections/departments for assignment logic.",
        });
      }

      // === Logic kiểm tra departmentHasSections (CẦN ĐIỀU CHỈNH logic tính toán) ===
      // Logic này được dùng bởi shouldShowDirectUserAssignmentCard và shouldShowDepartmentSectionAssignmentCard (loại department)
      // Nó cần xác định Department object của KPI trước (dùng created_by)
      // Và sau đó fetch section con DỰA TRÊN Department object đó.
      departmentHasSections.value = null; // Reset
      if (newDetail.created_by_type === "department" && newDetail.created_by) {
        const departmentId = newDetail.created_by; // Giả định created_by là Department ID
        const allDepartmentsList = allDepartments.value;
        // Tìm Department object TỪ allDepartments list
        const kpiDepartment = Array.isArray(allDepartmentsList)
          ? allDepartmentsList.find((d) => d.id == departmentId)
          : undefined;

        if (kpiDepartment) {
          // Chỉ fetch sections nếu tìm thấy Department object
          try {
            // Gọi action fetchSections VỚI params department_id
            // Payload params cần là { params: { department_id: departmentId } }
            const sections = await store.dispatch("sections/fetchSections", {
              params: { department_id: departmentId }, // Filter theo departmentId
              limit: 1, // Chỉ cần check có tồn tại section nào không
              forceRefresh: true, // Luôn fetch mới khi check cấu trúc
            });
            // Check response structure - assuming action returns array or data.data array
            const sectionData =
              sections?.data?.data || sections?.data || sections; // Handle potential nested data
            departmentHasSections.value =
              Array.isArray(sectionData) && sectionData.length > 0;
          } catch (e) {
            departmentHasSections.value = null;
            console.error(
              "Error checking sections for department:",
              departmentId,
              e
            );
            // notification.error({ message: "Could not determine department structure." }); // Tránh spam noti nếu lỗi
          }
        } else {
          departmentHasSections.value = null;
        }
      } else {
        // Không áp dụng cho các level khác hoặc created_by thiếu
        departmentHasSections.value = null;
      }

      // === Fetch user assignments SAU khi data chính load ===
      await fetchKpiUserAssignmentsData(newKpiId);
    } else if (!newKpiId && oldKpiId) {
      store.commit("kpis/SET_KPI_USER_ASSIGNMENTS", []);
      kpiEvaluations.value = [];
      departmentHasSections.value = null;
      // Có thể cần reset allSections / allDepartments nếu chỉ fetch cho trang này
    }
  },
  {
    deep: false,
  }
);

watch(
  kpiDetailData,
  (newValue) => {
    console.log("kpiDetailData watcher: New value:", newValue); // <-- LOG WATCHER 1
    console.log(
      "kpiDetailData watcher: New value created_by_type:",
      newValue?.created_by_type
    ); // <-- LOG WATCHER 2
    console.log(
      "kpiDetailData watcher: New value created_by:",
      newValue?.created_by
    ); // <-- LOG WATCHER 3
  },
  { deep: true }
);

// Watcher cho modal user assignment
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

// --- LIFECYCLE HOOK ---
onMounted(async () => {
  await loadInitialData(); // Gọi hàm load data tổng hợp
  console.log("onMounted: Initial kpiDetailData.value:", kpiDetailData.value); // <-- LOG ONMOUNTED 1
  console.log(
    "onMounted: Initial kpiDetailData.value.created_by_type:",
    kpiDetailData.value?.created_by_type
  ); // <-- LOG ONMOUNTED 2
  console.log(
    "onMounted: Initial kpiDetailData.value.created_by:",
    kpiDetailData.value?.created_by
  ); // <-- LOG ONMOUNTED 3
});
</script>
<style scoped>
.ant-descriptions-item-label {
  font-weight: bold;
}
p {
  margin-bottom: 0.5em;
}
</style>
