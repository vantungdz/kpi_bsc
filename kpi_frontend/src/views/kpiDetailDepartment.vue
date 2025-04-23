<template>
  <div>
    <a-card :title="`KPI Detail (Department View): ${kpiDetailData?.name || 'Loading...'}`" style="margin-bottom: 20px">
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <a-descriptions-item label="ID">{{ kpiDetailData.id }}</a-descriptions-item>
          <a-descriptions-item label="Frequency">{{ kpiDetailData.frequency }}</a-descriptions-item>
          <a-descriptions-item label="Description" :span="2">{{ kpiDetailData.description }}</a-descriptions-item>
          <a-descriptions-item label="Perspective">{{ kpiDetailData.perspective?.name || 'N/A' }}</a-descriptions-item>
          <a-descriptions-item label="Assigned To Unit">{{ getAssignmentUnitName(kpiDetailData) }}</a-descriptions-item>
          <a-descriptions-item label="Unit">{{ kpiDetailData.unit || 'N/A' }}</a-descriptions-item>
          <a-descriptions-item label="Department Target">{{ kpiDetailData.target?.toLocaleString() ?? 'N/A'
            }}</a-descriptions-item>
          <a-descriptions-item label="Weight (%)">{{ kpiDetailData.weight ?? 'N/A' }}</a-descriptions-item>
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

    <a-card v-if="departmentHasSections === true && canManageAssignments" title="Section Assignments"
      style="margin-top: 20px">
      <div style="margin-bottom: 16px; text-align: right">
        <a-button type="primary" :disabled="loadingSectionAssignments || !isKpiAssignableToSections"
          @click="openAssignSectionModal">
          <template #icon><apartment-outlined /></template>
          Assign/Edit Section Targets
        </a-button>
      </div>
      <a-skeleton :loading="loadingSectionAssignments" active :paragraph="{ rows: 4 }">
        <a-table v-show="sectionAssignments.length > 0" :columns="sectionAssignmentColumns"
          :data-source="sectionAssignments" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'section'">
              {{ record.section?.name || 'N/A' }}
            </template>
            <template v-else-if="column.key === 'target'">
              {{ record.target?.toLocaleString() ?? 'N/A' }}
              {{ kpiDetailData?.unit || '' }}
            </template>
            <template v-else-if="column.key === 'weight'">
              {{ record.weight ?? 'N/A' }} %
            </template>
            <template v-else-if="column.key === 'status'">
              <a-tag :color="getStatusColor(record.status)">
                {{ record.status || 'N/A' }}
              </a-tag>
            </template>
            <template v-else-if="column.key === 'actions'">
              <a-space>
                <a-tooltip title="Remove Section Assignment">
                  <a-button danger shape="circle" size="small" @click="confirmDeleteSectionAssignment(record)">
                    <delete-outlined />
                  </a-button>
                </a-tooltip>
              </a-space>
            </template>
          </template>
        </a-table>
        <a-empty v-show="sectionAssignments.length === 0"
          description="This KPI has not been assigned to any sections in this department yet." />
      </a-skeleton>
    </a-card>

    <a-card title="Direct User Assignments" style="margin-top: 20px;"
      v-else-if="departmentHasSections === false && canManageAssignments">
      <div style="margin-bottom: 16px; text-align: right;">
        <a-button type="primary" @click="openAssignUserModal"
          :disabled="loadingUserAssignments || !isKpiAssignableToUsers">
          <template #icon><user-add-outlined /></template>
          Add/Edit User Assignment
        </a-button>
      </div>
      <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
        <a-table v-show="userAssignments.length > 0" :columns="userAssignmentColumns" :data-source="userAssignments"
          row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'"> <a-avatar :src="record.user?.avatar_url" size="small"
                style="margin-right: 8px;">{{ record.user?.first_name?.charAt(0) }}</a-avatar> {{
                  record.user?.first_name }} {{ record.user?.last_name }} ({{ record.user?.username }}) </template>
            <template v-else-if="column.key === 'target'"> {{ record.target?.toLocaleString() ?? 'N/A' }} {{
              kpiDetailData?.unit || '' }} </template>
            <template v-else-if="column.key === 'weight'"> {{ record.weight ?? 'N/A' }} % </template>
            <template v-else-if="column.key === 'actual'"> {{ record.latest_actual_value?.toLocaleString() ?? 'N/A' }}
            </template>
            <template v-else-if="column.key === 'status'"> <a-tag :color="getStatusColor(record.status)">{{
              record.status || 'N/A' }}</a-tag> </template>
            <template v-else-if="column.key === 'actions'"> <a-space> <a-tooltip title="Edit Assignment"> <a-button
                    type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                    <edit-outlined /> </a-button> </a-tooltip> <a-tooltip title="Delete Assignment"> <a-button danger
                    shape="circle" size="small" @click="confirmDeleteUserAssignment(record)"> <delete-outlined />
                  </a-button> </a-tooltip> </a-space> </template>
          </template>
        </a-table>
        <a-empty v-show="userAssignments.length === 0"
          description="No users have been directly assigned this KPI in this department yet." />
      </a-skeleton>
    </a-card>

    <a-alert message="Checking department structure..." type="info"
      v-if="departmentHasSections === null && canManageAssignments" style="margin-top: 20px;"></a-alert>


    <a-card title="KPI Evaluations" style="margin-top: 20px">
      <a-button type="primary" style="margin-bottom: 10px" :loading="loadingUsersForEval" @click="openEvaluationModal">
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
              {{ record.period_start_date ? dayjs(record.period_start_date).format('YYYY-MM-DD') : '?' }} -
              {{ record.period_end_date ? dayjs(record.period_end_date).format('YYYY-MM-DD') : '?' }}
            </template>
            <template v-else-if="column.dataIndex === 'status'">
              <a-tag :bordered="false" :color="getStatusColor(record.status)">
                {{ record.status || 'N/A' }}
              </a-tag>
            </template>
            <template v-else-if="column.dataIndex === 'actions'">
              <a-button type="link" @click="viewEvaluation(record)">View</a-button>
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

    <a-modal :open="isViewEvaluationModalVisible" title="KPI Evaluation Details" :width="1000" :footer="null"
      @update:open="isViewEvaluationModalVisible = $event" @cancel="closeViewEvaluationModal">
      <a-descriptions v-if="selectedEvaluation.id" bordered :column="2" size="small">
        <a-descriptions-item label="Evaluator">
          <span v-if="selectedEvaluation.evaluator">
            <a-avatar :src="selectedEvaluation.evaluator.avatar_url" size="small" style="margin-right: 8px" />
            {{ selectedEvaluation.evaluator.first_name }} {{ selectedEvaluation.evaluator.last_name }}
          </span>
          <span v-else>N/A</span>
        </a-descriptions-item>
        <a-descriptions-item label="Evaluatee">
          <span v-if="selectedEvaluation.evaluatee">
            <a-avatar :src="selectedEvaluation.evaluatee.avatar_url" size="small" style="margin-right: 8px" />
            {{ selectedEvaluation.evaluatee.first_name }} {{ selectedEvaluation.evaluatee.last_name }}
          </span>
          <span v-else>N/A</span>
        </a-descriptions-item>
        <a-descriptions-item label="Period">
          {{ selectedEvaluation.period_start_date ? dayjs(selectedEvaluation.period_start_date).format('YYYY-MM-DD') :
          '?'
          }} -
          {{ selectedEvaluation.period_end_date ? dayjs(selectedEvaluation.period_end_date).format('YYYY-MM-DD') : '?'
          }}
        </a-descriptions-item>
        <a-descriptions-item label="Evaluation Date">
          {{ selectedEvaluation.evaluation_date ? dayjs(selectedEvaluation.evaluation_date).format('L') : 'N/A' }}
        </a-descriptions-item>
        <a-descriptions-item label="Rating">{{
          selectedEvaluation.rating ?? 'N/A'
        }}</a-descriptions-item>
        <a-descriptions-item label="Status">
          <a-tag :bordered="false" :color="getStatusColor(selectedEvaluation.status)">
            {{ selectedEvaluation.status || 'N/A' }}
          </a-tag>
        </a-descriptions-item>
        <a-descriptions-item label="Comment" :span="2">{{
          selectedEvaluation.comments || 'N/A'
        }}</a-descriptions-item>
      </a-descriptions>
      <a-empty v-else description="Could not load evaluation details." />
      <template #footer>
        <a-button key="back" @click="closeViewEvaluationModal">Close</a-button>
      </template>
    </a-modal>

    <a-modal :open="isCreateEvaluationModalVisible" title="Create KPI Evaluation" :width="600"
      :confirm-loading="submittingEvaluation" @update:open="isCreateEvaluationModalVisible = $event"
      @ok="submitEvaluation" @cancel="closeCreateEvaluationModal">
      <a-form layout="vertical" :model="newEvaluation">
        <a-form-item label="Evaluator" name="evaluator_id"
          :rules="[{ required: true, message: 'Please select an evaluator!' }]">
          <a-select v-model:value="newEvaluation.evaluator_id" placeholder="Select Evaluator"
            :loading="loadingUsersForEval" show-search filter-option :options="evaluationUserOptions" />
        </a-form-item>
        <a-form-item label="Evaluatee" name="evaluatee_id"
          :rules="[{ required: true, message: 'Please select an evaluatee!' }]">
          <a-select v-model:value="newEvaluation.evaluatee_id" placeholder="Select Evaluatee"
            :loading="loadingUsersForEval" show-search filter-option :options="evaluationUserOptions" />
        </a-form-item>
        <a-form-item label="Status" name="status" :rules="[{ required: true, message: 'Please select a status!' }]">
          <a-select v-model:value="newEvaluation.status" placeholder="Select Status">
            <a-select-option value="Met">Met</a-select-option>
            <a-select-option value="Not Met">Not Met</a-select-option>
            <a-select-option value="In Progress">In Progress</a-select-option>
            <a-select-option value="Not Started">Not Started</a-select-option>
            <a-select-option value="Exceeded">Exceeded</a-select-option>
          </a-select>
        </a-form-item>
        <a-form-item label="Evaluation Period" name="period_dates"
          :rules="[{ required: true, message: 'Please select the evaluation period!' }]">
          <a-range-picker v-model:value="newEvaluation.period_dates" style="width: 100%" picker="date" />
        </a-form-item>
        <a-form-item label="Rating" name="rating">
          <a-input-number v-model:value="newEvaluation.rating" placeholder="Enter Rating" style="width: 100%" />
        </a-form-item>
        <a-form-item label="Comments" name="comments">
          <a-textarea v-model:value="newEvaluation.comments" rows="4" placeholder="Enter comments" />
        </a-form-item>
      </a-form>
    </a-modal>

    <a-modal :open="isAssignSectionModalVisible" @update:open="isAssignSectionModalVisible = $event"
      title="Assign KPI to Sections & Set Targets" @ok="handleSaveSectionAssignment" @cancel="closeAssignSectionModal"
      :confirm-loading="submittingSectionAssignment" :width="700" ok-text="Save Assignments" cancel-text="Cancel">
      <a-spin :spinning="loadingAssignableSections || submittingSectionAssignment">
        <p style="margin-bottom: 15px">
          Select sections within department
          <strong>{{ kpiDetailData?.department?.name }}</strong>
          and set their individual targets:
        </p>
        <a-table :columns="modalSectionAssignmentColumns" :data-source="assignableSections"
          :row-selection="rowSelectionConfig" row-key="id" size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'section'"> {{ record.name }} </template>
            <template v-if="column.key === 'target'">
              <a-input-number v-model:value="sectionAssignmentDetails[record.id].target" placeholder="Target"
                style="width: 100%" :min="0" :disabled="!selectedSectionIds.includes(record.id)"
                :formatter="(value) => `${value}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')"
                :parser="(value) => value.replace(/\$\s?|(,*)/g, '')" />
            </template>
          </template>
        </a-table>
        <div v-if="sectionAssignmentError" style="color: red; margin-top: 10px">
          {{ sectionAssignmentError }}
        </div>
      </a-spin>
    </a-modal>
    <a-modal :open="isDeleteSectionAssignModalVisible" @update:open="isDeleteSectionAssignModalVisible = $event"
      title="Confirm Removal" @ok="handleDeleteSectionAssignment" @cancel="isDeleteSectionAssignModalVisible = false"
      :confirm-loading="submittingSectionDeletion" ok-text="Remove" cancel-text="Cancel" ok-type="danger">
      <p v-if="sectionAssignmentToDelete?.section">
        Are you sure you want to remove the assignment for section
        <strong>{{ sectionAssignmentToDelete.section.name }}</strong>?
      </p>
      <p v-else>Are you sure you want to remove this section assignment?</p>
    </a-modal>
    <a-modal :open="isAssignUserModalVisible" @update:open="isAssignUserModalVisible = $event"
      :title="isEditingUserAssignment ? 'Edit User Assignment' : 'Assign KPI to Users (Direct)'"
      @ok="handleSaveUserAssignment" @cancel="closeAssignUserModal" :confirm-loading="submittingUserAssignment"
      :width="800" :mask-closable="false" :keyboard="false" ok-text="Save" cancel-text="Cancel">
      <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
        <a-descriptions v-if="isEditingUserAssignment && editingUserAssignmentRecord?.user" :column="1" size="small"
          style="margin-bottom: 15px;"> <a-descriptions-item label="User"> <a-avatar
              :src="editingUserAssignmentRecord.user.avatar_url" size="small" style="margin-right: 8px;">{{
                editingUserAssignmentRecord.user.first_name?.charAt(0) }}</a-avatar> {{
                editingUserAssignmentRecord.user.first_name }} {{ editingUserAssignmentRecord.user.last_name }} ({{
              editingUserAssignmentRecord.user.username }}) </a-descriptions-item> </a-descriptions>
        <a-form-item v-if="!isEditingUserAssignment" label="Select Users" required> <a-select
            v-model:value="selectedUserIds" mode="multiple" placeholder="Search and select users from the department..."
            style="width: 100%; margin-bottom: 15px;" show-search allow-clear
            :filter-option="(inputValue, option) => option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >= 0"
            :options="assignableUserOptions" :loading="loadingAssignableUsers" /> </a-form-item>
        <h4 style="margin-bottom: 10px;">Set Target & Weight:</h4>
        <a-table :columns="modalUserAssignmentInputColumns" :data-source="modalUserDataSource" row-key="userId"
          size="small" bordered :pagination="false">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'"> <a-avatar :src="record.avatar_url" size="small"
                style="margin-right: 8px;">{{ record.name?.charAt(0) }}</a-avatar> {{ record.name }} </template>
            <template v-if="column.key === 'target'"> <a-input-number
                v-model:value="userAssignmentDetails[record.userId].target" placeholder="Target" style="width: 100%"
                :min="0" :step="1" /> </template>
            <template v-if="column.key === 'weight'"> <a-input-number
                v-model:value="userAssignmentDetails[record.userId].weight" placeholder="Weight" style="width: 100%"
                :min="0" :max="100" :step="1" addon-after="%" /> </template>
          </template>
        </a-table>
        <div v-if="userAssignmentError" style="color: red; margin-top: 10px;">{{ userAssignmentError }}</div>
      </a-spin>
    </a-modal>
    <a-modal :open="isDeleteUserAssignModalVisible" @update:open="isDeleteUserAssignModalVisible = $event"
      title="Confirm Deletion" @ok="handleDeleteUserAssignment" @cancel="isDeleteUserAssignModalVisible = false"
      :confirm-loading="submittingUserDeletion" ok-text="Delete" cancel-text="Cancel" ok-type="danger">
      <p v-if="userAssignmentToDelete?.user">Are you sure you want to remove the assignment for user <strong>{{
        userAssignmentToDelete.user.first_name }} {{ userAssignmentToDelete.user.last_name }}</strong>?</p>
      <p v-else>Are you sure you want to delete this assignment?</p>
    </a-modal>
  </div>
