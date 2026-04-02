/**
 * 5-Step Wizard
 * Covers all 42 features of synthetic_health_risk_75k_v1.csv
 *
 * Step 1: Demographics & Anthropometrics  (age, gender, height, weight → BMI)
 * Step 2: Lifestyle & Diet                (exercise, sleep, stress, diet, food habits)
 * Step 3: Work & Habits                   (employment, work type/stress, alcohol, smoking)
 * Step 4: Medical & Family History        (conditions, family history, symptoms)
 * Step 5: Symptoms & Mental Health        (fatigue, anxiety, physical symptoms, female-specific)
 */

import React, { useState, useEffect } from 'react';

// Tiny reusable components

function Field({ label, hint, error, children }) {
  return (
    <div style={fc.wrap}>
      <label style={fc.label}>
        {label}
        {hint && <span style={fc.hint}>{hint}</span>}
      </label>
      {children}
      {error && <span style={fc.err}>{error}</span>}
    </div>
  );
}

function Select({ value, onChange, options, placeholder = 'Select…' }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} style={fc.input}>
      <option value="">{placeholder}</option>
      {options.map(o => (
        <option key={o.value ?? o} value={o.value ?? o}>{o.label ?? o}</option>
      ))}
    </select>
  );
}

function NumberInput({ value, onChange, min, max, step = 1, placeholder = '' }) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={fc.input}
    />
  );
}

function SliderInput({ value, onChange, min, max, step = 1, label }) {
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{min}</span>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a' }}>{value || min}</span>
        <span style={{ fontSize: '12px', color: '#64748b' }}>{max}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step}
        value={value || min}
        onChange={e => onChange(e.target.value)}
        style={{ width: '100%', accentColor: '#2563eb' }}
      />
    </div>
  );
}

function YesNo({ value, onChange }) {
  return (
    <div style={{ display: 'flex', gap: '8px' }}>
      {[{ v: 'Yes', label: 'Yes' }, { v: 'No', label: 'No' }].map(({ v, label }) => (
        <button key={v} type="button" onClick={() => onChange(v)}
                style={{ ...fc.toggle, ...(value === v ? fc.toggleOn : {}) }}>
          {label}
        </button>
      ))}
    </div>
  );
}

function OptionGroup({ value, onChange, options }) {
  return (
    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
      {options.map(o => (
        <button key={o.value ?? o} type="button"
                onClick={() => onChange(o.value ?? o)}
                style={{ ...fc.chip, ...(value === (o.value ?? o) ? fc.chipOn : {}) }}>
          {o.label ?? o}
        </button>
      ))}
    </div>
  );
}

