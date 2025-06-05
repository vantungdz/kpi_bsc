<template>
  <div>
    <a-card :title="
        $t('kpiDetailTitle', { name: kpiDetailData?.name || $t('loading') })
      " style="margin-bottom: 20px">
      <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 6 }">
        <a-descriptions v-if="kpiDetailData" :column="2" bordered size="small">
          <template #title>
            <div style="
                display: flex;
                justify-content: space-between;
                align-items: center;
                width: 100%;
              ">
              <span>{{ $t("kpiInformation") }}</span>
              <a-button v-if="kpiDetailData?.id && canCopyTemplate" @click="copyKpiAsTemplate" :disabled="loadingKpi">
                {{ $t("copyAsTemplate") }}
              </a-button>
            </div>
          </template>
          <a-descriptions-item :label="$t('id')">
            {{ kpiDetailData.id }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('createdByType')">
            {{ kpiDetailData.created_by_type || "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('frequency')">
            {{ kpiDetailData.frequency }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('perspective')">
            {{ kpiDetailData.perspective?.name || "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('department')">
            {{ departmentNameFromSectionContext }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('section')">
            {{ sectionNameFromContext }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('unit')">
            {{ kpiDetailData.unit || "" }}
          </a-descriptions-item>
          <a-descriptions-item :label="$t('target')">
            {{ Number(kpiDetailData.target).toLocaleString() }}
            <span v-if="kpiDetailData.unit"></span>
          </a-descriptions-item>
          <a-descriptions-item :label="$t('weight')">
            {{ kpiDetailData.weight ?? "" }}
          </a-descriptions-item>

          <a-descriptions-item :label="$t('status')" :span="2">
            <a-tag :color="getKpiDefinitionStatusColor(kpiDetailData.status)" style="margin-right: 10px">
              {{ getKpiDefinitionStatusText(kpiDetailData.status) }}</a-tag>
            <a-switch v-if="canToggleStatus && kpiDetailData?.id"
              :checked="kpiDetailData.status === KpiDefinitionStatus.APPROVED" :loading="isToggling"
              :disabled="isToggling || loadingKpi" :checked-children="$t('on')" :un-checked-children="$t('off')"
              size="small" @change="() => handleToggleStatus(kpiDetailData.id)" :title="$t('toggleStatus')" />
            <div v-if="toggleStatusError" style="color: red; font-size: 0.9em; margin-top: 5px">
              {{ $t("error") }}: {{ toggleStatusError }}
              <a @click="clearToggleError" style="margin-left: 5px">({{ $t("clear") }})</a>
            </div>
          </a-descriptions-item>

          <a-descriptions-item :label="$t('description')" :span="2">
            {{ kpiDetailData.description || "" }}
          </a-descriptions-item>
        </a-descriptions>
        <a-empty v-else-if="!loadingKpi" :description="$t('couldNotLoadKpiDetails')" />
      </a-skeleton>

      <a-row v-if="shouldShowAssignmentStats" :gutter="12" style="
          margin-top: 16px;
          margin-bottom: 16px;
          background: #f0f2f5;
          padding: 8px;
          border-radius: 4px;
        ">
        <a-col :span="8">
          <a-statistic :title="$t('overallTarget')" :value="overallTargetValueDetail" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="$t('totalAssigned')" :value="totalAssignedTargetDetail" :precision="2" />
        </a-col>
        <a-col :span="8">
          <a-statistic :title="$t('remaining')" :value="remainingTargetDetail" :precision="2"
            :value-style="isOverAssignedDetail ? { color: '#cf1322' } : {}" />
        </a-col>
      </a-row>
    </a-card>

    <!-- COMPANY OVERVIEW MODE CARDS -->
    <template v-if="isCompanyOverviewMode">
      <a-card :title="$t('departmentAssignments')" style="margin-top: 20px" v-if="canAssignDepartment">
        <template #extra>
          <a-button type="primary" @click="openManageDepartmentSectionAssignments">
            <plus-outlined /> {{ $t("addDepartmentAssignment") }}
          </a-button>
        </template>
        <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 3 }">
          <a-table :columns="departmentSectionAssignmentColumns" :data-source="companyOverviewDepartmentAssignments"
            row-key="id" size="small" bordered :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.department">{{
                  record.department.name
                  }}</span>
                <span v-else></span>
              </template>
              <template v-else-if="column.key === 'targetValue'">
                {{ Number(record.targetValue).toLocaleString() ?? "-" }}
                <span v-if="kpiDetailData?.unit">
                  {{ kpiDetailData.unit }}</span>
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "-" }}
                {{ kpiDetailData.unit }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small"
                      @click="openEditDepartmentSectionAssignment(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small"
                      @click="confirmDeleteDepartmentSectionAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
              <template v-else>
                <span>{{ record[column.dataIndex] }}</span>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>

      <a-card :title="$t('sectionAssignments')" style="margin-top: 20px" v-if="canAssignSection">
        <template #extra>
          <a-button type="primary" @click="openManageDepartmentSectionAssignments">
            <plus-outlined /> {{ $t("addSectionAssignment") }}
          </a-button>
        </template>
        <a-skeleton :loading="loadingKpi" active :paragraph="{ rows: 3 }">
          <a-table :columns="departmentSectionAssignmentColumns" :data-source="companyOverviewSectionAssignments"
            row-key="id" size="small" bordered :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.section">
                  {{ record.section.name }}
                  <span v-if="record.section.department" style="font-size: 0.9em; color: #888">
                    ({{ $t("dept") }}: {{ record.section.department.name }})
                  </span>
                </span>
                <span v-else></span>
              </template>
              <template v-else-if="column.key === 'targetValue'">
                {{ Number(record.targetValue).toLocaleString() ?? "-" }}
                <span v-if="kpiDetailData?.unit">
                  {{ kpiDetailData.unit }}</span>
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "-" }}
                {{ kpiDetailData.unit }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small"
                      @click="openEditDepartmentSectionAssignment(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small"
                      @click="confirmDeleteDepartmentSectionAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>

      <a-card :title="$t('directUserAssignments')" style="margin-top: 20px" v-if="canAssignEmployees">
        <template #extra>
          <a-button type="primary" @click="openAssignUserModal">
            <user-add-outlined /> {{ $t("addUserAssignment") }}
          </a-button>
        </template>
        <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 3 }">
          <a-table :columns="userAssignmentColumns" :data-source="companyOverviewUserAssignments" row-key="id"
            size="small" bordered :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <a-avatar :src="record.employee?.avatar_url" size="small" style="margin-right: 8px">
                  {{ record.employee?.first_name?.charAt(0) }}
                </a-avatar>
                {{ record.employee?.first_name }}
                {{ record.employee?.last_name }}
                <span style="font-size: 0.9em; color: #888">
                  ({{ record.employee?.username }})
                  <template v-if="record.employee?.section">
                    - {{ $t("section") }}: {{ record.employee.section.name }}
                  </template>
                  <template v-else-if="record.employee?.department">
                    - {{ $t("dept") }}: {{ record.employee.department.name }}
                  </template>
                </span>
              </template>
              <template v-else-if="column.key === 'target'">
                {{ Number(record.targetValue).toLocaleString() }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "" }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>
    </template>

    <!-- CONTEXT-SPECIFIC ASSIGNMENT CARDS -->
    <template v-else>
      <a-card :title="$t('manageDepartmentSectionAssignments')" style="margin-top: 20px"
        v-if="shouldShowDepartmentSectionAssignmentCard && canAssignSection">
        <template #extra>
          <a-button type="primary" @click="openManageDepartmentSectionAssignments">
            <template #icon>
              <plus-outlined />
            </template>
            {{ $t("addAssignment") }}
          </a-button>
        </template>
        <a-skeleton :loading="loadingDepartmentSectionAssignments" active :paragraph="{ rows: 4 }">
          <a-table :columns="departmentSectionAssignmentColumns" :data-source="filteredAssignmentsForContextDepartment"
            row-key="id" size="small" bordered :pagination="false">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'assignedUnit'">
                <span v-if="record.section">{{ record.section.name }} ({{ $t("section") }})</span>
                <span v-else-if="record.department">{{ record.department.name }} ({{ $t("department") }})</span>
                <span v-else></span>
              </template>
              <template v-else-if="column.key === 'targetValue'">
                {{ Number(record.targetValue).toLocaleString() ?? "-" }}
                <span v-if="kpiDetailData?.unit">
                  {{ kpiDetailData.unit }}</span>
              </template>

              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "-" }}
                <span v-if="kpiDetailData?.unit">
                  {{ kpiDetailData.unit }}</span>
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small"
                      @click="openEditDepartmentSectionAssignment(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small"
                      @click="confirmDeleteDepartmentSectionAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-show="
              currentDepartmentSectionAssignments.length === 0 &&
              !loadingDepartmentSectionAssignments
            " :description="$t('noDepartmentSectionAssignments')" />
        </a-skeleton>
      </a-card>

      <a-card :title="$t('manageDirectUserAssignments')" style="margin-top: 20px"
        v-if="shouldShowUserAssignmentsInDepartmentSectionsCard && canAssignEmployees">
        <template #extra>
          <a-button type="primary" @click="openAssignUsersInDeptSectionsModal"
            :disabled="loadingUserAssignments || !kpiDetailData?.id">
            <template #icon>
              <user-add-outlined />
            </template>
            {{ $t("addEditUserAssignment") }}
          </a-button>
        </template>
        <a-skeleton :loading="loadingUserAssignments" active :paragraph="{ rows: 4 }">
          <a-alert v-if="userAssignmentError" :message="userAssignmentError" type="error" show-icon closable
            @close="clearAssignmentError" style="margin-bottom: 16px" />
          <a-table :columns="userAssignmentColumns" :data-source="filteredUserAssignmentsInDepartmentSections"
            row-key="id" size="small" bordered :pagination="false" style="min-height: 180px">
            <template #bodyCell="{ column, record }">
              <template v-if="column.key === 'user'">
                <a-avatar :src="record.employee?.avatar_url" size="small" style="margin-right: 8px">
                  {{ record.employee?.first_name?.charAt(0) }}
                </a-avatar>
                {{ record.employee?.first_name }}
                {{ record.employee?.last_name }}
              </template>
              <template v-else-if="column.key === 'target'">
                {{ Number(record.targetValue).toLocaleString() }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "" }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
        </a-skeleton>
      </a-card>

      <a-card :title="$t('manageDirectUserAssignments')" style="margin-top: 20px"
        v-if="shouldShowDirectUserAssignmentCard && canAssignEmployees">
        <template #extra>
          <a-button type="primary" @click="openAssignUserModal"
            :disabled="loadingUserAssignments || !kpiDetailData?.id">
            <template #icon>
              <user-add-outlined />
            </template>
            {{ $t("addEditUserAssignment") }}
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
                {{ record.employee?.last_name }} ({{
                record.employee?.username
                }})
              </template>
              <template v-else-if="column.key === 'target'">
                {{ Number(record.targetValue).toLocaleString() }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "" }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-if="
              companyOverviewUserAssignments.length === 0 &&
              !loadingUserAssignments
            " :description="$t('noDirectUserAssignments')" />
        </a-skeleton>
      </a-card>

      <a-card :title="$t('manageUserAssignments')" style="margin-top: 20px"
        v-if="shouldShowSectionUserAssignmentCard && canAssignEmployees && contextSectionId">
        <template #extra>
          <a-button type="primary" @click="openAssignUserModal"
            :disabled="loadingUserAssignments || !kpiDetailData?.id">
            <template #icon>
              <user-add-outlined />
            </template>
            {{ $t("addEditUserAssignment") }}
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
                {{ record.employee?.last_name }} ({{
                record.employee?.username
                }})
              </template>
              <template v-else-if="column.key === 'target'">
                {{
                Number(record.targetValue).toLocaleString()
                }}
                {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'actual'">
                {{ Number(record.latest_actual_value).toLocaleString() ?? "0" }}  {{ kpiDetailData?.unit || "" }}
              </template>
              <template v-else-if="column.key === 'status'">
                <a-tag :color="getAssignmentStatusColor(record.status)">
                  {{ getAssignmentStatusText(record.status) }}
                </a-tag>
              </template>
              <template v-else-if="column.key === 'actions'">
                <a-space>
                  <a-tooltip :title="$t('editAssignment')">
                    <a-button type="primary" ghost shape="circle" size="small" @click="openEditUserModal(record)">
                      <edit-outlined />
                    </a-button>
                  </a-tooltip>
                  <a-tooltip :title="$t('deleteAssignment')">
                    <a-button danger shape="circle" size="small" @click="confirmDeleteUserAssignment(record)">
                      <delete-outlined />
                    </a-button>
                  </a-tooltip>
                </a-space>
              </template>
            </template>
          </a-table>
          <a-empty v-show="filteredSectionUserAssignments.length === 0"
            :description="$t('noSectionUserAssignmentsYet')" />
        </a-skeleton>
      </a-card>
    </template>

    <a-modal :open="isAssignUsersInDeptSectionsModalVisible"
      @update:open="isAssignUsersInDeptSectionsModalVisible = $event" :title="$t('assignUsersInDepartmentSections')"
      @ok="handleAssignUsersInSection" @cancel="closeAssignUsersInDeptSectionsModal"
      :confirm-loading="assigningUsersInSection" :width="600">
      <a-form layout="vertical">
        <a-form-item :label="$t('selectSection')" required>
          <a-select v-model:value="selectedSectionIdForUserAssign" :options="sectionsInContextDepartment"
            :placeholder="$t('selectSection')" @change="fetchUsersInSection" />
        </a-form-item>
        <a-form-item :label="$t('selectUsers')" required>
          <a-select v-model:value="selectedUserIdsInSection" :options="assignableUsersInSection" mode="multiple"
            :placeholder="$t('selectUsers')" :disabled="!selectedSectionIdForUserAssign" show-search allow-clear
            @change="onSelectedUsersInSectionChange" />
        </a-form-item>
        <a-table v-if="selectedUserIdsInSection.length" :columns="assignUsersInSectionColumns"
          :data-source="assignUsersInSectionTableData" row-key="userId" size="small" bordered :pagination="false"
          style="margin-bottom: 10px">
          <template #bodyCell="{ column, record }">
            <template v-if="column.key === 'user'">
              <a-avatar :src="record.avatar_url" size="small" style="margin-right: 8px">
                {{ record.name?.charAt(0) }}
              </a-avatar>
              {{ record.name }}
            </template>
            <template v-else-if="column.key === 'target'">
              <a-input v-model:value="assignUsersInSectionTargetDetails[record.userId]" :placeholder="$t('target')"
              style="width: 100%" type="number" min="0" />
            </template>
          </template>
        </a-table>
        <div v-if="userAssignErrorInSection" style="color: red; margin-bottom: 10px">
          {{ userAssignErrorInSection }}
        </div>
      </a-form>
    </a-modal>

    <a-modal :open="isViewEvaluationModalVisible" @update:open="isViewEvaluationModalVisible = $event"
      :title="$t('kpiEvaluationDetails')" :width="1000" :footer="null" @cancel="closeViewEvaluationModal">
      <a-descriptions bordered :column="2" v-if="selectedEvaluation.id" size="small">
      </a-descriptions>
      <a-empty v-else :description="$t('couldNotLoadEvaluationDetails')" />
      <template #footer>
        <a-button key="back" @click="closeViewEvaluationModal">
          {{ $t("close") }}
        </a-button>
      </template>
    </a-modal>

    <a-modal :open="isCreateEvaluationModalVisible" @update:open="isCreateEvaluationModalVisible = $event"
      :title="$t('createKpiEvaluation')" :width="600" @ok="submitEvaluation" @cancel="closeCreateEvaluationModal"
      :confirm-loading="submittingEvaluation">
      <a-form layout="vertical" :model="newEvaluation"> </a-form>
    </a-modal>

    <a-modal :open="isAssignUserModalVisible" @update:open="isAssignUserModalVisible = $event"
      :title="assignUserModalTitle" @ok="handleSaveUserAssignment" @cancel="closeAssignUserModal"
      :confirm-loading="submittingUserAssignment" :width="800" :mask-closable="false" :keyboard="false"
      :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')" @afterClose="
        () => {
          modalFilterDepartmentId = null;
          modalFilterSectionId = null;
        }
      ">
      <a-spin :spinning="loadingAssignableUsers || submittingUserAssignment">
        <div v-if="isCompanyOverviewMode" style="margin-bottom: 20px">
          <a-row :gutter="16">
            <a-col :span="12">
              <a-form-item :label="$t('filterByDepartment')">
                <a-select v-model:value="modalFilterDepartmentId" :placeholder="$t('selectDepartment')"
                  style="width: 100%" allow-clear @change="handleModalDepartmentFilterChange" :options="
                    allDepartments.map((dept) => ({
                      value: dept.id,
                      label: dept.name,
                    }))
                  " />
              </a-form-item>
            </a-col>
            <a-col :span="12">
              <a-form-item :label="$t('filterBySection')">
                <a-select v-model:value="modalFilterSectionId" :placeholder="$t('selectSection')" style="width: 100%"
                  allow-clear :disabled="!modalFilterDepartmentId" @change="handleModalSectionFilterChange" :options="
                    modalFilterAssignableSections.map((sect) => ({
                      value: sect.id,
                      label: sect.name,
                    }))
                  " />
              </a-form-item>
            </a-col>
          </a-row>
          <a-alert v-if="
              isCompanyOverviewMode &&
              !modalFilterDepartmentId &&
              !modalFilterSectionId &&
              assignableUsers.length === 0 &&
              !loadingAssignableUsers
            " :message="$t('selectDepartmentOrSectionToLoadUsers')" type="info" show-icon
            style="margin-bottom: 10px" />
        </div>

        <a-descriptions v-if="
            isEditingUserAssignment && editingUserAssignmentRecord?.employee
          " :column="1" size="small" style="margin-bottom: 15px">
          <a-descriptions-item :label="$t('user')">
            <a-avatar :src="editingUserAssignmentRecord.employee?.avatar_url" size="small" style="margin-right: 8px">
              {{ editingUserAssignmentRecord.employee?.first_name?.charAt(0) }}
            </a-avatar>
            {{ editingUserAssignmentRecord.employee?.first_name }}
            {{ editingUserAssignmentRecord.employee?.last_name }} ({{
            editingUserAssignmentRecord.employee?.username
            }})
          </a-descriptions-item>
        </a-descriptions>
        <a-form-item v-if="!isEditingUserAssignment" :label="$t('selectUsers')" required>
          <a-select v-model:value="selectedUserIds" mode="multiple" :placeholder="$t('searchAndSelectUsers')"
            style="width: 100%; margin-bottom: 15px" show-search allow-clear :filter-option="
              (inputValue, option) =>
                option.label.toLowerCase().indexOf(inputValue.toLowerCase()) >=
                0
            " :options="assignableUserOptions" :loading="loadingAssignableUsers" />
        </a-form-item>
        <h4 style="margin-bottom: 10px">{{ $t("setTargetAndWeight") }}</h4>
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
              <a-input v-model:value="userAssignmentDetails[record.userId].target" :placeholder="$t('target')"
                style="width: 100%" @input="(event) => handleNumericInput('targetValue', event)" />
            </template>
          </template>
        </a-table>
        <div v-if="userAssignmentSubmitError" style="color: red; margin-top: 10px">
          {{ userAssignmentSubmitError }}
        </div>
      </a-spin>
    </a-modal>

    <a-modal :open="isDeleteUserAssignModalVisible" @update:open="isDeleteUserAssignModalVisible = $event"
      :title="$t('confirmDeletion')" @ok="handleDeleteUserAssignment" @cancel="isDeleteUserAssignModalVisible = false"
      :confirm-loading="submittingUserDeletion" :ok-text="$t('delete')" :cancel-text="$t('cancel')" ok-type="danger">
      <p v-if="userAssignmentToDelete?.employee">
        {{ $t("confirmRemoveAssignmentForUser") }}
        <strong>
          {{ userAssignmentToDelete.employee.first_name }}
          {{ userAssignmentToDelete.employee.last_name }}
        </strong>
        ?
      </p>
      <p v-else>{{ $t("confirmDeleteAssignment") }}</p>
    </a-modal>

    <a-modal :open="isDepartmentSectionAssignmentModalVisible"
      @update:open="isDepartmentSectionAssignmentModalVisible = $event" :title="
        editingDepartmentSectionAssignment
          ? $t('editAssignment')
          : $t('addDepartmentSectionAssignment')
      " @ok="handleSaveDepartmentSectionAssignment" @cancel="closeManageDepartmentSectionAssignments"
      :confirm-loading="submittingDepartmentSectionAssignment" :width="600" :mask-closable="false" :keyboard="false"
      :ok-text="$t('common.save')" :cancel-text="$t('common.cancel')">
      <a-spin :spinning="
          /* Cân nhắc thêm state loading riêng khi fetch sections cho modal nếu cần */
          /* loadingDepartmentSectionAssignments || */
          submittingDepartmentSectionAssignment
        ">
        <a-form layout="vertical" :model="departmentSectionAssignmentForm" ref="departmentSectionAssignmentFormRef">
          <a-form-item :label="$t('assignTo')" name="assignToTarget">
            <a-select v-model:value="
                departmentSectionAssignmentForm.assigned_to_department
              " :placeholder="$t('selectDepartment')" style="width: 100%; margin-bottom: 10px"
              @change="handleDepartmentSelectInModal" :disabled="
                !!contextDepartmentId ||
                editingDepartmentSectionAssignment !== null
              ">
              <a-select-option v-for="dept in allDepartments" :key="dept.id" :value="dept.id">
                {{ dept.name }}
              </a-select-option>
            </a-select>

            <a-form-item name="assigned_to_section" no-style>
              <a-select v-model:value="
                  departmentSectionAssignmentForm.assigned_to_section
                " :placeholder="$t('selectSectionOptional')" style="width: 100%" :disabled="
                  !departmentSectionAssignmentForm.assigned_to_department ||
                  editingDepartmentSectionAssignment !== null
                " allow-clear>
                <a-select-option v-for="section in assignableSections" :key="section.id" :value="section.id">
                  {{ section.name }}
                </a-select-option>
              </a-select>
            </a-form-item>
          </a-form-item>

          <a-form-item :label="$t('target')" required name="targetValue">
            <a-input v-model:value="departmentSectionAssignmentForm.targetValue" :placeholder="$t('target')"
              style="width: 100%" @input="(event) => handleNumericInput('targetValue', event)" />
          </a-form-item>

          <div v-if="departmentSectionAssignmentError" style="color: red; margin-top: 10px">
            {{ departmentSectionAssignmentError }}
          </div>
        </a-form>
      </a-spin>
    </a-modal>

    <a-modal :open="isDeleteDepartmentSectionAssignmentModalVisible"
      @update:open="isDeleteDepartmentSectionAssignmentModalVisible = $event" :title="$t('confirmDeletion')"
      @ok="handleDeleteDepartmentSectionAssignment" @cancel="isDeleteDepartmentSectionAssignmentModalVisible = false"
      :confirm-loading="submittingDepartmentSectionDeletion" :ok-text="$t('delete')" :cancel-text="$t('cancel')"
      ok-type="danger">
      <p v-if="departmentSectionAssignmentToDelete">
        {{ $t("confirmRemoveAssignmentFor") }}
        <strong>
          <span v-if="departmentSectionAssignmentToDelete.department">
            {{ $t("department") }}:
            {{ departmentSectionAssignmentToDelete.department.name }}
          </span>
          <span v-else-if="departmentSectionAssignmentToDelete.section">
            {{ $t("section") }}:
            {{ departmentSectionAssignmentToDelete.section.name }}
          </span>
          <span v-else-if="departmentSectionAssignmentToDelete.team">
            {{ $t("team") }}:
            {{ departmentSectionAssignmentToDelete.team.name }}
          </span>
          <span v-else> {{ $t("thisUnit") }} </span>
        </strong>
        ?
      </p>
      <p v-else>{{ $t("confirmDeleteAssignment") }}</p>
    </a-modal>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, reactive } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useStore } from "vuex";
