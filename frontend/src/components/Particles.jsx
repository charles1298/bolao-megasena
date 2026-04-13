import React, { useMemo } from 'react';

export default function Particles() {
  const particles = useMemo(() =>
    Array.from({ length: 22 }, (_, i) => ({
      id: i,
      size: 18 + Math.random() * 110,
      left: Math.random() * 100,
      isGold: Math.random() > 0.48,
      duration: 14 + Math.random() * 22,
      delay: -Math.random() * 22,
    })),
  []);

  return (
    <div className="particles" aria-hidden="true">
      {particles.map((p) => (
        <div
          key={p.id}
          className="particle"
          style={{
            width:  p.size,
            height: p.size,
            left:   `${p.left}%`,
            background: p.isGold
              ? 'rgba(212,168,67,.055)'
              : 'rgba(38,168,106,.055)',
            animationDuration: `${p.duration}s`,
            animationDelay:    `${p.delay}s`,
          }}
        />
      ))}
    </div>
  );
}
