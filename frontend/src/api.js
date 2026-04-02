import axios from 'axios';

// API URL is read from the environment variable VITE_API_URL.
// For local development, create a .env file in the frontend/ directory:
//   VITE_API_URL=http://127.0.0.1:8000
// For production, set VITE_API_URL in your Vercel/Netlify environment variables
// to your deployed backend URL (e.g. https://your-api.onrender.com).
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 45000,   // 45s — allows for cold start on free-tier hosting
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Sanitise errors before they reach the UI.
// Never show raw axios/network internals to the user.
function sanitiseError(error) {
  if (error.response) {
    // Server responded with a non-2xx status
    const status = error.response.status;
    const detail = error.response.data?.detail;

    if (status === 429) {
      throw new Error('Too many requests. Please wait a moment before trying again.');
    }
    if (status === 422) {
      // Validation error — detail may be an array of field errors from Pydantic
      if (Array.isArray(detail)) {
        const msgs = detail
          .map(d => `${d.loc?.slice(1).join(' → ')}: ${d.msg}`)
          .join(' | ');
        throw new Error(`Validation error — ${msgs}`);
      }
      throw new Error(detail || 'Some fields contain invalid values. Please review your answers.');
    }
    if (status === 413) {
      throw new Error('Request too large. Please contact support.');
    }
    if (status === 503) {
      throw new Error('The analysis service is temporarily unavailable. Please try again in a moment.');
    }
    // Generic server error — do NOT expose raw server error strings
    throw new Error('Something went wrong on our end. Please try again.');
  }

  if (error.request) {
    // Request was made but no response received (network issue / CORS / timeout)
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }

  // Something else went wrong setting up the request
  throw new Error('An unexpected error occurred. Please refresh and try again.');
}

export const healthAPI = {
  predictRisks: (data) =>
    api.post('/predict/risks', data)
      .then(r => r.data)
      .catch(sanitiseError),

  healthCheck: () =>
    api.get('/health')
      .then(r => r.data)
      .catch(sanitiseError),
};