import { useI18n } from "vue-i18n";

const { t: $t } = useI18n();

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
} from "@/core/constants/kpiStatus";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";

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

const modalFilterDepartmentId = ref(null);
const modalFilterSectionId = ref(null);

const modalFilterAssignableSections = computed(() => {
  if (!modalFilterDepartmentId.value) return [];

  return allSections.value.filter(
    (s) =>
      s.department_id === modalFilterDepartmentId.value ||
      s.department?.id === modalFilterDepartmentId.value
  );
});

const contextSectionId = computed(() => {
  const id = route.query.contextSectionId;
  return id ? parseInt(id, 10) : null;
});


const isCompanyOverviewMode = computed(() => {
  const noDeptContext = !contextDepartmentId.value;
  const noSectionContext = !contextSectionId.value;
  return noDeptContext && noSectionContext;
});

console.log("isCompanyOverviewMode", isCompanyOverviewMode.value);

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
const isToggling = computed(() => store.getters["kpis/isTogglingKpiStatus"]);
const toggleStatusError = computed(
  () => store.getters["kpis/toggleKpiStatusError"]
);

// const effectiveRole = computed(() => {
//   const userRoles = currentUser.value?.roles || [];

//   const rolePriority = ["admin", "manager", "department", "section"];

//   for (const role of rolePriority) {
//     if (userRoles.some((userRole) => userRole.name === role)) {
//       return role;
//     }
//   }

