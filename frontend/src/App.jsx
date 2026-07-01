import React, { useState, useEffect, useCallback } from 'react';
import UnifiedForm          from './components/UnifiedForm';
import Dashboard            from './components/Dashboard';
import RecommendationsView  from './components/RecommendationsView';
import { healthAPI, wakeServer } from './api';

// demo profile, fills all 44 form fields with a sample person.
// 38 year old male desk worker. mixed risk: overweight, sedentary, some stress,
// family history of diabetes and hypertension, former smoker. gives nice xai.
const DEMO_PROFILE = {
  // step 1 demographics
  age: '38', gender: 'Male', height_cm: '175', weight_kg: '84',
  // step 2 lifestyle
  exercise_level: 'Sedentary', avg_sleep_hours: '6', stress_level: '7',
  diet_type: 'Non Vegetarian', eat_fruits_daily: 'No', eat_veggies_daily: 'Yes',
  eat_processed_food: 'Moderate', water_intake_liters: '1.5',
  meal_frequency: '3', metabolism_type: 'Normal',
  // step 3 work and habits
  employment_status: 'Employed', work_type: 'Desk/Office', work_stress: '7',
  alcohol_consumption: 'Rarely', smoking_status: 'Former',
  screen_time_hours: '9', sun_exposure: 'Low',
  // step 4 medical and family history
  family_history_diabetes: 'Yes', family_history_heart_disease: 'No',
  family_history_hypertension: 'Yes', family_history_obesity: 'No',
  family_history_pcos: 'N/A',
  has_asthma: 'No', has_thyroid: 'No', has_allergies: 'Yes',
  has_diabetes: 'No', has_heart_disease: 'No', has_hypertension: 'No',
  // step 5 symptoms and mental health
  fatigue_level: '6', anxiety_level: '6',
  social_interaction_level: 'Moderate', shortness_of_breath: 'Rarely',
  frequent_headaches: 'Sometimes', digestive_issues: 'Rarely',
  difficulty_falling_asleep: 'Sometimes', perceived_appetite: 'Normal',
  frequent_urination: 'No', slow_wound_healing: 'No', numbness_tingling: 'No',
  menstrual_regularity: 'N/A',
};

