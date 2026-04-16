import mushroomData from '../../data/mushrooms.json';
import { FieldIdDraft, RankedCandidate, computeBroadType } from '../constants/fieldId';
import { MushroomEntry } from '../types';

const entries = mushroomData as MushroomEntry[];

function normalize(value: string): string {
  return value.toLowerCase().trim();
}

function includesAny(text: string, values: string[]): boolean {
  const normalized = normalize(text);
  return values.some((value) => normalized.includes(value));
}

function fuzzySubstrateMatch(entry: MushroomEntry, substrate: string): boolean {
  const target = normalize(substrate);
  if (!target || target === 'unknown') return false;

  return entry.substrateTags.some((tag) => {
    const normalized = normalize(tag);
    return (
      normalized.includes(target) ||
      target.includes(normalized) ||
      (target === 'dead wood' &&
        ['log', 'wood', 'stump', 'dead-tree', 'dead', 'wood-chip'].some((item) =>
          normalized.includes(item)
        )) ||
      (target === 'soil' &&
        ['soil', 'ground', 'humus', 'duff', 'forest-floor'].some((item) =>
          normalized.includes(item)
        )) ||
      (target === 'living tree' &&
        ['tree', 'bark', 'trunk', 'living-tree', 'root'].some((item) =>
          normalized.includes(item)
        )) ||
      (target === 'grass' &&
        ['grass', 'lawn', 'meadow', 'grassy'].some((item) => normalized.includes(item)))
    );
  });
}

function fuzzyColorMatch(entry: MushroomEntry, color: string): boolean {
  const target = normalize(color);
  if (!target || target === 'unknown') return false;

  return entry.colorTags.some((tag) => {
    const normalized = normalize(tag);
    return (
      normalized.includes(target) ||
      (target === 'cream' && ['tan', 'buff', 'pale', 'beige', 'ivory', 'cream'].some((item) => normalized.includes(item))) ||
      (target === 'brown' && ['rust', 'chestnut', 'ochre', 'tawny', 'brown'].some((item) => normalized.includes(item))) ||
      (target === 'yellow' && ['gold', 'amber', 'ochre', 'sulphur', 'yellow'].some((item) => normalized.includes(item))) ||
      (target === 'orange' && ['orange', 'salmon', 'apricot', 'peach'].some((item) => normalized.includes(item))) ||
      (target === 'white' && ['white', 'ivory', 'cream'].some((item) => normalized.includes(item)))
    );
  });
}

function capShapeMatch(entry: MushroomEntry, capShape: string): boolean {
  const target = normalize(capShape);
  if (!target || target === 'unknown') return false;

  return entry.shapeTags.some((tag) => {
    const normalized = normalize(tag);
    return (
      normalized.includes(target) ||
      (target === 'convex' && ['round', 'dome', 'convex'].some((item) => normalized.includes(item))) ||
      (target === 'flat' && ['flat', 'plate'].some((item) => normalized.includes(item))) ||
      (target === 'funnel' && ['funnel', 'wavy', 'trumpet'].some((item) => normalized.includes(item))) ||
      (target === 'conical' && ['conical', 'bell', 'pointed'].some((item) => normalized.includes(item)))
    );
  });
}

function undersideMatch(entry: MushroomEntry, undersideType: string): boolean {
  const target = normalize(undersideType);
  if (!target || target === 'unknown') return false;

  const text = `${entry.descriptionLong} ${entry.descriptionShort} ${entry.keyTraits.join(' ')} ${entry.textureTags.join(' ')}`.toLowerCase();
  switch (target) {
    case 'gills':
      return includesAny(text, ['gill', 'blades']);
    case 'pores':
      return includesAny(text, ['pore', 'spongy', 'pored']);
    case 'ridges':
      return includesAny(text, ['ridge', 'wrinkle', 'fold']);
    case 'smooth':
      return includesAny(text, ['smooth']);
    case 'teeth':
      return includesAny(text, ['teeth', 'tooth', 'spine']);
    default:
      return false;
  }
}