//   return null; // Không có role phù hợp
// });

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

const userPermissions = computed(
  () => store.getters["auth/user"]?.permissions || []
);

/**
 * Helper kiểm tra quyền động RBAC FE (resource:action)
 * @param {string} action
 * @param {string} resource
 * @returns {boolean}
 */
function hasPermission(action, resource) {
  return userPermissions.value.some(
    (p) => p.action === action && p.resource === resource
  );
}

// Kiểm tra quyền động cho các action quản trị KPI
const canToggleStatus = computed(() =>
  hasPermission(RBAC_ACTIONS.TOGGLE_STATUS, RBAC_RESOURCES.KPI)
);

// Copy KPI làm template
const canCopyTemplate = computed(() =>
  hasPermission(RBAC_ACTIONS.COPY_TEMPLATE, RBAC_RESOURCES.KPI)
);

const canAssignDepartment = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_COMPANY)
);

const canAssignSection = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_DEPARTMENT)
);

const canAssignEmployees = computed(() =>
  hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_SECTION)
);

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
const isAssignUsersInDeptSectionsModalVisible = ref(false);
const selectedSectionIdForUserAssign = ref(null);
const selectedUserIdsInSection = ref([]);
const assigningUsersInSection = ref(false);
const userAssignErrorInSection = ref(null);
const assignUsersInSectionTargetDetails = reactive({});

