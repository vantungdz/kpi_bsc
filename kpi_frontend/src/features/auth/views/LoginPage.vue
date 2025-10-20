<template>
  <div class="login-container">
    <div class="login-box">
      <img
        src="@/core/assets/logo.png"
        :alt="$t('logoAlt')"
        class="login-logo"
      />
      <h2>{{ $t("kpiSystemLogin") }}</h2>
      <a-form
        ref="formRef"
        :model="formData"
        :rules="rules"
        layout="vertical"
        @finish="handleLogin"
        @finishFailed="onFinishFailed"
      >
        <a-form-item
          :label="$t('username')"
          name="username"
          has-feedback
          :validateTrigger="['change', 'blur']"
        >
          <a-input
            v-model:value="formData.username"
            :placeholder="$t('enterUsername')"
            :disabled="loading"
            size="large"
          >
            <template #prefix>
              <user-outlined />
            </template>
          </a-input>
        </a-form-item>
        <a-form-item
          :label="$t('password')"
          name="password"
          has-feedback
          :validateTrigger="['change', 'blur']"
        >
          <a-input-password
            v-model:value="formData.password"
            :placeholder="$t('enterPassword')"
            :disabled="loading"
            size="large"
          >
            <template #prefix>
              <lock-outlined />
            </template>
          </a-input-password>
        </a-form-item>
        <a-form-item name="remember" class="remember-forgot-row">
          <a-checkbox v-model:checked="rememberMe" :disabled="loading">
            {{ $t("rememberMe") }}
          </a-checkbox>
          <router-link to="/forgot-password" class="forgot-password-link">
            {{ $t("forgotPassword") }}
          </router-link>
        </a-form-item>
        <a-form-item
          v-if="error"
          style="margin-top: -10px; margin-bottom: 15px"
        >
          <a-alert
            :message="error"
            type="error"
            show-icon
            closable
            @close="clearError"
          />
        </a-form-item>
        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="loading"
            block
            size="large"
          >
            {{ $t("login") }}
          </a-button>
        </a-form-item>
      </a-form>
    </div>
  </div>
</template>
<script setup>
import { ref, reactive, computed, onUnmounted } from "vue";

import { useStore } from "vuex";
import { useRouter } from "vue-router";

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

const formData = reactive({
  username: "",
  password: "",
});

const formRef = ref();
const rememberMe = ref(false);

const store = useStore();
const router = useRouter();

const loading = computed(() => store.getters["auth/authStatus"] === "loading");
const error = computed(() => store.state.auth.error);

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

if (localStorage.getItem("rememberMe") === "true") {
  rememberMe.value = true;
  const savedUsername = localStorage.getItem("rememberedUsername");
  if (savedUsername) formData.username = savedUsername;
}

const handleLogin = async (values) => {
  if (rememberMe.value) {
    localStorage.setItem("rememberMe", "true");
    localStorage.setItem("rememberedUsername", values.username);
  } else {
    localStorage.removeItem("rememberMe");
    localStorage.removeItem("rememberedUsername");
  }
  const success = await store.dispatch("auth/login", {
    username: values.username,
    password: values.password,
    remember: rememberMe.value,
  });

  if (success) {
    router.push("/home");
  } else {
    console.error("Login failed (handled by action).");
    formData.password = "";
  }
};

const onFinishFailed = (errorInfo) => {
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

const clearError = () => {
  store.commit("auth/SET_ERROR", null);
};

onUnmounted(() => {
  if (error.value) {
    clearError();
  }
});
</script>
<style scoped>
:root {
  --brand-primary: #1976d2;
  --brand-primary-hover: #125ea2;
  --brand-link: #1976d2;
  --brand-primary-bg: #f5faff;
  --brand-shadow: 0 8px 32px 0 rgba(25, 118, 210, 0.1);
}
.login-container {
  position: fixed;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, #f5faff 0%, #e3f0ff 100%);
  padding: 0;
  overflow: auto;
  min-height: unset;
  height: unset;
}
.login-box {
  background: #fff;
  border-radius: 18px;
  box-shadow: var(--brand-shadow);
  padding: 48px 38px 36px 38px;
  max-width: 400px;
  width: 100%;
  text-align: center;
  animation: fadeIn 0.7s cubic-bezier(0.4, 0, 0.2, 1);
  max-height: 100vh;
  overflow-y: auto;
}
@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(30px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
.login-logo {
  max-height: 60px;
  margin-bottom: 28px;
  filter: drop-shadow(0 2px 8px #1976d220);
}
.login-box h2 {
  margin-bottom: 32px;
  color: var(--brand-primary);
  font-size: 2rem;
  font-weight: 700;
  letter-spacing: 0.5px;
}
:deep(.ant-form-item-label > label) {
  font-weight: 600;
  font-size: 1rem;
  color: #1976d2;
}
:deep(.ant-form-item) {
  margin-bottom: 22px;
}
:deep(.ant-input-affix-wrapper),
:deep(.ant-input-password-affix-wrapper) {
  border-radius: 8px;
  background: #f5faff;
  border: 1.5px solid #e3f0ff;
  transition:
    border-color 0.2s,
    box-shadow 0.2s;
}
:deep(.ant-input-affix-wrapper-focused),
:deep(.ant-input-password-affix-wrapper-focused) {
  border-color: var(--brand-primary);
  box-shadow: 0 0 0 2px #1976d220;
}
:deep(.ant-input),
:deep(.ant-input-password) {
  background: transparent;
}
:deep(.ant-input-prefix),
:deep(.ant-input-password-icon) {
  color: #1976d2;
  opacity: 0.8;
}
:deep(.ant-checkbox-checked .ant-checkbox-inner) {
  background-color: var(--brand-primary);
  border-color: var(--brand-primary);
}
:deep(.ant-checkbox-inner) {
  border-radius: 4px;
}
:deep(.ant-checkbox-wrapper:hover .ant-checkbox-inner),
:deep(.ant-checkbox:hover .ant-checkbox-inner),
:deep(.ant-checkbox-input:focus + .ant-checkbox-inner) {
  border-color: var(--brand-primary);
}
.remember-forgot-row.ant-form-item {
  margin-bottom: 18px;
}
.remember-forgot-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
}
.forgot-password-link {
  font-size: 0.95em;
  color: var(--brand-link);
  text-decoration: none;
  transition: color 0.2s;
}
.forgot-password-link:hover {
  text-decoration: underline;
  color: var(--brand-primary-hover);
}
:deep(.ant-btn) {
  border-radius: 8px;
  font-weight: 600;
  font-size: 1.08rem;
  height: 44px;
  transition:
    background 0.2s,
    border 0.2s,
    transform 0.1s;
}
:deep(.ant-btn-primary) {
  background: linear-gradient(90deg, #1976d2 80%, #2196f3 100%);
  border: none;
  color: #fff;
  box-shadow: 0 2px 8px #1976d220;
}
:deep(.ant-btn-primary:not(:disabled):hover) {
  background: linear-gradient(90deg, #125ea2 80%, #1976d2 100%);
  color: #fff;
}
:deep(.ant-btn:active:not(:disabled)) {
  transform: scale(0.97);
}
:deep(.ant-alert) {
  border-radius: 8px;
  font-size: 1rem;
}
@media (max-width: 600px) {
  .login-box {
    padding: 28px 8px 24px 8px;
    max-width: 98vw;
  }
  .login-logo {
    max-height: 44px;
  }
  .login-box h2 {
    font-size: 1.2rem;
  }
}
</style>