</template>

<script setup>
// --- IMPORTS ---
import { ref, computed, onMounted, reactive } from 'vue';
import { useRoute } from 'vue-router';
import { useStore } from 'vuex';
import { notification, Descriptions as ADescriptions, DescriptionsItem as ADescriptionsItem, Form as AForm, FormItem as AFormItem, InputNumber as AInputNumber, Select as ASelect, SelectOption as ASelectOption, RangePicker as ARangePicker, Textarea as ATextarea, Avatar as AAvatar, Empty as AEmpty, Spin as ASpin, Modal as AModal, Table as ATable, Tag as ATag, Card as ACard, Skeleton as ASkeleton, Alert as AAlert, Button as AButton, Space as ASpace, Tooltip as ATooltip } from 'ant-design-vue'; // Import đầy đủ Ant components
import { EditOutlined, DeleteOutlined, UserAddOutlined, ApartmentOutlined } from '@ant-design/icons-vue';
import dayjs from 'dayjs';
import LocalizedFormat from 'dayjs/plugin/localizedFormat';
dayjs.extend(LocalizedFormat);

// --- STORE, ROUTER, ROUTE INIT ---
const store = useStore();
const route = useRoute();
const kpiId = computed(() => parseInt(route.params.id, 10));

// --- FAKE DATA GENERATION ---
const generateFakeUserData = (id, prefix, deptId, sectId = null) => ({ id: id, first_name: `${prefix}FN${id}`, last_name: `LN`, username: `${prefix.toLowerCase()}${id}`, avatar_url: null, section_id: sectId, department_id: deptId });
const allFakeUsers = [generateFakeUserData(1, 'Admin', null), generateFakeUserData(10, 'HeadD', 20), generateFakeUserData(11, 'HeadD', 30), generateFakeUserData(101, 'LeadS', 20, 101), generateFakeUserData(102, 'LeadS', 20, 102), generateFakeUserData(103, 'LeadS', 30, 103), generateFakeUserData(201, 'UserS', 20, 101), generateFakeUserData(202, 'UserS', 20, 101), generateFakeUserData(203, 'UserS', 20, 102), generateFakeUserData(301, 'UserD', 30, null), generateFakeUserData(302, 'UserD', 30, null)];
const allFakeSections = [{ id: 101, name: 'Sales Section Alpha', department_id: 20 }, { id: 102, name: 'Sales Section Beta', department_id: 20 }]; // Dept 30 không có section
const generateFakeKpiDetailDept = (id) => { const deptId = (id % 2 === 0) ? 20 : 30; const deptName = (deptId === 20) ? 'Sales Department' : 'Marketing Department'; return { id: id, name: `Dept KPI ${id}`, description: `Description for Dept KPI ${id}.`, frequency: 'Quarterly', perspective: { id: 2, name: 'Customer' }, assignment_level: 'department', section: null, department: { id: deptId, name: deptName }, assignedTo: null, unit: 'Point', target: 500 + id * 5, weight: 30 + (id % 3), status: id % 2 === 0 ? 'Active' : 'Pending', evaluations: [{ id: 10 * id + 5, evaluator: generateFakeUserData(1, 'Admin'), evaluatee: generateFakeUserData(10, 'HeadD'), evaluation_date: dayjs().subtract(2, 'month').toISOString(), period_start_date: dayjs().subtract(3, 'month').startOf('month').toISOString(), period_end_date: dayjs().subtract(3, 'month').endOf('month').toISOString(), rating: 5, status: 'Exceeded', comments: 'Excellent department results.' },] }; };
const generateFakeSectionAssignments = (kpiDetail) => { if (kpiDetail?.assignment_level !== 'department') return []; const deptId = kpiDetail.department.id; const sectionsInDept = allFakeSections.filter(s => s.department_id === deptId); return sectionsInDept.map(section => ({ id: kpiDetail.id * 10 + section.id, kpi_id: kpiDetail.id, section: section, target: Math.round(kpiDetail.target / sectionsInDept.length), weight: Math.round(100 / sectionsInDept.length), status: 'Pending', })); }; // Chia đều target/weight
const generateFakeUserAssignmentsForDept = (kpiDetail) => { if (kpiDetail?.assignment_level !== 'department') return []; const deptId = kpiDetail.department.id; const usersInDeptOnly = allFakeUsers.filter(u => u.department_id === deptId && u.section_id === null && !u.username.toLowerCase().includes('head')); return usersInDeptOnly.slice(0, 2).map((user, index) => ({ id: kpiDetail.id * 1000 + user.id, kpi_id: kpiDetail.id, user: user, target: Math.round(kpiDetail.target / (index + 1.5)), weight: Math.round(kpiDetail.weight / (index + 1.5)), latest_actual_value: Math.round(kpiDetail.target / (index + 1.5) * (0.7 + Math.random() * 0.5)), status: index === 0 ? 'Active' : 'Pending', })); };


