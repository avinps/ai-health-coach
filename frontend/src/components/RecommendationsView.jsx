import React from 'react';

// shows the risk reduction guidance.
// renders the /generate/recommendations response:
// { summary, recommendations: { foods, exercise, lifestyle }, disclaimer }
// each category has a positive column (eat / do) and an avoid column.
// each item can carry targets, the risk areas it helps, shown as little chips so
// the user can see why a suggestion is on their list.

// colour per risk area for the target chips
const TARGET_COLORS = {
  'diabetes':            { bg: '#eef2ff', fg: '#4338ca' },
  'heart disease':       { bg: '#fef2f2', fg: '#b91c1c' },
  'high blood pressure': { bg: '#fff7ed', fg: '#c2410c' },
  'obesity':             { bg: '#f0fdf4', fg: '#15803d' },
  'mental wellbeing':    { bg: '#faf5ff', fg: '#7e22ce' },
  'respiratory health':  { bg: '#ecfeff', fg: '#0e7490' },
  'general fitness':     { bg: '#f8fafc', fg: '#475569' },
};
const chipColor = (t) => TARGET_COLORS[t] || { bg: '#f1f5f9', fg: '#475569' };

// Category metadata: icon + the two directions and their wording.
const CATEGORIES = [
  { key: 'foods',     icon: '🥗', title: 'Foods',     pos: 'eat', posLabel: 'Eat more' },
  { key: 'exercise',  icon: '🏃', title: 'Exercise',  pos: 'do',  posLabel: 'Do' },
  { key: 'lifestyle', icon: '🌱', title: 'Lifestyle', pos: 'do',  posLabel: 'Do' },
];

function Chips({ targets }) {
  if (!targets || targets.length === 0) return null;
  return (
    <div style={st.chipRow}>
      {targets.map((t) => {
        const c = chipColor(t);
        return (
          <span key={t} style={{ ...st.chip, background: c.bg, color: c.fg }}>{t}</span>
        );
      })}
    </div>
  );
}

function ItemList({ items, tone }) {
  if (!items || items.length === 0) {
    return <p style={st.emptyNote}>Nothing specific flagged here.</p>;
  }
  const dot = tone === 'pos' ? st.dotPos : st.dotNeg;
  return (
    <ul style={st.list}>
      {items.map((it, i) => (
        <li key={i} style={st.item}>
          <span style={{ ...st.dot, ...dot }} />
          <div>
            <span style={st.itemText}>{it.text}</span>
            <Chips targets={it.targets} />
          </div>
        </li>
      ))}
    </ul>
  );
}

function CategoryCard({ meta, block }) {
  const posItems = block?.[meta.pos] || [];
  const avoidItems = block?.avoid || [];
  return (
    <div style={st.card}>
      <div style={st.cardHead}>
        <span style={st.cardIcon}>{meta.icon}</span>
        <h3 style={st.cardTitle}>{meta.title}</h3>
      </div>
      <div style={st.twoCol}>
        <div style={st.col}>
          <div style={{ ...st.colHead, color: '#15803d' }}>
            <span style={st.colHeadIcon}>✓</span> {meta.posLabel}
          </div>
          <ItemList items={posItems} tone="pos" />
        </div>
        <div style={st.divider} />
        <div style={st.col}>
          <div style={{ ...st.colHead, color: '#b91c1c' }}>
            <span style={st.colHeadIcon}>✕</span> Avoid
          </div>
          <ItemList items={avoidItems} tone="neg" />
        </div>
      </div>
    </div>
  );
}

export default function RecommendationsView({ data, onBack, onReset }) {
  if (!data) return null;
  const { summary, recommendations, disclaimer } = data;

  return (
    <div style={st.wrap}>
      {/* summary, the human readable shap interpretation */}
      <div style={st.summaryCard}>
        <div style={st.summaryHead}>
          <span style={st.summaryIcon}>🎯</span>
          <h2 style={st.summaryTitle}>Your risk-reduction focus</h2>
        </div>
        <p style={st.summaryText}>{summary}</p>
      </div>

      {/* Category cards */}
      {CATEGORIES.map((meta) => (
        <CategoryCard key={meta.key} meta={meta} block={recommendations?.[meta.key]} />
      ))}

      {/* Disclaimer */}
      {disclaimer && (
        <div style={st.disclaimer}>
          <span style={{ fontSize: '16px' }}>ℹ️</span>
          <span>{disclaimer}</span>
        </div>
      )}

      {/* Actions */}
      <div style={st.actions}>
        <button onClick={onBack} style={st.backBtn}>← Back to Dashboard</button>
        <button onClick={onReset} style={st.resetBtn}>Start New Assessment</button>
      </div>
    </div>
  );
}

const st = {
  wrap: { display: 'flex', flexDirection: 'column', gap: '20px' },

  summaryCard: {
    background: 'linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%)',
    borderRadius: '16px', padding: '28px 32px', color: 'white',
    boxShadow: '0 10px 30px rgba(15,23,42,0.25)',
  },
  summaryHead: { display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' },
  summaryIcon: { fontSize: '26px' },
  summaryTitle: { margin: 0, fontSize: '20px', fontWeight: 700 },
  summaryText: { margin: 0, fontSize: '15px', lineHeight: 1.7, color: '#cbd5e1' },

  card: {
    background: 'white', borderRadius: '16px', padding: '24px 28px',
    boxShadow: '0 4px 16px rgba(15,23,42,0.06)', border: '1px solid #eef2f7',
  },
  cardHead: { display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '18px' },
  cardIcon: { fontSize: '24px' },
  cardTitle: { margin: 0, fontSize: '18px', fontWeight: 700, color: '#0f172a' },

  twoCol: { display: 'flex', gap: '24px', flexWrap: 'wrap' },
  col: { flex: '1 1 260px', minWidth: '240px' },
  divider: { width: '1px', background: '#eef2f7', alignSelf: 'stretch' },
  colHead: { display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '12px' },
  colHeadIcon: { fontWeight: 800 },

  list: { listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '12px' },
  item: { display: 'flex', gap: '10px', alignItems: 'flex-start' },
  dot: { width: '8px', height: '8px', borderRadius: '50%', marginTop: '7px', flexShrink: 0 },
  dotPos: { background: '#22c55e' },
  dotNeg: { background: '#ef4444' },
  itemText: { fontSize: '14px', color: '#334155', lineHeight: 1.5 },
  emptyNote: { fontSize: '13px', color: '#94a3b8', fontStyle: 'italic', margin: 0 },

  chipRow: { display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '6px' },
  chip: { fontSize: '11px', fontWeight: 600, padding: '2px 9px', borderRadius: '999px', whiteSpace: 'nowrap' },

  disclaimer: {
    display: 'flex', gap: '10px', alignItems: 'flex-start',
    background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px',
    padding: '14px 18px', fontSize: '12.5px', color: '#64748b', lineHeight: 1.6,
  },

  actions: { display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '4px' },
  backBtn: { padding: '13px 24px', background: 'white', color: '#334155', border: '1px solid #cbd5e1', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' },
  resetBtn: { padding: '13px 24px', background: 'linear-gradient(135deg, #059669, #10b981)', color: 'white', border: 'none', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', boxShadow: '0 4px 14px rgba(16,185,129,0.35)' },
};
