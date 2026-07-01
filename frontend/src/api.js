import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,   // 120s — Render free tier cold start can take ~60s
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Separate fast-timeout client just for the wake-up ping.
// We use 5s — if /health doesn't respond in 5s the server is almost certainly
// sleeping, and we should show the "Waking up..." UI before the real request.
const pingApi = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Accept': 'application/json' },
});

/**
 * Check if the server is awake.
 * Returns: 'awake' | 'sleeping' | 'error'
 *   - 'awake'   : /health responded within 4s
 *   - 'sleeping': no response within 4s (server is cold-starting)
 *   - 'error'   : server responded with an error status (CORS, 500, etc.)
 */
export async function checkServerAwake() {
  try {
    await pingApi.get('/health');
    return 'awake';
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || !err.response) {
      // No response at all = server is sleeping or unreachable
      return 'sleeping';
    }
    // Got a response (even an error response) = server is up, something else is wrong
    return 'error';
  }
}

/**
 * Fire-and-forget wake-up ping. Call once when the app loads so Render's free-tier
 * instance starts spinning up in the background while the user is still filling in
 * the form. We deliberately do NOT await or surface the result — simply hitting the
 * endpoint is enough to trigger the cold start. By the time the user clicks
 * "Analyse", the instance is usually already awake, so the real request is fast.
 *
 * Uses the long-timeout client so the connection is held open through a full cold
 * start (~60s) rather than aborting early.
 */
export function wakeServer() {
  api.get('/health').catch(() => { /* best-effort only — ignore all errors */ });
}

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
    throw new Error('Cannot reach the server. Please try again.');
  }

  // Something else went wrong setting up the request
  throw new Error('An unexpected error occurred. Please try again.');
}

export const healthAPI = {
  /**
   * Submit health data for risk prediction.
   *
   * onWaking (optional callback) — called when we detect the server is sleeping,
   * before the real request is sent. Use it to show a "Waking up..." UI.
   * Called with no arguments. When the server responds, the UI should go back
   * to normal loading state (handled by the caller resetting state on resolution).
   */
  predictRisks: async (data, onWaking) => {
    // Quick ping first — if server doesn't respond in 4s it's cold-starting
    const serverState = await checkServerAwake();
    if (serverState === 'sleeping' && typeof onWaking === 'function') {
      onWaking();
    }
    // Now send the actual prediction request (70s timeout handles cold start wait)
    return api.post('/predict/risks', data)
      .then(r => r.data)
      .catch(sanitiseError);
  },

  /**
   * Generate risk-reduction recommendations from the prediction result.
   * Pass the `predictions` and `feature_importances` objects returned by
   * predictRisks — no new health data is collected.
   */
  generateRecommendations: (predictions, featureImportances) =>
    api.post('/generate/recommendations', {
      predictions,
      feature_importances: featureImportances || {},
    })
      .then(r => r.data)
      .catch(sanitiseError),

  healthCheck: () =>
    api.get('/health')
      .then(r => r.data)
      .catch(sanitiseError),
};