// --- STATE ---
const loadingKpi = ref(true);
const kpiDetailData = ref(null);
const departmentHasSections = ref(null);
// Section Assignment State
const sectionAssignments = ref([]);
const loadingSectionAssignments = ref(false);
const isAssignSectionModalVisible = ref(false);
const assignableSections = ref([]);
const loadingAssignableSections = ref(false);
const selectedSectionIds = ref([]);
const sectionAssignmentDetails = reactive({});
const submittingSectionAssignment = ref(false);
const sectionAssignmentError = ref(null);
const isDeleteSectionAssignModalVisible = ref(false);
const sectionAssignmentToDelete = ref(null);
const submittingSectionDeletion = ref(false);
// User Assignment State
const userAssignments = ref([]);
const loadingUserAssignments = ref(false);
const isAssignUserModalVisible = ref(false);
const isEditingUserAssignment = ref(false);
const editingUserAssignmentRecord = ref(null);
const assignableUsers = ref([]);
const loadingAssignableUsers = ref(false);
const selectedUserIds = ref([]);
const userAssignmentDetails = reactive({});
const submittingUserAssignment = ref(false);
const userAssignmentError = ref(null);
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
// User Role
const currentUserRole = ref('dept_head');

// --- COMPUTED PROPERTIES ---
const canManageAssignments = computed(() => { const allowedRoles = ['dept_head', 'admin', 'kpi_owner']; const hasPermission = allowedRoles.includes(currentUserRole.value); const assignableLevel = kpiDetailData.value?.assignment_level === 'department'; return hasPermission && assignableLevel && !!kpiDetailData.value; });
const isKpiAssignableToSections = computed(() => { return departmentHasSections.value === true && kpiDetailData.value?.assignment_level === 'department'; });
const isKpiAssignableToUsers = computed(() => { return departmentHasSections.value === false && kpiDetailData.value?.assignment_level === 'department'; });
const allUserList = computed(() => store.getters['users/userList'] || allFakeUsers);
const evaluationUserOptions = computed(() => { return allUserList.value.map(u => ({ value: u.id, label: `${u.first_name || ''} ${u.last_name || ''} (${u.username})` })); });
const rowSelectionConfig = computed(() => ({ selectedRowKeys: selectedSectionIds.value, onChange: (selectedKeys) => { selectedSectionIds.value = selectedKeys; } }));
// const assignableSectionOptions = computed(() => { 
//   return assignableSections.value.map(section => ({ value: section.id, label: section.name })); 
// });
const assignableUserOptions = computed(() => { return assignableUsers.value.map(user => ({ value: user.id, label: `${user.first_name || ''} ${user.last_name || ''} (${user.username})`, name: `${user.first_name || ''} ${user.last_name || ''}`, avatar_url: user.avatar_url, })); });
const modalUserDataSource = computed(() => { if (isEditingUserAssignment.value && editingUserAssignmentRecord.value?.user) { const user = editingUserAssignmentRecord.value.user; ensureUserAssignmentDetail(user.id, editingUserAssignmentRecord.value.target, editingUserAssignmentRecord.value.weight); return [{ userId: user.id, name: `${user.first_name || ''} ${user.last_name || ''}`, avatar_url: user.avatar_url }]; } else if (!isEditingUserAssignment.value && selectedUserIds.value.length > 0) { return assignableUserOptions.value.filter(opt => selectedUserIds.value.includes(opt.value)).map(opt => { ensureUserAssignmentDetail(opt.value); return { userId: opt.value, name: opt.name, avatar_url: opt.avatar_url }; }); } return []; });


