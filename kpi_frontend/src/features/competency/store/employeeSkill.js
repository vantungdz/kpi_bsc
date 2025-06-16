// Quản lý kỹ năng của nhân viên (EmployeeSkill)
// State: skillsByEmployee: { [employeeId]: [ { id, skillId, skillName, group, level, note } ] }
// Actions: fetchSkillsByEmployee, addEmployeeSkill, updateEmployeeSkill, deleteEmployeeSkill

import apiClient from '@/core/services/api';

const state = () => ({
  skillsByEmployee: {},
  loading: false,
});

const mutations = {
  SET_SKILLS(state, { employeeId, skills }) {
    state.skillsByEmployee = {
      ...state.skillsByEmployee,
      [employeeId]: skills,
    };
  },
  ADD_SKILL(state, { employeeId, skill }) {
    state.skillsByEmployee[employeeId] = [
      ...(state.skillsByEmployee[employeeId] || []),
      skill,
    ];
  },
  UPDATE_SKILL(state, { employeeId, skill }) {
    state.skillsByEmployee[employeeId] = (state.skillsByEmployee[employeeId] || []).map(s =>
      s.id === skill.id ? skill : s
    );
  },
  DELETE_SKILL(state, { employeeId, skillId }) {
    state.skillsByEmployee[employeeId] = (state.skillsByEmployee[employeeId] || []).filter(s => s.id !== skillId);
  },
  SET_LOADING(state, loading) {
    state.loading = loading;
  },
};

const actions = {
  async fetchSkillsByEmployee({ commit }, employeeId) {
    commit('SET_LOADING', true);
    try {
      const res = await apiClient.get('/employee-skills', { params: { employeeId } });
      // Map API về đúng format cho table
      const skills = (res.data || []).map(item => ({
        id: item.id,
        skillId: item.competency?.id,
        skillName: item.competency?.name,
        group: item.competency?.group,
        level: item.level,
        note: item.note,
      }));
      commit('SET_SKILLS', { employeeId, skills });
    } finally {
      commit('SET_LOADING', false);
    }
  },
  async addEmployeeSkill({ commit }, payload) {
    const res = await apiClient.post('/employee-skills', {
      employeeId: payload.employeeId,
      competencyId: payload.skillId,
      level: payload.level,
      note: payload.note,
    });
    const skill = res.data;
    commit('ADD_SKILL', {
      employeeId: payload.employeeId,
      skill: {
        id: skill.id,
        skillId: skill.competency?.id,
        skillName: skill.competency?.name,
        group: skill.competency?.group,
        level: skill.level,
        note: skill.note,
      },
    });
  },
  async updateEmployeeSkill({ commit }, { id, data }) {
    const res = await apiClient.patch(`/employee-skills/${id}`, {
      level: data.level,
      note: data.note,
    });
    const skill = res.data;
    commit('UPDATE_SKILL', {
      employeeId: data.employeeId,
      skill: {
        id: skill.id,
        skillId: skill.competency?.id,
        skillName: skill.competency?.name,
        group: skill.competency?.group,
        level: skill.level,
        note: skill.note,
      },
    });
  },
  async deleteEmployeeSkill({ commit, state }, id) {
    // Tìm employeeId chứa skill này
    let employeeId = null;
    for (const [eid, skills] of Object.entries(state.skillsByEmployee)) {
      if (skills.find(s => s.id === id)) {
        employeeId = eid;
        break;
      }
    }
    await apiClient.delete(`/employee-skills/${id}`);
    if (employeeId) {
      commit('DELETE_SKILL', { employeeId, skillId: id });
    }
  },
};

const getters = {
  skillsByEmployee: state => state.skillsByEmployee,
  loading: state => state.loading,
};

export default {
  namespaced: true,
  state,
  mutations,
  actions,
  getters,
};
