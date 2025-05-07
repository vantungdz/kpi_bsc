<template>
  <div class="employee-list">
    <h2>Danh sách nhân viên</h2>
    <a-table :columns="columns" :data-source="employees" row-key="id">
      <template #bodyCell="{ column, record }">
        <template v-if="column.dataIndex === 'fullName'">
          {{ record.first_name }} {{ record.last_name }}
        </template>
        <template v-else-if="column.dataIndex === 'department'">
          {{ record.department?.name || '--' }}
        </template>
        <template v-else-if="column.dataIndex === 'section'">
          {{ record.section?.name || '--' }}
        </template>
        <template v-else-if="column.dataIndex === 'role'">
          {{ record.role || '--' }}
        </template>
        <template v-else>
          {{ record[column.dataIndex] || '--' }}
        </template>
      </template>
    </a-table>
  </div>
</template>

<script>
import { onMounted, computed } from 'vue';
import { useStore } from 'vuex';

export default {
  name: 'EmployeeList',
  setup() {
    const store = useStore();

    const employees = computed(() => store.getters['employees/userList']);

    const columns = [
      {
        title: 'Tên nhân viên',
        dataIndex: 'fullName',
        key: 'fullName',
      },
      {
        title: 'Phòng ban',
        dataIndex: 'department',
        key: 'department',
      },
      {
        title: 'Bộ phận',
        dataIndex: 'section',
        key: 'section',
      },
      {
        title: 'Vai trò',
        dataIndex: 'role',
        key: 'role',
      },
    ];

    onMounted(() => {
      store.dispatch('employees/fetchUsers');
    });

    return {
      employees,
      columns,
    };
  },
};
</script>

<style scoped>
.employee-list {
  padding: 20px;
}
</style>