// --- TABLE COLUMNS ---
const sectionAssignmentColumns = [{ title: 'Assigned Section', key: 'section', width: '40%' }, { title: 'Target', key: 'target', align: 'right' }, { title: 'Weight (%)', key: 'weight', align: 'right' }, { title: 'Status', key: 'status', align: 'center' }, { title: 'Actions', key: 'actions', align: 'center', width: '100px' },];
const modalSectionAssignmentColumns = [{ title: 'Section Name', key: 'section', dataIndex: 'name', width: '65%' }, { title: 'Target', key: 'target', width: '35%' },];
const userAssignmentColumns = [{ title: 'User', key: 'user', width: '30%' }, { title: 'Assigned Target', key: 'target', align: 'right' }, { title: 'Weight (%)', key: 'weight', align: 'right' }, { title: 'Latest Actual', key: 'actual', align: 'right' }, { title: 'Status', key: 'status', align: 'center' }, { title: 'Actions', key: 'actions', align: 'center', width: '100px' },];
const modalUserAssignmentInputColumns = [{ title: 'User', key: 'user', width: '40%' }, { title: 'Target', key: 'target', width: '30%' }, { title: 'Weight (%)', key: 'weight', width: '30%' },];
const evaluationColumns = [{ title: 'Evaluator', dataIndex: 'evaluator', key: 'evaluator' }, { title: 'Evaluatee', dataIndex: 'evaluatee', key: 'evaluatee' }, { title: 'Period', dataIndex: 'period', key: 'period' }, { title: 'Rating', dataIndex: 'rating', key: 'rating' }, { title: 'Date', dataIndex: 'evaluation_date', key: 'evaluation_date' }, { title: 'Status', dataIndex: 'status', key: 'status' }, { title: 'Actions', dataIndex: 'actions', key: 'actions' }];