const assignedUserIdsInSection = computed(() => {
  if (!selectedSectionIdForUserAssign.value) return [];
  return (kpiDetailData.value?.assignments || [])
    .filter(
      (a) =>
        a.assigned_to_employee &&
        a.employee?.sectionId === selectedSectionIdForUserAssign.value
    )
    .map((a) => a.employee.id);
});

const assignableUsersInSection = computed(() => {
  // Giả sử bạn đã fetch danh sách users của section này vào biến users
  const users = store.getters["employees/usersBySection"](
    selectedSectionIdForUserAssign.value
  ) || [];
  return users
    .filter((u) => !assignedUserIdsInSection.value.includes(u.id))
    .map((u) => ({
      value: u.id,
      label: `${u.first_name || ""} ${u.last_name || ""} (${u.username})`,
    }));
});

const sectionsInContextDepartment = computed(() => {
  if (!contextDepartmentId.value) return [];
  return allSections.value
    .filter(
      (s) =>
        s.department_id === contextDepartmentId.value ||
        s.department?.id === contextDepartmentId.value
    )
    .map((s) => ({
      value: s.id,
      label: s.name,
    }));
});

const assignUsersInSectionTableData = computed(() => {
  return selectedUserIdsInSection.value.map((userId) => {
    const user = assignableUsersInSection.value.find((u) => u.value === userId);
    return {
      userId,
      name: user ? user.label : userId,
      target: assignUsersInSectionTargetDetails[userId] || null,
    };
  });
});

