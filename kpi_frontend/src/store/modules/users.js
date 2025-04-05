import apiClient from '../../services/api';

const state = {
  userList: [],
};

const getters = {
  userList: (state) => state.userList,
};

const mutations = {
  SET_USERS(state, users) {
    state.userList = users;
  },
};

const actions = {
  async fetchUsers({ commit }) {
    try {
      const response = await apiClient.get('/users');
      commit('SET_USERS', response.data);
    } catch (error) {
      console.error('Error fetching users:', error);
    }
  },
};

export default {
  namespaced: true,
  state,
  getters,
  mutations,
  actions,
};