// --- METHODS ---
const getStatusColor = (status) => { switch (status?.toLowerCase()) { case 'active': case 'approved': case 'met': case 'exceeded': return 'success'; case 'inactive': case 'rejected': case 'not met': return 'error'; case 'pending section approval': case 'pending dept approval': case 'pending owner approval': case 'pending': return 'warning'; case 'in progress': return 'processing'; default: return 'default'; } };
const getAssignmentUnitName = (kpi) => { if (!kpi) return 'N/A'; if (kpi.section) return `Section: ${kpi.section.name}`; if (kpi.department) return `Department: ${kpi.department.name}`; return 'Overall / Not specified'; };
// const ensureSectionAssignmentDetail = (sectionId, initialTarget = null) => { 
//   const key = String(sectionId); 
//   if (!sectionAssignmentDetails[key]) { 
//     sectionAssignmentDetails[key] = { 
//       target: initialTarget 
//     }; 
//   } 
// };
const ensureUserAssignmentDetail = (userId, initialTarget = null, initialWeight = null) => { const key = String(userId); if (!userAssignmentDetails[key]) { userAssignmentDetails[key] = { target: initialTarget, weight: initialWeight }; } };

// === FAKE DATA METHODS ===
const loadFakeKpiData = async (id) => { loadingKpi.value = true; loadingSectionAssignments.value = true; loadingUserAssignments.value = true; loadingEvaluations.value = true; departmentHasSections.value = null; console.log(`Loading FAKE data for Dept KPI ID: ${id}`); await new Promise(resolve => setTimeout(resolve, 600)); try { const fakeDetail = generateFakeKpiDetailDept(id); kpiDetailData.value = fakeDetail; const sectionsInDept = allFakeSections.filter(s => s.department_id === fakeDetail.department.id); departmentHasSections.value = sectionsInDept.length > 0; if (departmentHasSections.value) { sectionAssignments.value = generateFakeSectionAssignments(fakeDetail); userAssignments.value = []; } else { userAssignments.value = generateFakeUserAssignmentsForDept(fakeDetail); sectionAssignments.value = []; } kpiEvaluations.value = fakeDetail.evaluations || []; console.log("Fake KPI Detail:", kpiDetailData.value); console.log("Dept has sections:", departmentHasSections.value); console.log("Fake Section Assignments:", sectionAssignments.value); console.log("Fake User Assignments:", userAssignments.value); } catch (error) { console.error("Error generating fake data:", error); notification.error({ message: "Failed to generate fake data" }); /* Reset state */ } finally { loadingKpi.value = false; loadingSectionAssignments.value = false; loadingUserAssignments.value = false; loadingEvaluations.value = false; } };
const fetchAssignableSections = async () => { const departmentId = kpiDetailData.value?.department?.id; if (!departmentId) { sectionAssignmentError.value = "Cannot determine department."; assignableSections.value = []; return; } loadingAssignableSections.value = true; sectionAssignmentError.value = null; console.log(`Workspaceing FAKE assignable sections for Dept ID: ${departmentId}`); await new Promise(resolve => setTimeout(resolve, 300)); try { assignableSections.value = allFakeSections.filter(s => s.department_id === departmentId); console.log("Fake Assignable Sections:", assignableSections.value); const details = {}; assignableSections.value.forEach(section => { const currentAssignment = sectionAssignments.value.find(a => a.section.id === section.id); details[String(section.id)] = { target: currentAssignment?.target ?? null }; }); Object.keys(sectionAssignmentDetails).forEach(key => delete sectionAssignmentDetails[key]); Object.assign(sectionAssignmentDetails, details); console.log("Initialized sectionAssignmentDetails:", sectionAssignmentDetails); } catch (err) { console.error("Error faking assignable sections:", err); sectionAssignmentError.value = `Failed to load fake sections`; assignableSections.value = []; } finally { loadingAssignableSections.value = false; } };
const fetchAssignableUsersForDept = async () => { const departmentId = kpiDetailData.value?.department?.id; if (!departmentId) { userAssignmentError.value = "Cannot determine department."; assignableUsers.value = []; return; } loadingAssignableUsers.value = true; userAssignmentError.value = null; console.log(`Workspaceing FAKE assignable users for Dept ID: ${departmentId}`); await new Promise(resolve => setTimeout(resolve, 300)); try { assignableUsers.value = allFakeUsers.filter(user => user.department_id === departmentId && user.section_id === null); console.log("Fake Assignable Users (Dept Direct):", assignableUsers.value); } catch (err) { console.error("Error faking assignable users:", err); userAssignmentError.value = `Failed to load fake users`; assignableUsers.value = []; } finally { loadingAssignableUsers.value = false; } };

