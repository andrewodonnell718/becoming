import { useEffect, useRef, useState } from 'react';

const reduced = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const easeOutExpo = (t: number) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

interface Props {
  value: number;
  decimals?: number;
  duration?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
  style?: React.CSSProperties;
}

/** Counts from the previously shown value to `value` (from 0 on first mount). */
export function AnimatedNumber({ value, decimals = 0, duration = 1100, prefix = '', suffix = '', className, style }: Props) {
  const [shown, setShown] = useState(reduced() ? value : 0);
  const from = useRef(shown);

  useEffect(() => {
    if (reduced()) return setShown(value);
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const t = Math.min((now - start) / duration, 1);
      const v = a + (value - a) * easeOutExpo(t);
      from.current = v;
      setShown(v);
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  const text = shown.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
  return (
    <span className={className} style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}{text}{suffix}
    </span>
  );
}
