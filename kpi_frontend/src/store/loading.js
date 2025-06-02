import { reactive } from 'vue';

const state = reactive({
  loading: false,
});

const mutations = {
  setLoading(value) {
    state.loading = value;
  },
};

const actions = {
  startLoading() {
    state.loading = true;
  },
  stopLoading() {
    state.loading = false;
  },
};

const getters = {
  isLoading: () => state.loading,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