// --- Section Assignment Methods --- (Fake Save/Delete)
const openAssignSectionModal = () => { sectionAssignmentError.value = null; selectedSectionIds.value = sectionAssignments.value.map(a => a.section.id); isAssignSectionModalVisible.value = true; fetchAssignableSections(); };
const closeAssignSectionModal = () => { isAssignSectionModalVisible.value = false; setTimeout(() => { selectedSectionIds.value = []; assignableSections.value = []; sectionAssignmentError.value = null; Object.keys(sectionAssignmentDetails).forEach(key => delete sectionAssignmentDetails[key]); }, 300); };
const handleSaveSectionAssignment = async () => { sectionAssignmentError.value = null; if (selectedSectionIds.value.length === 0) { sectionAssignmentError.value = "Please select section(s)."; return; } let invalidTarget = false; selectedSectionIds.value.forEach(sectionId => { const details = sectionAssignmentDetails[String(sectionId)]; if (details?.target === null || details?.target < 0) { invalidTarget = true; } }); if (invalidTarget) { sectionAssignmentError.value = "Please enter a valid Target (>= 0) for all selected sections."; return; } submittingSectionAssignment.value = true; const kpi_id = kpiDetailData.value.id; console.log("Saving FAKE section assignment..."); await new Promise(resolve => setTimeout(resolve, 700)); try { const newAssignments = selectedSectionIds.value.map(sectionId => { const section = allFakeSections.find(s => s.id === sectionId); const details = sectionAssignmentDetails[String(sectionId)]; const oldAssignment = sectionAssignments.value.find(a => a.section.id === sectionId); return { id: oldAssignment?.id || Date.now() + sectionId, kpi_id: kpi_id, section: section, target: details?.target ?? null, weight: oldAssignment?.weight ?? null, status: oldAssignment?.status || 'Pending', }; }); sectionAssignments.value = newAssignments; console.log("Updated fake section assignments:", sectionAssignments.value); notification.success({ message: "Section assignments saved (Fake)" }); closeAssignSectionModal(); } catch (err) { console.error("Error saving fake section assignment:", err); sectionAssignmentError.value = `Failed to save fake data: ${err.message || 'Unknown'}`; notification.error({ message: "Save Failed", description: sectionAssignmentError.value }); } finally { submittingSectionAssignment.value = false; } };
const confirmDeleteSectionAssignment = (record) => { sectionAssignmentToDelete.value = record; isDeleteSectionAssignModalVisible.value = true; };
const handleDeleteSectionAssignment = async () => { if (!sectionAssignmentToDelete.value) return; submittingSectionDeletion.value = true; const assignmentIdToDelete = sectionAssignmentToDelete.value.id; const sectionName = sectionAssignmentToDelete.value.section?.name || 'this section'; console.log(`Deleting FAKE section assignment ID: ${assignmentIdToDelete}`); await new Promise(resolve => setTimeout(resolve, 400)); try { const index = sectionAssignments.value.findIndex(a => a.id === assignmentIdToDelete); if (index !== -1) { sectionAssignments.value.splice(index, 1); notification.success({ message: `Assignment for ${sectionName} removed (Fake)` }); isDeleteSectionAssignModalVisible.value = false; sectionAssignmentToDelete.value = null; } else { throw new Error("Not found"); } } catch (err) { console.error("Error deleting fake section assignment:", err); notification.error({ message: "Deletion Failed", description: `Could not remove assignment: ${err.message || 'Unknown'}` }); isDeleteSectionAssignModalVisible.value = false; } finally { submittingSectionDeletion.value = false; } };