const fc = {
  wrap:     { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:    { fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', flexDirection: 'column', gap: '3px' },
  hint:     { fontSize: '11px', fontWeight: 400, color: '#94a3b8' },
  err:      { fontSize: '11px', color: '#ef4444' },
  input:    { padding: '11px 13px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box' },
  toggle:   { flex: 1, padding: '9px', borderRadius: '7px', border: '1px solid #cbd5e1', background: 'white', color: '#64748b', cursor: 'pointer', fontWeight: 600, fontSize: '13px', transition: 'all 0.15s' },
  toggleOn: { border: '2px solid #2563eb', background: '#eff6ff', color: '#1e40af' },
  chip:     { padding: '7px 14px', borderRadius: '20px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '12px', fontWeight: 500, transition: 'all 0.15s' },
  chipOn:   { border: '1.5px solid #2563eb', background: '#eff6ff', color: '#1e40af', fontWeight: 600 },
};

// Step wrapper
function StepSection({ title, icon, children }) {
  return (
    <div style={st.section}>
      <h3 style={st.sectionTitle}><span>{icon}</span> {title}</h3>
      <div style={st.grid}>{children}</div>
    </div>
  );
}
const st = {
  section:      { marginBottom: '32px' },
  sectionTitle: { fontSize: '16px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '2px solid #f1f5f9' },
  grid:         { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' },
};

// Step progress bar
function StepBar({ current, total, labels }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              width: '28px', height: '28px', borderRadius: '50%', margin: '0 auto 5px',
              background: i < current ? '#22c55e' : i === current - 1 ? '#2563eb' : '#e2e8f0',
              color: i <= current - 1 ? 'white' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '12px', fontWeight: 700, transition: 'all 0.3s',
            }}>
              {i < current - 1 ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '11px', color: i === current - 1 ? '#2563eb' : '#94a3b8', fontWeight: i === current - 1 ? 600 : 400 }}>
              {lbl}
            </span>
          </div>
        ))}
      </div>
      <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px', position: 'relative' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563eb, #6366f1)', borderRadius: '99px', width: `${((current - 1) / (total - 1)) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// STEP DEFINITIONS

const STEP_LABELS = ['Demographics', 'Lifestyle & Diet', 'Work & Habits', 'Medical History', 'Symptoms'];
const TOTAL_STEPS = 5;

// Initial form state — all raw string values (API sends these pre-processed)
const INITIAL = {
  // Step 1
  age: '', gender: '', height_cm: '', weight_kg: '',
  // Step 2
  exercise_level: '', avg_sleep_hours: '', stress_level: '',
  diet_type: '', eat_fruits_daily: '', eat_veggies_daily: '',
  eat_processed_food: '', water_intake_liters: '', meal_frequency: '',
  metabolism_type: '',
  // Step 3
  employment_status: '', work_type: '', work_stress: '',
  alcohol_consumption: '', smoking_status: '',
  screen_time_hours: '', sun_exposure: '',
  // Step 4
  family_history_diabetes: '', family_history_heart_disease: '',
  family_history_hypertension: '', family_history_obesity: '',
  family_history_pcos: '',
  has_asthma: '', has_thyroid: '', has_allergies: '',
  has_diabetes: '', has_heart_disease: '', has_hypertension: '',
  // Step 5
  fatigue_level: '', anxiety_level: '', social_interaction_level: '',
  shortness_of_breath: '', frequent_headaches: '', digestive_issues: '',
  difficulty_falling_asleep: '', perceived_appetite: '',
  frequent_urination: '', slow_wound_healing: '', numbness_tingling: '',
  menstrual_regularity: '',
};

// Validation per step
function validateStep(step, form, bmi) {
  const errs = {};
  if (step === 1) {
    if (!form.age)        errs.age        = 'Required';
    else if (form.age < 18 || form.age > 80) errs.age = 'Must be 18–80';
    if (!form.gender)     errs.gender     = 'Required';
    if (!form.height_cm)  errs.height_cm  = 'Required';
    if (!form.weight_kg)  errs.weight_kg  = 'Required';
    if (bmi && (bmi < 14 || bmi > 55)) errs.bmi = 'BMI out of plausible range (14–55). Check height/weight.';
  }
  if (step === 2) {
    if (!form.exercise_level)   errs.exercise_level   = 'Required';
    if (!form.avg_sleep_hours)  errs.avg_sleep_hours  = 'Required';
    if (!form.stress_level)     errs.stress_level     = 'Required';
    if (!form.diet_type)        errs.diet_type        = 'Required';
    if (!form.eat_fruits_daily) errs.eat_fruits_daily = 'Required';
    if (!form.eat_veggies_daily)errs.eat_veggies_daily= 'Required';
    if (!form.eat_processed_food) errs.eat_processed_food = 'Required';
    if (!form.water_intake_liters) errs.water_intake_liters = 'Required';
    if (!form.meal_frequency)   errs.meal_frequency   = 'Required';
    if (!form.metabolism_type)  errs.metabolism_type  = 'Required';
  }
  if (step === 3) {
    if (!form.employment_status)  errs.employment_status  = 'Required';
    if (!form.work_type)          errs.work_type          = 'Required';
    if (!form.work_stress)        errs.work_stress        = 'Required';
    if (!form.alcohol_consumption)errs.alcohol_consumption= 'Required';
    if (!form.smoking_status)     errs.smoking_status     = 'Required';
    if (!form.screen_time_hours)  errs.screen_time_hours  = 'Required';
    if (!form.sun_exposure)       errs.sun_exposure       = 'Required';
  }
  if (step === 4) {
    const fhCols = ['family_history_diabetes','family_history_heart_disease',
                    'family_history_hypertension','family_history_obesity'];
    fhCols.forEach(c => { if (!form[c]) errs[c] = 'Required'; });
    ['has_asthma','has_thyroid','has_allergies'].forEach(c => { if (!form[c]) errs[c] = 'Required'; });
    ['has_diabetes','has_heart_disease','has_hypertension'].forEach(c => { if (!form[c]) errs[c] = 'Required'; });
    // PCOS/menstrual only required for females
    if (form.gender === 'Female') {
      if (!form.family_history_pcos) errs.family_history_pcos = 'Required for females';
    }
  }
  if (step === 5) {
    const required5 = ['fatigue_level','anxiety_level','social_interaction_level',
                       'shortness_of_breath','frequent_headaches','digestive_issues',
                       'difficulty_falling_asleep','perceived_appetite',
                       'frequent_urination','slow_wound_healing','numbness_tingling'];
    required5.forEach(c => { if (!form[c]) errs[c] = 'Required'; });
    if (form.gender === 'Female') {
      if (!form.menstrual_regularity) errs.menstrual_regularity = 'Required for females';
    }
  }
  return errs;
}

// Main component
export default function UnifiedForm({ onSubmit, isLoading, demoData }) {
  const [step,       setStep]     = useState(1);
  const [form,       setForm]     = useState(INITIAL);
  const [errors,     setErrors]   = useState({});
  const [bmi,        setBmi]      = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);

  // Pre-fill every field from demoData and jump straight to step 1
  const applyDemo = () => {
    if (!demoData) return;
    setForm({ ...INITIAL, ...demoData });
    setIsDemoMode(true);
    setErrors({});
    setStep(1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Clearing demo mode when user edits any field
  const set = (key, val) => {
    setForm(f => ({ ...f, [key]: val }));
    if (isDemoMode) setIsDemoMode(false);
  };

  // Derive BMI whenever height/weight change
  useEffect(() => {
    const h = parseFloat(form.height_cm);
    const w = parseFloat(form.weight_kg);
    if (h > 0 && w > 0) {
      setBmi(parseFloat((w / ((h / 100) ** 2)).toFixed(1)));
    } else {
      setBmi(null);
    }
  }, [form.height_cm, form.weight_kg]);



  const goNext = () => {
    const errs = validateStep(step, form, bmi);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setErrors({});
    setStep(s => s + 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const goBack = () => {
    setErrors({});
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleSubmit = () => {
    const errs = validateStep(5, form, bmi);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }

    // Determine menstrual_regularity and family_history_pcos for non-females
    const isFemale        = form.gender === 'Female';
    const isFemaleRepro   = isFemale && parseFloat(form.age) <= 50;
    const menstrual       = isFemale ? (form.menstrual_regularity || 'N/A') : 'N/A';
    const fhPcos          = isFemale ? (form.family_history_pcos || 'No') : 'N/A';

    const payload = {
      // Raw numerical
      age:                    parseFloat(form.age),
      height_cm:              parseFloat(form.height_cm),
      weight_kg:              parseFloat(form.weight_kg),
      bmi:                    bmi,
      avg_sleep_hours:        parseFloat(form.avg_sleep_hours),
      stress_level:           parseInt(form.stress_level),
      work_stress:            parseInt(form.work_stress),
      screen_time_hours:      parseFloat(form.screen_time_hours),
      water_intake_liters:    parseFloat(form.water_intake_liters),
      meal_frequency:         parseInt(form.meal_frequency),
      anxiety_level:          parseInt(form.anxiety_level),
      fatigue_level:          parseInt(form.fatigue_level),

      // Categorical (sent as raw strings — API encodes them)
      gender:                       form.gender,
      exercise_level:               form.exercise_level,
      diet_type:                    form.diet_type,
      eat_fruits_daily:             form.eat_fruits_daily,
      eat_veggies_daily:            form.eat_veggies_daily,
      eat_processed_food:           form.eat_processed_food,
      metabolism_type:              form.metabolism_type,
      employment_status:            form.employment_status,
      work_type:                    form.work_type,
      alcohol_consumption:          form.alcohol_consumption,
      smoking_status:               form.smoking_status,
      sun_exposure:                 form.sun_exposure,
      social_interaction_level:     form.social_interaction_level,
      shortness_of_breath:          form.shortness_of_breath,
      frequent_headaches:           form.frequent_headaches,
      digestive_issues:             form.digestive_issues,
      difficulty_falling_asleep:    form.difficulty_falling_asleep,
      perceived_appetite:           form.perceived_appetite,
      family_history_diabetes:      form.family_history_diabetes,
      family_history_heart_disease: form.family_history_heart_disease,
      family_history_hypertension:  form.family_history_hypertension,
      family_history_obesity:       form.family_history_obesity,
      family_history_pcos:          fhPcos,
      has_asthma:                   form.has_asthma,
      has_thyroid:                  form.has_thyroid,
      has_allergies:                form.has_allergies,
      frequent_urination:           form.frequent_urination,
      slow_wound_healing:           form.slow_wound_healing,
      numbness_tingling:            form.numbness_tingling,
      menstrual_regularity:         menstrual,
    };

    // Existing conditions are for UI display only — not sent to the prediction API
    const existingConditions = {
      has_diabetes:      form.has_diabetes,
      has_heart_disease: form.has_heart_disease,
      has_hypertension:  form.has_hypertension,
    };

    onSubmit(payload, existingConditions);
  };

  // Progress label 
  const stepCompletionText = {
    1: '10 fields',
    2: '10 fields',
    3: '7 fields',
    4: form.gender === 'Female' ? '8 fields' : '7 fields',
    5: form.gender === 'Female' ? '12 fields' : '11 fields',
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>

      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
          Build your health profile
        </h2>
        <p style={{ color: '#64748b', fontSize: '15px', margin: '0 0 20px' }}>
          {TOTAL_STEPS} quick steps · All 42 health indicators · Your data stays private
        </p>
        {/* Demo mode button — only shown when demoData is available */}
        {demoData && (
          <button type="button" onClick={applyDemo} style={demoBtn.btn}>
            <span style={{ fontSize: '16px' }}>⚡</span>
            Try Demo Mode
            <span style={demoBtn.badge}>Pre-fills all 42 fields</span>
          </button>
        )}
      </div>

      {/* Demo mode active banner */}
      {isDemoMode && (
        <div style={demoBtn.banner}>
          <span style={{ fontSize: '18px' }}>🧪</span>
          <div style={{ flex: 1 }}>
            <strong>Demo Mode active</strong> — this is a sample profile of a 38-year-old
            male desk worker with moderate health risks.
            Edit any field to switch to your own data.
          </div>
          <button onClick={() => { setForm(INITIAL); setIsDemoMode(false); setStep(1); }}
                  style={demoBtn.clearBtn}>
            Clear
          </button>
        </div>
      )}

      <StepBar current={step} total={TOTAL_STEPS} labels={STEP_LABELS} />

      {Object.keys(errors).length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#dc2626' }}>
          ⚠️ Please fill in all required fields before continuing.
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
            {Object.entries(errors).map(([k, v]) => (
              <li key={k}><strong>{k.replace(/_/g, ' ')}:</strong> {v}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>

        {/* STEP 1: Demographics & Anthropometrics */}
        {step === 1 && (
          <>
            <StepSection title="Basic Demographics" icon="👤">
              <Field label="Age" hint="18–80 years" error={errors.age}>
                <NumberInput value={form.age} onChange={v => set('age', v)} min={18} max={80} placeholder="e.g. 35" />
              </Field>
              <Field label="Biological Sex" error={errors.gender}>
                <OptionGroup value={form.gender} onChange={v => set('gender', v)}
                  options={['Male', 'Female', 'Other']} />
              </Field>
            </StepSection>

            <StepSection title="Anthropometrics" icon="📏">
              <Field label="Height" hint="cm (140–200)" error={errors.height_cm}>
                <NumberInput value={form.height_cm} onChange={v => set('height_cm', v)} min={140} max={200} step={0.5} placeholder="e.g. 168" />
              </Field>
              <Field label="Weight" hint="kg (35–180)" error={errors.weight_kg}>
                <NumberInput value={form.weight_kg} onChange={v => set('weight_kg', v)} min={35} max={180} step={0.1} placeholder="e.g. 72" />
              </Field>
              {bmi && (
                <Field label="Calculated BMI" error={errors.bmi}>
                  <div style={{ padding: '12px 14px', background: bmi < 18.5 ? '#eff6ff' : bmi < 25 ? '#f0fdf4' : bmi < 30 ? '#fefce8' : '#fef2f2', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                    <span style={{ fontSize: '24px', fontWeight: 800, color: bmi < 18.5 ? '#3b82f6' : bmi < 25 ? '#16a34a' : bmi < 30 ? '#ca8a04' : '#dc2626' }}>{bmi}</span>
                    <span style={{ fontSize: '13px', color: '#64748b', marginLeft: '10px' }}>
                      {bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Normal weight' : bmi < 30 ? 'Overweight' : bmi < 35 ? 'Obese Class I' : bmi < 40 ? 'Obese Class II' : 'Obese Class III'}
                    </span>
                  </div>
                </Field>
              )}
            </StepSection>
          </>
        )}

        {/* STEP 2: Lifestyle & Diet */}
        {step === 2 && (
          <>
            <StepSection title="Physical Activity & Sleep" icon="🏃">
              <Field label="Exercise Level" hint="Typical weekly physical activity" error={errors.exercise_level}>
                <OptionGroup value={form.exercise_level} onChange={v => set('exercise_level', v)}
                  options={[
                    { value: 'Sedentary', label: 'Sedentary' },
                    { value: 'Light',     label: 'Light' },
                    { value: 'Moderate',  label: 'Moderate' },
                    { value: 'Active',    label: 'Active' },
                  ]} />
              </Field>
              <Field label="Average Sleep Hours" hint="3–12 hours per night" error={errors.avg_sleep_hours}>
                <NumberInput value={form.avg_sleep_hours} onChange={v => set('avg_sleep_hours', v)} min={3} max={12} step={0.5} placeholder="e.g. 7.0" />
              </Field>
              <Field label="Stress Level" hint="1 = minimal · 10 = extreme" error={errors.stress_level}>
                <SliderInput value={form.stress_level} onChange={v => set('stress_level', v)} min={1} max={10} />
              </Field>
              <Field label="Metabolism Type" error={errors.metabolism_type}>
                <OptionGroup value={form.metabolism_type} onChange={v => set('metabolism_type', v)}
                  options={['Slow', 'Normal', 'Fast']} />
              </Field>
            </StepSection>

            <StepSection title="Diet & Nutrition" icon="🥗">
              <Field label="Primary Diet Type" error={errors.diet_type}>
                <Select value={form.diet_type} onChange={v => set('diet_type', v)}
                  options={['Non Vegetarian','Vegetarian','Vegan','Pescatarian','Keto/Low-carb','Mediterranean','Junk-food-heavy']} />
              </Field>
              <Field label="Eat Fruit Daily?" error={errors.eat_fruits_daily}>
                <YesNo value={form.eat_fruits_daily} onChange={v => set('eat_fruits_daily', v)} />
              </Field>
              <Field label="Eat Vegetables Daily?" error={errors.eat_veggies_daily}>
                <YesNo value={form.eat_veggies_daily} onChange={v => set('eat_veggies_daily', v)} />
              </Field>
              <Field label="Processed Food Consumption" error={errors.eat_processed_food}>
                <OptionGroup value={form.eat_processed_food} onChange={v => set('eat_processed_food', v)}
                  options={['Never','Rarely','Moderate','Heavy']} />
              </Field>
              <Field label="Daily Water Intake" hint="0.5–5.0 litres" error={errors.water_intake_liters}>
                <NumberInput value={form.water_intake_liters} onChange={v => set('water_intake_liters', v)} min={0.5} max={5} step={0.1} placeholder="e.g. 2.0" />
              </Field>
              <Field label="Meals Per Day" hint="1–6" error={errors.meal_frequency}>
                <OptionGroup value={form.meal_frequency} onChange={v => set('meal_frequency', v)}
                  options={['1','2','3','4','5','6']} />
              </Field>
            </StepSection>
          </>
        )}

        {/* STEP 3: Work & Habits */}
        {step === 3 && (
          <>
            <StepSection title="Employment" icon="💼">
              <Field label="Employment Status" error={errors.employment_status}>
                <OptionGroup value={form.employment_status} onChange={v => set('employment_status', v)}
                  options={['Student','Employed','Self-Employed','Unemployed','Retired']} />
              </Field>
              <Field label="Work Type / Occupation" error={errors.work_type}>
                <Select value={form.work_type} onChange={v => set('work_type', v)}
                  options={['Desk/Office','Remote/WFH','Manual Labor','Healthcare','Creative',
                            'Retail/Service','Field Work','Student','Homemaker','Retired','Unemployed/None']} />
              </Field>
              <Field label="Work Stress Level" hint="1 = none · 10 = extreme" error={errors.work_stress}>
                <SliderInput value={form.work_stress} onChange={v => set('work_stress', v)} min={1} max={10} />
              </Field>
            </StepSection>

            <StepSection title="Lifestyle & Habits" icon="🌿">
              <Field label="Screen Time Per Day" hint="0.5–18 hours (phone + computer + TV)" error={errors.screen_time_hours}>
                <NumberInput value={form.screen_time_hours} onChange={v => set('screen_time_hours', v)} min={0.5} max={18} step={0.5} placeholder="e.g. 7.0" />
              </Field>
              <Field label="Alcohol Consumption" error={errors.alcohol_consumption}>
                <OptionGroup value={form.alcohol_consumption} onChange={v => set('alcohol_consumption', v)}
                  options={['Never','Rarely','Moderate','Heavy','Former']} />
              </Field>
              <Field label="Smoking Status" error={errors.smoking_status}>
                <OptionGroup value={form.smoking_status} onChange={v => set('smoking_status', v)}
                  options={['Never','Former','Current']} />
              </Field>
              <Field label="Daily Sun Exposure" error={errors.sun_exposure}>
                <OptionGroup value={form.sun_exposure} onChange={v => set('sun_exposure', v)}
                  options={['Low','Moderate','High']} />
              </Field>
            </StepSection>
          </>
        )}

        {/* STEP 4: Medical & Family History */}
        {step === 4 && (
          <>
            <StepSection title="Family Medical History" icon="🧬">
              {[
                { key: 'family_history_diabetes',       label: 'Diabetes in immediate family?' },
                { key: 'family_history_heart_disease',  label: 'Heart disease in immediate family?' },
                { key: 'family_history_hypertension',   label: 'Hypertension in immediate family?' },
                { key: 'family_history_obesity',        label: 'Obesity in immediate family?' },
              ].map(({ key, label }) => (
                <Field key={key} label={label} error={errors[key]}>
                  <YesNo value={form[key]} onChange={v => set(key, v)} />
                </Field>
              ))}
              {form.gender === 'Female' && (
                <Field label="PCOS in immediate family? (females only)" error={errors.family_history_pcos}>
                  <YesNo value={form.family_history_pcos} onChange={v => set('family_history_pcos', v)} />
                </Field>
              )}
            </StepSection>

            <StepSection title="Diagnosed Conditions" icon="🏥">
              {[
                { key: 'has_asthma',    label: 'Diagnosed with Asthma?' },
                { key: 'has_thyroid',   label: 'Diagnosed with a Thyroid condition?' },
                { key: 'has_allergies', label: 'Diagnosed with Allergies / Intolerances?' },
              ].map(({ key, label }) => (
                <Field key={key} label={label} error={errors[key]}>
                  <YesNo value={form[key]} onChange={v => set(key, v)} />
                </Field>
              ))}
            </StepSection>

            <StepSection title="Existing Diagnoses" icon="📋">
              <p style={{ gridColumn: '1/-1', margin: '-8px 0 4px', fontSize: '13px', color: '#64748b' }}>
                If you already have these conditions, we'll adjust your dashboard accordingly.
              </p>
              <Field label="Do you already have Diabetes?" error={errors.has_diabetes}>
                <YesNo value={form.has_diabetes} onChange={v => set('has_diabetes', v)} />
              </Field>
              <Field label="Do you already have Heart Disease?" error={errors.has_heart_disease}>
                <YesNo value={form.has_heart_disease} onChange={v => set('has_heart_disease', v)} />
              </Field>
              <Field label="Do you already have High Blood Pressure (Hypertension)?" error={errors.has_hypertension}>
                <YesNo value={form.has_hypertension} onChange={v => set('has_hypertension', v)} />
              </Field>
            </StepSection>
          </>
        )}

        {/* STEP 5: Symptoms & Mental Health */}
        {step === 5 && (
          <>
            <StepSection title="Mental & Emotional Health" icon="🧘">
              <Field label="Anxiety Level" hint="1 = minimal · 10 = severe" error={errors.anxiety_level}>
                <SliderInput value={form.anxiety_level} onChange={v => set('anxiety_level', v)} min={1} max={10} />
              </Field>
              <Field label="Social Interaction" error={errors.social_interaction_level}>
                <OptionGroup value={form.social_interaction_level} onChange={v => set('social_interaction_level', v)}
                  options={['Low','Moderate','High']} />
              </Field>
              <Field label="Difficulty Falling Asleep" error={errors.difficulty_falling_asleep}>
                <OptionGroup value={form.difficulty_falling_asleep} onChange={v => set('difficulty_falling_asleep', v)}
                  options={['Never','Rarely','Sometimes','Often']} />
              </Field>
              <Field label="Digestive Issues (bloating, IBS, reflux)" error={errors.digestive_issues}>
                <OptionGroup value={form.digestive_issues} onChange={v => set('digestive_issues', v)}
                  options={['Never','Rarely','Sometimes','Often']} />
              </Field>
            </StepSection>

            <StepSection title="Physical Symptoms" icon="🩺">
              <Field label="Fatigue Level" hint="1 = rarely fatigued · 10 = constant severe" error={errors.fatigue_level}>
                <SliderInput value={form.fatigue_level} onChange={v => set('fatigue_level', v)} min={1} max={10} />
              </Field>
              <Field label="Shortness of Breath (during routine activity)" error={errors.shortness_of_breath}>
                <OptionGroup value={form.shortness_of_breath} onChange={v => set('shortness_of_breath', v)}
                  options={['Never','Rarely','Sometimes','Often']} />
              </Field>
              <Field label="Frequent Headaches" error={errors.frequent_headaches}>
                <OptionGroup value={form.frequent_headaches} onChange={v => set('frequent_headaches', v)}
                  options={['Never','Rarely','Sometimes','Often']} />
              </Field>
              <Field label="Perceived Appetite Level" error={errors.perceived_appetite}>
                <OptionGroup value={form.perceived_appetite} onChange={v => set('perceived_appetite', v)}
                  options={['Low','Normal','Excessive']} />
              </Field>
            </StepSection>

            <StepSection title="Diabetes Symptom Cluster" icon="🍭">
              <p style={{ gridColumn: '1/-1', margin: '-8px 0 4px', fontSize: '13px', color: '#64748b' }}>
                These are clinically specific symptoms. Answer honestly — they help calibrate diabetes risk.
              </p>
              <Field label="Frequent / Unusual Urination?" error={errors.frequent_urination}>
                <YesNo value={form.frequent_urination} onChange={v => set('frequent_urination', v)} />
              </Field>
              <Field label="Slow Wound / Cut Healing?" error={errors.slow_wound_healing}>
                <YesNo value={form.slow_wound_healing} onChange={v => set('slow_wound_healing', v)} />
              </Field>
              <Field label="Numbness or Tingling in Hands / Feet?" error={errors.numbness_tingling}>
                <YesNo value={form.numbness_tingling} onChange={v => set('numbness_tingling', v)} />
              </Field>
            </StepSection>

            {form.gender === 'Female' && (
              <StepSection title="Female-Specific" icon="♀️">
                <Field label="Menstrual Cycle Regularity" hint="Post-menopausal → select N/A" error={errors.menstrual_regularity}>
                  <OptionGroup value={form.menstrual_regularity} onChange={v => set('menstrual_regularity', v)}
                    options={['Regular','Irregular','Very Irregular','N/A']} />
                </Field>
              </StepSection>
            )}
          </>
        )}

      </div>

      {/* Navigation buttons */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        {step > 1 && (
          <button type="button" onClick={goBack} style={nav.back}>
            ← Back
          </button>
        )}
        <div style={{ flex: 1, textAlign: 'center', color: '#94a3b8', fontSize: '12px' }}>
          Step {step} of {TOTAL_STEPS} · ~{stepCompletionText[step]}
        </div>
        {step < TOTAL_STEPS ? (
          <button type="button" onClick={goNext} style={nav.next}>
            Continue →
          </button>
        ) : (
          <button type="button" onClick={handleSubmit} disabled={isLoading} style={nav.submit}>
            {isLoading ? 'Analysing...' : 'Analyse My Health →'}
          </button>
        )}
      </div>
    </div>
  );
}

const demoBtn = {
  btn:      { display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '11px 22px',
              background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white',
              border: 'none', borderRadius: '10px', cursor: 'pointer', fontSize: '14px',
              fontWeight: 700, boxShadow: '0 4px 14px rgba(37,99,235,0.3)' },
  badge:    { background: 'rgba(255,255,255,0.2)', padding: '2px 9px', borderRadius: '999px',
              fontSize: '11px', fontWeight: 600, letterSpacing: '0.2px' },
  banner:   { display: 'flex', alignItems: 'center', gap: '12px', background: '#eff6ff',
              border: '1px solid #bfdbfe', borderRadius: '10px', padding: '12px 18px',
              marginBottom: '20px', fontSize: '13px', color: '#1e40af', lineHeight: 1.5 },
  clearBtn: { padding: '6px 14px', background: 'white', color: '#3b82f6',
              border: '1px solid #bfdbfe', borderRadius: '7px', cursor: 'pointer',
              fontSize: '12px', fontWeight: 600, flexShrink: 0 },
};

const nav = {
  back:   { padding: '13px 22px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
  next:   { padding: '13px 28px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
  submit: { padding: '14px 32px', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' },
};