const onSelectedUsersInSectionChange = (userIds) => {
  // Xóa target của user đã bỏ chọn
  Object.keys(assignUsersInSectionTargetDetails).forEach((uid) => {
    if (!userIds.includes(Number(uid)) && !userIds.includes(uid)) {
      delete assignUsersInSectionTargetDetails[uid];
    }
  });
  // Đảm bảo có key cho user mới chọn
  userIds.forEach((uid) => {
    if (!assignUsersInSectionTargetDetails[uid]) {
      assignUsersInSectionTargetDetails[uid] = null;
    }
  });
};

const handleAssignUsersInSection = async () => {
  userAssignErrorInSection.value = null;
  if (
    !selectedSectionIdForUserAssign.value ||
    !selectedUserIdsInSection.value.length
  ) {
    userAssignErrorInSection.value = $t("selectSectionAndUsersRequired");
    return;
  }
  // Kiểm tra target
  for (const userId of selectedUserIdsInSection.value) {
    const target = assignUsersInSectionTargetDetails[userId];
    if (target === null || target === undefined || target === "" || isNaN(Number(target))) {
      userAssignErrorInSection.value = $t("targetRequiredForEachUser");
      return;
    }
  }
  assigningUsersInSection.value = true;
  try {
    await store.dispatch("kpis/saveUserAssignments", {
      kpiId: kpiId.value,
      assignmentsPayload: {
        assignments: selectedUserIdsInSection.value.map((userId) => ({
          user_id: userId,
          section_id: selectedSectionIdForUserAssign.value,
          target: Number(assignUsersInSectionTargetDetails[userId]),
        })),
      },
    });
    notification.success({ message: $t("usersAssignedSuccessfully") });
    closeAssignUsersInDeptSectionsModal();
    await fetchKpiUserAssignmentsData(kpiId.value);
  } catch (err) {
    userAssignErrorInSection.value =
      err?.message || $t("failedToSaveAssignments");
  } finally {
    assigningUsersInSection.value = false;
  }
};

const fetchUsersInSection = async () => {
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
  if (!selectedSectionIdForUserAssign.value) return;
  try {
    await store.dispatch(
      "employees/fetchUsersBySection",
      selectedSectionIdForUserAssign.value
    );
    const users = store.getters["employees/usersBySection"](
      selectedSectionIdForUserAssign.value
    );
    assignableUsersInSection.value = Array.isArray(users)
      ? users.map((u) => ({
        value: u.id,
        label: `${u.first_name || ""} ${u.last_name || ""} (${u.username})`,
      }))
      : [];
  } catch (err) {
    userAssignErrorInSection.value =
      err?.message || $t("failedToLoadAssignableUsers");
  }
};


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
    return filteredSections;
  } else {
    return sectionsForSelectedDept;
  }
});

const openAssignUsersInDeptSectionsModal = () => {
  isAssignUsersInDeptSectionsModalVisible.value = true;
  selectedSectionIdForUserAssign.value = null;
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
};

