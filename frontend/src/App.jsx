import React, { useState, useCallback } from 'react';
import UnifiedForm        from './components/UnifiedForm';
import Dashboard          from './components/Dashboard';
import PlanQuestionnaire  from './components/PlanQuestionnaire';
import { healthAPI, checkServerAwake } from './api';

// ── Demo profile — pre-fills all 44 form fields with a realistic sample ────
// 38-year-old male desk worker. Mixed risk: overweight, sedentary, moderate stress,
// family history of diabetes & hypertension, former smoker. Shows meaningful xAI.
const DEMO_PROFILE = {
  // Step 1 — Demographics
  age: '38', gender: 'Male', height_cm: '175', weight_kg: '84',
  // Step 2 — Lifestyle
  exercise_level: 'Sedentary', avg_sleep_hours: '6', stress_level: '7',
  diet_type: 'Non Vegetarian', eat_fruits_daily: 'No', eat_veggies_daily: 'Yes',
  eat_processed_food: 'Moderate', water_intake_liters: '1.5',
  meal_frequency: '3', metabolism_type: 'Normal',
  // Step 3 — Work & Habits
  employment_status: 'Employed', work_type: 'Desk/Office', work_stress: '7',
  alcohol_consumption: 'Rarely', smoking_status: 'Former',
  screen_time_hours: '9', sun_exposure: 'Low',
  // Step 4 — Medical & Family History
  family_history_diabetes: 'Yes', family_history_heart_disease: 'No',
  family_history_hypertension: 'Yes', family_history_obesity: 'No',
  family_history_pcos: 'N/A',
  has_asthma: 'No', has_thyroid: 'No', has_allergies: 'Yes',
  has_diabetes: 'No', has_heart_disease: 'No', has_hypertension: 'No',
  // Step 5 — Symptoms & Mental Health
  fatigue_level: '6', anxiety_level: '6',
  social_interaction_level: 'Moderate', shortness_of_breath: 'Rarely',
  frequent_headaches: 'Sometimes', digestive_issues: 'Rarely',
  difficulty_falling_asleep: 'Sometimes', perceived_appetite: 'Normal',
  frequent_urination: 'No', slow_wound_healing: 'No', numbness_tingling: 'No',
  menstrual_regularity: 'N/A',
};

