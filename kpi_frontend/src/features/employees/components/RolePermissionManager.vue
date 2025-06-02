<template>
  <div class="role-permission-manager">
    <div class="header-row">
      <h2>{{ $t('rolePermissionManagement') }}</h2>
      <a-button type="primary" @click="saveAll" :loading="loading">
        {{ $t('saveAll') }}
      </a-button>
    </div>
    <a-table :dataSource="rolesWithPermissions" :columns="columns" rowKey="id" :loading="loading" bordered
      table-layout="fixed">
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
                  <template v-for="option in viewOptions.slice(0, Math.ceil(viewOptions.length / 2))"
                    :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
                <div class="view-block-col">
                  <template v-for="option in viewOptions.slice(Math.ceil(viewOptions.length / 2))" :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <!-- Create/Edit/Delete block (2 cột dọc) -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.createEditDelete') }}</span>
              <div class="permission-block-toggles view-block view-block-2col">
                <div class="view-block-col">
                  <template
                    v-for="option in createEditDeleteOptions.slice(0, Math.ceil(createEditDeleteOptions.length/2))"
                    :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
                <div class="view-block-col">
                  <template v-for="option in createEditDeleteOptions.slice(Math.ceil(createEditDeleteOptions.length/2))"
                    :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <!-- Gộp Approve/Reject và Assign thành 1 block -->
            <div class="permission-block">
              <span class="permission-block-label">{{ $t('permissionBlock.approveRejectAssign') }}</span>
              <div class="permission-block-toggles view-block view-block-2col">
                <div class="view-block-col">
                  <template v-for="option in approveRejectOptions" :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
                <div class="view-block-col">
                  <template v-for="option in assignOptions" :key="option.value">
                    <div class="permission-toggle-item">
                      <a-switch :checked="record.permissionIds.includes(option.value)"
                        @change="checked => onTogglePermission(record, option.value, checked)" />
                      <a-tooltip :title="permissionDescription(option.value)">
                        <span class="permission-toggle-label">{{ option.label }}</span>
                      </a-tooltip>
                    </div>
                  </template>
                </div>
              </div>
            </div>
            <!-- Các nhóm còn lại gom chung 1 khối -->
            <div class="permission-block" v-if="otherOptionsWithManage.length">
              <span class="permission-block-label">{{ $t('permissionBlock.other') }}</span>
              <div class="permission-block-toggles other-block">
                <template v-for="option in otherOptionsWithManage" :key="option.value">
                  <div class="permission-toggle-item">
                    <a-switch :checked="record.permissionIds.includes(option.value)"
                      @change="checked => onTogglePermission(record, option.value, checked)" />
                    <a-tooltip :title="permissionDescription(option.value)">
                      <span class="permission-toggle-label">{{ option.label }}</span>
                    </a-tooltip>
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

const loading = computed(() => store.getters["loading/isLoading"]);

const rolesWithPermissions = ref([]);
const allPermissions = ref([]);

const permissionDisplayName = (permission) => {
  const resourceKey = permission.resource.replace(/:/g, "_");
  const key = `permission.${permission.action}_${resourceKey}`;
  return t(key);
};

const permissionDescription = (permissionId) => {
  const permission = allPermissions.value.find((p) => p.id === permissionId);
  if (!permission) return "";
  const resourceKey = permission.resource.replace(/:/g, "_");
  const i18nKey = `permissionDesc.${permission.action}_${resourceKey}`;
  const desc = t(i18nKey);
  if (desc === i18nKey) return permissionDisplayName(permission);
  return desc;
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
  // Ưu tiên lấy từ i18n, fallback về roleName nếu không có
  const key = roleName === 'admin' ? 'administrator' : roleName;
  return t(key) || roleName;
};

const columns = computed(() => [
  { title: t('role'), dataIndex: 'name', key: 'role', width: '15%',
    customRender: ({ record }) => `${roleDisplayName(record.name)}${record.description ? ' - ' + record.description : ''}`
  },
  { title: t('permissions'), key: 'permissions', scopedSlots: { customRender: 'permissions' } },
]);

const fetchData = async () => {
  await store.dispatch("loading/startLoading");
  try {
    const [roles, permissions] = await Promise.all([
      store.dispatch("employees/fetchRolesWithPermissions"),
      store.dispatch("employees/fetchAllPermissions"),
    ]);
    rolesWithPermissions.value = (roles || []).map((r) => ({
      ...r,
      permissionIds: (r.permissions || []).map((p) => p.id),
    }));
    allPermissions.value = permissions || [];
  } catch (e) {
    message.error(t("errorLoadingRolesOrPermissions"));
  } finally {
    await store.dispatch("loading/stopLoading");
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
  await store.dispatch("loading/startLoading");
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
    await store.dispatch("loading/stopLoading");
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