const closeAssignUsersInDeptSectionsModal = () => {
  isAssignUsersInDeptSectionsModalVisible.value = false;
  selectedSectionIdForUserAssign.value = null;
  assignableUsersInSection.value = [];
  selectedUserIdsInSection.value = [];
  userAssignErrorInSection.value = null;
};

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
    if (
      contextAssignment &&
      typeof contextAssignment.targetValue !== "undefined" &&
      contextAssignment.targetValue !== null
    ) {
      const contextTarget = parseFloat(contextAssignment.targetValue);
      return isNaN(contextTarget) ? 0 : contextTarget;
    }
  } else if (
    currentContextDeptId !== null &&
    currentContextDeptId !== undefined
  ) {
    const contextAssignment = assignments.find(
      (assign) => assign.assigned_to_department === currentContextDeptId
    );
    if (
      contextAssignment &&
      typeof contextAssignment.targetValue !== "undefined" &&
      contextAssignment.targetValue !== null
    ) {
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
      const sectionUserAssignments = userAssignments.filter(
        (assign) =>
          assign.employee && assign.employee.sectionId === currentContextSectId
      );
      sectionUserAssignments.forEach((assign) => {
        const targetValue = assign.targetValue ?? assign.target;
        if (
          targetValue !== null &&
          targetValue !== undefined &&
          !isNaN(targetValue)
        ) {
          total += Number(targetValue);
        }
      });
      return total;
    } else {
      return 0;
    }
  } else if (
    currentContextDeptId !== null &&
    currentContextDeptId !== undefined
  ) {
    if (!assignments || !Array.isArray(assignments)) {
      return 0;
    }
    if (!sectionsData || !Array.isArray(sectionsData)) {
      return 0;
    }
    const sectionToDeptMap = new Map();
    sectionsData.forEach((section) => {
      const sectionId = section?.id;
      const deptId = section?.department?.id ?? section?.department_id;
      if (typeof sectionId === "number" && typeof deptId === "number") {
        sectionToDeptMap.set(sectionId, deptId);
      }
    });
    assignments.forEach((assign) => {
      const sectionId = assign.assigned_to_section;
      const targetValue = assign.targetValue;
      if (
        sectionId !== null &&
        sectionId !== undefined &&
        targetValue !== null &&
        targetValue !== undefined &&
        !isNaN(targetValue)
      ) {
        const assignedSectionId = Number(sectionId);
        if (
          !isNaN(assignedSectionId) &&
          sectionToDeptMap.get(assignedSectionId) === currentContextDeptId
        ) {
          total += Number(targetValue);
        }
      }
    });
    return total;
  } else {
    if (!assignments || !Array.isArray(assignments)) {
      return 0;
    }
    if (!sectionsData || !Array.isArray(sectionsData)) {
      return 0;
    }
    const sectionToDeptMap = new Map();
    sectionsData.forEach((section) => {
      const sectionId = section?.id;
      const deptId = section?.department?.id ?? section?.department_id;
      if (typeof sectionId === "number" && typeof deptId === "number") {
        sectionToDeptMap.set(sectionId, deptId);
      }
    });
    const assignedSectionIds = new Set(
      assignments
        .filter(
          (a) =>
            a.assigned_to_section !== null &&
            a.assigned_to_section !== undefined
        )
        .map((a) => Number(a.assigned_to_section))
        .filter((id) => !isNaN(id))
    );
    assignments.forEach((assign) => {
      const targetValue = assign.targetValue;
      let shouldIncludeTarget = false;
      if (
        targetValue !== undefined &&
        targetValue !== null &&
        !isNaN(targetValue) &&
        Number(targetValue) >= 0
      ) {
        if (
          assign.assigned_to_section !== null &&
          assign.assigned_to_section !== undefined
        ) {
          shouldIncludeTarget = true;
        } else if (
          assign.assigned_to_department !== null &&
          assign.assigned_to_department !== undefined
        ) {
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

const companyOverviewDepartmentAssignments = computed(() => {
  if (!isCompanyOverviewMode.value) return [];

  const assignmentsArray = Array.isArray(kpiDetailData.value?.assignments)
    ? kpiDetailData.value.assignments
    : [];

  return assignmentsArray.filter(
    (a) =>
      a.assigned_to_department &&
      (!a.assigned_to_section || a.assigned_to_section === null) &&
      (!a.assigned_to_employee || a.assigned_to_employee === null)
  );
});

const companyOverviewSectionAssignments = computed(() => {
  if (!isCompanyOverviewMode.value || !kpiDetailData.value?.assignments)
    return [];

  const assignmentsArray = Array.isArray(kpiDetailData.value?.assignments)
    ? kpiDetailData.value.assignments
    : [];

  const sectionsList = allSections.value;

  return assignmentsArray
    .filter(
      (a) =>
        a.assigned_to_section &&
        (!a.assigned_to_employee || a.assigned_to_employee === null)
    )
    .map((a) => ({
      ...a,
      section: Array.isArray(sectionsList)
        ? sectionsList.find((s) => s.id === a.assigned_to_section) || a.section
        : a.section,
    }));
});

const companyOverviewUserAssignments = computed(() => {
  if (!isCompanyOverviewMode.value || !kpiDetailData.value?.assignments)
    return [];

  const assignmentsArray = Array.isArray(kpiDetailData.value?.assignments)
    ? kpiDetailData.value.assignments
    : [];

  return assignmentsArray.filter((a) => a.assigned_to_employee);
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

const handleToggleStatus = async (kpiId) => {
  if (!kpiId || isToggling.value) return;
  store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
  try {
    await store.dispatch("kpis/toggleKpiStatus", { kpiId });
  } catch (error) {
    console.error("Error toggling KPI status:", error);
  }
};

const getKpiDefinitionStatusText = (status) =>
  KpiDefinitionStatusText($t)[status] || status || "";

const getKpiDefinitionStatusColor = (status) =>
  KpiDefinitionStatusColor[status] || "default";

const clearToggleError = () => {
  store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
};

const sectionIdForUserAssignmentsCard = computed(() => {
  // Ưu tiên contextDepartmentId: lấy section đầu tiên thuộc phòng ban đó
  if (contextDepartmentId.value) {
    const sectionsInDepartment = allSections.value.filter(
      (section) =>
        section.department_id === contextDepartmentId.value ||
        section.department?.id === contextDepartmentId.value
    );
    if (sectionsInDepartment.length > 0) {
      return sectionsInDepartment[0].id;
    }
  }

  // Ưu tiên contextSectionId nếu có
  if (contextSectionId.value) {
    return contextSectionId.value;
  }

  // Nếu user hiện tại có sectionId thì lấy sectionId đó
  if (currentUser.value?.sectionId) {
    return currentUser.value.sectionId;
  }

  // Nếu KPI được tạo bởi section thì lấy luôn section đó
  if (
    kpiDetailData.value?.created_by_type === "section" &&
    kpiDetailData.value?.created_by
  ) {
    return kpiDetailData.value.created_by;
  }

  return null;
});

const filteredDirectUserAssignments = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const kpi = kpiDetailData.value;

  const currentDeptId =
    kpi?.created_by_type === "department" ? kpi?.created_by : null;

  if (
    !kpi ||
    kpi.created_by_type !== "department" ||
    !currentDeptId ||
    !Array.isArray(allAssignments)
  ) {
    return [];
  }

  return allAssignments.filter((assign) => {
    const isUserAssignment = assign.assigned_to_employee !== null;

    let employeeDepartmentId = assign.employee?.departmentId;
    let employeeHasSection =
      assign.employee?.sectionId !== null &&
      assign.employee?.sectionId !== undefined;

    return (
      isUserAssignment &&
      employeeDepartmentId === currentDeptId &&
      !employeeHasSection
    );
  });
});

const filteredSectionUserAssignments = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const sectionIdToFilterBy = sectionIdForUserAssignmentsCard.value;

  if (!sectionIdToFilterBy || !Array.isArray(allAssignments)) {
    return [];
  }

  return allAssignments.filter((assign) => {
    return (
      assign.assigned_to_employee !== null &&
      assign.employee?.sectionId == sectionIdToFilterBy
    );
  });
});

const filteredUserAssignmentsInDepartmentSections = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const deptId = contextDepartmentId.value;
  const sections = allSections.value;

  if (!deptId || !Array.isArray(allAssignments) || !Array.isArray(sections)) {
    return [];
  }

  // Lấy danh sách sectionId thuộc phòng ban context
  const sectionIdsInDept = sections
    .filter(
      (s) =>
        s.department_id === deptId ||
        (s.department && s.department.id === deptId)
    )
    .map((s) => s.id);

  return allAssignments.filter((assign) => {
    // Chỉ lấy assignment cho user, có sectionId thuộc phòng ban context
    const isUserAssignment = assign.assigned_to_employee !== null;
    const sectionId = assign.employee?.sectionId;
    return (
      isUserAssignment &&
      sectionId !== null &&
      sectionId !== undefined &&
      sectionIdsInDept.includes(sectionId)
    );
  });
});

const shouldShowUserAssignmentsInDepartmentSectionsCard = computed(() => {
  const deptId = contextDepartmentId.value;
  if (!deptId) return false;

  // Kiểm tra phòng ban có section không
  const sections = allSections.value.filter(
    (s) =>
      s.department_id === deptId ||
      (s.department && s.department.id === deptId)
  );
  if (sections.length === 0) return false;

  // Kiểm tra quyền động RBAC
  if (!hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_SECTION)) return false;

  return true;
});

const shouldShowDirectUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;

  // Chỉ áp dụng cho KPI tạo bởi phòng ban
  if (!kpi || kpi.created_by_type !== "department") {
    return false;
  }

  const departmentId = kpi.created_by;
  const allDepartmentsList = allDepartments.value;

  // Phòng ban phải tồn tại
  const kpiDepartment = Array.isArray(allDepartmentsList)
    ? allDepartmentsList.find((d) => d.id == departmentId)
    : undefined;

  if (!kpiDepartment) {
    return false;
  }

  // Phòng ban không được có section
  const deptHasSections = departmentHasSections.value;
  if (deptHasSections === null || deptHasSections === true) {
    return false;
  }

  // Kiểm tra quyền động RBAC
  if (!hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_SECTION)) {
    return false;
  }

  // Nếu cần kiểm tra thêm quyền quản lý phòng ban, có thể bổ sung điều kiện động ở đây (nếu có logic custom)
  // Ví dụ: nếu muốn chỉ cho phép user thuộc phòng ban này thì:
  // if (actualUser.value?.department_id !== departmentId) return false;

  return true;
});

const shouldShowSectionUserAssignmentCard = computed(() => {
  const kpi = kpiDetailData.value;
  const user = currentUser.value;
  const sectionId = sectionIdForUserAssignmentsCard.value;

  // Phải có dữ liệu KPI, user, section context
  if (!kpi || !user || !sectionId) return false;

  // Kiểm tra quyền động RBAC: phải có quyền ASSIGN trên KPI_SECTION
  if (!hasPermission(RBAC_ACTIONS.ASSIGN, RBAC_RESOURCES.KPI_SECTION)) return false;

  // Nếu muốn chỉ cho phép user thuộc section đó thì kiểm tra thêm:
  // if (user.sectionId && user.sectionId !== sectionId) return false;

  return true;
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
    return $t("assignKpiToUsersInSection", { sectionName });
  }

  if (isEditingUserAssignment.value) {
    return $t("editUserAssignment");
  }
  return $t("assignKpiToUsers");
});

const assignUsersInSectionColumns = computed(() => [
  { title: $t("user"), key: "user", dataIndex: "user", width: "60%" },
  { title: $t("target"), key: "target", dataIndex: "target", width: "40%" },
]);


const departmentSectionAssignmentColumns = computed(() => [
  { title: $t("assignedUnit"), key: "assignedUnit", width: "30%" },
  {
    title: $t("targetValue"),
    key: "targetValue",
    dataIndex: "targetValue",
    width: "15%",
    align: "right",
  },
  {
    title: $t("latestActual"),
    key: "actual",
    dataIndex: "latest_actual_value",
    width: "15%",
    align: "right",
  },
  {
    title: $t("status"),
    key: "status",
    dataIndex: "status",
    width: "15%",
    align: "center",
  },
  { title: $t("common.actions"), key: "actions", align: "center", width: "100px" },
]);

const userAssignmentColumns = computed(() => [
  {
    title: $t("user"),
    key: "user",
    dataIndex: "user",
    width: "25%",
  },
  {
    title: $t("target"),
    key: "target",
    dataIndex: "target",
    align: "right",
    width: "25%",
  },
  {
    title: $t("latestActual"),
    key: "actual",
    dataIndex: "latest_actual_value",
    align: "right",
    width: "20%",
  },
  {
    title: $t("status"),
    key: "status",
    dataIndex: "status",
    align: "center",
    width: "20%",
  },
  {
    title: $t("common.actions"),
    key: "actions",
    align: "center",
    width: "150px",
  },
]);
const modalUserAssignmentInputColumns = computed(() => [
  {
    title: $t("employee"),
    key: "user",
    width: "40%",
  },
  {
    title: $t("target"),
    key: "target",
    width: "30%",
  },
]);

const getAssignmentStatusText = (status) => {
  return KpiDefinitionStatusText($t)[status] || status || "";
};
const getAssignmentStatusColor = (status) => {
  if (status === KpiDefinitionStatus.APPROVED) return "success";
  if (status === KpiDefinitionStatus.DRAFT) return "default";
  return "default";
};

