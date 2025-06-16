<template>
  <div class="perspective-create-form-modern">
    <div class="modern-header-light">
      <bulb-outlined class="header-icon-light" />
      <div class="header-title-group-light">
        <h3>{{ $t('perspectiveObject.managePerspectives') }}</h3>
        <div class="header-desc-light">{{ $t('perspectiveObject.manageDesc') || $t('perspectiveObject.managePerspectives') }}</div>
      </div>
    </div>
    <a-card class="modern-card-form-light" bordered>
      <a-form @submit.prevent="handleSubmit" layout="vertical" class="modern-form">
        <a-form-item
          :label="$t('perspectiveObject.name')"
          :rules=" [
            { required: true, message: $t('perspectiveObject.nameRequired') },
            { min: 3, message: $t('perspectiveObject.nameMin') },
            { max: 50, message: $t('perspectiveObject.nameMax') },
          ]"
        >
          <a-input
            v-model:value="form.name"
            :disabled="isLoading"
            :placeholder="$t('perspectiveObject.namePlaceholder')"
            size="large"
            class="modern-input"
          >
            <template #prefix><bulb-outlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item :label="$t('perspectiveObject.description')">
          <a-textarea
            v-model:value="form.description"
            :disabled="isLoading"
            :placeholder="$t('perspectiveObject.descriptionPlaceholder')"
            auto-size
            size="large"
            :rows="2"
            :maxlength="200"
            show-count
            class="modern-input"
          />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="isLoading" size="large" class="modern-btn" block>
            <plus-outlined /> {{ $t("common.create") }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>
    <div v-if="perspectives.length" class="modern-list-grid-light">
      <div
        v-for="item in perspectives"
        :key="item.id"
        class="modern-list-card"
      >
        <div class="modern-list-card-icon">
          <bulb-outlined />
        </div>
        <div class="modern-list-card-content">
          <div class="modern-list-card-title">{{ item.name }}</div>
          <div class="modern-list-card-desc">{{ item.description }}</div>
        </div>
        <div class="modern-list-card-actions">
          <a @click="handleEdit(item)"><edit-outlined /> {{ $t("common.edit") }}</a>
          <a-popconfirm
            :title="$t('perspectiveObject.deleteConfirm')"
            @confirm="() => handleDelete(item.id)"
            :okText="$t('perspectiveObject.confirmYes')"
            :cancelText="$t('perspectiveObject.confirmNo')"
          >
            <a style="color: #ef4444;"><delete-outlined /> {{ $t("common.delete") }}</a>
          </a-popconfirm>
        </div>
      </div>
    </div>
    <a-modal
      v-model:visible="isUpdateModalVisible"
      :title="$t('perspectiveObject.updatePerspective')"
      @ok="handleUpdate"
      @cancel="closeUpdateModal"
      :confirm-loading="isLoading"
      class="modern-modal"
    >
      <a-form layout="vertical" class="modern-form">
        <a-form-item
          :label="$t('perspectiveObject.name')"
          :rules=" [
            { required: true, message: $t('perspectiveObject.nameRequired') },
            { min: 3, message: $t('perspectiveObject.nameMin') },
            { max: 50, message: $t('perspectiveObject.nameMax') },
          ]"
        >
          <a-input
            v-model:value="updateForm.name"
            :placeholder="$t('perspectiveObject.namePlaceholder')"
            size="large"
            class="modern-input"
          >
            <template #prefix><bulb-outlined /></template>
          </a-input>
        </a-form-item>

        <a-form-item :label="$t('perspectiveObject.description')">
          <a-textarea
            v-model:value="updateForm.description"
            :placeholder="$t('perspectiveObject.descriptionPlaceholder')"
            auto-size
            size="large"
            :rows="2"
            :maxlength="200"
            show-count
            class="modern-input"
          />
        </a-form-item>
      </a-form>
    </a-modal>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed, ref } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";
import { BulbOutlined, PlusOutlined, EditOutlined, DeleteOutlined } from "@ant-design/icons-vue";
import { useI18n } from 'vue-i18n';

const { t: $t } = useI18n();
const store = useStore();

const form = reactive({
  name: "",
  description: "",
});

const updateForm = reactive({
  name: "",
  description: "",
});

const isUpdateModalVisible = ref(false);
const editingId = ref(null);

const perspectives = computed(() => store.state.perspectives.perspectives);
const isLoading = computed(() => store.state.perspectives.isLoading);

