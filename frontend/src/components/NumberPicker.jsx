import React from 'react';

const TOTAL    = 60;
const REQUIRED = 6;

export default function NumberPicker({ selected, onChange, disabled = false, hitNumbers = [] }) {
  function toggle(num) {
    if (disabled) return;
    if (selected.includes(num)) {
      onChange(selected.filter((n) => n !== num));
    } else if (selected.length < REQUIRED) {
      onChange([...selected, num].sort((a, b) => a - b));
    }
  }

  function ballClass(num) {
    if (hitNumbers.includes(num)) return 'number-ball number-ball-hit';
    if (selected.includes(num))   return 'number-ball number-ball-selected';
    return 'number-ball number-ball-default';
  }

  const done = selected.length === REQUIRED;

  return (
    <div>
      {/* Contador + limpar */}
      <div style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ fontSize: 11, color: 'rgba(250,247,240,.45)', letterSpacing: 1, textTransform: 'uppercase' }}>
            Selecionados
          </span>
          <span style={{ fontSize: 12, color: 'rgba(250,247,240,.35)' }}>
            <span style={{ color: done ? 'var(--forest3)' : 'var(--gold2)', fontWeight: 700 }}>
              {selected.length}
            </span>/6
          </span>
        </div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {selected.map((n) => (
            <span
              key={n}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                background: 'var(--gold)',
                color: 'var(--forest)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontWeight: 700, fontSize: 12,
                boxShadow: '0 4px 12px rgba(212,168,67,.35)',
                animation: 'ballPop .2s ease',
                flexShrink: 0,
              }}
            >
              {String(n).padStart(2, '0')}
            </span>
          ))}
          {Array.from({ length: REQUIRED - selected.length }).map((_, i) => (
            <span
              key={`empty-${i}`}
              style={{
                width: 34, height: 34, borderRadius: '50%',
                border: '1.5px dashed rgba(255,255,255,.15)',
                display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, color: 'rgba(255,255,255,.12)',
                flexShrink: 0,
              }}
            >
              ·
            </span>
          ))}
        </div>
      </div>

      {selected.length > 0 && !disabled && (
        <button
          onClick={() => onChange([])}
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.8rem', cursor: 'pointer', textDecoration: 'underline', marginBottom: 12 }}
          type="button"
        >
          Limpar seleção
        </button>
      )}

      {/* Grade 10×6 (desktop) / 6×10 (mobile) */}
      <div className="number-grid">
        {Array.from({ length: TOTAL }, (_, i) => i + 1).map((num) => (
          <button
            key={num}
            type="button"
            className={ballClass(num)}
            onClick={() => toggle(num)}
            disabled={disabled || (selected.length >= REQUIRED && !selected.includes(num))}
            title={`Número ${String(num).padStart(2, '0')}`}
          >
            {String(num).padStart(2, '0')}
          </button>
        ))}
      </div>

      {done && (
        <div style={{
          marginTop: 14,
          padding: '10px 16px',
          background: 'rgba(38,168,106,.1)',
          border: '1px solid rgba(38,168,106,.3)',
          borderRadius: 10,
          color: 'var(--forest3)',
          fontSize: '0.875rem',
          textAlign: 'center',
          animation: 'fadeIn .3s ease',
        }}>
          ✓ Cartela completa! Clique em "Adicionar ao carrinho".
        </div>
      )}
    </div>
  );
}
