<template>
  <div class="role-permission-manager-table">
    <div class="header-bar">
      <div class="header-left">
        <h2 class="page-title">
          <i class="fa fa-user-shield title-icon"></i>
          {{ $t("rolePermissionManagement") }}
        </h2>
      </div>
      <div class="header-controls">
        <div class="role-select-group">
          <label class="role-label">{{ $t("role") }}:</label>
          <a-select v-model:value="currentRoleId" style="min-width: 220px">
            <a-select-option
              v-for="role in rolesWithPermissions"
              :key="role.id"
              :value="role.id"
            >
              {{ roleDisplayName(role.name) }}
            </a-select-option>
          </a-select>
        </div>
        <a-input
          v-model:value="searchText"
          :placeholder="$t('searchPermission')"
          allow-clear
          class="search-input"
        />
        <a-button
          type="primary"
          @click="saveAll"
          :loading="loading"
          class="save-btn"
        >
          <template #icon
            ><i style="margin-right: 6px" class="fa fa-save"></i
          ></template>
          {{ $t("saveAll") }}
        </a-button>
      </div>
    </div>
    <div class="permission-group-list">
      <div
        v-for="group in filteredPermissionGroups"
        :key="group.label"
        class="permission-group-block"
      >
        <div class="permission-group-title">
          <i class="fa fa-layer-group group-icon"></i>
          <span>{{ group.label }}</span>
          <span class="group-count">({{ group.permissions.length }})</span>
        </div>
        <div class="permission-group-grid">
          <div
            v-for="permission in group.permissions"
            :key="permission.id"
            class="permission-group-item"
          >
            <a-switch
              :checked="currentRole.permissionIds.includes(permission.id)"
              @change="
                (checked) =>
                  onTogglePermission(currentRole, permission.id, checked)
              "
            />
            <a-tooltip :title="permissionDescription(permission.id)">
              <span class="perm-label">{{
                permissionDisplayName(permission)
              }}</span>
            </a-tooltip>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted, computed, watch } from "vue";
import { message } from "ant-design-vue";
import { useI18n } from "vue-i18n";
import { useStore } from "vuex";

const { t } = useI18n();
const store = useStore();

const loading = computed(() => store.getters["loading/isLoading"]);
const rolesWithPermissions = ref([]);
const allPermissions = ref([]);
const searchText = ref("");

const permissionDisplayName = (permission) => {
  const actionKey = permission.action;
  const resourceKey = permission.resource.replace(/:/g, "_");
  const scopeKey = permission.scope || "";

  let key = `permission.${actionKey}_${resourceKey}`;
  if (scopeKey) key += `_${scopeKey}`;
  const i18nLabel = t(key);
  if (i18nLabel !== key) return i18nLabel;

  return `${t("action." + actionKey) || actionKey} - ${t("resource." + resourceKey) || permission.resource}${scopeKey ? " - " + t("scope." + scopeKey) : ""}`;
};

const permissionDescription = (permissionId) => {
  const permission = allPermissions.value.find((p) => p.id === permissionId);
  if (!permission) return "";
  const actionKey = permission.action;
  const resourceKey = permission.resource.replace(/:/g, "_");
  const scopeKey = permission.scope || "";
  let i18nKey = `permissionDesc.${actionKey}_${resourceKey}`;
  if (scopeKey) i18nKey += `_${scopeKey}`;
  const desc = t(i18nKey);
  if (desc === i18nKey) return permissionDisplayName(permission);
  return desc;
};

onMounted(async () => {
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
});

const onTogglePermission = (record, permissionId, checked) => {
  if (checked) {
    if (!record.permissionIds.includes(permissionId)) {
      record.permissionIds.push(permissionId);
    }
  } else {
    const index = record.permissionIds.indexOf(permissionId);
    if (index !== -1) {
      record.permissionIds.splice(index, 1);
    }
  }
};

const saveAll = async () => {
  loading.value = true;
  try {
    await Promise.all(
      rolesWithPermissions.value.map((role) =>
        store.dispatch("employees/updateRolePermissions", {
          roleId: role.id,
          permissionIds: role.permissionIds,
        })
      )
    );
    message.success(t("permissionsUpdatedSuccessfully"));
  } catch (error) {
    message.error(t("errorUpdatingPermissions"));
  } finally {
    loading.value = false;
  }
};

const roleDisplayName = (name) => {
  const i18nName = t(`role.${name}`);
  return i18nName !== `role.${name}` ? i18nName : name;
};

const permissionGroups = computed(() => {
  const groupedActions = [
    "export",
    "toggle-status",
    "copy-template",
    "delete",
    "update",
  ];
  const actionOrder = [
    "view",
    "create",
    "edit",
    "approve",
    "reject",
    "assign",
    "assign_user",
    "assign_unit",
    "assign_direct_user",
    "assign_section",
    "personal",
    "manage",
  ];
  const groups = [];
  const usedIds = new Set();
  actionOrder.forEach((action) => {
    const perms = allPermissions.value.filter((p) => p.action === action);
    if (perms.length) {
      groups.push({
        label: t("action." + action) || action,
        permissions: perms,
      });
      perms.forEach((p) => usedIds.add(p.id));
    }
  });
  const specialPerms = allPermissions.value.filter((p) =>
    groupedActions.includes(p.action)
  );
  if (specialPerms.length) {
    groups.push({
      label: t("permissionBlock.special"),
      permissions: specialPerms,
    });
    specialPerms.forEach((p) => usedIds.add(p.id));
  }
  const otherPerms = allPermissions.value.filter((p) => !usedIds.has(p.id));
  if (otherPerms.length) {
    groups.push({
      label: t("permissionBlock.other"),
      permissions: otherPerms,
    });
  }
  return groups;
});