const filteredAssignmentsForContextDepartment = computed(() => {
  const allAssignments = kpiDetailData.value?.assignments;
  const deptIdContext = contextDepartmentId.value;

  const sectionToDeptMap = new Map();
  allSections.value.forEach((section) => {
    const sectionId = section?.id;

    const deptId = section?.department?.id ?? section?.department_id;
    if (typeof sectionId === "number" && typeof deptId === "number") {
      sectionToDeptMap.set(sectionId, deptId);
    }
  });

  if (
    deptIdContext === null ||
    deptIdContext === undefined ||
    !Array.isArray(allAssignments)
  ) {
    return [];
  }

  return allAssignments.filter((assign) => {
    if (
      assign.assigned_to_section !== null &&
      assign.assigned_to_section !== undefined
    ) {
      const sectionId = Number(assign.assigned_to_section);
      if (
        !isNaN(sectionId) &&
        sectionToDeptMap.get(sectionId) === deptIdContext
      ) {
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
      message: $t("error"),
      description: $t("cannotIdentifyAssignmentToDelete"),
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

    notification.success({ message: $t("assignmentDeletedSuccessfully") });

    isDeleteDepartmentSectionAssignmentModalVisible.value = false;
    departmentSectionAssignmentToDelete.value = null;

    await loadDetail();
  } catch (error) {
    console.error("Failed to delete Department/Section assignment:", error);
    const errorMessage =
      store.getters["kpis/error"] ||
      error.message ||
      $t("failedToDeleteAssignment");
    departmentSectionAssignmentError.value = errorMessage;
    notification.error({
      message: $t("deletionFailed"),
      description: errorMessage,
    });
  } finally {
    submittingDepartmentSectionDeletion.value = false;
  }
};

const handleSaveDepartmentSectionAssignment = async () => {
  const isEditing = !!editingDepartmentSectionAssignment.value;
  // const hasContext = !!contextDepartmentId.value;

  // Kiểm tra trùng assignment phòng ban (không có section)
  if (
    departmentSectionAssignmentForm.assigned_to_department &&
    !departmentSectionAssignmentForm.assigned_to_section
  ) {
    const assignments = kpiDetailData.value?.assignments || [];
    const deptId = departmentSectionAssignmentForm.assigned_to_department;
    // Nếu đang edit thì bỏ qua chính assignment đang edit
    const duplicate = assignments.find(
      (a) =>
        a.assigned_to_department == deptId &&
        (!a.assigned_to_section || a.assigned_to_section === null) &&
        (!isEditing || a.id !== departmentSectionAssignmentForm.assignmentId)
    );
    if (duplicate) {
      departmentSectionAssignmentError.value = $t("departmentAlreadyAssigned");
      submittingDepartmentSectionAssignment.value = false;
      notification.error({
        message: $t("error"),
        description: $t("departmentAlreadyAssigned"),
      });
      return;
    }
  }

  if (!departmentSectionAssignmentForm.assigned_to_department) {
    departmentSectionAssignmentError.value = $t("selectDepartmentRequired");
    submittingDepartmentSectionAssignment.value = false;
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
      departmentSectionAssignmentError.value = $t("targetValueRequired");
      submittingDepartmentSectionAssignment.value = false;
      return;
    }

    let assignmentPayload = {
      assignmentId: departmentSectionAssignmentForm.assignmentId,
      assigned_to_department: null,
      assigned_to_section: null,
      targetValue: Number(departmentSectionAssignmentForm.targetValue),
    };

    // Sửa logic: Nếu chọn cả phòng ban và section thì đều phải gán vào payload
    assignmentPayload.assigned_to_department =
      departmentSectionAssignmentForm.assigned_to_department || null;
    assignmentPayload.assigned_to_section =
      departmentSectionAssignmentForm.assigned_to_section || null;
    assignmentPayload.status = kpiDetailData.value?.status;
    if (
      !assignmentPayload.assigned_to_department &&
      !assignmentPayload.assigned_to_section
    ) {
      departmentSectionAssignmentError.value = $t("assignmentTargetRequired");
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
        ? $t("assignmentUpdatedSuccessfully")
        : $t("assignmentAddedSuccessfully"),
    });

    closeManageDepartmentSectionAssignments();
    await loadDetail();
  } catch (error) {
    console.error("Failed to save Department/Section assignment:", error);
    const errMsg =
      store.getters["kpis/departmentSectionAssignmentSaveError"] ||
      error?.response?.data?.message ||
      error?.message ||
      $t("saveFailed");
    departmentSectionAssignmentError.value = errMsg;
    if (error?.response?.data?.errors) {
      const fieldErrors = Object.values(error.response.data.errors)
        .flat()
        .join(" ");
      departmentSectionAssignmentError.value = `${errMsg}: ${fieldErrors}`;
    }
    notification.error({
      message: $t("saveFailed"),
      description: errMsg,
    });
  } finally {
    submittingDepartmentSectionAssignment.value = false;
  }
};

const handleDepartmentSelectInModal = (departmentId) => {
  departmentSectionAssignmentForm.assigned_to_section = null;

  if (departmentId) {
    store.dispatch("sections/fetchSectionsByDepartment", departmentId);
  }
};

const handleNumericInput = (field, event) => {
  let value = event.target.value.replace(/[^0-9.]/g, "");
  const parts = value.split(".");
  if (parts.length > 2) {
    value = parts[0] + "." + parts.slice(1).join("");
  }
  // Format phần nguyên với dấu phẩy
  const [intPart, decPart] = value.split(".");
  let formatted = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (decPart !== undefined) formatted += "." + decPart;
  departmentSectionAssignmentForm[field] = formatted;
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
    await store.dispatch("kpis/fetchKpiDetail", id);

    store.commit("kpis/SET_TOGGLE_KPI_STATUS_ERROR", null);
  } else {
    console.error(
      "KpiDetail: Invalid KPI ID from route params:",
      route.params.id
    );
  }
};

const fetchKpiUserAssignmentsData = async (id) => {
  if (!id || typeof id !== "number") {
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
const fetchAssignableUsersData = async (
  modalDeptFilter = null,
  modalSectFilter = null
) => {
  const kpi = kpiDetailData.value;

  let fetchedUsersList = [];

  if (!isEditingUserAssignment.value) {
    selectedUserIds.value = [];
  }

  assignableUsers.value = [];
  loadingAssignableUsers.value = true;
  userAssignmentSubmitError.value = null;

  try {
    if (isCompanyOverviewMode.value) {
      if (modalSectFilter && modalDeptFilter) {
        await store.dispatch("employees/fetchUsersBySection", modalSectFilter);
        fetchedUsersList =
          store.getters["employees/usersBySection"](modalSectFilter);
      } else if (modalDeptFilter) {
        await store.dispatch(
          "employees/fetchUsersByDepartment",
          modalDeptFilter
        );
        fetchedUsersList =
          store.getters["employees/usersByDepartment"](modalDeptFilter);
      } else {
        fetchedUsersList = [];
      }
    } else {
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
      } else {
        fetchedUsersList = [];
      }
    }

    if (Array.isArray(fetchedUsersList)) {
      assignableUsers.value = fetchedUsersList;
    } else {
      console.error(
        "fetchAssignableUsersData: Fetched users list is NOT an array.",
        fetchedUsersList
      );
      assignableUsers.value = [];
      userAssignmentSubmitError.value = $t("failedToProcessUserList");
    }
  } catch (err) {
    console.error(
      "fetchAssignableUsersData: Error during dispatch or getter access:",
      err
    );
    userAssignmentSubmitError.value =
      store.getters["employees/error"] ||
      err.message ||
      $t("failedToLoadAssignableUsers");
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
  if (isCompanyOverviewMode.value) {
    modalFilterDepartmentId.value = null;
    modalFilterSectionId.value = null;
    assignableUsers.value = [];
  } else {
    fetchAssignableUsersData();
  }
  isAssignUserModalVisible.value = true;
};

const handleModalDepartmentFilterChange = () => {
  modalFilterSectionId.value = null;
  assignableUsers.value = [];
  selectedUserIds.value = [];
  if (modalFilterDepartmentId.value) {
    fetchAssignableUsersData(modalFilterDepartmentId.value, null);
  }
};

const handleModalSectionFilterChange = () => {
  assignableUsers.value = [];
  selectedUserIds.value = [];
  if (modalFilterSectionId.value && modalFilterDepartmentId.value) {
    fetchAssignableUsersData(
      modalFilterDepartmentId.value,
      modalFilterSectionId.value
    );
  } else if (modalFilterDepartmentId.value) {
    fetchAssignableUsersData(modalFilterDepartmentId.value, null);
  }
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
    userAssignmentSubmitError.value = $t("selectUsers");
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
    userAssignmentSubmitError.value = $t("invalidTarget");
    return;
  }
  submittingUserAssignment.value = true;
  const currentKpiId = kpiId.value;
  if (!currentKpiId) {
    userAssignmentSubmitError.value = $t("cannotGetKpiId");
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
        message: $t("assignmentUpdated"),
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
        message: $t("usersAssignedSuccessfully"),
      });
    }
    closeAssignUserModal();
    await fetchKpiUserAssignmentsData(currentKpiId);
  } catch (err) {
    userAssignmentSubmitError.value =
      store.getters["kpis/assignmentError"] ||
      err.message ||
      $t("failedToSave");
    notification.error({
      message: $t("saveFailed"),
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
      message: $t("cannotDeleteMissingAssignmentId"),
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
      message: $t("assignmentRemovedForUser", { userName }),
    });
    isDeleteUserAssignModalVisible.value = false;
    userAssignmentToDelete.value = null;
    /* Action fetch lại */
  } catch (err) {
    notification.error({
      message: $t("deletionFailed"),
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
      message: $t("evaluationCreatedPlaceholder"),
    });
    closeCreateEvaluationModal();
    await store.dispatch("kpis/fetchKpiDetail", kpiId.value);
  } catch (error) {
    notification.error({
      message: $t("failedToCreateEvaluation"),
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
          message: $t("couldNotLoadSectionsDepartments"),
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