function growthPatternMatch(entry: MushroomEntry, growthPattern: string): boolean {
  const target = normalize(growthPattern);
  if (!target || target === 'unknown') return false;

  const text = `${entry.descriptionLong} ${entry.descriptionShort} ${entry.keyTraits.join(' ')}`.toLowerCase();
  switch (target) {
    case 'solitary':
      return includesAny(text, ['single', 'solitary']);
    case 'clustered':
      return includesAny(text, ['cluster', 'group', 'overlapping']);
    case 'ring':
      return includesAny(text, ['ring', 'arc', 'fairy ring']);
    case 'scattered':
      return includesAny(text, ['scattered', 'few nearby']);
    default:
      return false;
  }
}

function sizeCompatible(entry: MushroomEntry, sizeClass: string): boolean {
  const target = normalize(sizeClass);
  if (!target || target === 'unknown') return false;

  const text = `${entry.descriptionShort} ${entry.descriptionLong}`.toLowerCase();
  if (includesAny(text, ['massive', 'large', 'dinner plate', 'volleyball', 'big'])) {
    return ['medium', 'large'].includes(target);
  }
  if (includesAny(text, ['small', 'tiny', 'few centimetres', 'few centimeters', 'golf ball'])) {
    return ['tiny', 'small'].includes(target);
  }
  return true;
}

export function getCurrentEcologicalSeason(date = new Date()): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = month * 100 + day;

  if (mmdd >= 315 && mmdd <= 531) return 'spring';
  if (mmdd >= 601 && mmdd <= 831) return 'summer';
  if (mmdd >= 901 && mmdd <= 1115) return 'fall';
  return 'winter';
}

export function scoreFieldIdCandidate(entry: MushroomEntry, draft: FieldIdDraft): number {
  let score = 0;
  const broadType = computeBroadType(draft);

  if (draft.overallForm && draft.overallForm !== 'unknown' && entry.broadType === broadType) {
    score += 6;
  }

  if (undersideMatch(entry, draft.undersideType)) score += 4;
  if (fuzzySubstrateMatch(entry, draft.substrate)) score += 3;
  if (fuzzyColorMatch(entry, draft.colorPrimary)) score += 2;
  if (capShapeMatch(entry, draft.capShape)) score += 2;
  if (growthPatternMatch(entry, draft.growthPattern)) score += 1;
  if (sizeCompatible(entry, draft.sizeClass)) score += 1;

  const currentSeason = getCurrentEcologicalSeason();
  if (entry.seasonTags.includes(currentSeason)) score += 1;

  return score;
}

export function getRankedFieldIdCandidates(draft: FieldIdDraft, max = 5): RankedCandidate[] {
  return entries
    .map((entry) => {
      const score = scoreFieldIdCandidate(entry, draft);
      return {
        entry,
        score,
        confidenceDots: Math.max(0, Math.min(5, Math.round(score / 2))),
      };
    })
    .filter((candidate) => candidate.score >= 3)
    .sort((left, right) => right.score - left.score || left.entry.commonName.localeCompare(right.entry.commonName))
    .slice(0, max);
}

export function detectDangerWarnings(candidates: RankedCandidate[]): string[] {
  const dangerKeywords = ['deadly', 'toxic', 'poisonous', 'fatal', 'dangerous', 'death'];
  const warnings = new Set<string>();

  candidates.slice(0, 3).forEach(({ entry }) => {
    entry.confusionWarnings.forEach((warning) => {
      const normalized = warning.toLowerCase();
      if (dangerKeywords.some((keyword) => normalized.includes(keyword))) {
        warnings.add(warning);
      }
    });
  });

  return [...warnings];
}

export function getConfidenceLabel(score: number): string {
  if (score >= 8) return 'Strong match';
  if (score >= 4) return 'Possible match';
  return 'Weak match';
}

export function buildDistinguishCopy(candidates: RankedCandidate[]): { title: string; left: string; right: string } | null {
  if (candidates.length < 2 || candidates[1].score < 4) return null;
  const [first, second] = candidates;
  const left = first.entry.expertClues[0] ?? first.entry.confusionWarnings[0];
  const right = second.entry.expertClues[0] ?? second.entry.confusionWarnings[0];
  if (!left || !right) return null;

  return {
    title: `Separating ${first.entry.commonName} from ${second.entry.commonName}`,
    left,
    right,
  };
}
