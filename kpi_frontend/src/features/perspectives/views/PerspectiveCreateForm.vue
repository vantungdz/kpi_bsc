<template>
  <div class="perspective-create-form">
    <a-card title="Manage Perspectives" bordered>
      <a-form @submit.prevent="handleSubmit" layout="vertical">
        <a-form-item
          label="Name"
          :rules=" [
            { required: true, message: 'Please enter the perspective name' },
            { min: 3, message: 'Name must be at least 3 characters' },
            { max: 50, message: 'Name cannot exceed 50 characters' }
          ]"
        >
          <a-input
            v-model:value="form.name"
            :disabled="isLoading"
            placeholder="Enter perspective name"
          />
        </a-form-item>

        <a-form-item
          label="Description"
        >
          <a-textarea
            v-model:value="form.description"
            :disabled="isLoading"
            placeholder="Enter perspective description"
            auto-size
          />
        </a-form-item>

        <a-form-item>
          <a-button
            type="primary"
            html-type="submit"
            :loading="isLoading"
          >
            {{ editingId ? 'Update' : 'Create' }}
          </a-button>
        </a-form-item>
      </a-form>
    </a-card>

    <a-card v-if="perspectives.length" title="Existing Perspectives" bordered style="margin-top: 20px;">
      <a-list :data-source="perspectives" bordered>
        <template #renderItem="{ item }">
          <a-list-item>
            <a-list-item-meta :title="item.name" :description="item.description" />
            <template #actions>
              <a @click="handleEdit(item)">Edit</a>
              <a @click="handleDelete(item.id)">Delete</a>
            </template>
          </a-list-item>
        </template>
      </a-list>
    </a-card>
  </div>
</template>

<script setup>
import { reactive, onMounted, computed } from "vue";
import { useStore } from "vuex";
import { message } from "ant-design-vue";

const store = useStore();

const form = reactive({
  name: "",
  description: "",
});

let editingId = null;

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
    if (editingId) {
      await store.dispatch("perspectives/updatePerspective", {
        id: editingId,
        perspective: form,
      });
      message.success("Perspective updated successfully");
      editingId = null;
    } else {
      await store.dispatch("perspectives/createPerspective", form);
      message.success("Perspective created successfully");
    }
    form.name = "";
    form.description = "";
    handleFetch();
  } catch (error) {
    message.error("Error creating/updating perspective");
  }
};

const handleEdit = (perspective) => {
  editingId = perspective.id;
  form.name = perspective.name;
  form.description = perspective.description;
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