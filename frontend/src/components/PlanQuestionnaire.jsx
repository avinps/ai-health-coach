// 3-Step Plan Preferences Wizard

import React, { useState, useMemo } from 'react';

// Ideal weight helper (WHO BMI 22.5 midpoint for healthy range (18.5–25))
// Returns the weight in kg that corresponds to BMI 22.5 for a given height.
function calcIdealWeight(height_cm) {
  if (!height_cm || height_cm <= 0) return null;
  return Math.round(22.5 * Math.pow(height_cm / 100, 2) * 10) / 10;
}

// Tiny shared UI atoms

function Field({ label, hint, error, wide, children }) {
  return (
    <div style={{ ...fc.wrap, ...(wide ? { gridColumn: '1 / -1' } : {}) }}>
      <label style={fc.label}>
        {label}
        {hint && <span style={fc.hint}>{hint}</span>}
      </label>
      {children}
      {error && <span style={fc.err}>{error}</span>}
    </div>
  );
}

function TextInput({ value, onChange, placeholder = '' }) {
  return (
    <input
      type="text"
      value={value}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      style={fc.input}
    />
  );
}

function NumberInput({ value, onChange, min, max, step = 1, placeholder = '', disabled = false }) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step}
      placeholder={placeholder}
      disabled={disabled}
      onChange={e => onChange(e.target.value)}
      style={{ ...fc.input, ...(disabled ? fc.inputDisabled : {}) }}
    />
  );
}

function OptionGroup({ value, onChange, options, columns }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: columns
        ? `repeat(${columns}, 1fr)`
        : 'repeat(auto-fit, minmax(110px, 1fr))',
      gap: '8px',
    }}>
      {options.map(o => {
        const val   = typeof o === 'object' ? o.value : o;
        const label = typeof o === 'object' ? o.label : o;
        return (
          <button key={val} type="button" onClick={() => onChange(val)}
                  style={{ ...fc.chip, ...(value === val ? fc.chipOn : {}) }}>
            {label}
          </button>
        );
      })}
    </div>
  );
}

