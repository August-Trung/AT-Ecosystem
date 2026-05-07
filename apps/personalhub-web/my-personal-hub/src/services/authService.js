import api from './api';

export default {
  getProviders() {
    return api.get('/auth/providers');
  },
  login(data) {
    return api.post('/auth/login', data);
  },
  register(data) {
    return api.post('/auth/register', data);
  },
  loginWithGoogle(data) {
    return api.post('/auth/google', data);
  },
  requestPhoneOtp(data) {
    return api.post('/auth/phone/request-otp', data);
  },
  verifyPhoneOtp(data) {
    return api.post('/auth/phone/verify-otp', data);
  },
  getGitHubStartUrl(returnUrl) {
    const encoded = encodeURIComponent(returnUrl);
    return `${api.defaults.baseURL}/auth/github/start?returnUrl=${encoded}`;
  },
  getCurrentUser() {
    return api.get('/auth/me');
  },
  updateProfile(data) {
    return api.put('/auth/profile', data);
  },
  changePassword(data) {
    return api.put('/auth/change-password', data);
  },
};