const handleFetch = async () => {
  try {
    await store.dispatch("perspectives/fetchPerspectives");
  } catch (error) {
    message.error("Error fetching perspectives");
  }
};

const handleSubmit = async () => {
  try {
    await store.dispatch("perspectives/createPerspective", form);
    message.success("Perspective created successfully");
    form.name = "";
    form.description = "";
    handleFetch();
  } catch (error) {
    message.error("Error creating perspective");
  }
};

const handleEdit = (perspective) => {
  editingId.value = perspective.id;
  updateForm.name = perspective.name;
  updateForm.description = perspective.description;
  isUpdateModalVisible.value = true;
};

const handleUpdate = async () => {
  try {
    await store.dispatch("perspectives/updatePerspective", {
      id: editingId.value,
      perspective: updateForm,
    });
    message.success("Perspective updated successfully");
    closeUpdateModal();
    handleFetch();
  } catch (error) {
    message.error("Error updating perspective");
  }
};

const closeUpdateModal = () => {
  isUpdateModalVisible.value = false;
  editingId.value = null;
  updateForm.name = "";
  updateForm.description = "";
};

const handleDelete = async (id) => {
  try {
    await store.dispatch("perspectives/deletePerspective", id);
    message.success("Perspective deleted successfully");
    handleFetch();
  } catch (error) {
    message.error("Error deleting perspective");
  }
};

onMounted(() => {
  handleFetch();
});
</script>

<style scoped>
.perspective-create-form-modern {
  max-width: 700px;
  margin: 0 auto;
  padding: 0 0 32px 0;
}
.modern-header-light {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #f4f7fd;
  border-radius: 14px;
  padding: 18px 22px 12px 22px;
  margin-bottom: -8px;
  border: 1px solid #e0e7ef;
  box-shadow: 0 1px 6px rgba(37,99,235,0.04);
}
.header-icon-light {
  font-size: 26px;
  color: #2563eb;
  background: #e0e7ff;
  border-radius: 50%;
  padding: 7px;
  box-shadow: 0 1px 4px rgba(37,99,235,0.07);
}
.header-title-group-light h3 {
  color: #1e293b;
  font-size: 1.25rem;
  font-weight: 600;
  margin-bottom: 2px;
}
.header-desc-light {
  color: #64748b;
  font-size: 0.98rem;
  margin-top: 2px;
}
.modern-card-form-light {
  border-radius: 14px;
  box-shadow: 0 1px 6px rgba(37,99,235,0.04);
  margin-bottom: 0;
  margin-top: 0;
  padding-top: 0;
  border: 1px solid #e0e7ef;
}
.modern-form {
  padding: 8px 0 0 0;
}
.modern-input {
  border-radius: 10px !important;
  box-shadow: 0 1px 4px rgba(37,99,235,0.03);
}
.modern-btn {
  border-radius: 8px;
  font-size: 1.05rem;
  font-weight: 600;
  height: 40px;
  margin-top: 8px;
}
.modern-list-grid-light {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 18px;
  margin-top: 28px;
}
.modern-list-card {
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 1px 6px rgba(37,99,235,0.06);
  padding: 18px 18px 12px 18px;
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  position: relative;
  min-height: 120px;
  transition: box-shadow 0.2s;
  border: 1px solid #e0e7ef;
}
.modern-list-card:hover {
  box-shadow: 0 4px 14px rgba(37,99,235,0.13);
}
.modern-list-card-icon {
  position: absolute;
  top: 12px;
  right: 12px;
  font-size: 22px;
  color: #2563eb;
  background: #e0e7ff;
  border-radius: 50%;
  padding: 5px;
}
.modern-list-card-title {
  font-weight: 600;
  color: #2563eb;
  font-size: 1.05rem;
  margin-bottom: 2px;
}
.modern-list-card-desc {
  color: #64748b;
  font-size: 0.97rem;
  margin-bottom: 12px;
  min-height: 24px;
}
.modern-list-card-actions {
  display: flex;
  gap: 12px;
  margin-top: auto;
}
.modern-list-card-actions a {
  font-weight: 500;
  font-size: 0.98rem;
  color: #2563eb;
  transition: color 0.15s;
}
.modern-list-card-actions a:hover {
  color: #1d4ed8;
}
.modern-modal .ant-modal-content {
  border-radius: 12px;
}
</style>
