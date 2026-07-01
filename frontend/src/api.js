import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

const api = axios.create({
  baseURL: API_URL,
  timeout: 120000,   // 120s because render free tier cold start can take around 60s
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// separate client with a short timeout just for the wake up ping.
// if /health doesnt answer quickly the server is probably asleep, so we
// show the waking up screen before sending the real request.
const pingApi = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: { 'Accept': 'application/json' },
});

// check if the server is awake.
// returns 'awake', 'sleeping' or 'error'
export async function checkServerAwake() {
  try {
    await pingApi.get('/health');
    return 'awake';
  } catch (err) {
    if (err.code === 'ECONNABORTED' || err.message?.includes('timeout') || !err.response) {
      // no response at all means the server is sleeping or unreachable
      return 'sleeping';
    }
    // we got some response so the server is up but something else is wrong
    return 'error';
  }
}

// fire and forget wake up ping. call it once when the app loads so render
// starts spinning up in the background while the user fills the form.
// we dont await it, just hitting the endpoint is enough to start the cold boot.
export function wakeServer() {
  api.get('/health').catch(() => { /* best effort, ignore errors */ });
}

// clean up errors before they reach the ui.
// never show raw axios or network stuff to the user.
function sanitiseError(error) {
  if (error.response) {
    // server answered with a non 2xx status
    const status = error.response.status;
    const detail = error.response.data?.detail;

    if (status === 429) {
      throw new Error('Too many requests. Please wait a moment before trying again.');
    }
    if (status === 422) {
      // validation error, detail might be an array of field errors from pydantic
      if (Array.isArray(detail)) {
        const msgs = detail
          .map(d => `${d.loc?.slice(1).join(' > ')}: ${d.msg}`)
          .join(' | ');
        throw new Error(`Validation error: ${msgs}`);
      }
      throw new Error(detail || 'Some fields contain invalid values. Please review your answers.');
    }
    if (status === 413) {
      throw new Error('Request too large. Please contact support.');
    }
    if (status === 503) {
      throw new Error('The analysis service is temporarily unavailable. Please try again in a moment.');
    }
    // generic server error, dont expose raw server strings
    throw new Error('Something went wrong on our end. Please try again.');
  }

  if (error.request) {
    // request went out but no response came back (network / cors / timeout)
    throw new Error('Cannot reach the server. Please try again.');
  }

  // something else broke while setting up the request
  throw new Error('An unexpected error occurred. Please try again.');
}

export const healthAPI = {
  // send health data and get the risk prediction back.
  // onWaking is an optional callback, we call it when we notice the server is
  // asleep so the caller can show a waking up screen.
  predictRisks: async (data, onWaking, isDemo = false) => {
    // quick ping first, if the server doesnt answer its cold starting
    const serverState = await checkServerAwake();
    if (serverState === 'sleeping' && typeof onWaking === 'function') {
      onWaking();
    }
    // now send the real prediction request.
    // is_demo tells the backend not to store demo submissions.
    return api.post('/predict/risks', data, { params: { is_demo: !!isDemo } })
      .then(r => r.data)
      .catch(sanitiseError);
  },

  // make recommendations from the prediction result.
  // pass predictions and feature_importances from predictRisks plus the
  // assessmentId it gave us so the backend can attach them to the stored row.
  generateRecommendations: (predictions, featureImportances, assessmentId) =>
    api.post('/generate/recommendations', {
      predictions,
      feature_importances: featureImportances || {},
      assessment_id: assessmentId || null,
    })
      .then(r => r.data)
      .catch(sanitiseError),

  healthCheck: () =>
    api.get('/health')
      .then(r => r.data)
      .catch(sanitiseError),
};