// views: 'form' | 'dashboard' | 'recommendations'
export default function App() {
  const [view,        setView]        = useState('form');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState(null);

  // phase 1 results
  const [predictions, setPredictions] = useState(null);
  const [explanation, setExplanation] = useState(null);

  // feature importances per model from the api
  const [featureImportances, setFeatureImportances] = useState({});

  // existing conditions from the form, just for display, not sent to the api
  const [existingConditions, setExistingConditions] = useState({});

  // raw form data, passed to dashboard for the per condition xai impact
  const [formData, setFormData] = useState(null);

  // height and weight from the form, passed on so we can work out ideal weight
  const [userProfile, setUserProfile] = useState({ weight_kg: null, height_cm: null });

  // cold start detection, true while we wait for render to wake up
  const [isWaking,      setIsWaking]      = useState(false);
  const [wakeProgress,  setWakeProgress]  = useState(0);

  // recommendations result from /generate/recommendations
  const [recommendations, setRecommendations] = useState(null);
  const [recsLoading,      setRecsLoading]     = useState(false);

  // assessment id from /predict/risks, links the recommendations to the stored row
  const [assessmentId, setAssessmentId] = useState(null);

  // wake the free tier backend as soon as the app loads so its ready by the
  // time the user finishes the form and clicks analyse. fire and forget.
  useEffect(() => {
    wakeServer();
  }, []);

  // phase 1: analyse
  const handleAnalyse = useCallback(async (formPayload, incomingExistingConditions = {}, isDemo = false) => {
    setIsLoading(true);
    setError(null);
    // store display only data right away
    setExistingConditions(incomingExistingConditions);
    // store the full form payload for the per condition xai impact in dashboard
    setFormData(formPayload);
    // grab height and weight before the async call so the questionnaire can use them
    setUserProfile({
      weight_kg: formPayload.weight_kg ?? null,
      height_cm: formPayload.height_cm ?? null,
    });
    // called by api.js when the ping times out (server is cold starting)
    const onWaking = () => {
      setIsLoading(false);   // hide the normal spinner
      setIsWaking(true);     // show the wake up overlay
      setWakeProgress(0);
      // animate a progress bar over about 82s (typical render cold start)
      const start = Date.now();
      const DURATION = 82000;
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(95, Math.round((elapsed / DURATION) * 100));
        setWakeProgress(pct);
        if (pct < 95) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    try {
      const res = await healthAPI.predictRisks(formPayload, onWaking, isDemo);
      setPredictions(res.predictions);
      setAssessmentId(res.assessment_id || null);
      setExplanation(res.explanation);
      setFeatureImportances(res.feature_importances || {});
      setView('dashboard');
    } catch (e) {
      setError(e.message || 'Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
      setIsWaking(false);
      setWakeProgress(0);
    }
  }, []);

  // make recommendations from the prediction we already have.
  // reuses predictions and feature importances in state, no new data collected.
  const handleGetRecommendations = useCallback(async () => {
    setRecsLoading(true);
    setError(null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
    try {
      const res = await healthAPI.generateRecommendations(predictions, featureImportances, assessmentId);
      setRecommendations(res);
      setView('recommendations');
    } catch (e) {
      setError(e.message || 'Could not generate recommendations. Please try again.');
    } finally {
      setRecsLoading(false);
    }
  }, [predictions, featureImportances, assessmentId]);

  // full reset
  const handleReset = () => {
    setView('form');
    setPredictions(null);
    setExplanation(null);
    setRecommendations(null);
    setAssessmentId(null);
    setUserProfile({ weight_kg: null, height_cm: null });
    setFormData(null);
    setFeatureImportances({});
    setExistingConditions({});
    setError(null);
    setIsWaking(false);
    setWakeProgress(0);
  };

  // step indicator setup per view
  const STEPS = ['Risk Assessment', 'Your Dashboard', 'Recommendations'];
  const stepIndex = { form: 0, dashboard: 1, recommendations: 2 };
  const currentStep = stepIndex[view] ?? 0;

  return (
    <div style={s.root}>

      {/* header */}
      <header style={s.header}>
        <div style={s.headerInner}>
          <span style={s.logo}>🧬</span>
          <div>
            <h1 style={s.title}>AI Health Coach</h1>
            <p style={s.subtitle}>Adaptive ML-Driven Health Risk Intelligence</p>
          </div>
          {view !== 'form' && (
            <button onClick={handleReset} style={s.resetBtn}>← New Assessment</button>
          )}
        </div>

        {/* 3 step indicator */}
        <div style={s.stepRow}>
          {STEPS.map((label, i) => {
            const active = i === currentStep;
            const done   = i < currentStep;
            return (
              <div key={i} style={{ ...s.step, ...(active ? s.stepActive : {}), ...(done ? s.stepDone : {}) }}>
                <span style={s.stepNum}>{done ? '✓' : i + 1}</span>
                {label}
              </div>
            );
          })}
        </div>
      </header>

      {/* error banner */}
      {error && (
        <div style={s.errBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={s.errClose}>✕</button>
        </div>
      )}

      {/* normal loading overlay */}
      {isLoading && !isWaking && (
        <div style={s.overlay}>
          <div style={s.overlayCard}>
            <div style={s.spinner} />
            <p style={s.spinnerText}>Running 7-model health risk analysis...</p>
            <p style={s.spinnerSub}>Please wait a few seconds.</p>
          </div>
        </div>
      )}

      {/* recommendations loading overlay */}
      {recsLoading && (
        <div style={s.overlay}>
          <div style={s.overlayCard}>
            <div style={s.spinner} />
            <p style={s.spinnerText}>Building your risk-reduction recommendations...</p>
            <p style={s.spinnerSub}>Tailoring guidance to your results.</p>
          </div>
        </div>
      )}

      {/* cold start / waking overlay, shown when render free tier is asleep */}
      {isWaking && (
        <div style={s.overlay}>
          <div style={{ ...s.overlayCard, maxWidth: '440px', width: '90%' }}>
            {/* moon animation */}
            <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1 }}>🌙</div>
            <p style={{ ...s.spinnerText, marginBottom: '6px' }}>Waking up the server...</p>
            <p style={{ ...s.spinnerSub, marginBottom: '24px', lineHeight: 1.6 }}>
              The server went to sleep after a period of inactivity (free tier hosting).
              <br />This usually takes <strong> a minute</strong> - hang tight!
            </p>
            {/* progress bar */}
            <div style={s.wakeBarTrack}>
              <div style={{ ...s.wakeBarFill, width: `${wakeProgress}%` }} />
            </div>
            <p style={{ ...s.spinnerSub, marginTop: '10px' }}>
              {wakeProgress < 30  ? 'Starting up...' :
               wakeProgress < 60  ? 'Loading models...' :
               wakeProgress < 90  ? 'Almost ready few more seconds...' :
               'Running analysis...'}
            </p>
          </div>
        </div>
      )}

      {/* content */}
      <main style={s.main}>

        {view === 'form' && (
          <UnifiedForm onSubmit={handleAnalyse} isLoading={isLoading} demoData={DEMO_PROFILE} />
        )}

        {view === 'dashboard' && predictions && (
          <Dashboard
            predictions={predictions}
            explanation={explanation}
            featureImportances={featureImportances}
            existingConditions={existingConditions}
            formData={formData}
            onReset={handleReset}
            onGeneratePlan={handleGetRecommendations}
          />
        )}

        {view === 'recommendations' && recommendations && (
          <RecommendationsView
            data={recommendations}
            onBack={() => { setView('dashboard'); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
            onReset={handleReset}
          />
        )}

      </main>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes zFloat {
          0%, 100% { transform: translateY(0) scale(1); opacity: 0.7; }
          50%       { transform: translateY(-8px) scale(1.1); opacity: 1; }
        }
      `}</style>
    </div>
  );
}

// styles
const s = {
  root:        { minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Inter', system-ui, sans-serif" },
  header:      { background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)', boxShadow: '0 4px 20px rgba(0,0,0,0.3)' },
  headerInner: { display: 'flex', alignItems: 'center', gap: '16px', padding: '20px 40px 12px', flexWrap: 'wrap' },
  logo:        { fontSize: '40px' },
  title:       { color: 'white', fontSize: '26px', margin: 0, fontWeight: 700 },
  subtitle:    { color: '#94a3b8', fontSize: '13px', margin: '3px 0 0' },
  resetBtn:    { marginLeft: 'auto', padding: '9px 18px', background: 'rgba(255,255,255,0.1)', color: 'white', border: '1px solid rgba(255,255,255,0.2)', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' },
  stepRow:     { display: 'flex', padding: '0 40px', gap: '4px' },
  step:        { display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontSize: '13px', color: '#64748b', borderBottom: '3px solid transparent' },
  stepActive:  { color: '#60a5fa', borderBottomColor: '#60a5fa', fontWeight: 600 },
  stepDone:    { color: '#34d399', borderBottomColor: '#34d399' },
  stepNum:     { width: '20px', height: '20px', borderRadius: '50%', background: 'rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: 'white', flexShrink: 0 },
  errBanner:   { background: '#fef2f2', borderBottom: '1px solid #fecaca', color: '#dc2626', padding: '12px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '14px' },
  errClose:    { background: 'none', border: 'none', color: '#dc2626', cursor: 'pointer', fontSize: '18px', padding: '0 4px' },
  overlay:     { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 },
  overlayCard: { background: 'white', borderRadius: '16px', padding: '48px 64px', textAlign: 'center', boxShadow: '0 25px 50px rgba(0,0,0,0.35)' },
  spinner:     { width: '52px', height: '52px', border: '5px solid #e2e8f0', borderTop: '5px solid #2563eb', borderRadius: '50%', margin: '0 auto 24px', animation: 'spin 0.8s linear infinite' },
  spinnerText: { color: '#0f172a', fontSize: '17px', fontWeight: 600, margin: '0 0 8px' },
  spinnerSub:  { color: '#94a3b8', fontSize: '13px', margin: 0 },
  main:        { maxWidth: '1060px', margin: '0 auto', padding: '40px 24px' },
  wakeBarTrack:{ height: '8px', background: '#e2e8f0', borderRadius: '999px', overflow: 'hidden', width: '100%' },
  wakeBarFill: { height: '100%', background: 'linear-gradient(90deg, #6366f1, #8b5cf6)', borderRadius: '999px', transition: 'width 0.4s ease' },
};
