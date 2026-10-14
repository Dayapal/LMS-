import { authHttp, http } from '../../services/http.js';

const unwrap = (res) => res.data.data;

export const authApi = {
  login: (values) => authHttp.post('/auth/login', values).then(unwrap),
  register: (values) => authHttp.post('/auth/register', values).then(unwrap),
  logout: () => authHttp.post('/auth/logout'),
  updateProfile: (values) => http.patch('/users/me', values).then(unwrap),
  changePassword: (values) => http.patch('/users/me/password', values).then(unwrap),
};
