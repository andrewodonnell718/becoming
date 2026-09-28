import { useEffect, useId, useState, type ReactNode } from 'react';

/** Renders at 0 first, then animates to the real value on the next frame. */
function useMountedValue(v: number) {
  const [x, setX] = useState(0);
  useEffect(() => {
    const r = requestAnimationFrame(() => setX(v));
    return () => cancelAnimationFrame(r);
  }, [v]);
  return x;
}

export function ProgressBar({ value, color, thin }: { value: number; color?: string; thin?: boolean }) {
  const v = useMountedValue(Math.max(0, Math.min(1, value)));
  const fill = color ? `linear-gradient(90deg, color-mix(in srgb, ${color} 70%, #fff), ${color})` : undefined;
  return (
    <div className={`bar${thin ? ' thin' : ''}`} role="progressbar" aria-valuenow={Math.round(value * 100)} aria-valuemin={0} aria-valuemax={100}>
      <i style={{ width: `${v * 100}%`, ...(fill ? { ['--fill' as string]: fill } : {}) }} />
    </div>
  );
}

export function ProgressRing({ value, size = 150, stroke = 12, children }: { value: number; size?: number; stroke?: number; children?: ReactNode }) {
  const v = useMountedValue(Math.max(0, Math.min(1, value)));
  const id = useId();
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <defs>
          <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--accent-2)" />
          </linearGradient>
        </defs>
        <circle className="track" cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className="value"
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          stroke={`url(#${id})`}
          strokeLinecap="round"
          strokeDasharray={c}
          strokeDashoffset={c * (1 - v)}
          opacity={v > 0 ? 1 : 0}
        />
      </svg>
      <div className="label">{children}</div>
    </div>
  );
}
