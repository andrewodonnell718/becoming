const base = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.7, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
type P = { size?: number };
const sz = (p: P) => (p.size ? { width: p.size, height: p.size } : {});

export const IconToday = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>;
export const IconPlan = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>;
export const IconTrack = (p: P) => <svg {...base} {...sz(p)}><path d="M4 7h10M4 12h16M4 17h7" /><circle cx="17" cy="7" r="2" /><circle cx="14" cy="17" r="2" /></svg>;
export const IconReflect = (p: P) => <svg {...base} {...sz(p)}><path d="M20 12.5A8 8 0 1111.5 4a6 6 0 008.5 8.5z" /></svg>;
export const IconGrow = (p: P) => <svg {...base} {...sz(p)}><path d="M12 21v-8M12 13c0-4 3-7 8-7 0 4-3 7-8 7zM12 15c0-3-2.5-5.5-7-5.5 0 3 2.5 5.5 7 5.5z" /></svg>;
export const IconPlus = (p: P) => <svg {...base} {...sz(p)}><path d="M12 5v14M5 12h14" /></svg>;
export const IconMinus = (p: P) => <svg {...base} {...sz(p)}><path d="M5 12h14" /></svg>;
export const IconClose = (p: P) => <svg {...base} {...sz(p)}><path d="M6 6l12 12M18 6L6 18" /></svg>;
export const IconMic = (p: P) => <svg {...base} {...sz(p)}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0014 0M12 18v3" /></svg>;
export const IconSpark = (p: P) => <svg {...base} {...sz(p)}><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></svg>;
export const IconSun = (p: P) => <svg {...base} {...sz(p)}><path d="M3 18h18M7 18a5 5 0 0110 0M12 7V4M5.6 10.6L3.5 8.5M18.4 10.6l2.1-2.1" /></svg>;
export const IconMoon = (p: P) => <svg {...base} {...sz(p)}><path d="M19 14.5A7.5 7.5 0 019.5 5a7.5 7.5 0 109.5 9.5z" /></svg>;
export const IconBuoy = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="4" /><path d="M5.6 5.6l3.6 3.6M14.8 14.8l3.6 3.6M18.4 5.6l-3.6 3.6M9.2 14.8l-3.6 3.6" /></svg>;
export const IconTarget = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="5" /><circle cx="12" cy="12" r="1" /></svg>;
export const IconEdit = (p: P) => <svg {...base} {...sz(p)}><path d="M4 20h4L19 9l-4-4L4 16z" /></svg>;
export const IconClock = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const IconCheck = ({ size = 20, color = 'currentColor' }: P & { color?: string }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 12.5l4 4L18 8" /></svg>
);
export const IconChevron = ({ dir = 'right', size = 18 }: P & { dir?: 'up' | 'down' | 'right' | 'left' }) => (
  <svg {...base} width={size} height={size} style={{ transform: { up: 'rotate(-90deg)', down: 'rotate(90deg)', right: 'none', left: 'rotate(180deg)' }[dir], transition: 'transform .3s' }}><path d="M9 6l6 6-6 6" /></svg>
);
export const IconTrend = ({ up }: { up: boolean }) => (
  <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden><path d={up ? 'M6 2l4 6H2z' : 'M6 10l4-6H2z'} /></svg>
);
export const IconSettings = (p: P) => <svg {...base} {...sz(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" /></svg>;
