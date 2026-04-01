import React, { useState } from 'react';

// Macro progress bar
function MacroBar({ label, grams, calories, color, icon }) {
  return (
    <div style={mb.wrap}>
      <div style={mb.header}>
        <span style={mb.icon}>{icon}</span>
        <span style={mb.label}>{label}</span>
        <span style={mb.val}>{grams}g</span>
        <span style={mb.kcal}>{calories} kcal</span>
      </div>
      <div style={mb.track}>
        <div style={{ ...mb.fill, width: `${Math.min(100, (grams / 350) * 100)}%`, background: color }} />
      </div>
    </div>
  );
}
const mb = {
  wrap:   { marginBottom: '14px' },
  header: { display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' },
  icon:   { fontSize: '18px' },
  label:  { fontSize: '14px', fontWeight: 600, color: '#334155', flex: 1 },
  val:    { fontSize: '16px', fontWeight: 700, color: '#0f172a' },
  kcal:   { fontSize: '12px', color: '#64748b', width: '56px', textAlign: 'right' },
  track:  { height: '8px', background: '#f1f5f9', borderRadius: '999px', overflow: 'hidden' },
  fill:   { height: '100%', borderRadius: '999px', transition: 'width 0.8s ease' },
};

// Category icon map 
const CAT_ICONS = {
  nutrition:   '🥗',
  exercise:    '🏃',
  sleep:       '😴',
  hydration:   '💧',
  mental:      '🧘',
  monitoring:  '🩺',
  lifestyle:   '⭐',
};
const PRIORITY_COLORS = {
  high:   { bg: '#fef2f2', border: '#fecaca', text: '#dc2626', badge: 'HIGH' },
  medium: { bg: '#fffbeb', border: '#fde68a', text: '#d97706', badge: 'MEDIUM' },
  low:    { bg: '#f0fdf4', border: '#bbf7d0', text: '#16a34a', badge: 'LOW' },
};

// Recommendation card
function RecCard({ rec, index }) {
  const [open, setOpen] = useState(index < 3); // first 3 open by default
  const pc = PRIORITY_COLORS[rec.priority] || PRIORITY_COLORS.low;
  return (
    <div style={{ ...rc.card, background: open ? pc.bg : 'white', borderColor: open ? pc.border : '#e2e8f0' }}>
      <div style={rc.header} onClick={() => setOpen(!open)}>
        <span style={rc.catIcon}>{CAT_ICONS[rec.category] || '💡'}</span>
        <div style={{ flex: 1 }}>
          <span style={rc.title}>{rec.title}</span>
          {rec.target_value && (
            <span style={rc.target}> → {rec.target_value} {rec.target_unit}</span>
          )}
        </div>
        <span style={{ ...rc.badge, color: pc.text, background: pc.border }}>
          {pc.badge}
        </span>
        <span style={rc.chevron}>{open ? '▲' : '▼'}</span>
      </div>
      {open && (
        <div style={rc.body}>
          <p style={rc.detail}>{rec.detail}</p>
          {rec.rationale && (
            <p style={rc.rationale}>📚 {rec.rationale}</p>
          )}
        </div>
      )}
    </div>
  );
}
const rc = {
  card:    { border: '1px solid #e2e8f0', borderRadius: '10px', marginBottom: '10px', overflow: 'hidden', transition: 'all 0.2s' },
  header:  { display: 'flex', alignItems: 'center', gap: '12px', padding: '14px 18px', cursor: 'pointer' },
  catIcon: { fontSize: '20px', flexShrink: 0 },
  title:   { fontSize: '14px', fontWeight: 600, color: '#0f172a' },
  target:  { fontSize: '13px', color: '#2563eb', fontWeight: 500 },
  badge:   { fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '999px', letterSpacing: '0.5px', flexShrink: 0 },
  chevron: { fontSize: '10px', color: '#94a3b8', flexShrink: 0 },
  body:    { padding: '0 18px 16px 50px' },
  detail:  { fontSize: '14px', color: '#334155', margin: '0 0 8px', lineHeight: 1.6 },
  rationale:{ fontSize: '12px', color: '#64748b', margin: 0, fontStyle: 'italic', lineHeight: 1.5 },
};

// Target summary chip
function TargetChip({ icon, label, value }) {
  return (
    <div style={tc.chip}>
      <span style={tc.icon}>{icon}</span>
      <div>
        <p style={tc.val}>{value}</p>
        <p style={tc.lab}>{label}</p>
      </div>
    </div>
  );
}
const tc = {
  chip:  { display: 'flex', alignItems: 'center', gap: '12px', background: 'white', borderRadius: '12px', padding: '14px 18px', boxShadow: '0 2px 8px rgba(0,0,0,0.06)', flex: '1', minWidth: '150px' },
  icon:  { fontSize: '26px' },
  val:   { fontSize: '20px', fontWeight: 800, color: '#0f172a', margin: '0 0 2px' },
  lab:   { fontSize: '12px', color: '#64748b', margin: 0 },
};

// BMI meter
function BMIMeter({ bmi, category }) {
  const zones = [
    { label: 'Under', max: 18.5, color: '#3b82f6' },
    { label: 'Normal', max: 25,  color: '#22c55e' },
    { label: 'Over',   max: 30,  color: '#f59e0b' },
    { label: 'Obese',  max: 45,  color: '#ef4444' },
  ];
  const pct = Math.min(100, Math.max(0, ((bmi - 10) / 35) * 100));
  return (
    <div style={{ marginTop: '12px' }}>
      <div style={{ display: 'flex', height: '14px', borderRadius: '999px', overflow: 'hidden', gap: '2px' }}>
        {zones.map(z => (
          <div key={z.label} style={{ flex: 1, background: z.color, opacity: 0.25 }} />
        ))}
      </div>
      {/* Indicator */}
      <div style={{ position: 'relative', height: '20px', marginTop: '2px' }}>
        <div style={{ position: 'absolute', left: `${pct}%`, transform: 'translateX(-50%)' }}>
          <div style={{ width: '3px', height: '12px', background: '#0f172a', margin: '0 auto' }} />
          <span style={{ fontSize: '11px', fontWeight: 700, color: '#0f172a', whiteSpace: 'nowrap' }}>
            {bmi} — {category}
          </span>
        </div>
      </div>
    </div>
  );
}

// Main PlanView 
export default function PlanView({ plan, cluster, predictions, onReset }) {
  const [activeTab, setActiveTab] = useState('all');

  if (!plan) return null;
  const archetype   = cluster?.archetype || plan?.archetype || {};
  const recs        = plan.recommendations || [];
  const categories  = ['all', ...new Set(recs.map(r => r.category))];
  const filtered    = activeTab === 'all' ? recs : recs.filter(r => r.category === activeTab);
  const highRecs    = recs.filter(r => r.priority === 'high').length;

  return (
    <div style={pv.wrap}>

      {/* Coaching Message */}
      <div style={pv.coachBanner}>
        <span style={{ fontSize: '32px' }}>🤖</span>
        <p style={pv.coachMsg}>{plan.coaching_message}</p>
      </div>

      {/* Archetype Card */}
      <div style={{ ...pv.archetypeCard, borderColor: archetype.color || '#6366f1' }}>
        <span style={{ fontSize: '48px' }}>{archetype.icon || '👤'}</span>
        <div style={{ flex: 1 }}>
          <p style={pv.archetypeLabel}>Your Lifestyle Archetype</p>
          <h2 style={{ ...pv.archetypeName, color: archetype.color || '#6366f1' }}>
            {archetype.archetype_name || 'Unknown'}
          </h2>
          <p style={pv.archetypeDesc}>{archetype.description || ''}</p>
        </div>
        <div style={{ textAlign: 'center' }}>
          <p style={{ ...pv.riskBadge, background: archetype.color + '22' || '#f3f4f6',
                      color: archetype.color || '#6366f1', border: `1px solid ${archetype.color || '#6366f1'}` }}>
            {(archetype.risk_level || 'unknown').toUpperCase()} RISK
          </p>
          {cluster?.confidence && (
            <p style={pv.confText}>
              {Math.round(cluster.confidence * 100)}% match
            </p>
          )}
        </div>
      </div>

      {/* Key Targets */}
      <h2 style={pv.sectionTitle}>🎯 Daily Targets</h2>
      <div style={pv.chipRow}>
        <TargetChip icon="🔥" label="Daily Calories" value={`${plan.calorie_target?.toLocaleString()} kcal`} />
        <TargetChip icon="🏃" label="Exercise"        value={`${plan.exercise_days_per_week}d × ${plan.exercise_duration_minutes}min`} />
        <TargetChip icon="💧" label="Water"            value={`${plan.water_target_litres}L`} />
        <TargetChip icon="😴" label="Sleep"            value={`${plan.sleep_target_hours}h`} />
      </div>

      {/* Macros Card */}
      <div style={pv.card}>
        <h3 style={pv.cardTitle}>🥗 Macro Breakdown</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 40px' }}>
          <MacroBar label="Protein"      grams={plan.protein_g} calories={plan.protein_g * 4} color="#3b82f6"  icon="🥩" />
          <MacroBar label="Carbohydrates" grams={plan.carb_g}    calories={plan.carb_g    * 4} color="#22c55e"  icon="🌾" />
          <MacroBar label="Fats"         grams={plan.fat_g}      calories={plan.fat_g     * 9} color="#f59e0b"  icon="🫒" />
          <div style={mb.wrap}>
            <div style={mb.header}>
              <span style={mb.icon}>📊</span>
              <span style={{ ...mb.label, flex: 1 }}>Est. TDEE</span>
              <span style={mb.val}>{plan.tdee?.toLocaleString()}</span>
              <span style={mb.kcal}>kcal/day</span>
            </div>
          </div>
        </div>
        {/* Visual pie */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px', alignItems: 'center' }}>
          {[
            { label: 'Protein', pct: Math.round((plan.protein_g * 4 / plan.calorie_target) * 100), color: '#3b82f6' },
            { label: 'Carbs',   pct: Math.round((plan.carb_g    * 4 / plan.calorie_target) * 100), color: '#22c55e' },
            { label: 'Fats',    pct: Math.round((plan.fat_g     * 9 / plan.calorie_target) * 100), color: '#f59e0b' },
          ].map(m => (
            <React.Fragment key={m.label}>
              <div style={{ height: '10px', width: `${m.pct}%`, background: m.color, borderRadius: '3px' }} />
              <span style={{ fontSize: '11px', color: '#64748b', whiteSpace: 'nowrap' }}>{m.label} {m.pct}%</span>
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* BMI Meter */}
      <div style={pv.card}>
        <h3 style={pv.cardTitle}>⚖️ BMI Assessment</h3>
        <BMIMeter bmi={plan.bmi} category={plan.bmi_category} />
      </div>

      {/* Safety Flags */}
      {plan.safety_flags?.length > 0 && (
        <div style={pv.safetyBox}>
          <h3 style={pv.safetyTitle}>🛡️ Medical Safety Notices</h3>
          {plan.safety_flags.map((f, i) => (
            <p key={i} style={pv.safetyItem}>{f}</p>
          ))}
        </div>
      )}

      {/* Recommendations */}
      <div style={pv.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={pv.cardTitle}>📋 Action Plan
            <span style={pv.recCount}>{recs.length} items · {highRecs} high priority</span>
          </h3>
        </div>

        {/* Category tabs */}
        <div style={pv.tabs}>
          {categories.map(cat => (
            <button key={cat} onClick={() => setActiveTab(cat)}
                    style={{ ...pv.tab, ...(activeTab === cat ? pv.tabActive : {}) }}>
              {cat === 'all' ? 'All' : `${CAT_ICONS[cat] || '📌'} ${cat.charAt(0).toUpperCase() + cat.slice(1)}`}
            </button>
          ))}
        </div>

        <div style={{ marginTop: '16px' }}>
          {filtered.map((rec, i) => <RecCard key={i} rec={rec} index={i} />)}
        </div>
      </div>

      {/* Footer actions */}
      <div style={pv.footer}>
        <button onClick={onReset} style={pv.resetBtn}>← Start New Assessment</button>
        <button onClick={() => window.print()} style={pv.printBtn}>🖨️ Print / Save Plan</button>
      </div>

      <p style={pv.disclaimer}>
        It is not a substitute for professional medical advice. Always consult a qualified healthcare provider before making significant changes to your diet or exercise routine.
      </p>
    </div>
  );
}

const pv = {
  wrap:          { maxWidth: '900px', margin: '0 auto' },
  coachBanner:   { display: 'flex', alignItems: 'flex-start', gap: '16px', background: 'linear-gradient(135deg, #eff6ff, #f0fdf4)', borderRadius: '16px', padding: '24px', marginBottom: '28px', border: '1px solid #bfdbfe' },
  coachMsg:      { fontSize: '15px', color: '#1e3a5f', margin: 0, lineHeight: 1.7 },
  archetypeCard: { display: 'flex', alignItems: 'center', gap: '24px', background: 'white', borderRadius: '16px', padding: '28px', marginBottom: '28px', borderLeft: '6px solid', boxShadow: '0 4px 16px rgba(0,0,0,0.08)', flexWrap: 'wrap' },
  archetypeLabel:{ fontSize: '12px', color: '#64748b', margin: '0 0 4px', textTransform: 'uppercase', letterSpacing: '0.8px' },
  archetypeName: { fontSize: '24px', fontWeight: 800, margin: '0 0 8px' },
  archetypeDesc: { fontSize: '14px', color: '#475569', margin: 0, lineHeight: 1.6 },
  riskBadge:     { fontSize: '11px', fontWeight: 700, padding: '6px 14px', borderRadius: '999px', letterSpacing: '0.8px' },
  confText:      { fontSize: '11px', color: '#94a3b8', margin: '6px 0 0', textAlign: 'center' },
  sectionTitle:  { fontSize: '20px', fontWeight: 700, color: '#0f172a', margin: '0 0 16px' },
  chipRow:       { display: 'flex', gap: '12px', flexWrap: 'wrap', marginBottom: '28px' },
  card:          { background: 'white', borderRadius: '16px', padding: '28px', boxShadow: '0 2px 10px rgba(0,0,0,0.06)', marginBottom: '24px' },
  cardTitle:     { fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: '0 0 20px', display: 'flex', alignItems: 'center', gap: '10px' },
  recCount:      { fontSize: '13px', fontWeight: 400, color: '#64748b' },
  safetyBox:     { background: '#fff7ed', border: '1px solid #fed7aa', borderRadius: '12px', padding: '20px 24px', marginBottom: '24px' },
  safetyTitle:   { fontSize: '15px', fontWeight: 700, color: '#c2410c', margin: '0 0 12px' },
  safetyItem:    { fontSize: '13px', color: '#7c2d12', margin: '0 0 8px', lineHeight: 1.5 },
  tabs:          { display: 'flex', gap: '8px', flexWrap: 'wrap' },
  tab:           { padding: '7px 16px', borderRadius: '999px', border: '1px solid #e2e8f0', background: 'white', fontSize: '13px', color: '#64748b', cursor: 'pointer' },
  tabActive:     { background: '#0f172a', color: 'white', borderColor: '#0f172a' },
  footer:        { display: 'flex', gap: '16px', marginTop: '8px', marginBottom: '12px', flexWrap: 'wrap' },
  resetBtn:      { flex: 1, padding: '14px', background: 'white', color: '#0f172a', border: '1px solid #cbd5e1', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  printBtn:      { flex: 1, padding: '14px', background: '#0f172a', color: 'white', border: 'none', borderRadius: '10px', fontSize: '15px', fontWeight: 600, cursor: 'pointer' },
  disclaimer:    { fontSize: '12px', color: '#94a3b8', textAlign: 'center', lineHeight: 1.6, marginBottom: '40px' },
};
