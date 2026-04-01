import React, { useState } from 'react';

// Risk tile configuration (3-3-1 layout order)
const ROW1 = [
  { key: 'diabetes_risk_level',        scoreKey: 'diabetes_risk_score',        label: 'Diabetes',           desc: 'Type 2 Diabetes risk' },
  { key: 'heart_disease_risk_level',   scoreKey: 'heart_disease_risk_score',   label: 'Heart Disease',      desc: 'Cardiovascular risk' },
  { key: 'hypertension_risk_level',    scoreKey: 'hypertension_risk_score',    label: 'Hypertension',       desc: 'Blood pressure risk' },
];
const ROW2 = [
  { key: 'obesity_risk_level',         scoreKey: 'obesity_risk_score',         label: 'Obesity',           icon: '', modalIcon: '', desc: 'Weight health risk' },
  { key: 'respiratory_risk_level',     scoreKey: 'respiratory_risk_score',     label: 'Respiratory',       icon: '', modalIcon: '', desc: 'Lung & breathing risk' },
  { key: 'mental_health_risk_level',   scoreKey: 'mental_health_risk_score',   label: 'Mental Health',     icon: '', modalIcon: '', desc: 'Anxiety & depression risk' },
];
const ROW3 = [
  { key: 'general_physical_health_level', scoreKey: 'general_physical_health_score', label: 'Overall Wellness', icon: '', modalIcon: '', desc: 'General physical health score', inverted: true },
];
const ALL_TILES = [...ROW1, ...ROW2, ...ROW3];

// Which form existing-condition fields map to which tile keys
const EXISTING_MAP = {
  diabetes_risk_level:      'has_diabetes',
  heart_disease_risk_level: 'has_heart_disease',
  hypertension_risk_level:  'has_hypertension',
};

// Human readable feature labels
const FEATURE_LABELS = {
  bmi: 'BMI', bmi_risk_cat: 'BMI Category', age: 'Age', age_decade: 'Age Group',
  exercise_level: 'Exercise Level', avg_sleep_hours: 'Sleep Hours',
  sleep_deviation: 'Sleep Quality', stress_level: 'Stress Level',
  work_stress: 'Work Stress', stress_anxiety_composite: 'Stress & Anxiety',
  alcohol_consumption: 'Alcohol Use', smoking_status: 'Smoking',
  screen_time_hours: 'Screen Time', sedentary_screen_index: 'Sedentary Index',
  water_intake_liters: 'Water Intake', eat_processed_food: 'Processed Food',
  eat_fruits_daily: 'Fruit Intake', eat_veggies_daily: 'Veggie Intake',
  healthy_diet_score: 'Diet Quality', meal_frequency: 'Meal Frequency',
  anxiety_level: 'Anxiety Level', fatigue_level: 'Fatigue Level',
  diabetes_symptom_count: 'Diabetes Symptoms', family_history_load: 'Family History',
  family_history_diabetes: 'Family Hx: Diabetes',
  family_history_heart_disease: 'Family Hx: Heart',
  family_history_hypertension: 'Family Hx: Hypertension',
  family_history_obesity: 'Family Hx: Obesity', family_history_pcos: 'Family Hx: PCOS',
  is_female_reproductive: 'Reproductive Age (F)', bmi_age_interaction: 'Age x BMI',
  has_asthma: 'Asthma', has_thyroid: 'Thyroid Condition', has_allergies: 'Allergies',
  gender_Male: 'Gender (Male)', gender_Other: 'Gender (Other)',
  shortness_of_breath: 'Shortness of Breath', frequent_headaches: 'Frequent Headaches',
  digestive_issues: 'Digestive Issues', difficulty_falling_asleep: 'Sleep Difficulty',
  perceived_appetite: 'Appetite Level', frequent_urination: 'Frequent Urination',
  slow_wound_healing: 'Slow Wound Healing', numbness_tingling: 'Numbness/Tingling',
  social_interaction_level: 'Social Interaction', sun_exposure: 'Sun Exposure',
  menstrual_regularity: 'Menstrual Regularity', metabolism_type: 'Metabolism Type',
};

