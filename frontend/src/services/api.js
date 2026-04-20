import axios from 'axios';

const BASE_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: BASE_URL,
  timeout: 15000,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: false,
});

// ─── Interceptor de request — injeta JWT ──────────────────────────
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken') || sessionStorage.getItem('accessToken');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ─── Interceptor de response — auto-refresh de token ──────────────
let isRefreshing = false;
let failedQueue = [];

function processQueue(error, token = null) {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (
      error.response?.status === 401 &&
      error.response?.data?.code === 'TOKEN_EXPIRED' &&
      !originalRequest._retry
    ) {
      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        // Verifica tanto localStorage (manter conectado) quanto sessionStorage (sessão)
        const refreshToken =
          localStorage.getItem('refreshToken') || sessionStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('Sem refresh token');

        const { data } = await axios.post(`${BASE_URL}/auth/refresh`, { refreshToken });

        // Salva no mesmo storage onde estava o token anterior
        const storage = localStorage.getItem('refreshToken') ? localStorage : sessionStorage;
        storage.setItem('accessToken', data.accessToken);
        storage.setItem('refreshToken', data.refreshToken);

        api.defaults.headers.Authorization = `Bearer ${data.accessToken}`;
        processQueue(null, data.accessToken);
        originalRequest.headers.Authorization = `Bearer ${data.accessToken}`;
        return api(originalRequest);
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        sessionStorage.removeItem('accessToken');
        sessionStorage.removeItem('refreshToken');
        window.location.href = '/login?session=expired';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
