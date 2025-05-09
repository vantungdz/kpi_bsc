import { createRouter, createWebHistory } from "vue-router";
import store from "../store"; 
import PerformanceObjectives from "../../features/evaluation/views/PerformanceObjectives.vue";
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
import KpiReview from "../../features/evaluation/views/KpiReview.vue"; // Hoặc đường dẫn đúng


const routes = [
  {
    path: "/kpi/review", // Hoặc một path khác phù hợp
    name: "KpiReview",
    component: KpiReview,
    meta: { requiresAuth: true, roles: ["manager", "admin"] }, // Chỉ manager và admin được review
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
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/dashboard/kpi-process-stats",
    name: "KpiProcessStats",
    component: KpiProcessStatistics,
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/dashboard/kpi-inventory-stats",
    name: "KpiInventoryStatistics",
    component: KpiInventoryStatistics,
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/dashboard/user-activity-stats",
    name: "UserActivityStatistics",
    component: UserActivityStatistics,
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
  {
    path: "/dashboard/kpi-performance-overview",
    name: "KpiPerformanceOverview",
    component: KpiPerformanceOverview,
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
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
    path: "/performance",
    name: "PerformanceObjectives",
    component: PerformanceObjectives,
    meta: { requiresAuth: true },
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
        meta: { roles: ["admin", "manager"] },
      },
      {
        path: "department",
        name: "KpiListDepartment",
        component: KpiListDepartment,
        meta: { roles: ["admin", "manager", "department"] },
      },
      {
        path: "department-create",
        name: "KpiCreateDepartment",
        component: KpiCreateDepartment,
        props: true,
        meta: { roles: ["admin", "manager", "department"] },
      },
      {
        path: "section",
        name: "KpiListSection",
        component: KpiListSection,
        meta: { roles: ["admin", "manager", "section", "department"] },
      },
      {
        path: "section-create",
        name: "KpiCreateSection",
        component: KpiCreateSection,
        props: true,
        meta: { roles: ["admin", "manager", "department", "section"] },
      },
      {
        path: "create",
        name: "KpiCreateCompany",
        component: KpiCreateCompany,
        props: (route) => ({ scope: route.query.scope }),
        meta: { roles: ["admin", "manager"] },
      },
      {
        path: ":id",
        name: "KpiDetail",
        component: KpiDetail,
        props: true,
      },
    ],
  },
  {
    path: "/approvals",
    name: "PendingApprovals",
    component: KpiValueApprovalList,
    meta: {
      requiresAuth: true,
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
    meta: { requiresAuth: true },
  },
  {
    path: "/employees",
    name: "EmployeeList",
    component: EmployeeList,
    meta: { requiresAuth: true, roles: ["admin", "manager"] },
  },
];

const router = createRouter({
  history: createWebHistory(process.env.BASE_URL),
  routes,
});


router.beforeEach((to, from, next) => {
  
  const requiresAuth = to.matched.some((record) => record.meta.requiresAuth);

  
  const isAuthenticated = store.getters["auth/isAuthenticated"];

  
  if (isAuthenticated && to.path === "/") {
    next({ path: "/performance" });
    return;
  }

  if (requiresAuth && !isAuthenticated) {
    
    
    next({ name: "LoginPage", query: { redirect: to.fullPath } });
  } else {
    
    
    const allowedRoles = to.meta.roles;

    if (
      allowedRoles &&
      Array.isArray(allowedRoles) &&
      allowedRoles.length > 0
    ) {
      
      
      const userEffectiveRole = store.getters["auth/effectiveRole"];

      if (!userEffectiveRole || !allowedRoles.includes(userEffectiveRole)) {
        
        console.warn(
          `User role '${userEffectiveRole}' not authorized for route ${to.name}`
        );
        
        
        next(false); 
      } else {
        
        next();
      }
    } else {
      
      next();
    }
  }
});


export default router;
