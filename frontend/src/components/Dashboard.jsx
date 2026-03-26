import React, { useState } from 'react';

export default function Dashboard({ data, onReset, onGeneratePlan }) {
  const risks = data.predictions;
  const xai = data.explanation;
  
  // State for the Optional Recommendation Questions
  const [personalInfo, setPersonalInfo] = useState({
    waterIntake: '', sleepHours: '', favoriteFoods: '', dislikedFoods: '', cookingAbility: '', budget: '', allergies: ''
  });

  const getRiskColor = (probability) => {
    if (probability > 0.6) return '#ef4444'; 
    if (probability > 0.3) return '#f59e0b'; 
    return '#22c55e'; 
  };

  const handleChange = (e) => setPersonalInfo({ ...personalInfo, [e.target.name]: e.target.value });

  return (
    <div style={{ maxWidth: '900px', margin: '0 auto', fontFamily: 'system-ui' }}>
      <button onClick={onReset} style={{ marginBottom: '30px', padding: '10px 20px', cursor: 'pointer', borderRadius: '6px', border: '1px solid #cbd5e1', backgroundColor: 'white' }}>
        ← Update Health Profile
      </button>

      <h2 style={{ fontSize: '28px', color: '#0f172a', marginBottom: '20px' }}>📊 Your Comprehensive Risk Analysis</h2>
      
      {/* 2x2 Risk Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px', marginBottom: '40px' }}>
        {Object.entries(risks).map(([condition, prob]) => (
          <div key={condition} style={{ padding: '25px', backgroundColor: '#f8fafc', borderRadius: '12px', borderTop: `6px solid ${getRiskColor(prob)}`, boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}>
            <h3 style={{ textTransform: 'capitalize', margin: '0 0 10px 0', color: '#334155' }}>{condition.replace('_', ' ')}</h3>
            <p style={{ fontSize: '32px', fontWeight: 'bold', margin: 0, color: getRiskColor(prob) }}>{(prob * 100).toFixed(1)}%</p>
          </div>
        ))}
      </div>

      {/* SHAP XAI */}
      {xai && (
        <div style={{ backgroundColor: '#eff6ff', padding: '30px', borderRadius: '12px', border: '1px solid #bfdbfe', marginBottom: '40px' }}>
          <h3 style={{ color: '#1e3a8a', marginTop: 0 }}>🧠 Inside the AI: Risk Drivers</h3>
          <ul style={{ listStyleType: 'none', padding: 0, margin: 0 }}>
            {xai.top_risk_drivers.map((driver, index) => (
              <li key={index} style={{ padding: '15px', backgroundColor: 'white', marginBottom: '10px', borderRadius: '8px', borderLeft: '5px solid #ef4444', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span><strong>{driver.feature}</strong> is negatively impacting your metabolic risk.</span>
                <span style={{ color: '#ef4444', fontWeight: 'bold' }}>Impact: +{driver.impact}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* NEW: UPSALE FORM FOR PHASE 3 RECOMMENDATIONS */}
      <div style={{ backgroundColor: 'white', padding: '30px', borderRadius: '12px', border: '2px solid #e2e8f0', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}>
        <h2 style={{ color: '#0f172a', marginTop: 0 }}>🥗 Unlock Your Personalized Plan</h2>
        <p style={{ color: '#64748b', marginBottom: '25px' }}>To generate a hyper-personalized meal and workout plan based on your AI risk profile, fill in these optional details below.</p>
        
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '20px', marginBottom: '25px' }}>
          <label style={labelStyle}>Daily Water Intake (Liters) <input type="number" step="any" name="waterIntake" onChange={handleChange} style={inputStyle} /></label>
          <label style={labelStyle}>Average Sleep (Hours) <input type="number" name="sleepHours" onChange={handleChange} style={inputStyle} /></label>
          <label style={labelStyle}>Cooking Ability 
            <select name="cookingAbility" onChange={handleChange} style={inputStyle}>
              <option value="">Select...</option><option value="Beginner">Beginner (Microwave/Simple)</option><option value="Intermediate">Intermediate (Can follow recipes)</option><option value="Advanced">Advanced (Chef mode)</option>
            </select>
          </label>
          <label style={labelStyle}>Grocery Budget 
            <select name="budget" onChange={handleChange} style={inputStyle}>
              <option value="">Select...</option><option value="Low">Strict Budget</option><option value="Medium">Moderate</option><option value="High">No Constraints</option>
            </select>
          </label>
          <label style={{...labelStyle, gridColumn: '1 / -1'}}>Food Allergies / Intolerances (e.g., Gluten, Dairy) <input type="text" name="allergies" onChange={handleChange} style={inputStyle} placeholder="Leave blank if none" /></label>
          <label style={labelStyle}>Favorite Foods <input type="text" name="favoriteFoods" onChange={handleChange} style={inputStyle} placeholder="e.g., Chicken, Pasta, Apples" /></label>
          <label style={labelStyle}>Disliked Foods <input type="text" name="dislikedFoods" onChange={handleChange} style={inputStyle} placeholder="e.g., Broccoli, Fish" /></label>
        </div>

        <button 
          onClick={() => onGeneratePlan(personalInfo)}
          style={{ width: '100%', padding: '20px', backgroundColor: '#10b981', color: 'white', border: 'none', borderRadius: '12px', fontSize: '18px', fontWeight: 'bold', cursor: 'pointer' }}
        >
          ✨ Generate My Meal & Workout Plan
        </button>
      </div>
    </div>
  );
}

const labelStyle = { display: 'flex', flexDirection: 'column', fontSize: '14px', fontWeight: '600', color: '#334155', gap: '8px' };
const inputStyle = { padding: '12px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '16px', backgroundColor: '#f8fafc' };