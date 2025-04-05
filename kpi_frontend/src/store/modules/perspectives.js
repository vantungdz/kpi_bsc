import apiClient from '../../services/api';

const state = {
  perspectives: [],
};

const mutations = {
  SET_PERSPECTIVES(state, perspectives) {
    state.perspectives = perspectives;
  }
};

const actions = {
  async fetchPerspectives({ commit }) {
    try {
      const response = await apiClient.get('/perspectives');
      commit('SET_PERSPECTIVES', response.data);
    } catch (error) {
      console.error('Error fetching perspectives:', error);
    }
  }
};

const getters = {
  perspectiveList: (state) => state.perspectives,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