// --- User Assignment Methods --- (Fake Save/Delete)
const openAssignUserModal = () => { isEditingUserAssignment.value = false; editingUserAssignmentRecord.value = null; selectedUserIds.value = []; Object.keys(userAssignmentDetails).forEach(key => delete userAssignmentDetails[key]); userAssignmentError.value = null; isAssignUserModalVisible.value = true; fetchAssignableUsersForDept(); };
const openEditUserModal = (record) => { isEditingUserAssignment.value = true; editingUserAssignmentRecord.value = record; selectedUserIds.value = [record.user.id]; Object.keys(userAssignmentDetails).forEach(key => delete userAssignmentDetails[key]); ensureUserAssignmentDetail(record.user.id, record.target, record.weight); userAssignmentError.value = null; isAssignUserModalVisible.value = true; };
const closeAssignUserModal = () => { isAssignUserModalVisible.value = false; setTimeout(() => { isEditingUserAssignment.value = false; editingUserAssignmentRecord.value = null; selectedUserIds.value = []; Object.keys(userAssignmentDetails).forEach(key => delete userAssignmentDetails[key]); userAssignmentError.value = null; assignableUsers.value = []; }, 300); };
const handleSaveUserAssignment = async () => { userAssignmentError.value = null; if (!isEditingUserAssignment.value && selectedUserIds.value.length === 0) { userAssignmentError.value = "Please select user(s)."; return; } let invalidDetail = false; const usersToValidate = isEditingUserAssignment.value ? [editingUserAssignmentRecord.value.user.id] : selectedUserIds.value; usersToValidate.forEach(userId => { const details = userAssignmentDetails[String(userId)]; if (!details || details.target === null || details.target < 0 || details.weight === null || details.weight < 0 || details.weight > 100) { invalidDetail = true; } }); if (invalidDetail) { userAssignmentError.value = "Invalid Target/Weight."; return; } submittingUserAssignment.value = true; const kpi_id = kpiDetailData.value.id; console.log("Saving FAKE user assignment (Dept)..."); await new Promise(resolve => setTimeout(resolve, 700)); try { if (isEditingUserAssignment.value) { const assignmentId = editingUserAssignmentRecord.value.id; const userId = editingUserAssignmentRecord.value.user.id; const index = userAssignments.value.findIndex(a => a.id === assignmentId); if (index !== -1) { userAssignments.value[index].target = userAssignmentDetails[String(userId)]?.target; userAssignments.value[index].weight = userAssignmentDetails[String(userId)]?.weight; notification.success({ message: "Assignment updated (Fake)" }); } else { throw new Error("Not found"); } } else { const newAssignments = selectedUserIds.value.map(userId => { const user = assignableUsers.value.find(u => u.id === userId) || allFakeUsers.find(u => u.id === userId); const details = userAssignmentDetails[String(userId)]; return { id: Date.now() + userId, kpi_id: kpi_id, user: user, target: details?.target, weight: details?.weight, latest_actual_value: null, status: 'Active', }; }); const newUserIdsSet = new Set(selectedUserIds.value); userAssignments.value = userAssignments.value.filter(a => !newUserIdsSet.has(a.user.id)); userAssignments.value.push(...newAssignments); notification.success({ message: "KPI assigned (Fake)" }); } closeAssignUserModal(); } catch (err) { console.error("Error saving fake user assignment:", err); userAssignmentError.value = `Failed to save fake data: ${err.message || 'Unknown'}`; notification.error({ message: "Save Failed", description: userAssignmentError.value }); } finally { submittingUserAssignment.value = false; } };
const confirmDeleteUserAssignment = (record) => { userAssignmentToDelete.value = record; isDeleteUserAssignModalVisible.value = true; };
const handleDeleteUserAssignment = async () => {
  if (!userAssignmentToDelete.value) return;
  submittingUserDeletion.value = true;
  const assignmentIdToDelete = userAssignmentToDelete.value.id;
  // const userName = `${userAssignmentToDelete.value.user?.first_name || ''} ${userAssignmentToDelete.value.user?.last_name || ''}`; 
  console.log(`Deleting FAKE user assignment ID: ${assignmentIdToDelete}`);
  await new Promise(resolve => setTimeout(resolve, 400));
  try {
    const index = userAssignments.value.findIndex(a => a.id === assignmentIdToDelete);
    if (index !== -1) {
      userAssignments.value.splice(index, 1);
      notification.success({ message: `Assignment removed (Fake)` });
      isDeleteUserAssignModalVisible.value = false;
      userAssignmentToDelete.value = null;
    } else {
      throw new Error("Not found");
    }
  } catch (err) {
    console.error("Error deleting fake assignment:", err);
    notification.error({ message: "Deletion Failed", description: `Could not remove assignment: ${err.message || 'Unknown'}` });
    isDeleteUserAssignModalVisible.value = false;
  } finally {
    submittingUserDeletion.value = false;
  }
};

// --- Evaluations Methods --- (Fake Submit)
const viewEvaluation = (record) => { selectedEvaluation.value = record; isViewEvaluationModalVisible.value = true; };
const closeViewEvaluationModal = () => { isViewEvaluationModalVisible.value = false; };
const openEvaluationModal = () => { newEvaluation.value = { kpi_id: kpiDetailData.value?.id }; isCreateEvaluationModalVisible.value = true; };
const closeCreateEvaluationModal = () => { isCreateEvaluationModalVisible.value = false; };
const submitEvaluation = async () => { /* ... FAKE SUBMIT ... */ };

// --- LIFECYCLE HOOK ---
onMounted(async () => {
  await loadFakeKpiData(kpiId.value);
  try { loadingUsersForEval.value = true; await store.dispatch('users/fetchUsers'); loadingUsersForEval.value = false; }
  catch (error) { console.error("Error fetching users for eval modal:", error); loadingUsersForEval.value = false; }
});

</script>

<style scoped>
/* ... styles ... */
.ant-descriptions-item-label {
  font-weight: bold;
}

p {
  margin-bottom: 0.5em;
}
</style>