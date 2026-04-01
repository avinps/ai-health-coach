import axios from 'axios';

const API_URL = 'http://127.0.0.1:8000';

const api = axios.create({ baseURL: API_URL, timeout: 30000 });

export const healthAPI = {
  // Single endpoint — all 7 risk predictions from the synthetic dataset
  predictRisks: (data) =>
    api.post('/predict/risks', data).then(r => r.data),

  healthCheck: () =>
    api.get('/health').then(r => r.data),
};
