import React, { useState, useEffect } from 'react';

const YesNoToggle = ({ label, value, onChange, name }) => (
  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
    <label style={{ fontSize: '14px', fontWeight: '600', color: '#334155' }}>{label}</label>
    <div style={{ display: 'flex', gap: '10px' }}>
      <button type="button" onClick={() => onChange(name, 1)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: value === 1 ? '2px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: value === 1 ? '#eff6ff' : 'white', color: value === 1 ? '#1e40af' : '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>Yes</button>
      <button type="button" onClick={() => onChange(name, 0)} style={{ flex: 1, padding: '10px', borderRadius: '6px', border: value === 0 ? '2px solid #2563eb' : '1px solid #cbd5e1', backgroundColor: value === 0 ? '#eff6ff' : 'white', color: value === 0 ? '#1e40af' : '#64748b', cursor: 'pointer', fontWeight: 'bold' }}>No</button>
    </div>
  </div>
);

export default function UnifiedForm({ onSubmit, isLoading }) {
  const [formData, setFormData] = useState({
    // ML Features
    age: '', sex: null, height_cm: '', weight_kg: '',
    smoker: null, cigsPerDay: '', alcohol: null, physActivity: null, fruits: null, veggies: null,
    highBP: null, highChol: null, diabetes: null, stroke: null, heartDisease: null, diffWalk: null, genHlth: '3',
    sysBP: '', diaBP: '', totChol: '', heartRate: '', glucose: '',
    
    // NEW: Mandatory Database Features (For Recommendations)
    country: '', state: '', goalWeight: '', goal: '', goalPace: '', activityLevel: '', dietType: '', thyroid: null, kidney: null
  });

  const [calculatedBMI, setCalculatedBMI] = useState(0);

  useEffect(() => {
    if (formData.height_cm && formData.weight_kg) {
      const heightInMeters = formData.height_cm / 100;
      const bmi = formData.weight_kg / (heightInMeters * heightInMeters);
      setCalculatedBMI(parseFloat(bmi.toFixed(1)));
    }
  }, [formData.height_cm, formData.weight_kg]);

  const handleInputChange = (e) => setFormData({ ...formData, [e.target.name]: e.target.value });
  const handleToggleChange = (name, value) => setFormData({ ...formData, [name]: value });

  const handleSubmit = (e) => {
    e.preventDefault();
    const parseOptional = (val) => val === '' ? undefined : parseFloat(val);

    // --- NEW: FORM VALIDATION ---
    // Check if any required Yes/No toggles were left unclicked (null)
    const requiredToggles = [formData.smoker, formData.alcohol, formData.physActivity, formData.fruits, formData.veggies, formData.highBP, formData.highChol, formData.diabetes, formData.stroke, formData.heartDisease, formData.diffWalk];
    if (requiredToggles.includes(null)) {
      alert("⚠️ Please answer all the Yes/No questions before analyzing!");
      return; // Stop the function from hitting the API
    }
    // ----------------------------

    const cdcPayload = {
      HighBP: formData.highBP, HighChol: formData.highChol, BMI: calculatedBMI, Smoker: formData.smoker, Stroke: formData.stroke,
      HeartDiseaseorAttack: formData.heartDisease, PhysActivity: formData.physActivity, Fruits: formData.fruits, Veggies: formData.veggies,
      HvyAlcoholConsump: formData.alcohol, GenHlth: parseFloat(formData.genHlth), DiffWalk: formData.diffWalk, Sex: formData.sex, Age: parseFloat(formData.age)
    };

    const cardioPayload = {
      id: 0, age: parseFloat(formData.age), sex: formData.sex, is_smoking: formData.smoker, cigsPerDay: formData.smoker === 1 ? parseFloat(formData.cigsPerDay || 0) : 0,
      prevalentStroke: formData.stroke, prevalentHyp: formData.highBP, diabetes: formData.diabetes,
      totChol: parseOptional(formData.totChol), sysBP: parseOptional(formData.sysBP), diaBP: parseOptional(formData.diaBP),
      BMI: calculatedBMI, heartRate: parseOptional(formData.heartRate), glucose: parseOptional(formData.glucose)
    };

    const dbPayload = {
      country: formData.country, state: formData.state,
      currentWeight: parseFloat(formData.weight_kg), goalWeight: parseFloat(formData.goalWeight),
      goal: formData.goal, goalPace: formData.goalPace,
      activityLevel: formData.activityLevel, dietType: formData.dietType,
      hasThyroidIssue: formData.thyroid, hasKidneyDisease: formData.kidney
    };

    onSubmit(cdcPayload, cardioPayload, dbPayload);
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <h2 style={{ color: '#0f172a', textAlign: 'center', marginBottom: '10px' }}>Let's get to know you.</h2>
      <p style={{ color: '#64748b', textAlign: 'center', marginBottom: '40px' }}>Your data is private. This helps us predict risks and tailor your plan.</p>
      
      <form onSubmit={handleSubmit}>
        
        {/* NEW: GOALS & LOCATION (Database) */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>🎯 Goals & Location</h3>
          <div style={gridStyle}>
            <label style={labelStyle}>Country<input type="text" required name="country" value={formData.country} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>State/Province<input type="text" required name="state" value={formData.state} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Primary Goal
              <select required name="goal" value={formData.goal} onChange={handleInputChange} style={inputStyle}>
                <option value="" disabled>Select...</option><option value="Weight Loss">Weight Loss</option><option value="Weight Gain">Weight Gain</option><option value="Be Healthy">Be Healthy / Maintain</option>
              </select>
            </label>
            <label style={labelStyle}>Goal Weight (kg)<input type="number" required name="goalWeight" value={formData.goalWeight} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Pace / Aggressiveness
              <select required name="goalPace" value={formData.goalPace} onChange={handleInputChange} style={inputStyle}>
                <option value="" disabled>Select...</option><option value="Slow">Slow & Steady</option><option value="Moderate">Moderate</option><option value="Aggressive">Aggressive</option>
              </select>
            </label>
          </div>
        </div>

        {/* BASIC VITALS (ML) */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>👤 Basic Profile</h3>
          <div style={gridStyle}>
            <label style={labelStyle}>Age (Years)<input type="number" required name="age" value={formData.age} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Sex <select required name="sex" value={formData.sex === null ? '' : formData.sex} onChange={handleInputChange} style={inputStyle}><option value="" disabled>Select...</option><option value="1">Male</option><option value="0">Female</option></select></label>
            <label style={labelStyle}>Height (cm)<input type="number" required name="height_cm" value={formData.height_cm} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Current Weight (kg)<input type="number" required name="weight_kg" value={formData.weight_kg} onChange={handleInputChange} style={inputStyle} /></label>
          </div>
        </div>

        {/* LIFESTYLE (ML + DB) */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>🏃 Lifestyle & Diet</h3>
          <div style={gridStyle}>
            <label style={labelStyle}>Diet Type
              <select required name="dietType" value={formData.dietType} onChange={handleInputChange} style={inputStyle}>
                <option value="" disabled>Select...</option><option value="Vegetarian">Vegetarian</option><option value="Non-Vegetarian">Non-Vegetarian</option><option value="Vegan">Vegan</option><option value="Pescatarian">Pescatarian</option><option value="Other">Other</option>
              </select>
            </label>
            <label style={labelStyle}>Daily Activity Level
              <select required name="activityLevel" value={formData.activityLevel} onChange={handleInputChange} style={inputStyle}>
                <option value="" disabled>Select...</option><option value="Sedentary">Sedentary (Desk job)</option><option value="Light">Light (1-3 days/wk)</option><option value="Moderate">Moderate (3-5 days/wk)</option><option value="High">High (Daily)</option>
              </select>
            </label>
            <YesNoToggle name="physActivity" label="Exercised in past 30 days?" value={formData.physActivity} onChange={handleToggleChange} />
            <YesNoToggle name="fruits" label="Eat fruit daily?" value={formData.fruits} onChange={handleToggleChange} />
            <YesNoToggle name="veggies" label="Eat vegetables daily?" value={formData.veggies} onChange={handleToggleChange} />
            <YesNoToggle name="alcohol" label="Heavy alcohol consumption?" value={formData.alcohol} onChange={handleToggleChange} />
            <YesNoToggle name="smoker" label="Do you smoke?" value={formData.smoker} onChange={handleToggleChange} />
            {formData.smoker === 1 && <label style={labelStyle}>Cigarettes per day<input type="number" required name="cigsPerDay" value={formData.cigsPerDay} onChange={handleInputChange} style={inputStyle} /></label>}
          </div>
        </div>

        {/* MEDICAL HISTORY (ML + DB) */}
        <div style={cardStyle}>
          <h3 style={sectionTitle}>🏥 Medical History</h3>
          <div style={gridStyle}>
            {/* DB Only */}
            <YesNoToggle name="thyroid" label="Diagnosed with Thyroid issues?" value={formData.thyroid} onChange={handleToggleChange} />
            <YesNoToggle name="kidney" label="Diagnosed with Kidney Disease?" value={formData.kidney} onChange={handleToggleChange} />
            {/* ML Needed */}
            <YesNoToggle name="highBP" label="Diagnosed with High Blood Pressure?" value={formData.highBP} onChange={handleToggleChange} />
            <YesNoToggle name="highChol" label="Diagnosed with High Cholesterol?" value={formData.highChol} onChange={handleToggleChange} />
            <YesNoToggle name="diabetes" label="Diagnosed with Diabetes?" value={formData.diabetes} onChange={handleToggleChange} />
            <YesNoToggle name="heartDisease" label="History of Heart Disease/Attack?" value={formData.heartDisease} onChange={handleToggleChange} />
            <YesNoToggle name="stroke" label="History of Stroke?" value={formData.stroke} onChange={handleToggleChange} />
            <YesNoToggle name="diffWalk" label="Serious difficulty walking/climbing stairs?" value={formData.diffWalk} onChange={handleToggleChange} />
            <label style={labelStyle}>Overall General Health 
              <select name="genHlth" value={formData.genHlth} onChange={handleInputChange} style={inputStyle}>
                <option value="1">Excellent</option><option value="2">Very Good</option><option value="3">Good</option><option value="4">Fair</option><option value="5">Poor</option>
              </select>
            </label>
          </div>
        </div>

        {/* OPTIONAL CLINICALS (ML) */}
        <div style={{ ...cardStyle, border: '1px dashed #94a3b8', backgroundColor: '#f8fafc' }}>
          <h3 style={sectionTitle}>🔬 Clinical Vitals <span style={{fontSize: '14px', fontWeight: 'normal', color: '#64748b'}}>(Optional)</span></h3>
          <div style={gridStyle}>
            <label style={labelStyle}>Systolic BP (e.g., 120)<input type="number" name="sysBP" placeholder="120" value={formData.sysBP} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Diastolic BP (e.g., 80)<input type="number" name="diaBP" placeholder="80" value={formData.diaBP} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Total Cholesterol (mg/dL)<input type="number" name="totChol" placeholder="200" value={formData.totChol} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Fasting Glucose (mg/dL)<input type="number" name="glucose" placeholder="90" value={formData.glucose} onChange={handleInputChange} style={inputStyle} /></label>
            <label style={labelStyle}>Resting Heart Rate (BPM)<input type="number" name="heartRate" placeholder="70" value={formData.heartRate} onChange={handleInputChange} style={inputStyle} /></label>
          </div>
        </div>

        <button type="submit" disabled={isLoading} style={{ width: '100%', padding: '20px', backgroundColor: '#0f172a', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}>
          {isLoading ? '🧠 Generating AI Risk Profile...' : 'View My Health Dashboard'}
        </button>
      </form>
    </div>
  );
}

const cardStyle = { backgroundColor: 'white', padding: '30px', borderRadius: '12px', boxShadow: '0 1px 3px 0 rgb(0 0 0 / 0.1)', marginBottom: '30px' };
const sectionTitle = { borderBottom: '2px solid #f1f5f9', paddingBottom: '10px', color: '#0f172a', marginTop: 0, marginBottom: '25px' };
const gridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px' };
const labelStyle = { display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: '600', color: '#334155', gap: '8px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', backgroundColor: '#f8fafc', color: '#0f172a' };