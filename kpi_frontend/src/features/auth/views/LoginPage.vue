<template>
  <div class="login-container">
    <div class="login-box">
      <img src="@/core/assets/logo.png" :alt="$t('logoAlt')" class="login-logo" />
      <h2>{{ $t('kpiSystemLogin') }}</h2>
      <a-form ref="formRef" :model="formData" :rules="rules" layout="vertical" @finish="handleLogin"
        @finishFailed="onFinishFailed">
        <a-form-item :label="$t('username')" name="username" has-feedback :validateTrigger="['change', 'blur']">
          <a-input v-model:value="formData.username" :placeholder="$t('enterUsername')" :disabled="loading" size="large">
            <template #prefix>
              <user-outlined />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item :label="$t('password')" name="password" has-feedback :validateTrigger="['change', 'blur']">
          <a-input-password v-model:value="formData.password" :placeholder="$t('enterPassword')" :disabled="loading"
            size="large">
            <template #prefix>
              <lock-outlined />
            </template>
          </a-input-password>
        </a-form-item>
        <a-form-item name="remember" class="remember-forgot-row">
          <a-checkbox v-model:checked="rememberMe" :disabled="loading">
            {{ $t('rememberMe') }}
          </a-checkbox>
          <router-link to="/forgot-password" class="forgot-password-link">
            {{ $t('forgotPassword') }}
          </router-link>
        </a-form-item>
        <a-form-item v-if="error" style="margin-top: -10px; margin-bottom: 15px">
          <a-alert :message="error" type="error" show-icon closable @close="clearError" />
        </a-form-item>
        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="loading" block size="large">
            {{ $t('login') }}
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>
<script setup>
// Vue core imports
import { ref, reactive, computed, onUnmounted } from "vue";
// Vuex and Router
import { useStore } from "vuex";
import { useRouter } from "vue-router";
// Ant Design Vue components and icons
import {
  Form as AForm,
  FormItem as AFormItem,
  Input as AInput,
  InputPassword as AInputPassword,
  Button as AButton,
  Alert as AAlert,
  Checkbox as ACheckbox,
  notification,
} from "ant-design-vue";
import { UserOutlined, LockOutlined } from "@ant-design/icons-vue";

// Reactive form data
const formData = reactive({
  username: "",
  password: "",
});

// Refs
const formRef = ref();
const rememberMe = ref(false);

// Store and router instances
const store = useStore();
const router = useRouter();

// Computed properties
const loading = computed(() => store.getters["auth/authStatus"] === "loading");
const error = computed(() => store.state.auth.error);

// Validation rules extracted outside component logic for clarity
const rules = reactive({
  username: [
    {
      required: true,
      message: "Please input your Username!",
    },
  ],
  password: [
    {
      required: true,
      message: "Please input your Password!",
    },
    {
      min: 6,
      message: "Password must be minimum 6 characters.",
      trigger: "change",
    },
  ],
});

// Handle login form submission
const handleLogin = async (values) => {
  const success = await store.dispatch("auth/login", {
    username: values.username,
    password: values.password,
  });

  if (success) {
    console.log("Login successful, redirecting to /performance");
    router.push("/performance");
  } else {
    console.error("Login failed (handled by action).");
    formData.password = "";
  }
};

// Handle form validation failure
const onFinishFailed = (errorInfo) => {
  console.log("Form validation failed:", errorInfo);
  let errorMessages = "Please double check required fields and input formats.";
  if (errorInfo?.errorFields?.length > 0) {
    const firstErrorField = errorInfo.errorFields[0];
    const fieldName = Array.isArray(firstErrorField.name)
      ? firstErrorField.name.join(".")
      : firstErrorField.name;
    const errors = Array.isArray(firstErrorField.errors)
      ? firstErrorField.errors.join(", ")
      : "Unknown error";
    errorMessages = `Error in field '${fieldName}': ${errors}`;
  }
  notification.error({
    message: "Validation Failed",
    description: errorMessages,
  });
};

// Clear error state in store
const clearError = () => {
  store.commit("auth/SET_ERROR", null);
};

// Clear error on component unmount
onUnmounted(() => {
  if (error.value) {
    clearError();
  }
});
</script>
<style scoped>
/* 
    Nếu bạn có các biến màu global, hãy định nghĩa chúng trong một file CSS chung.
    Ví dụ: --brand-primary: #0056b3; 
  */
.login-container {
  display: flex;
  justify-content: center;
  align-items: center;
  min-height: 100vh;
  padding: 20px;
  background: linear-gradient(to bottom right, #ece9e6, #ffffff);
}
.login-box {
  background-color: #fff;
  padding: 40px 35px;
  border-radius: 10px;
  box-shadow: 0 5px 20px rgba(0, 0, 0, 0.12);
  width: 100%;
  max-width: 420px;
  text-align: center;
}
.login-logo {
  max-height: 60px;
  margin-bottom: 25px;
}
.login-box h2 {
  margin-bottom: 35px;
  color: #343a40;
  font-size: 1.75rem;
  font-weight: 700;
}
:deep(.ant-form-item-label > label) {
  font-weight: 600;
  font-size: 0.9rem;
  color: #495057;
}
:deep(.ant-form-item) {
  margin-bottom: 24px;
}
.remember-forgot-row.ant-form-item {
  margin-bottom: 20px;
}
.remember-forgot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.forgot-password-link {
  font-size: 0.9em;
  color: var(--brand-link);
  text-decoration: none;
  transition: color 0.2s ease;
}
.forgot-password-link:hover {
  text-decoration: underline;
  color: var(--brand-primary-hover);
}
:deep(.ant-input-affix-wrapper:focus),
:deep(.ant-input-affix-wrapper-focused),
:deep(.ant-input-password-affix-wrapper:focus),
:deep(.ant-input-password-affix-wrapper-focused) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px
    color-mix(in srgb, var(--brand-primary) 20%, transparent);
}
:deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: var(--brand-primary);
  border-color: var(--brand-primary);
}
:deep(.ant-checkbox-wrapper:hover .ant-checkbox-inner),
:deep(.ant-checkbox:hover .ant-checkbox-inner),
:deep(.ant-checkbox-input:focus + .ant-checkbox-inner) {
  border-color: var(--brand-primary);
}
:deep(.ant-btn) {
  transition:
    background-color 0.2s ease-in-out,
    border-color 0.2s ease-in-out,
    transform 0.1s ease;
}
:deep(.ant-btn-primary) {
  background-color: var(--brand-primary);
  border-color: var(--brand-primary);
  color: #fff;
}
:deep(.ant-btn-primary:not(:disabled):hover) {
  background-color: var(--brand-primary-hover);
  border-color: var(--brand-primary-hover);
}
:deep(.ant-btn:active:not(:disabled)) {
  transform: scale(0.98);
}
</style>
