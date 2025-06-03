<template>
  <div class="perspective-create-form">
    <a-card :title="$t('perspectiveObject.managePerspectives')" bordered>
      <a-form @submit.prevent="handleSubmit" layout="vertical">
        <a-form-item
          :label="$t('perspectiveObject.name')"
          :rules="[
            { required: true, message: $t('perspectiveObject.nameRequired') },
            { min: 3, message: $t('perspectiveObject.nameMin') },
            { max: 50, message: $t('perspectiveObject.nameMax') },
          ]"
        >
          <a-input
            v-model:value="form.name"
            :disabled="isLoading"
            :placeholder="$t('perspectiveObject.namePlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('perspectiveObject.description')">
          <a-textarea
            v-model:value="form.description"
            :disabled="isLoading"
            :placeholder="$t('perspectiveObject.descriptionPlaceholder')"
            auto-size
          />
        </a-form-item>

        <a-form-item>
          <a-button type="primary" html-type="submit" :loading="isLoading">
            {{ $t("common.create") }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card
      v-if="perspectives.length"
      :title="$t('perspectiveObject.existingPerspectives')"
      bordered
      style="margin-top: 20px"
    >
      <a-list :data-source="perspectives" bordered>
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta
              :title="item.name"
              :description="item.description"
            />
            <template #actions>
              <a @click="handleEdit(item)">{{ $t("common.edit") }}</a>
              <a-popconfirm
                :title="$t('perspectiveObject.deleteConfirm')"
                @confirm="() => handleDelete(item.id)"
                :okText="$t('perspectiveObject.confirmYes')"
                :cancelText="$t('perspectiveObject.confirmNo')"
              >
                <a style="color: red;">{{ $t("common.delete") }}</a>
              </a-popconfirm>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>

    <a-modal
      v-model:visible="isUpdateModalVisible"
      :title="$t('perspectiveObject.updatePerspective')"
      @ok="handleUpdate"
      @cancel="closeUpdateModal"
      :confirm-loading="isLoading"
    >
      <a-form layout="vertical">
        <a-form-item
          :label="$t('perspectiveObject.name')"
          :rules="[
            { required: true, message: $t('perspectiveObject.nameRequired') },
            { min: 3, message: $t('perspectiveObject.nameMin') },
            { max: 50, message: $t('perspectiveObject.nameMax') },
          ]"
        >
          <a-input
            v-model:value="updateForm.name"
            :placeholder="$t('perspectiveObject.namePlaceholder')"
          />
        </a-form-item>

        <a-form-item :label="$t('perspectiveObject.description')">
          <a-textarea
            v-model:value="updateForm.description"
            :placeholder="$t('perspectiveObject.descriptionPlaceholder')"
            auto-size
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
.perspective-create-form {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}
</style>
