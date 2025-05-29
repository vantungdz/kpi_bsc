import { createRouter, createWebHistory } from "vue-router";
import store from "../store";
import { RBAC_ACTIONS, RBAC_RESOURCES } from "@/core/constants/rbac.constants";
import KpiListCompany from "../../features/kpi/views/KpiListCompany.vue";
import KpiListDepartment from "../../features/kpi/views/KpiListDepartment.vue";
import KpiListSection from "../../features/kpi/views/KpiListSection.vue";
import KpiCreateCompany from "../../features/kpi/views/create/KpiCreateCompany.vue";
import KpiDetail from "../../features/kpi/views/KpiDetail.vue";
import PersonalCreate from "../../features/kpi/views/create/PersonalCreate.vue";
import KpiPersonal from "../../features/kpi/views/KpiPersonal.vue";
import KpiCreateDepartment from "../../features/kpi/views/create/KpiCreateDepartment.vue";
import KpiCreateSection from "../../features/kpi/views/create/KpiCreateSection.vue";
import LoginPage from "../../features/auth/views/LoginPage.vue";
import KpiPerformanceOverview from "../../features/dashboard/views/KpiPerformanceOverview.vue";
import ForgotPasswordPage from "../../features/auth/views/ForgotPasswordPage.vue";
import KpiValueApprovalList from "../../features/kpi/views/KpiValueApprovalList.vue";
import UserProfile from "../../features/employees/views/UserProfile.vue";
import EmployeeList from "../../features/employees/views/EmployeeList.vue";
import DashBoard from "../../features/dashboard/DashBoard.vue";
import KpiProcessStatistics from "../../features/dashboard/views/KpiProcessStatistics.vue";
import UserActivityStatistics from "../../features/dashboard/views/UserActivityStatistics.vue";
import KpiInventoryStatistics from "@/features/dashboard/views/KpiInventoryStatistics.vue";
import ReportGenerator from "@/features/reports/views/ReportGenerator.vue";
import KpiInactiveList from "../../features/kpi/components/KpiInactiveList.vue";
import RolePermissionManager from "@/features/employees/components/RolePermissionManager.vue";
import HomePage from "../../features/home/HomePage.vue";
import MyKpiSelfReview from "../../features/evaluation/views/MyKpiSelfReview.vue";
import ReviewCycleCreate from "../../features/evaluation/views/ReviewCycleCreate.vue";
import DepartmentCreateForm from "@/features/departments/views/DepartmentCreateForm.vue";
import SectionCreateForm from "@/features/sections/views/SectionCreateForm.vue";
import KpiReviewList from "@/features/evaluation/views/KpiReviewList.vue";
import RoleManager from "@/features/roles/views/RoleManager.vue";
import KpiListEmployee from "../../features/kpi/views/KpiListEmployee.vue";
import EmployeePerformanceHistory from "@/features/employees/EmployeePerformanceHistory.vue";