// Views: 'form' | 'dashboard' | 'questionnaire' | 'plan-ready'
export default function App() {
  const [view,        setView]        = useState('form');
  const [isLoading,   setIsLoading]   = useState(false);
  const [error,       setError]       = useState(null);

  // Phase 1 results
  const [predictions, setPredictions] = useState(null);
  const [explanation, setExplanation] = useState(null);

  // Per-model feature importances returned by the API
  const [featureImportances, setFeatureImportances] = useState({});

  // Existing conditions declared in the form (display-only, not sent to API)
  const [existingConditions, setExistingConditions] = useState({});

  // Raw form payload — passed to Dashboard for per-condition xAI impact computation
  const [formData, setFormData] = useState(null);

  // Anthropometric data from the health form — passed to the questionnaire
  // so it can enforce goal-weight constraints and compute ideal weight
  const [userProfile, setUserProfile] = useState({ weight_kg: null, height_cm: null });

  // Cold-start detection — true when we're waiting for Render to wake up
  const [isWaking,      setIsWaking]      = useState(false);
  const [wakeProgress,  setWakeProgress]  = useState(0);

  // Phase 3 — plan preferences (stored for later plan generation)
  const [planAnswers, setPlanAnswers] = useState(null);

  // Phase 1: Analyse 
  const handleAnalyse = useCallback(async (formPayload, incomingExistingConditions = {}) => {
    setIsLoading(true);
    setError(null);
    // Store display-only data immediately
    setExistingConditions(incomingExistingConditions);
    // Store full form payload for per-condition xAI impact computation in Dashboard
    setFormData(formPayload);
    // Capture anthropometrics before the async call so questionnaire can use them
    setUserProfile({
      weight_kg: formPayload.weight_kg ?? null,
      height_cm: formPayload.height_cm ?? null,
    });
    // Called by api.js when the 4s ping times out (server is cold-starting)
    const onWaking = () => {
      setIsLoading(false);   // hide the normal spinner
      setIsWaking(true);     // show the wake-up overlay
      setWakeProgress(0);
      // Animate a progress bar over ~55s (typical Render cold start)
      const start = Date.now();
      const DURATION = 55000;
      const tick = () => {
        const elapsed = Date.now() - start;
        const pct = Math.min(95, Math.round((elapsed / DURATION) * 100));
        setWakeProgress(pct);
        if (pct < 95) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };

    try {
      const res = await healthAPI.predictRisks(formPayload, onWaking);
      setPredictions(res.predictions);
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

  // Navigate to questionnaire 
  const handleOpenQuestionnaire = () => {
    setView('questionnaire');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Questionnaire complete. To store answers, show dummy plan ready screen
  const handleQuestionnaireSubmit = (answers) => {
    setPlanAnswers(answers);
    // Log for inspection during development
    console.log('Plan preferences collected:', {
      ...answers,
      riskProfile: predictions,
    });
    setView('plan-ready');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Full reset 
  const handleReset = () => {
    setView('form');
    setPredictions(null);
    setExplanation(null);
    setPlanAnswers(null);
    setUserProfile({ weight_kg: null, height_cm: null });
    setFormData(null);
    setFeatureImportances({});
    setExistingConditions({});
    setError(null);
    setIsWaking(false);
    setWakeProgress(0);
  };

  // Step indicator config per view 
  const STEPS = ['Risk Assessment', 'Your Dashboard', 'Your Plan'];
  const stepIndex = { form: 0, dashboard: 1, questionnaire: 2, 'plan-ready': 2 };
  const currentStep = stepIndex[view] ?? 0;

  return (
    <div style={s.root}>

      {/* Header */}
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

        {/* 3-step indicator */}
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

      {/* Error banner */}
      {error && (
        <div style={s.errBanner}>
          ⚠️ {error}
          <button onClick={() => setError(null)} style={s.errClose}>✕</button>
        </div>
      )}

      {/* Normal loading overlay */}
      {isLoading && !isWaking && (
        <div style={s.overlay}>
          <div style={s.overlayCard}>
            <div style={s.spinner} />
            <p style={s.spinnerText}>Running 7-model health risk analysis…</p>
            <p style={s.spinnerSub}>This takes 3–8 seconds on first request.</p>
          </div>
        </div>
      )}

      {/* Cold-start / waking overlay — shown when Render free tier is sleeping */}
      {isWaking && (
        <div style={s.overlay}>
          <div style={{ ...s.overlayCard, maxWidth: '440px', width: '90%' }}>
            {/* Moon + zZZ animation */}
            <div style={{ fontSize: '52px', marginBottom: '16px', lineHeight: 1 }}>🌙</div>
            <p style={{ ...s.spinnerText, marginBottom: '6px' }}>Waking up the server…</p>
            <p style={{ ...s.spinnerSub, marginBottom: '24px', lineHeight: 1.6 }}>
              The server went to sleep after a period of inactivity (free tier hosting).
              <br />This usually takes <strong>30–60 seconds</strong> — hang tight!
            </p>
            {/* Progress bar */}
            <div style={s.wakeBarTrack}>
              <div style={{ ...s.wakeBarFill, width: `${wakeProgress}%` }} />
            </div>
            <p style={{ ...s.spinnerSub, marginTop: '10px' }}>
              {wakeProgress < 30  ? 'Starting up…' :
               wakeProgress < 60  ? 'Loading models…' :
               wakeProgress < 85  ? 'Almost ready…' :
               'Running analysis…'}
            </p>
          </div>
        </div>
      )}

      {/* Content */}
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
            onGeneratePlan={handleOpenQuestionnaire}
          />
        )}

        {view === 'questionnaire' && (
          <PlanQuestionnaire
            predictions={predictions}
            userProfile={userProfile}
            onBack={() => setView('dashboard')}
            onDone={handleQuestionnaireSubmit}
          />
        )}

        {/* Plan ready placeholder (generation not implemented yet) */}
        {view === 'plan-ready' && planAnswers && (
          <div style={pr.wrap}>
            <div style={pr.iconWrap}></div>
            <h2 style={pr.title}>Your preferences have been saved!</h2>
            <p style={pr.sub}>
              Plan generation is coming in the next phase. Your full profile including all 7 risk scores and your goals is stored and ready.
            </p>

            {/* Summary of what was collected */}
            <div style={pr.summaryCard}>
              <h3 style={pr.summaryTitle}>What we collected</h3>
              <div style={pr.grid}>
                {[
                  { label: 'Location',          value: `${planAnswers.state}, ${planAnswers.country}` },
                  { label: 'Goal',               value: planAnswers.goal },
                  { label: 'Goal Weight',        value: `${planAnswers.goalWeight} kg` },
                  { label: 'Aggressiveness',     value: planAnswers.aggressiveness },
                  { label: 'Cooking Ability',    value: planAnswers.cookingAbility },
                  { label: 'Budget',             value: planAnswers.budget },
                  { label: 'Meals / Day',        value: planAnswers.mealsPerDay },
                  { label: 'Eating Out / Week',  value: `${planAnswers.eatingOutFreq}×` },
                  { label: 'Muscle Level',       value: planAnswers.muscleLevel },
                  { label: 'Workout Frequency',  value: planAnswers.workoutFrequency },
                  { label: 'Workout Location',   value: planAnswers.workoutLocation },
                  { label: 'Session Duration',   value: planAnswers.timePerSession },
                  ...(planAnswers.favoriteFoods ? [{ label: 'Favourite Foods', value: planAnswers.favoriteFoods }] : []),
                  ...(planAnswers.dislikedFoods ? [{ label: 'Disliked Foods',  value: planAnswers.dislikedFoods  }] : []),
                  ...(planAnswers.homeEquipment ? [{ label: 'Home Equipment',  value: planAnswers.homeEquipment  }] : []),
                ].map(({ label, value }) => (
                  <div key={label} style={pr.item}>
                    <span style={pr.itemLabel}>{label}</span>
                    <span style={pr.itemValue}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setView('questionnaire')} style={pr.backBtn}>
                ← Edit Preferences
              </button>
              <button onClick={handleReset} style={pr.resetBtn}>
                Start New Assessment
              </button>
            </div>
          </div>
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

// Styles 
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

// Plan ready screen styles
const pr = {
  wrap:         { maxWidth: '700px', margin: '0 auto', textAlign: 'center' },
  iconWrap:     { fontSize: '64px', marginBottom: '16px' },
  title:        { fontSize: '28px', fontWeight: 800, color: '#0f172a', margin: '0 0 12px' },
  sub:          { fontSize: '15px', color: '#64748b', lineHeight: 1.7, margin: '0 0 32px', maxWidth: '520px', marginLeft: 'auto', marginRight: 'auto' },
  summaryCard:  { background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '32px', textAlign: 'left' },
  summaryTitle: { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' },
  item:         { display: 'flex', flexDirection: 'column', gap: '3px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #f1f5f9' },
  itemLabel:    { fontSize: '11px', fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.4px' },
  itemValue:    { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  backBtn:      { padding: '12px 22px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
  resetBtn:     { padding: '12px 22px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
};