const currentRoleId = ref("");
const currentRole = computed(
  () =>
    rolesWithPermissions.value.find((r) => r.id === currentRoleId.value) ||
    rolesWithPermissions.value[0] || { permissionIds: [] }
);
watch(
  rolesWithPermissions,
  (val) => {
    if (val.length && !val.find((r) => r.id === currentRoleId.value)) {
      currentRoleId.value = val[0].id;
    }
  },
  { immediate: true }
);

const filteredPermissionGroups = computed(() => {
  if (!searchText.value) return permissionGroups.value;
  const lower = searchText.value.toLowerCase();
  return permissionGroups.value
    .map((group) => ({
      ...group,
      permissions: group.permissions.filter((p) =>
        permissionDisplayName(p).toLowerCase().includes(lower)
      ),
    }))
    .filter((group) => group.permissions.length > 0);
});
</script>

<style scoped>
.role-permission-manager-table {
  padding: 36px 0 36px 0;
  background: linear-gradient(135deg, #f6fafd 0%, #e9f0fb 100%);
  border-radius: 18px;
  box-shadow: 0 4px 24px rgba(0, 32, 128, 0.08);
}

.header-bar {
  display: flex;
  justify-content: space-between;
  align-items: flex-end;
  margin-bottom: 28px;
  gap: 18px;
  flex-wrap: wrap;
}
.header-left {
  display: flex;
  align-items: center;
  gap: 10px;
}
.header-controls {
  display: flex;
  align-items: flex-end;
  gap: 16px;
  flex-wrap: wrap;
}
.role-select-group {
  display: flex;
  align-items: center;
  gap: 8px;
}
.role-label {
  font-size: 1.08em;
  font-weight: 500;
  color: #1a2947;
}
.search-input {
  width: 320px;
  margin-bottom: 0;
}
.save-btn {
  font-weight: 600;
  font-size: 1.08em;
  padding: 0 22px;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.08);
}

.page-title {
  font-size: 1.6em;
  font-weight: 700;
  color: #1a2947;
  display: flex;
  align-items: center;
  gap: 10px;
}
.title-icon {
  color: #1677ff;
  font-size: 1.2em;
  padding-left: 25px;
}

.permission-group-list {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.permission-group-block {
  background: #f8fafc;
  border-radius: 12px;
  box-shadow: 0 2px 8px rgba(22, 119, 255, 0.06);
  padding: 18px 18px 12px 18px;
}
.permission-group-title {
  font-weight: 600;
  color: #1677ff;
  font-size: 1.08em;
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 10px;
}
.group-icon {
  color: #1677ff;
  font-size: 1.1em;
}
.group-count {
  color: #7b8794;
  font-size: 0.98em;
}
.permission-group-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 32px;
}
@media (max-width: 900px) {
  .permission-group-grid {
    grid-template-columns: 1fr;
  }
}
.permission-group-item {
  display: flex;
  align-items: center;
  background: #fff;
  border-radius: 7px;
  padding: 8px 14px;
  box-shadow: 0 1px 4px rgba(22, 119, 255, 0.04);
  border: 1px solid #e3eaf7;
  margin-bottom: 8px;
}
.perm-label {
  margin-left: 12px;
  word-break: break-word;
  color: #2d3a4a;
  font-size: 1em;
  font-weight: 500;
}
.permission-table-wrapper {
  background: #fff;
  border-radius: 14px;
  box-shadow: 0 2px 12px rgba(0, 32, 128, 0.06);
  padding: 18px 12px 18px 12px;
  margin-top: 8px;
  overflow-x: auto;
}

.permission-table-ui {
  width: 100%;
  border-collapse: collapse;
  background: #fff;
}
.permission-table-ui th,
.permission-table-ui td {
  border: 1px solid #e3eaf7;
  padding: 10px 8px;
  font-size: 1em;
  vertical-align: middle;
}
.permission-table-ui th {
  background: #f8fafc;
  color: #1677ff;
  font-weight: 600;
  text-align: left;
}
.info-icon {
  color: #1677ff;
  font-size: 1.1em;
}
.perm-label {
  font-weight: 500;
  color: #1a2947;
}
.action-label {
  color: #1677ff;
  font-weight: 500;
}
.resource-label {
  color: #2d3a4a;
}
.scope-label {
  color: #7b8794;
  font-size: 0.98em;
}
@media (max-width: 900px) {
  .header-bar {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .header-controls {
    flex-direction: column;
    align-items: stretch;
    gap: 10px;
  }
  .search-input {
    width: 100%;
  }
  .permission-table-ui th,
  .permission-table-ui td {
    font-size: 0.95em;
    padding: 7px 4px;
  }
}
</style>