const routes = [
  {
    path: "/report-generator",
    name: "ReportGenerator",
    component: ReportGenerator,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.REPORT,
        },
      ],
    },
  },
  {
    path: "/",
    name: "LoginPage",
    component: LoginPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/dashboard",
    name: "DashBoard",
    component: DashBoard,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.DASHBOARD,
        },
      ],
    },
  },
  {
    path: "/dashboard/kpi-process-stats",
    name: "KpiProcessStats",
    component: KpiProcessStatistics,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/kpi-inventory-stats",
    name: "KpiInventoryStatistics",
    component: KpiInventoryStatistics,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/user-activity-stats",
    name: "UserActivityStatistics",
    component: UserActivityStatistics,
    meta: { requiresAuth: true },
  },
  {
    path: "/dashboard/kpi-performance-overview",
    name: "KpiPerformanceOverview",
    component: KpiPerformanceOverview,
    meta: { requiresAuth: true },
  },
  {
    path: "/profile",
    name: "UserProfile",
    component: UserProfile,
    meta: { requiresAuth: true },
  },
  {
    path: "/forgot-password",
    name: "ForgotPasswordPage",
    component: ForgotPasswordPage,
    meta: { requiresAuth: false },
  },
  {
    path: "/kpis",
    name: "Kpis",
    meta: { requiresAuth: true },
    children: [
      {
        path: "company",
        name: "KpiListCompany",
        component: KpiListCompany,
        meta: {
          requiresAuth: true,
          permissions: [
            { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_COMPANY },
          ],
        },
      },
      {
        path: "department",
        name: "KpiListDepartment",
        component: KpiListDepartment,
        meta: {
          requiresAuth: true,
          permissions: [
            {
              action: RBAC_ACTIONS.VIEW,
              resource: RBAC_RESOURCES.KPI_DEPARTMENT,
            },
          ],
        },
      },
      {
        path: "department-create",
        name: "KpiCreateDepartment",
        component: KpiCreateDepartment,
        props: true,
        meta: { requiresAuth: true },
      },
      {
        path: "section",
        name: "KpiListSection",
        component: KpiListSection,
        meta: {
          requiresAuth: true,
          permissions: [
            { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_SECTION },
          ],
        },
      },
      {
        path: "section-create",
        name: "KpiCreateSection",
        component: KpiCreateSection,
        props: true,
        meta: { requiresAuth: true },
      },
      {
        path: "create",
        name: "KpiCreateCompany",
        component: KpiCreateCompany,
        props: (route) => ({ scope: route.query.scope }),
        meta: { requiresAuth: true },
      },
      {
        path: ":id",
        name: "KpiDetail",
        component: KpiDetail,
        props: true,
        meta: { requiresAuth: true },
      },
    ],
  },
  {
    path: "/approvals",
    name: "PendingApprovals",
    component: KpiValueApprovalList,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.KPI_VALUE,
        },
      ],
    },
  },
  {
    path: "/personal/create",
    name: "KpiPersonalCreate",
    component: PersonalCreate,
    meta: { requiresAuth: true },
  },
  {
    path: "/personal",
    name: "KpiPersonal",
    component: KpiPersonal,
    meta: {
      requiresAuth: true,
    },
  },
  {
    path: "/employees",
    name: "EmployeeList",
    component: EmployeeList,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.EMPLOYEE_COMPANY,
        },
      ],
    },
  },
  {
    path: "/home",
    name: "HomePage",
    component: HomePage,
    meta: { requiresAuth: true },
  },
  {
    path: "/kpis/inactive",
    name: "KpiInactiveList",
    component: KpiInactiveList,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.EMPLOYEE_COMPANY,
        },
      ],
    },
  },
  {
    path: "/user-role-manager",
    name: "RolePermissionManager",
    component: RolePermissionManager,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.ADMIN,
        },
      ],
    },
  },
  {
    path: "/my-kpi-self-review",
    name: "MyKpiSelfReview",
    component: MyKpiSelfReview,
    meta: { requiresAuth: true },
  },
  {
    path: "/review-cycle/create",
    name: "ReviewCycleCreate",
    component: ReviewCycleCreate,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.ADMIN,
        },
      ],
    },
  },
  {
    path: "/kpi-review",
    name: "KpiReviewList",
    component: KpiReviewList,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.KPI_VALUE,
        },
      ],
    },
  },
  {
    path: "/admin/create-department",
    name: "AdminCreateDepartment",
    component: DepartmentCreateForm,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.ADMIN,
        },
      ],
    },
  },
  {
    path: "/admin/create-section",
    name: "AdminCreateSection",
    component: SectionCreateForm,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.ADMIN,
        },
      ],
    },
  },
  {
    path: "/admin/create-role",
    name: "AdminCreateRole",
    component: RoleManager,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.ADMIN,
        },
      ],
    },
  },
  {
    path: "/kpis/employee-management",
    name: "KpiListEmployee",
    component: KpiListEmployee,
    meta: {
      requiresAuth: true,
      permissions: [
        { action: RBAC_ACTIONS.VIEW, resource: RBAC_RESOURCES.KPI_EMPLOYEE },
      ],
    },
  },
  {
    path: "/dashboard/employee-performance-history",
    name: "EmployeePerformanceHistory",
    component: EmployeePerformanceHistory,
    meta: {
      requiresAuth: true,
      permissions: [
        {
          action: RBAC_ACTIONS.VIEW,
          resource: RBAC_RESOURCES.EMPLOYEE_COMPANY,
        },
      ],
    },
  },
];

function hasPermission(userPermissions, action, resource) {
  return userPermissions?.some(
    (p) => p.action?.trim() === action && p.resource?.trim() === resource
  );
}

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});

router.beforeEach((to, from, next) => {
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);
  const isAuthenticated = store.getters["auth/isAuthenticated"];

  if (isAuthenticated && to.path === "/") {
    next({ path: "/home" });
    return;
  }

  if (requiresAuth && !isAuthenticated) {
    next({ name: "LoginPage", query: { redirect: to.fullPath } });
  } else {
    // Kiểm tra permission động nếu có
    const userPermissions = store.getters["auth/user"]?.permissions || [];
    const requiredPermissions = to.meta.permissions;
    if (
      requiredPermissions &&
      Array.isArray(requiredPermissions) &&
      requiredPermissions.length > 0
    ) {
      const ok = requiredPermissions.every((perm) =>
        hasPermission(userPermissions, perm.action, perm.resource)
      );
      if (!ok) {
        next({ name: "HomePage" });
        return;
      }
    }
    next();
  }
});

export default router;
