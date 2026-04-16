import { BroadType, MushroomEntry } from '../types';

export interface FieldIdOption {
  label: string;
  emoji: string;
  value: string;
  broadType?: BroadType;
}

export interface FieldIdDraft {
  substrate: string;
  growthPattern: string;
  overallForm: string;
  capShape: string;
  undersideType: string;
  colorPrimary: string;
  sizeClass: string;
  locationNote: string;
  notes: string;
  photos: string[];
}

export interface RankedCandidate {
  entry: MushroomEntry;
  score: number;
  confidenceDots: number;
}

export const SUBSTRATE_OPTS: FieldIdOption[] = [
  { label: 'Dead wood / log / stump', emoji: '🪵', value: 'dead wood' },
  { label: 'Living tree / bark', emoji: '🌲', value: 'living tree' },
  { label: 'Soil / forest floor', emoji: '🌱', value: 'soil' },
  { label: 'Grass / lawn', emoji: '🌿', value: 'grass' },
  { label: 'Dung / compost', emoji: '💩', value: 'dung' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

export const GROWTH_OPTS: FieldIdOption[] = [
  { label: 'Single, on its own', emoji: '🍄', value: 'solitary' },
  { label: 'Clustered together', emoji: '👥', value: 'clustered' },
  { label: 'In a ring or arc', emoji: '⭕', value: 'ring' },
  { label: 'Scattered, a few nearby', emoji: '🌿', value: 'scattered' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

export const FORM_OPTS: FieldIdOption[] = [
  { label: 'Shelf or bracket on wood', emoji: '🪵', value: 'bracket', broadType: 'Bracket/Polypore' },
  { label: 'Cap on a stem', emoji: '🍄', value: 'cap', broadType: 'Gilled' },
  { label: 'Ball or puffball shape', emoji: '⚪', value: 'puffball', broadType: 'Puffball' },
  { label: 'Coral or branched', emoji: '🌿', value: 'coral', broadType: 'Coral' },
  { label: 'Jelly-like or wobbly', emoji: '🫧', value: 'jelly', broadType: 'Jelly' },
  { label: 'Cup or bowl shape', emoji: '🥣', value: 'cup', broadType: 'Cup' },
  { label: 'Covered in teeth or spines', emoji: '🦷', value: 'tooth', broadType: 'Tooth' },
  { label: 'Trumpet or funnel shape', emoji: '🎺', value: 'trumpet', broadType: 'Gilled' },
  { label: 'Flat crust on wood', emoji: '📄', value: 'crust', broadType: 'Crust' },
  { label: 'Other / not sure', emoji: '❓', value: 'unknown', broadType: 'Other' },
];

export const CAP_SHAPE_OPTS: FieldIdOption[] = [
  { label: 'Rounded or dome-shaped', emoji: '⛰️', value: 'convex' },
  { label: 'Flat or plate-like', emoji: '💿', value: 'flat' },
  { label: 'Wavy or funnel-shaped', emoji: '〰️', value: 'funnel' },
  { label: 'Pointy or bell-shaped', emoji: '🔔', value: 'conical' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

export const UNDERSIDE_OPTS: FieldIdOption[] = [
  { label: 'Gills — thin blades from centre', emoji: '🍄', value: 'gills' },
  { label: 'Pores — tiny holes (spongy)', emoji: '🔵', value: 'pores' },
  { label: 'Ridges or wrinkled folds', emoji: '〰️', value: 'ridges' },
  { label: 'Smooth — no texture', emoji: '⬜', value: 'smooth' },
  { label: 'Teeth or hanging spines', emoji: '🦷', value: 'teeth' },
  { label: "Couldn't check", emoji: '❓', value: 'unknown' },
];

export const COLOR_OPTS: FieldIdOption[] = [
  { label: 'White', emoji: '⬜', value: 'white' },
  { label: 'Cream or tan', emoji: '🟤', value: 'cream' },
  { label: 'Yellow or gold', emoji: '🟡', value: 'yellow' },
  { label: 'Orange', emoji: '🟠', value: 'orange' },
  { label: 'Brown or rusty', emoji: '🤎', value: 'brown' },
  { label: 'Red or brick red', emoji: '🔴', value: 'red' },
  { label: 'Grey or black', emoji: '⬛', value: 'grey' },
  { label: 'Purple or violet', emoji: '🟣', value: 'purple' },
  { label: 'Green', emoji: '🟢', value: 'green' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

export const SIZE_OPTS: FieldIdOption[] = [
  { label: 'Tiny — smaller than a golf ball', emoji: '🔹', value: 'tiny' },
  { label: 'Small — golf ball to fist', emoji: '🔸', value: 'small' },
  { label: 'Medium — fist to dinner plate', emoji: '🟧', value: 'medium' },
  { label: 'Large — dinner plate or bigger', emoji: '🟥', value: 'large' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

export const STEP_QUESTIONS = [
  'Where is it growing?',
  'How is it growing?',
  'What shape is it overall?',
  'What shape is the cap?',
  'What does the underside look like?',
  'What colour is it?',
  'How big is it?',
  'Add any extra details',
] as const;

export const QUICK_ID_STEPS = [
  'What shape is it overall?',
  'What colour is it?',
  'Where is it growing?',
] as const;

export const EMPTY_FIELD_ID_DRAFT: FieldIdDraft = {
  substrate: '',
  growthPattern: '',
  overallForm: '',
  capShape: '',
  undersideType: '',
  colorPrimary: '',
  sizeClass: '',
  locationNote: '',
  notes: '',
  photos: [],
};

export function getVisibleSteps(draft: FieldIdDraft): number[] {
  const steps = [0, 1, 2];
  if (draft.overallForm === 'cap' || draft.overallForm === 'trumpet') steps.push(3);
  if (
    draft.overallForm &&
    !['puffball', 'coral', 'jelly', 'crust', 'unknown'].includes(draft.overallForm)
  ) {
    steps.push(4);
  }
  steps.push(5, 6, 7);
  return steps;
}

export function computeBroadType(draft: Pick<FieldIdDraft, 'overallForm' | 'undersideType'>): BroadType {
  const form = FORM_OPTS.find((item) => item.value === draft.overallForm);
  if (!form?.broadType) return 'Other';
  if (form.value === 'cap' || form.value === 'trumpet') {
    if (draft.undersideType === 'pores') return 'Boletes/Pored';
    if (draft.undersideType === 'teeth') return 'Tooth';
    return 'Gilled';
  }
  return form.broadType;
}

export function optionLabel(options: FieldIdOption[], value: string): string {
  return options.find((item) => item.value === value)?.label ?? value;
}
