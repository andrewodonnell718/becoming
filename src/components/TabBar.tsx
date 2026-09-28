import { IconGrow, IconPlan, IconReflect, IconToday, IconTrack } from './Icons';

export type Tab = 'today' | 'plan' | 'track' | 'reflect' | 'grow';

const TABS: { id: Tab; label: string; icon: (p: { size?: number }) => React.JSX.Element }[] = [
  { id: 'today', label: 'Today', icon: IconToday },
  { id: 'plan', label: 'Plan', icon: IconPlan },
  { id: 'track', label: 'Track', icon: IconTrack },
  { id: 'reflect', label: 'Reflect', icon: IconReflect },
  { id: 'grow', label: 'Grow', icon: IconGrow },
];

export function TabBar({ tab, onChange }: { tab: Tab; onChange: (t: Tab) => void }) {
  return (
    <nav className="tabbar glass">
      {TABS.map(({ id, label, icon: Icon }) => (
        <button key={id} className={tab === id ? 'on' : ''} onClick={() => onChange(id)} aria-current={tab === id}>
          <Icon size={21} />
          {label}
        </button>
      ))}
    </nav>
  );
}