const fc = {
  wrap:         { display: 'flex', flexDirection: 'column', gap: '7px' },
  label:        { fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', flexDirection: 'column', gap: '3px' },
  hint:         { fontSize: '11px', fontWeight: 400, color: '#94a3b8' },
  err:          { fontSize: '11px', color: '#ef4444' },
  input:        { padding: '11px 13px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '14px', background: '#f8fafc', color: '#0f172a', outline: 'none', width: '100%', boxSizing: 'border-box' },
  inputDisabled:{ background: '#f1f5f9', color: '#94a3b8', cursor: 'not-allowed', border: '1px solid #e2e8f0' },
  chip:         { padding: '9px 14px', borderRadius: '8px', border: '1px solid #e2e8f0', background: 'white', color: '#64748b', cursor: 'pointer', fontSize: '13px', fontWeight: 500, transition: 'all 0.15s', textAlign: 'center' },
  chipOn:       { border: '2px solid #2563eb', background: '#eff6ff', color: '#1e40af', fontWeight: 700 },
};

// Section wrapper
function Section({ title, icon, children }) {
  return (
    <div style={{ marginBottom: '28px' }}>
      <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px', display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '10px', borderBottom: '2px solid #f1f5f9' }}>
        <span>{icon}</span> {title}
      </h3>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px' }}>
        {children}
      </div>
    </div>
  );
}

// Step progress bar
function StepBar({ current, labels }) {
  return (
    <div style={{ marginBottom: '32px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '10px' }}>
        {labels.map((lbl, i) => (
          <div key={i} style={{ textAlign: 'center', flex: 1 }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '50%', margin: '0 auto 6px',
              background: i < current ? '#22c55e' : i === current - 1 ? '#2563eb' : '#e2e8f0',
              color: i <= current - 1 ? 'white' : '#94a3b8',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '13px', fontWeight: 700, transition: 'all 0.3s',
            }}>
              {i < current - 1 ? '✓' : i + 1}
            </div>
            <span style={{ fontSize: '12px', color: i === current - 1 ? '#2563eb' : '#94a3b8', fontWeight: i === current - 1 ? 600 : 400 }}>
              {lbl}
            </span>
          </div>
        ))}
      </div>
      <div style={{ height: '4px', background: '#e2e8f0', borderRadius: '99px' }}>
        <div style={{ height: '100%', background: 'linear-gradient(90deg, #2563eb, #6366f1)', borderRadius: '99px', width: `${((current - 1) / (labels.length - 1)) * 100}%`, transition: 'width 0.4s ease' }} />
      </div>
    </div>
  );
}

// Ideal weight info card
function IdealWeightCard({ idealWeight }) {
  if (!idealWeight) return null;
  return (
    <div style={{ padding: '14px 18px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '14px' }}>
      <span style={{ fontSize: '28px' }}>⚖️</span>
      <div>
        <p style={{ margin: '0 0 3px', fontSize: '13px', fontWeight: 600, color: '#15803d' }}>Your Calculated Ideal Weight</p>
        <p style={{ margin: 0, fontSize: '22px', fontWeight: 800, color: '#166534' }}>
          {idealWeight} <span style={{ fontSize: '14px', fontWeight: 500 }}>kg</span>
        </p>
        <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#16a34a' }}>
          Based on WHO healthy BMI midpoint (22.5) for your height
        </p>
      </div>
    </div>
  );
}

// Validation
function validateStep(step, d, currentWeight) {
  const e = {};

  if (step === 1) {
    if (!d.state.trim())   e.state   = 'Required';
    if (!d.country.trim()) e.country = 'Required';
    if (!d.goal)           e.goal    = 'Required';
    if (!d.aggressiveness) e.aggressiveness = 'Required';

    // goalWeight only required when goal is not "Be Healthy"
    if (d.goal !== 'Be Healthy') {
      const gw = parseFloat(d.goalWeight);
      if (!d.goalWeight) {
        e.goalWeight = 'Required';
      } else if (isNaN(gw)) {
        e.goalWeight = 'Must be a number';
      } else if (d.goal === 'Weight Gain' && currentWeight && gw <= currentWeight) {
        e.goalWeight = `Must be above your current weight (${currentWeight} kg)`;
      } else if (d.goal === 'Weight Loss' && currentWeight && gw >= currentWeight) {
        e.goalWeight = `Must be below your current weight (${currentWeight} kg)`;
      }
    }
  }

  if (step === 2) {
    if (!d.cookingAbility) e.cookingAbility = 'Required';
    if (!d.budget)         e.budget         = 'Required';
    if (!d.mealsPerDay)    e.mealsPerDay    = 'Required';
    if (d.eatingOutFreq === '' || d.eatingOutFreq === null) e.eatingOutFreq = 'Required';
  }

  if (step === 3) {
    if (!d.muscleLevel)       e.muscleLevel       = 'Required';
    if (!d.workoutFrequency)  e.workoutFrequency  = 'Required';
    if (!d.workoutLocation)   e.workoutLocation   = 'Required';
    if (!d.timePerSession)    e.timePerSession    = 'Required';
  }

  return e;
}

// Main component
const STEP_LABELS = ['Goals & Location', 'Diet & Food', 'Fitness & Workout'];

const INITIAL_DATA = {
  // Step 1
  state:           '',
  country:         '',
  goalWeight:      '',
  goal:            '',          // 'Weight Loss' | 'Weight Gain' | 'Be Healthy'
  aggressiveness:  '',          // 'Slow' | 'Moderate' | 'Aggressive'
  // Step 2
  favoriteFoods:   '',
  dislikedFoods:   '',
  cookingAbility:  '',          // 'Beginner' | 'Intermediate' | 'Advanced'
  budget:          '',          // 'Budget-Conscious' | 'Moderate' | 'No Constraints'
  mealsPerDay:     '',          // '3' | '4' | '5' | '6'
  eatingOutFreq:   '',          // number per week
  // Step 3
  muscleLevel:      '',         // 'Beginner' | 'Intermediate' | 'Advanced'
  workoutFrequency: '',         // '3' | '4' | '5' | '6' | '7'  (days/week)
  workoutLocation:  '',         // 'Home' | 'Gym'
  homeEquipment:    '',         // free text — only shown when Home is selected
  timePerSession:   '',         // '15 min' | '30 min' | '45 min' | '60 min'
};

export default function PlanQuestionnaire({ onBack, onDone, predictions, userProfile }) {
  const [step,   setStep]   = useState(1);
  const [data,   setData]   = useState(INITIAL_DATA);
  const [errors, setErrors] = useState({});

  // Pull anthropometrics from the health form
  const currentWeight = userProfile?.weight_kg  ? parseFloat(userProfile.weight_kg)  : null;
  const heightCm      = userProfile?.height_cm  ? parseFloat(userProfile.height_cm)  : null;

  // Ideal weight is memorised & only recalculates if height changes
  const idealWeight = useMemo(() => calcIdealWeight(heightCm), [heightCm]);

  const set = (key, val) => {
    setData(d => {
      const next = { ...d, [key]: val };
      // When the goal changes, clear goalWeight to avoid stale constraint violations
      if (key === 'goal') next.goalWeight = '';
      return next;
    });
  };

  // Derive min/max for goal weight input based on selected goal
  const goalWeightMin = data.goal === 'Weight Gain' && currentWeight
    ? currentWeight + 0.5
    : 30;
  const goalWeightMax = data.goal === 'Weight Loss' && currentWeight
    ? currentWeight - 0.5
    : 300;

  const goalWeightHint = () => {
    if (data.goal === 'Weight Gain' && currentWeight)
      return `Must be above your current weight (${currentWeight} kg)`;
    if (data.goal === 'Weight Loss' && currentWeight)
      return `Must be below your current weight (${currentWeight} kg)`;
    return 'in kg';
  };

  const goNext = () => {
    const errs = validateStep(step, data, currentWeight);
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
    if (step === 1) { onBack(); return; }
    setStep(s => s - 1);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDone = () => {
    const errs = validateStep(3, data, currentWeight);
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    // For "Be Healthy" attach the calculated ideal weight so future plan generation knows the target
    const finalData = {
      ...data,
      goalWeight: data.goal === 'Be Healthy' ? idealWeight : parseFloat(data.goalWeight),
      idealWeightUsed: data.goal === 'Be Healthy',
    };
    onDone(finalData);
  };

  return (
    <div style={{ maxWidth: '820px', margin: '0 auto' }}>

      <div style={{ textAlign: 'center', marginBottom: '32px' }}>
        <h2 style={{ fontSize: '26px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>
          Personalise Your Plan
        </h2>
        <p style={{ color: '#64748b', fontSize: '15px', margin: 0 }}>
          3 quick steps · Your answers will tailor your meal &amp; workout plan to your exact risk profile
        </p>
      </div>

      <StepBar current={step} labels={STEP_LABELS} />

      {/* Validation error summary */}
      {Object.keys(errors).length > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fecaca', borderRadius: '10px', padding: '14px 18px', marginBottom: '24px', fontSize: '13px', color: '#dc2626' }}>
          ⚠️ Please fill in all required fields before continuing.
          <ul style={{ margin: '8px 0 0', paddingLeft: '18px' }}>
            {Object.entries(errors).map(([k, v]) => (
              <li key={k}><strong>{k.replace(/([A-Z])/g, ' $1').toLowerCase()}:</strong> {v}</li>
            ))}
          </ul>
        </div>
      )}

      <div style={{ background: 'white', borderRadius: '16px', padding: '32px', boxShadow: '0 2px 12px rgba(0,0,0,0.08)', marginBottom: '24px' }}>

        {/* STEP 1: Goals & Location */}
        {step === 1 && (
          <>
            <Section title="Your Location" icon="📍">
              <Field label="State / Province" error={errors.state}>
                <TextInput value={data.state} onChange={v => set('state', v)} placeholder="e.g. California" />
              </Field>
              <Field label="Country" error={errors.country}>
                <TextInput value={data.country} onChange={v => set('country', v)} placeholder="e.g. United States" />
              </Field>
            </Section>

            <Section title="Your Health Goal" icon="🎯">
              {/* Goal selector — must come first so weight field reacts */}
              <Field label="What is your primary goal?" error={errors.goal} wide>
                <OptionGroup value={data.goal} onChange={v => set('goal', v)} columns={3}
                  options={[
                    { value: 'Weight Loss', label: 'Weight Loss' },
                    { value: 'Weight Gain', label: 'Weight Gain' },
                    { value: 'Be Healthy',  label: 'Be Healthy'  },
                  ]} />
              </Field>

              {/* Goal weight (conditional on goal type) */}
              {data.goal === 'Be Healthy' ? (
                // Be Healthy: show auto-calculated ideal weight, no text input
                <Field label="Your Ideal Weight" hint="Calculated from your height — no input needed" wide>
                  <IdealWeightCard idealWeight={idealWeight} />
                  {!heightCm && (
                    <p style={{ fontSize: '12px', color: '#f59e0b', margin: '6px 0 0' }}>
                      ⚠️ Height not found from your health assessment. Ideal weight cannot be calculated.
                    </p>
                  )}
                </Field>
              ) : data.goal ? (
                // Weight Loss or Weight Gain: input with enforced min/max
                <Field label="Goal Weight" hint={goalWeightHint()} error={errors.goalWeight}>
                  <NumberInput
                    value={data.goalWeight}
                    onChange={v => set('goalWeight', v)}
                    min={goalWeightMin}
                    max={goalWeightMax}
                    step={0.5}
                    placeholder={
                      data.goal === 'Weight Gain'
                        ? `More than ${currentWeight ?? '?'} kg`
                        : `Less than ${currentWeight ?? '?'} kg`
                    }
                  />
                  {/* Visual guidance below the input */}
                  {currentWeight && (
                    <p style={{ fontSize: '12px', color: '#64748b', margin: '4px 0 0' }}>
                      {data.goal === 'Weight Gain'
                        ? `Your current weight is ${currentWeight} kg. Enter a value above this.`
                        : `Your current weight is ${currentWeight} kg. Enter a value below this.`}
                    </p>
                  )}
                </Field>
              ) : (
                // No goal selected yet - show placeholder
                <Field label="Goal Weight" hint="Select a goal above first">
                  <NumberInput value="" onChange={() => {}} disabled placeholder="Select your goal first" />
                </Field>
              )}

              {/* Aggressiveness */}
              <Field label="How aggressively do you want to reach your goal?" error={errors.aggressiveness} wide>
                <OptionGroup value={data.aggressiveness} onChange={v => set('aggressiveness', v)} columns={3}
                  options={[
                    { value: 'Slow',       label: 'Slow & Steady' },
                    { value: 'Moderate',   label:  'Moderate'      },
                    { value: 'Aggressive', label: 'Aggressive'     },
                  ]} />
              </Field>
            </Section>
          </>
        )}

        {/* STEP 2: Diet & Food Preferences */}
        {step === 2 && (
          <>
            <Section title="Food Preferences" icon="🍽️">
              <Field label="Favourite Foods" hint="Optional — helps tailor your meal plan" wide>
                <TextInput value={data.favoriteFoods} onChange={v => set('favoriteFoods', v)} placeholder="e.g. Chicken, rice, apples, pasta…" />
              </Field>
              <Field label="Disliked / Avoided Foods" hint="Optional — we'll exclude these" wide>
                <TextInput value={data.dislikedFoods} onChange={v => set('dislikedFoods', v)} placeholder="e.g. Broccoli, fish, spicy food…" />
              </Field>
            </Section>

            <Section title="Cooking & Budget" icon="🧑‍🍳">
              <Field label="Cooking Ability" error={errors.cookingAbility}>
                <OptionGroup value={data.cookingAbility} onChange={v => set('cookingAbility', v)}
                  options={[
                    { value: 'Beginner',     label: 'Beginner'     },
                    { value: 'Intermediate', label: 'Intermediate' },
                    { value: 'Advanced',     label: 'Advanced'     },
                  ]} />
              </Field>
              <Field label="Grocery Budget" error={errors.budget}>
                <OptionGroup value={data.budget} onChange={v => set('budget', v)}
                  options={[
                    { value: 'Budget-Conscious', label: 'Budget-Conscious' },
                    { value: 'Moderate',         label: 'Moderate'         },
                    { value: 'No Constraints',   label: 'No Constraints'   },
                  ]} />
              </Field>
            </Section>

            <Section title="Eating Habits" icon="⏰">
              <Field label="Preferred Meals Per Day" hint="Choose between 3 and 6" error={errors.mealsPerDay}>
                <OptionGroup value={data.mealsPerDay} onChange={v => set('mealsPerDay', v)} columns={4}
                  options={['3', '4', '5', '6']} />
              </Field>
              <Field label="How many times do you eat out per week?" error={errors.eatingOutFreq}>
                <NumberInput value={data.eatingOutFreq} onChange={v => set('eatingOutFreq', v)} min={0} max={21} step={1} placeholder="e.g. 2" />
              </Field>
            </Section>
          </>
        )}

        {/* STEP 3: Fitness & Workout */}
        {step === 3 && (
          <>
            <Section title="Current Fitness Level" icon="💪">
              <Field label="Muscle / Strength Fitness Level" error={errors.muscleLevel} wide>
                <OptionGroup value={data.muscleLevel} onChange={v => set('muscleLevel', v)} columns={3}
                  options={[
                    { value: 'Beginner',     label: 'Beginner'     },
                    { value: 'Intermediate', label: 'Intermediate' },
                    { value: 'Advanced',     label: 'Advanced'     },
                  ]} />
              </Field>
            </Section>

            <Section title="Workout Preferences" icon="🏋️">

              <Field
                label="Workout Frequency"
                hint="Days per week you can commit to"
                error={errors.workoutFrequency}
              >
                <OptionGroup
                  value={data.workoutFrequency}
                  onChange={v => set('workoutFrequency', v)}
                  columns={5}
                  options={[
                    { value: '3', label: '3 days' },
                    { value: '4', label: '4 days' },
                    { value: '5', label: '5 days' },
                    { value: '6', label: '6 days' },
                    { value: '7', label: '7 days' },
                  ]}
                />
              </Field>

              <Field label="Preferred Workout Location" error={errors.workoutLocation}>
                <OptionGroup value={data.workoutLocation} onChange={v => set('workoutLocation', v)} columns={2}
                  options={[
                    { value: 'Home', label: 'Home' },
                    { value: 'Gym',  label: 'Gym'  },
                  ]} />
              </Field>

              {/* Conditional: home equipment only if Home selected */}
              {data.workoutLocation === 'Home' && (
                <Field label="Available Home Equipment" hint="List everything you have access to" wide>
                  <TextInput
                    value={data.homeEquipment}
                    onChange={v => set('homeEquipment', v)}
                    placeholder="e.g. Dumbbells, resistance bands, yoga mat, pull-up bar…"
                  />
                </Field>
              )}

              <Field label="Time Available Per Session" error={errors.timePerSession} wide>
                <OptionGroup value={data.timePerSession} onChange={v => set('timePerSession', v)} columns={4}
                  options={[
                    { value: '15 min', label: '15 min' },
                    { value: '30 min', label: '30 min' },
                    { value: '45 min', label: '45 min' },
                    { value: '60 min', label: '60 min' },
                  ]} />
              </Field>
            </Section>
          </>
        )}

      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
        <button type="button" onClick={goBack} style={nav.back}>
          ← Back
        </button>
        <span style={{ flex: 1, textAlign: 'center', fontSize: '12px', color: '#94a3b8' }}>
          Step {step} of {STEP_LABELS.length}
        </span>
        {step < STEP_LABELS.length ? (
          <button type="button" onClick={goNext} style={nav.next}>
            Continue →
          </button>
        ) : (
          <button type="button" onClick={handleDone} style={nav.generate}>
            Generate My Plan
          </button>
        )}
      </div>
    </div>
  );
}

const nav = {
  back:     { padding: '12px 22px', background: 'white', color: '#475569', border: '1px solid #cbd5e1', borderRadius: '10px', cursor: 'pointer', fontWeight: 600, fontSize: '14px' },
  next:     { padding: '12px 28px', background: 'linear-gradient(135deg, #1e3a5f, #2563eb)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '14px', boxShadow: '0 4px 12px rgba(37,99,235,0.3)' },
  generate: { padding: '13px 28px', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: 'none', borderRadius: '10px', cursor: 'pointer', fontWeight: 700, fontSize: '15px', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' },
};
