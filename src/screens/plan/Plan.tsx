import { useState } from 'react';
import { Segmented } from '../../components/Fields';
import { Direction } from './Direction';
import { Outcomes } from './Outcomes';
import { WeekPlan } from './WeekPlan';

type View = 'direction' | 'outcomes' | 'week';

export function Plan() {
  const [view, setView] = useState<View>(() => {
    try {
      return (localStorage.getItem('becoming:plan-view') as View) || 'outcomes';
    } catch {
      return 'outcomes';
    }
  });
  const change = (v: View) => {
    setView(v);
    try { localStorage.setItem('becoming:plan-view', v); } catch { /* ignore */ }
  };
  return (
    <div className="screen">
      <h1>Plan</h1>
      <Segmented
        options={[{ id: 'direction', name: 'Direction' }, { id: 'outcomes', name: '90 days' }, { id: 'week', name: 'Week' }]}
        value={view}
        onChange={change}
      />
      {view === 'direction' && <Direction />}
      {view === 'outcomes' && <Outcomes />}
      {view === 'week' && <WeekPlan />}
    </div>
  );
}