function getLabel(feature) {
  if (FEATURE_LABELS[feature]) return FEATURE_LABELS[feature];
  if (feature.startsWith('diet_type_'))         return 'Diet: ' + feature.replace('diet_type_', '').replace(/_/g, ' ');
  if (feature.startsWith('employment_status_')) return 'Employment: ' + feature.replace('employment_status_', '');
  if (feature.startsWith('work_type_'))         return 'Work: ' + feature.replace('work_type_', '').replace(/_/g, ' ');
  return feature.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

// Colour helpers 
function levelColor(level, inverted) {
  if (inverted) {
    if (level === 'Excellent' || level === 'Good') return '#22c55e';
    if (level === 'Fair') return '#f59e0b';
    return '#ef4444';
  }
  if (level === 'Low')    return '#22c55e';
  if (level === 'Medium') return '#f59e0b';
  return '#ef4444';
}

function levelBg(level, inverted) {
  if (inverted) {
    if (level === 'Excellent' || level === 'Good') return '#f0fdf4';
    if (level === 'Fair') return '#fefce8';
    return '#fef2f2';
  }
  if (level === 'Low')    return '#f0fdf4';
  if (level === 'Medium') return '#fefce8';
  return '#fef2f2';
}

// Small half circle gauge (used inside tile)
function MiniGauge({ score, color, size }) {
  const sz   = size || 110;
  const pct  = Math.min(100, Math.round(score || 0));
  const r    = 40;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 100 58" style={{ width: sz, height: sz * 0.55, display: 'block', margin: '0 auto' }}>
      <path d="M 8 54 A 40 40 0 0 1 92 54" fill="none" stroke="#e2e8f0" strokeWidth="9" strokeLinecap="round" />
      <path d="M 8 54 A 40 40 0 0 1 92 54" fill="none" stroke={color} strokeWidth="9" strokeLinecap="round"
            strokeDasharray={dash + ' ' + circ} />
      <text x="50" y="46" textAnchor="middle" fontSize="15" fontWeight="800" fill={color}>{pct}</text>
    </svg>
  );
}

// Large half circle gauge (used in modal)
function LargeGauge({ score, color, icon }) {
  const pct  = Math.min(100, Math.round(score || 0));
  const r    = 70;
  const circ = Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <svg viewBox="0 0 170 100" style={{ width: '200px', height: '120px', display: 'block', margin: '0 auto' }}>
      <path d="M 14 96 A 70 70 0 0 1 156 96" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="14" strokeLinecap="round" />
      <path d="M 14 96 A 70 70 0 0 1 156 96" fill="none" stroke={color} strokeWidth="14" strokeLinecap="round"
            strokeDasharray={dash + ' ' + circ} />
      <text x="85" y="68" textAnchor="middle" fontSize="13" fill="rgba(255,255,255,0.5)">{icon}</text>
      <text x="85" y="86" textAnchor="middle" fontSize="26" fontWeight="900" fill={color}>{pct}</text>
    </svg>
  );
}

