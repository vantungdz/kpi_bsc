<template>
  <div class="role-permission-manager">
    <div class="header-row">
      <h2>{{ $t('rolePermissionManagement') }}</h2>
      <a-button type="primary" @click="saveAll" :loading="saving">
        {{ $t('saveAll') }}
      </a-button>
    </div>
    <a-table :dataSource="rolesWithPermissions" :columns="columns" rowKey="id" :loading="loading" bordered table-layout="fixed">
      <template #bodyCell="{ column, record }">
        <template v-if="column.key === 'name'">
          <span>{{ roleDisplayName(record.name) }}</span>
        </template>
        <template v-else-if="column.key === 'permissions'">
          <div class="permission-custom-layout">
            <!-- View block: chia 2 hàng dọc -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.view') }}</span>
              <div class="permission-block-toggles view-block view-block-2col">
                <div class="view-block-col">
                  <template v-for="option in viewOptions.slice(0, Math.ceil(viewOptions.length/2))" :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                      <span class="permission-toggle-label">{{ option.label }}</span>
                    </div>
                  </template>
                </div>
                <div class="view-block-col">
                  <template v-for="option in viewOptions.slice(Math.ceil(viewOptions.length/2))" :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                      <span class="permission-toggle-label">{{ option.label }}</span>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <!-- Create/Edit/Delete block -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.createEditDelete') }}</span>
              <div class="permission-block-toggles">
                <template v-for="option in createEditDeleteOptions" :key="option.value">
                  <div class="permission-toggle-item">
                    <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                    <span class="permission-toggle-label">{{ option.label }}</span>
                  </div>
                </template>
              </div>
            </div>
            <!-- Approve/Reject block -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.approveReject') }}</span>
              <div class="permission-block-toggles">
                <template v-for="option in approveRejectOptions" :key="option.value">
                  <div class="permission-toggle-item">
                    <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                    <span class="permission-toggle-label">{{ option.label }}</span>
                  </div>
                </template>
              </div>
            </div>
            <!-- Assign block -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.assign') }}</span>
              <div class="permission-block-toggles">
                <template v-for="option in assignOptions" :key="option.value">
                  <div class="permission-toggle-item">
                    <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                    <span class="permission-toggle-label">{{ option.label }}</span>
                  </div>
                </template>
              </div>
            </div>
            <!-- Các nhóm còn lại gom chung 1 khối -->
            <div class="permission-block" v-if="otherOptionsWithManage.length">
              <span class="permission-block-label">{{ $t('permissionBlock.other') }}</span>
              <div class="permission-block-toggles other-block">
                <template v-for="option in otherOptionsWithManage" :key="option.value">
                  <div class="permission-toggle-item">
                    <a-switch :checked="record.permissionIds.includes(option.value)" @change="checked => onTogglePermission(record, option.value, checked)" />
                    <span class="permission-toggle-label">{{ option.label }}</span>
                  </div>
                </template>
              </div>
            </div>
          </div>
        </template>
      </template>
    </a-table>
  </div>
</template>

<script setup>
import { ref, onMounted, computed } from 'vue';
import { message } from 'ant-design-vue';
import { useI18n } from 'vue-i18n';
import { useStore } from 'vuex';

const { t } = useI18n();
const store = useStore();
const loading = ref(false);
const saving = ref(false);
const rolesWithPermissions = ref([]);
const allPermissions = ref([]);

const permissionDisplayName = (permission) => {
  const key = `permission.${permission.action}_${permission.resource}`;
  return t(key);
};

const groupPermissionOptions = computed(() => {
  // Gom nhóm các quyền theo action (view, create, edit, delete, approve, reject, ...)
  const groups = {};
  allPermissions.value.forEach(p => {
    const action = p.action;
    if (!groups[action]) groups[action] = [];
    groups[action].push({ label: permissionDisplayName(p), value: p.id });
  });
  // Sắp xếp action phổ biến lên trước
  const actionOrder = [
    'manage', 'view', 'create', 'edit', 'delete', 'approve', 'reject', 'assign', 'toggle-status', 'export', 'generate', 'copy', 'personal', 'toggle_status'
  ];
  const ordered = [];
  actionOrder.forEach(act => {
    if (groups[act]) ordered.push({ action: act, options: groups[act] });
  });
  // Thêm các action còn lại (nếu có)
  Object.keys(groups).forEach(act => {
    if (!actionOrder.includes(act)) ordered.push({ action: act, options: groups[act] });
  });
  return ordered;
});

