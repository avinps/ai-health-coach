import React, { useState } from 'react';
import UnifiedForm from './components/UnifiedForm';
import Dashboard from './components/Dashboard';
import { healthAPI } from './api';

function App() {
  const [currentView, setCurrentView] = useState('form'); 
  const [results, setResults] = useState(null);
  const [userDataForDB, setUserDataForDB] = useState(null); // Holds Phase 3 data
  const [isLoading, setIsLoading] = useState(false);

  // Triggered when they finish the first Onboarding Form
  const handleAnalyzeAll = async (cdcPayload, cardioPayload, dbPayload) => {
    setIsLoading(true);
    try {
      // 1. Save the DB Payload in state for later
      setUserDataForDB(dbPayload);

      // 2. Fire the ML APIs
      const [cdcResponse, cardioResponse] = await Promise.all([
        healthAPI.predictCDCRisks(cdcPayload),
        healthAPI.predictCardioRisk(cardioPayload)
      ]);

      const combinedResults = {
        predictions: { ...cdcResponse.predictions, ...cardioResponse.predictions },
        explanation: cdcResponse.explanation
      };

      setResults(combinedResults);
      setCurrentView('dashboard');
    } catch (error) {
      alert("Error connecting to the ML Backend. Is FastAPI running?");
      console.error(error);
    } finally {
      setIsLoading(false);
    }
  };

  // Triggered when they click "Generate Plan" on the Dashboard
  const handleGeneratePlan = (optionalPreferences) => {
    const completeUserProfile = {
      baseProfile: userDataForDB,
      preferences: optionalPreferences,
      aiRiskScores: results.predictions
    };
    
    console.log("🚀 READY FOR PHASE 3! Sending this to Database & Rec Engine:", completeUserProfile);
    alert("Check your browser console! All data is perfectly packaged for Phase 3 (Clustering & Recommendation Engine).");
  };

  const handleReset = () => {
    setResults(null);
    setUserDataForDB(null);
    setCurrentView('form');
  };

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#f8fafc', padding: '40px 20px', fontFamily: 'system-ui' }}>
      <header style={{ textAlign: 'center', marginBottom: '40px' }}>
        <h1 style={{ color: '#0f172a', fontSize: '36px', margin: '0 0 10px 0' }}>🩺 AI Health Coach</h1>
        <p style={{ color: '#64748b', fontSize: '18px', margin: 0 }}>Adaptive ML-Driven Personalized Risk Prediction</p>
      </header>

      <main style={{ backgroundColor: 'white', borderRadius: '12px', padding: '30px', maxWidth: '1000px', margin: '0 auto' }}>
        {currentView === 'form' && <UnifiedForm onSubmit={handleAnalyzeAll} isLoading={isLoading} />}
        {currentView === 'dashboard' && results && <Dashboard data={results} onReset={handleReset} onGeneratePlan={handleGeneratePlan} />}
      </main>
    </div>
  );
}

export default App;