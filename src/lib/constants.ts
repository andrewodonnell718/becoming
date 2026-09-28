import type { AreaId, Commitment, PatternId } from './types';

export const AREAS: { id: AreaId; name: string; hint: string }[] = [
  { id: 'health', name: 'Health', hint: 'Body, energy, sleep, training' },
  { id: 'wealth', name: 'Wealth', hint: 'Income, assets, craft that pays' },
  { id: 'network', name: 'Network', hint: 'Family, friends, allies' },
  { id: 'creation', name: 'Creation', hint: 'Things you make and ship' },
  { id: 'adventure', name: 'Adventure', hint: 'Experiences, travel, risk' },
  { id: 'contribution', name: 'Contribution', hint: 'Service, giving, mentoring' },
  { id: 'practice', name: 'Practice', hint: 'Mind, spirit, discipline' },
];
export const areaName = (id: AreaId) => AREAS.find((a) => a.id === id)?.name ?? id;

export interface PrincipleDef { id: string; name: string; prompt: string }
export const PILLARS: PrincipleDef[] = [
  { id: 'discipline', name: 'Discipline', prompt: 'What does keeping your word to yourself look like?' },
  { id: 'structure', name: 'Structure', prompt: 'What rhythms and systems hold your life together?' },
  { id: 'wisdom', name: 'Wisdom', prompt: 'How do you learn, and how do you decide?' },
  { id: 'love', name: 'Love', prompt: 'How do you show up for the people you love?' },
  { id: 'strength', name: 'Strength', prompt: 'What does strength mean in body and character?' },
  { id: 'play', name: 'Play', prompt: 'Where does lightness and joy belong in your life?' },
  { id: 'invitation', name: 'Invitation', prompt: 'What do you invite into your life, and who do you invite others to become?' },
];
export const PURSUIT: PrincipleDef[] = [
  { id: 'adventure', name: 'Adventure', prompt: 'What is the adventure you are pursuing?' },
];
export const MASTERIES: PrincipleDef[] = [
  { id: 'sovereignty', name: 'Sovereignty', prompt: 'Ownership of your time, attention and choices.' },
  { id: 'vitality', name: 'Vitality', prompt: 'Energy, health and physical capacity.' },
  { id: 'kinship', name: 'Kinship', prompt: 'Depth of relationship and belonging.' },
  { id: 'creation', name: 'Creation', prompt: 'Bringing new things into the world.' },
  { id: 'dominion', name: 'Dominion', prompt: 'Command of your craft, resources and domain.' },
  { id: 'exploration', name: 'Exploration', prompt: 'Curiosity, new ground, the unknown.' },
  { id: 'contribution', name: 'Contribution', prompt: 'What you give beyond yourself.' },
  { id: 'transcendence', name: 'Transcendence', prompt: 'What is larger than you.' },
];
export const ALL_PRINCIPLES = [...PILLARS, ...PURSUIT, ...MASTERIES];
export const principleName = (id: string) => ALL_PRINCIPLES.find((p) => p.id === id)?.name ?? id;

export const PATTERNS: { id: PatternId; name: string }[] = [
  { id: 'avoidance', name: 'Avoidance' },
  { id: 'perfectionism', name: 'Perfectionism' },
  { id: 'distraction', name: 'Distraction' },
  { id: 'reward', name: 'Reward seeking' },
  { id: 'fear', name: 'Fear' },
  { id: 'overwhelm', name: 'Overwhelm' },
  { id: 'expectations', name: 'Unrealistic expectations' },
  { id: 'environment', name: 'Environmental trigger' },
  { id: 'emotional', name: 'Emotional reaction' },
  { id: 'priorities', name: 'Too many priorities' },
  { id: 'other', name: 'Other' },
];
export const patternName = (id: PatternId) => PATTERNS.find((p) => p.id === id)?.name ?? id;

export const IF_THEN: Record<PatternId, string> = {
  avoidance: 'If I start avoiding my most important task, I will work on it for 10 minutes before doing anything else.',
  perfectionism: 'If I catch myself polishing instead of finishing, I will define "good enough" and ship that version.',
  distraction: 'If I reach for my phone during focused work, I will put it in another room and return to the task.',
  reward: 'If I want a quick reward before the work is done, I will earn it with 25 focused minutes first.',
  fear: 'If I feel fear about a task, I will name it and take the smallest visible step.',
  overwhelm: 'If I feel overwhelmed, I will write everything down and choose one thing.',
  expectations: 'If my plan feels impossible, I will cut it in half and commit to that half.',
  environment: 'If my surroundings pull me off track, I will change rooms or remove the trigger.',
  emotional: 'If I react emotionally, I will take three slow breaths before I respond or act.',
  priorities: 'If too many things feel urgent, I will pick the one tied to my 90-day outcome.',
  other: 'If ___ happens, I will ___.',
};

type DefaultCommitment = Pick<Commitment, 'name' | 'area' | 'evidence'> & { days?: number[] };
export const DEFAULT_COMMITMENTS: DefaultCommitment[] = [
  { name: 'Physical training', area: 'health', evidence: 'training sessions' },
  { name: 'Nutrition', area: 'health', evidence: 'days eating to plan' },
  { name: 'Deep work', area: 'creation', evidence: 'deep work sessions', days: [1, 2, 3, 4, 5] },
  { name: 'Revenue-producing work', area: 'wealth', evidence: 'revenue-producing actions', days: [1, 2, 3, 4, 5] },
  { name: 'Meaningful human connection', area: 'network', evidence: 'meaningful connections' },
  { name: 'Digital discipline', area: 'practice', evidence: 'days without recreational social media' },
  { name: 'Keeping commitments', area: 'practice', evidence: 'days I kept my word' },
];

export const BODY_CHIPS = ['Train', 'Walk 30 min', 'Mobility', 'Eat to plan', 'Sleep by 10:30', 'Sauna / cold'];

export const PHILOSOPHY_LINE =
  'I am not trying to become a different person overnight. I am building evidence every day that I am becoming the person I said I would be.';