const viewOptions = computed(() => (groupPermissionOptions.value.find(g => g.action === 'view')?.options || []));
const createEditDeleteOptions = computed(() => {
  const arr = [];
  ['create','edit','delete'].forEach(act => {
    const group = groupPermissionOptions.value.find(g => g.action === act);
    if (group) arr.push(...group.options);
  });
  return arr;
});
const approveRejectOptions = computed(() => {
  const arr = [];
  ['approve','reject'].forEach(act => {
    const group = groupPermissionOptions.value.find(g => g.action === act);
    if (group) arr.push(...group.options);
  });
  return arr;
});
const assignOptions = computed(() => {
  const arr = [];
  ['assign','assign_user','assign_unit','assign_direct_user','assign_section'].forEach(act => {
    const group = groupPermissionOptions.value.find(g => g.action === act);
    if (group) arr.push(...group.options);
  });
  return arr;
});
const otherOptionsWithManage = computed(() => {
  // Gom tất cả quyền còn lại (bao gồm cả manage) thành 1 mảng
  return groupPermissionOptions.value.filter(g => !['view','create','edit','delete','approve','reject','assign','assign_user','assign_unit','assign_direct_user','assign_section'].includes(g.action)).flatMap(g => g.options);
});

const roleDisplayName = (roleName) => {
  switch (roleName) {
    case 'admin': return t('administrator');
    case 'manager': return t('manager');
    case 'department': return t('department_head');
    case 'section': return t('section_head');
    case 'employee': return t('employee');
    default: return roleName;
  }
};

const columns = computed(() => [
  { title: t('role'), dataIndex: 'name', key: 'role', width: '15%',
    customRender: ({ record }) => `${roleDisplayName(record.name)}${record.description ? ' - ' + record.description : ''}`
  },
  { title: t('permissions'), key: 'permissions', scopedSlots: { customRender: 'permissions' } },
]);

const fetchData = async () => {
  loading.value = true;
  try {
    const [roles, permissions] = await Promise.all([
      store.dispatch('employees/fetchRolesWithPermissions'),
      store.dispatch('employees/fetchAllPermissions'),
    ]);
    rolesWithPermissions.value = (roles || []).map(r => ({
      ...r,
      permissionIds: (r.permissions || []).map(p => p.id),
    }));
    allPermissions.value = permissions || [];
  } catch (e) {
    message.error(t('errorLoadingRolesOrPermissions'));
  } finally {
    loading.value = false;
  }
};

const onTogglePermission = (role, permissionId, checked) => {
  
  if (checked) {
    if (!role.permissionIds.includes(permissionId)) {
      role.permissionIds.push(permissionId);
    }
  } else {
    role.permissionIds = role.permissionIds.filter(id => id !== permissionId);
  }
};

const saveAll = async () => {
  saving.value = true;
  try {
    await Promise.all(
      rolesWithPermissions.value.map(role =>
        store.dispatch('employees/updateRolePermissions', {
          roleId: role.id,
          permissionIds: role.permissionIds,
        })
      )
    );
    message.success(t('permissionsUpdatedSuccessfully'));
    fetchData();
  } catch (e) {
    message.error(t('errorUpdatingPermissions'));
  } finally {
    saving.value = false;
  }
};

onMounted(fetchData);
</script>

<style scoped>
.role-permission-manager {
  padding: 24px;
  background: #fff;
  border-radius: 8px;
}
.header-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 18px;
}
.permission-custom-layout {
  display: flex;
  flex-wrap: wrap;
  gap: 18px 32px;
}
.permission-block {
  min-width: 220px;
  background: #f8f9fa;
  border-radius: 6px;
  padding: 8px 10px 10px 10px;
  margin-bottom: 8px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
}
.permission-block-label {
  font-weight: 600;
  text-transform: capitalize;
  margin-bottom: 6px;
  color: #3b3b3b;
  font-size: 13px;
}
.permission-block-toggles {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.view-block {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.view-block-2col {
  flex-direction: row;
  gap: 0 24px;
}
.view-block-col {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.permission-toggle-item {
  display: flex;
  align-items: center;
  margin: 5px 0;
}
.permission-toggle-label {
  margin-left: 4px;
  font-size: 13px;
}
.other-block {
  flex-direction: row;
  flex-wrap: wrap;
  gap: 10px 18px;
}
</style>
