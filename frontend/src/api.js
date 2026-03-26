import axios from 'axios';

// Point this to your FastAPI server
const API_URL = 'http://127.0.0.1:8000';

export const healthAPI = {
    // Submit the 19 CDC features and get risks + SHAP explanations
    predictCDCRisks: async (userData) => {
        try {
            const response = await axios.post(`${API_URL}/predict/cdc-risks`, userData);
            return response.data;
        } catch (error) {
            console.error("Error fetching CDC predictions:", error);
            throw error;
        }
    },

    // Submit the clinical features for heart risk
    predictCardioRisk: async (cardioData) => {
        try {
            const response = await axios.post(`${API_URL}/predict/cardio-risk`, cardioData);
            return response.data;
        } catch (error) {
            console.error("Error fetching Cardio predictions:", error);
            throw error;
        }
    }
};