// xAI SVG bar chart
function XAIBarChart({ factors }) {
  if (!factors || factors.length === 0) {
    return (
      <p style={{ color: '#64748b', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>
        No significant factors found for this risk area.
      </p>
    );
  }

  var W = 520, LABEL_W = 148, CHART_W = W - LABEL_W - 42;
  var ROW_H = 38, BAR_H = 20, TOP_PAD = 8, AXIS_H = 44;
  var N = factors.length;
  var SVG_H = TOP_PAD + N * ROW_H + AXIS_H;

  var rawMax = factors[0].impact_points;
  var axisMax = rawMax <= 5 ? 5 : rawMax <= 10 ? 10 : rawMax <= 20 ? 20 : rawMax <= 30 ? 30 : rawMax <= 40 ? 40 : Math.ceil(rawMax / 10) * 10;
  var allTicks = [0, 2, 4, 6, 8, 10, 15, 20, 25, 30, 40, 50];
  var ticks = allTicks.filter(function(t) { return t <= axisMax && (axisMax <= 10 ? t % 2 === 0 : t % 5 === 0); });
  if (ticks.indexOf(axisMax) === -1) ticks.push(axisMax);

  var toX = function(pts) { return LABEL_W + (pts / axisMax) * CHART_W; };
  var axisY = TOP_PAD + N * ROW_H + 6;

  return (
    <svg viewBox={'0 0 ' + W + ' ' + SVG_H} style={{ width: '100%', maxWidth: W + 'px', display: 'block', overflow: 'visible' }}>
      {ticks.slice(1).map(function(t) {
        return (
          <line key={t} x1={toX(t)} y1={TOP_PAD} x2={toX(t)} y2={axisY}
                stroke="rgba(255,255,255,0.05)" strokeWidth="1" />
        );
      })}

      {factors.map(function(f, i) {
        var rowY  = TOP_PAD + i * ROW_H;
        var barY  = rowY + (ROW_H - BAR_H) / 2;
        var barW  = Math.max(2, (f.impact_points / axisMax) * CHART_W);
        var color = f.is_modifiable ? '#f87171' : '#6b7280';
        var lbl   = getLabel(f.feature);
        return (
          <g key={f.feature}>
            <rect x={0} y={rowY} width={W} height={ROW_H} fill="rgba(255,255,255,0.02)" rx="4" />
            <text x={LABEL_W - 10} y={rowY + ROW_H / 2 + 1} textAnchor="end"
                  fill={f.is_modifiable ? '#f1f5f9' : '#94a3b8'} fontSize="12.5" dominantBaseline="middle">
              {lbl.length > 18 ? lbl.slice(0, 17) + '...' : lbl}
            </text>
            <line x1={LABEL_W} y1={barY - 2} x2={LABEL_W} y2={barY + BAR_H + 2}
                  stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
            <rect x={LABEL_W} y={barY} width={barW} height={BAR_H} fill={color} rx="3" opacity="0.9" />
            <text x={LABEL_W + barW + 6} y={rowY + ROW_H / 2 + 1}
                  fill={color} fontSize="11.5" fontWeight="700" dominantBaseline="middle">
              +{f.impact_points.toFixed(1)}
            </text>
          </g>
        );
      })}

      <line x1={LABEL_W} y1={axisY} x2={LABEL_W + CHART_W} y2={axisY}
            stroke="rgba(255,255,255,0.2)" strokeWidth="1" />
      <line x1={LABEL_W} y1={axisY} x2={LABEL_W} y2={axisY + 5}
            stroke="rgba(255,255,255,0.3)" strokeWidth="1" />

      {ticks.map(function(t) {
        return (
          <g key={t}>
            <line x1={toX(t)} y1={axisY} x2={toX(t)} y2={axisY + 5}
                  stroke="rgba(255,255,255,0.25)" strokeWidth="1" />
            <text x={toX(t)} y={axisY + 16} textAnchor="middle"
                  fill="rgba(255,255,255,0.45)" fontSize="11">
              {t}
            </text>
          </g>
        );
      })}

      <text x={LABEL_W + CHART_W / 2} y={SVG_H - 4} textAnchor="middle"
            fill="rgba(255,255,255,0.35)" fontSize="10.5" fontStyle="italic">
        Impact on Risk Score (Points) — Lower is Better, Higher is Worse
      </text>
    </svg>
  );
}

// xAI Modal
function XAIModal({ tile, score, level, factors, existingCondition, onClose }) {
  var color    = existingCondition ? '#f97316' : levelColor(level, tile.inverted);
  var modFacs  = (factors || []).filter(function(f) { return  f.is_modifiable; });
  var nonFacs  = (factors || []).filter(function(f) { return !f.is_modifiable; });
  var modCount = modFacs.length;
  var nonCount = nonFacs.length;
  var topMod   = modFacs.slice(0, 3).map(function(f) { return getLabel(f.feature); });
  var topNon   = nonFacs.slice(0, 2).map(function(f) { return getLabel(f.feature); });

  var summaryText = '';
  if (existingCondition) {
    summaryText = 'Since you already have ' + tile.label + ', these factors are currently making it harder to manage your condition.' + (topMod.length > 0 ? ' Focus on improving ' + topMod.join(', ') + ' to help keep it under control.' : '');
  } else if (!level) {
    summaryText = 'No prediction available.';
  } else if (level === 'Low' || level === 'Excellent' || level === 'Good') {
    summaryText = 'Your ' + tile.label.toLowerCase() + ' is well-managed.' + (topMod.length > 0 ? ' The main contributors are ' + topMod.join(' and ') + '. ' : ' ') + 'Maintaining your current habits keeps this risk low.';
  } else if (level === 'Medium' || level === 'Fair') {
    summaryText = 'Moderate ' + tile.label.toLowerCase() + ' risk detected. Your biggest leverage points are ' + topMod.join(', ') + (topNon.length ? ' — while ' + topNon.join(' and ') + ' are non-modifiable factors also at play' : '') + '. Small consistent improvements can meaningfully shift your score.';
  } else {
    summaryText = 'High ' + tile.label.toLowerCase() + ' risk flagged. Prioritise ' + topMod.join(', ') + ' — these are within your control.' + (topNon.length ? ' Note that ' + topNon.join(' and ') + ' are non-modifiable but important context.' : '') + ' A healthcare provider review is recommended.';
  }

  return (
    <div
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, padding: '20px', backdropFilter: 'blur(4px)' }}
      onClick={function(e) { if (e.target === e.currentTarget) onClose(); }}
    >
      <div style={{ background: '#12122a', borderRadius: '20px', padding: '28px', maxWidth: '600px', width: '100%', maxHeight: '92vh', overflowY: 'auto', position: 'relative', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', border: '1px solid rgba(255,255,255,0.07)' }}>

        <button onClick={onClose} style={{ position: 'absolute', top: '16px', right: '18px', background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '8px', color: 'rgba(255,255,255,0.6)', cursor: 'pointer', fontSize: '16px', width: '32px', height: '32px' }}>
          x
        </button>

        <div style={{ textAlign: 'center', paddingBottom: '20px', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
          {existingCondition ? (
            <div style={{ padding: '20px 0' }}>
              <span style={{ fontSize: '52px', display: 'block', marginBottom: '8px' }}>{tile.modalIcon}</span>
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', background: '#f97316', padding: '8px 20px', borderRadius: '999px' }}>
                <span style={{ fontSize: '14px', fontWeight: 800, color: 'white' }}>Already Diagnosed</span>
              </div>
            </div>
          ) : (
            <LargeGauge score={score} color={color} icon={tile.modalIcon} />
          )}
          <p style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px', fontWeight: 700, letterSpacing: '2px', margin: '4px 0 0', textTransform: 'uppercase' }}>
            {tile.label} Risk Score
          </p>
          {!existingCondition && level && (
            <span style={{ display: 'inline-block', marginTop: '8px', padding: '4px 14px', borderRadius: '999px', fontSize: '12px', fontWeight: 700, color: color, background: color + '22', border: '1px solid ' + color + '44' }}>
              {level}
            </span>
          )}
        </div>

        <div style={{ padding: '20px 0 8px' }}>
          <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#f1f5f9' }}>
            {existingCondition ? 'Factors contributing to your condition difficulty' : 'Explainability Breakdown: Individual Factor Impact'}
          </p>
          <p style={{ margin: '0 0 18px', fontSize: '12px', color: 'rgba(255,255,255,0.4)' }}>
            <span style={{ color: '#f87171', fontWeight: 600 }}>Modifiable</span>
            {' '}
            <span style={{ color: '#6b7280', fontWeight: 600 }}>Non-modifiable</span>
            {' · Bars show points contributed to your risk score'}
          </p>
          <XAIBarChart factors={factors} />
        </div>

        {summaryText && (
          <div style={{ marginTop: '16px', padding: '14px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: '10px', border: '1px solid rgba(255,255,255,0.08)' }}>
            <p style={{ margin: 0, fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.65 }}>
              {summaryText}
            </p>
          </div>
        )}

        {modCount > 0 && (
          <div style={{ marginTop: '12px', display: 'flex', gap: '12px', fontSize: '12px', color: 'rgba(255,255,255,0.35)', flexWrap: 'wrap' }}>
            <span>{modCount} factors you can change</span>
            {nonCount > 0 && <span>{nonCount} non-modifiable factors</span>}
          </div>
        )}
      </div>
    </div>
  );
}

// Risk Tile 
function RiskTile({ tile, score, level, onClick, existingCondition, wide }) {
  var isWide = wide || false;
  var [hovered, setHovered] = useState(false);
  var color = existingCondition ? '#f97316' : levelColor(level, tile.inverted);
  var bg    = existingCondition ? '#fff7ed' : levelBg(level, tile.inverted);

  return (
    <div
      style={{
        padding: '16px 14px 14px',
        borderRadius: '14px',
        borderTop: '4px solid ' + color,
        background: bg,
        boxShadow: hovered ? '0 8px 24px ' + color + '30, 0 2px 8px rgba(0,0,0,0.1)' : '0 2px 8px rgba(0,0,0,0.07)',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s, transform 0.15s',
        transform: hovered ? 'translateY(-2px)' : 'translateY(0)',
        display: 'flex',
        flexDirection: isWide ? 'row' : 'column',
        alignItems: isWide ? 'center' : 'stretch',
        gap: isWide ? '24px' : '4px',
        position: 'relative',
      }}
      onClick={onClick}
      onMouseEnter={function() { setHovered(true); }}
      onMouseLeave={function() { setHovered(false); }}
      title="Click to see contributing factors"
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: isWide ? 0 : undefined }}>
        <span style={{ fontSize: isWide ? '28px' : '22px' }}>{tile.icon}</span>
        {existingCondition ? (
          <span style={{ fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', background: '#f97316', color: 'white' }}>
            Diagnosed
          </span>
        ) : (
          <span style={{ fontSize: '11px', fontWeight: 700, padding: '3px 9px', borderRadius: '999px', color: color, background: color + '22', border: '1px solid ' + color + '55' }}>
            {level}
          </span>
        )}
      </div>

      {existingCondition ? (
        <div style={{ textAlign: 'center', padding: '10px 0', flex: isWide ? 1 : undefined }}>
          <p style={{ margin: '0 0 4px', fontSize: '13px', color: '#92400e', fontWeight: 600 }}>You have this condition</p>
          <p style={{ margin: 0, fontSize: '11px', color: '#b45309' }}>Tap to see contributing factors</p>
        </div>
      ) : (
        <div style={{ flex: isWide ? 1 : undefined }}>
          <MiniGauge score={score} color={color} size={isWide ? 140 : 110} />
        </div>
      )}

      <div style={{ flex: isWide ? 2 : undefined }}>
        <p style={{ fontSize: isWide ? '17px' : '14px', fontWeight: 700, color: '#0f172a', margin: '0 0 2px' }}>{tile.label}</p>
        <p style={{ fontSize: '11px', color: '#64748b', margin: 0 }}>{tile.desc}</p>
      </div>

      <div style={{ position: 'absolute', bottom: '10px', right: '12px', fontSize: '10px', color: color + 'aa', fontWeight: 600, opacity: hovered ? 1 : 0.5, transition: 'opacity 0.2s' }}>
        View details
      </div>
    </div>
  );
}

// Beautiful Summary Banner
function SummaryBanner({ highCount, medCount, wellnessLvl }) {
  var allGood = highCount === 0 && medCount === 0;
  var hasHigh = highCount > 0;

  var gradient = hasHigh
    ? 'linear-gradient(135deg, #450a0a 0%, #7f1d1d 50%, #450a0a 100%)'
    : medCount > 0
    ? 'linear-gradient(135deg, #451a03 0%, #78350f 50%, #451a03 100%)'
    : 'linear-gradient(135deg, #052e16 0%, #14532d 50%, #052e16 100%)';

  var accent      = hasHigh ? '#fca5a5' : medCount > 0 ? '#fde68a' : '#86efac';
  var accentSolid = hasHigh ? '#ef4444' : medCount > 0 ? '#f59e0b' : '#22c55e';
  var icon        = hasHigh ? 'Warning' : medCount > 0 ? 'Caution' : 'All Clear';
  var headline    = allGood
    ? 'All risks are within a healthy range'
    : hasHigh
    ? highCount + ' High-Risk area' + (highCount > 1 ? 's' : '') + ' detected'
    : medCount + ' area' + (medCount > 1 ? 's' : '') + ' need attention';

  return (
    <div style={{ background: gradient, borderRadius: '18px', padding: '22px 28px', marginBottom: '32px', border: '1px solid ' + accent + '18', boxShadow: '0 0 50px ' + accentSolid + '18', position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', right: '-20px', top: '-20px', width: '130px', height: '130px', borderRadius: '50%', background: accent + '0a', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', right: '60px', bottom: '-30px', width: '80px', height: '80px', borderRadius: '50%', background: accent + '07', pointerEvents: 'none' }} />

      <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap', position: 'relative' }}>
        <div style={{ width: '54px', height: '54px', borderRadius: '16px', background: accent + '1a', border: '1px solid ' + accent + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', flexShrink: 0 }}>
          {hasHigh ? '⚠️' : medCount > 0 ? '🟡' : '✅'}
        </div>
        <div style={{ flex: 1, minWidth: '180px' }}>
          <p style={{ color: accent, fontSize: '19px', fontWeight: 800, margin: '0 0 5px', letterSpacing: '-0.3px' }}>
            {headline}
          </p>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', margin: 0 }}>
            Overall Wellness: <span style={{ color: accent, fontWeight: 600 }}>{wellnessLvl}</span>
            {!allGood && (' · ' + (highCount + medCount) + ' area' + (highCount + medCount > 1 ? 's' : '') + ' to work on')}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexShrink: 0, flexWrap: 'wrap' }}>
          {highCount > 0 && <span style={{ background: '#ef4444', color: 'white', padding: '5px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>{highCount} High</span>}
          {medCount > 0 && <span style={{ background: '#f59e0b', color: 'white', padding: '5px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>{medCount} Medium</span>}
          {allGood      && <span style={{ background: '#22c55e', color: 'white', padding: '5px 13px', borderRadius: '999px', fontSize: '12px', fontWeight: 700 }}>All Clear</span>}
        </div>
      </div>
    </div>
  );
}

// Priority concern messages
var CONCERN_MSGS = {
  diabetes_risk_level:      { High: 'Multiple diabetes risk factors detected. A fasting glucose and HbA1c test with your GP is recommended.', Medium: 'Moderate diabetes risk. Reducing processed food and increasing activity can significantly lower this.' },
  heart_disease_risk_level: { High: 'High cardiovascular risk. A medical review of BP, cholesterol and ECG is recommended.', Medium: 'Moderate CVD risk. Focus on stress reduction, quitting smoking if applicable, and a heart-healthy diet.' },
  hypertension_risk_level:  { High: 'Elevated hypertension risk. Reducing salt intake, managing stress and limiting alcohol can have immediate impact.', Medium: 'Moderate hypertension risk. Weight management and aerobic exercise are the most effective interventions.' },
  obesity_risk_level:       { High: 'High obesity risk. A calorie-deficit plan with strength training and dietitian support is recommended.', Medium: 'Moderate obesity risk. Small consistent changes to diet and activity can prevent progression.' },
  mental_health_risk_level: { High: 'Significant mental health risk detected. Speaking to a mental health professional is strongly encouraged.', Medium: 'Moderate mental health burden. Social connection, sleep improvement and stress management are high-leverage.' },
  respiratory_risk_level:   { High: 'High respiratory risk. Smoking cessation is the single most impactful intervention available.', Medium: 'Moderate respiratory risk. Avoiding smoke and allergens and staying active helps lung capacity.' },
};

// Main Dashboard component
export default function Dashboard({ predictions, featureImportances, existingConditions, onReset, onGeneratePlan }) {
  var [activeTileKey, setActiveTileKey] = useState(null);

  if (!predictions) return null;

  var wellnessLvl = predictions['general_physical_health_level'];
  var concerns    = [...ROW1, ...ROW2].map(function(r) { return Object.assign({}, r, { level: predictions[r.key] }); });
  var highCount   = concerns.filter(function(c) { return c.level === 'High'; }).length;
  var medCount    = concerns.filter(function(c) { return c.level === 'Medium'; }).length;

  var activeTile     = ALL_TILES.find(function(t) { return t.key === activeTileKey; }) || null;
  var activeFactors  = activeTileKey ? (featureImportances && featureImportances[activeTileKey] ? featureImportances[activeTileKey] : []) : [];
  var activeScore    = activeTileKey && activeTile ? (predictions[activeTile.scoreKey] || 0) : 0;
  var activeLevel    = activeTileKey ? predictions[activeTileKey] : null;
  var activeExisting = activeTileKey
    ? (existingConditions && EXISTING_MAP[activeTileKey] && existingConditions[EXISTING_MAP[activeTileKey]] === 'Yes')
    : false;

  function isExisting(tileKey) {
    return !!(existingConditions && EXISTING_MAP[tileKey] && existingConditions[EXISTING_MAP[tileKey]] === 'Yes');
  }

  function renderTile(tile, wide) {
    return (
      <RiskTile
        key={tile.key}
        tile={tile}
        score={predictions[tile.scoreKey]}
        level={predictions[tile.key]}
        existingCondition={isExisting(tile.key)}
        wide={wide || false}
        onClick={function() { setActiveTileKey(tile.key); }}
      />
    );
  }

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto' }}>

      <SummaryBanner highCount={highCount} medCount={medCount} wellnessLvl={wellnessLvl} />

      <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 6px' }}>
        Your 7-Dimensional Risk Profile
      </h2>
      <p style={{ fontSize: '12px', color: '#94a3b8', margin: '0 0 16px' }}>
        Click any tile to see which factors are driving that risk
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
        {ROW1.map(function(t) { return renderTile(t, false); })}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', marginBottom: '14px' }}>
        {ROW2.map(function(t) { return renderTile(t, false); })}
      </div>

      <div style={{ marginBottom: '32px' }}>
        {ROW3.map(function(t) { return renderTile(t, true); })}
      </div>

      {(highCount > 0 || medCount > 0) && (
        <div style={{ marginBottom: '32px' }}>
          <h2 style={{ fontSize: '19px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' }}>Priority Health Concerns</h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {concerns.filter(function(c) { return c.level === 'High' || c.level === 'Medium'; }).map(function(c) {
              var color = levelColor(c.level, false);
              var bg    = levelBg(c.level, false);
              var msg   = CONCERN_MSGS[c.key] && CONCERN_MSGS[c.key][c.level] ? CONCERN_MSGS[c.key][c.level] : '';
              return (
                <div key={c.key} style={{ background: bg, border: '1px solid ' + color + '44', borderLeft: '4px solid ' + color, borderRadius: '10px', padding: '14px 18px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                  <span style={{ fontSize: '22px', flexShrink: 0 }}>{c.icon}</span>
                  <div style={{ flex: 1 }}>
                    <p style={{ margin: '0 0 4px', fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{c.label}</p>
                    <p style={{ margin: 0, fontSize: '13px', color: '#475569', lineHeight: 1.5 }}>{msg}</p>
                  </div>
                  <span style={{ color: color, fontWeight: 700, background: color + '18', padding: '3px 10px', borderRadius: '999px', fontSize: '12px', border: '1px solid ' + color + '44', flexShrink: 0 }}>{c.level}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div style={{ background: 'linear-gradient(135deg, #f0fdf4 0%, #eff6ff 100%)', border: '2px solid #a7f3d0', borderRadius: '16px', padding: '28px 32px', marginBottom: '28px', display: 'flex', alignItems: 'center', gap: '28px', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: '220px' }}>
          <p style={{ fontSize: '18px', fontWeight: 800, color: '#0f172a', margin: '0 0 8px' }}>Ready to take action on your results?</p>
          <p style={{ fontSize: '14px', color: '#475569', margin: 0, lineHeight: 1.6 }}>
            Answer a few quick questions about your goals, diet preferences, and fitness level to get a personalised meal and workout plan.
          </p>
        </div>
        <button onClick={onGeneratePlan} style={{ flexShrink: 0, padding: '16px 26px', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.35)', whiteSpace: 'nowrap' }}>
          Generate My Plan
        </button>
      </div>

      <div style={{ marginBottom: '16px' }}>
        <button onClick={onReset} style={{ padding: '11px 20px', background: 'white', color: '#64748b', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
          New Assessment
        </button>
      </div>

      <p style={{ fontSize: '12px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: '40px' }}>
        This AI analysis is for informational purposes only and does not constitute medical advice, diagnosis, or treatment. Always consult a qualified healthcare provider.
      </p>

      {activeTile && (
        <XAIModal
          tile={activeTile}
          score={activeScore}
          level={activeLevel}
          factors={activeFactors}
          existingCondition={activeExisting}
          onClose={function() { setActiveTileKey(null); }}
        />
      )}
    </div>
  );
}
