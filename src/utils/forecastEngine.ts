import missions from '../../data/missions.json';
import mushroomData from '../../data/mushrooms.json';
import { Mission, MushroomEntry, RarityTier, UserProfile } from '../types';

export interface WeatherSnapshot {
  rainLastFiveDaysMm: number;
  rainLastThreeDaysMm: number;
  tempMinC: number;
  tempMaxC: number;
  weatherScore: number;
  conditionLabel: string;
  weatherSummary: string;
}

export interface HabitatOption {
  id: string;
  label: string;
  emoji: string;
  tags: string[];
}

export interface ForecastResult {
  season: string;
  seasonLabel: string;
  bestBets: MushroomEntry[];
  keepAnEyeOut: MushroomEntry[];
  strategyText: string;
}

const allMushrooms = mushroomData as MushroomEntry[];
const allMissions = missions as Mission[];

export const HABITAT_OPTIONS: HabitatOption[] = [
  { id: 'forest', label: 'Forest', emoji: '🌲', tags: ['forest', 'mixed-forest', 'deciduous-forest', 'conifer-forest', 'birch-forest', 'oak-forest', 'beech-forest', 'pine-forest'] },
  { id: 'park-trail', label: 'Park / Trail', emoji: '🏞️', tags: ['parks', 'trail-sides'] },
  { id: 'meadow-field', label: 'Meadow / Field', emoji: '🌾', tags: ['meadows', 'grassy-areas', 'lawns'] },
  { id: 'near-water', label: 'Near Water', emoji: '💧', tags: ['stream-sides', 'wetland'] },
  { id: 'forest-edge', label: 'Forest Edge', emoji: '🌿', tags: ['forest-edge', 'disturbed-ground', 'roadsides'] },
  { id: 'urban-garden', label: 'Urban / Garden', emoji: '🏡', tags: ['gardens', 'urban-trees', 'mulch-beds', 'backyards'] },
];

const RARITY_BASE: Record<RarityTier, number> = {
  Common: 3,
  Uncommon: 2,
  'Special Find': 1,
  'Rare Find': 0,
  'Lucky Find': 0,
};

const SEASON_LABELS: Record<string, string> = {
  spring: '🌱 Spring',
  summer: '☀️ Summer',
  fall: '🍂 Fall',
  winter: '❄️ Winter',
};

export function getEcologicalSeason(date = new Date()): 'spring' | 'summer' | 'fall' | 'winter' {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const mmdd = month * 100 + day;

  if (mmdd >= 315 && mmdd <= 531) return 'spring';
  if (mmdd >= 601 && mmdd <= 831) return 'summer';
  if (mmdd >= 901 && mmdd <= 1115) return 'fall';
  return 'winter';
}

export function scoreWeather(rainLastFiveDaysMm: number, tempMinC: number, tempMaxC: number, season: string) {
  let score = 0;
  const tempMidpoint = (tempMinC + tempMaxC) / 2;

  if (rainLastFiveDaysMm >= 5 && rainLastFiveDaysMm <= 30) score += 3;
  else if (rainLastFiveDaysMm > 30) score += 2;
  else if (rainLastFiveDaysMm === 0) score -= 2;

  if (tempMidpoint >= 10 && tempMidpoint <= 20) score += 2;
  else if (tempMidpoint > 20 && tempMidpoint <= 28) score += 1;
  else if (tempMidpoint < 5 || tempMidpoint > 30) score -= 2;

  if (season === 'winter') score -= 3;

  const weatherScore = Math.max(-5, Math.min(5, score));
  let conditionLabel = 'Fair conditions';
  if (weatherScore >= 3) conditionLabel = 'Excellent conditions';
  else if (weatherScore >= 1) conditionLabel = 'Good conditions';
  else if (weatherScore <= -2) conditionLabel = 'Poor conditions';

  return { weatherScore, conditionLabel };
}

function getActiveMissionKeywords(profile?: UserProfile): Set<string> {
  const incompleteMissions = allMissions.filter(
    (mission) => mission.active && !profile?.completedMissions.includes(mission.id)
  );

  const keywords = new Set<string>();
  incompleteMissions.forEach((mission) => {
    if (mission.missionType === 'category') {
      const broadType = String(mission.criteria.broadType ?? '').toLowerCase();
      if (broadType.includes('bracket')) keywords.add('bracket');
      if (broadType.includes('puffball')) keywords.add('puffball');
      if (broadType.includes('gilled')) keywords.add('gilled');
      if (broadType.includes('boletes')) keywords.add('bolete');
      if (broadType.includes('pored')) keywords.add('pored');
    }
    if (mission.missionType === 'biome') {
      const biomeTag = String(mission.criteria.biomeTag ?? '').toLowerCase();
      if (biomeTag.includes('forest')) keywords.add('forest');
      if (biomeTag.includes('field') || biomeTag.includes('meadow')) keywords.add('meadow');
    }
    if (mission.missionType === 'rarityFind') {
      keywords.add('rare');
      keywords.add('lucky');
    }
  });

  return keywords;
}

function buildStrategyText(args: {
  season: string;
  conditionLabel: string;
  habitat: HabitatOption;
  topSpecies: MushroomEntry[];
  weather: WeatherSnapshot;
}): string {
  const speciesList = args.topSpecies.slice(0, 3).map((entry) => entry.commonName).join(', ');
  const rainSignal =
    args.weather.rainLastFiveDaysMm >= 20
      ? 'Recent rain should have pushed fresh fruiting bodies up.'
      : args.weather.rainLastFiveDaysMm > 0
        ? 'Moisture is present, so scan slowly around promising substrate.'
        : 'Dry ground means you should focus on sheltered, damp pockets.';

  const habitatLead: Record<string, string> = {
    forest: 'Work slowly under mature trees and check mossy ground, roots, and fallen wood.',
    'park-trail': 'Scan trail edges, landscaped trees, and wood-rich disturbed spots.',
    'meadow-field': 'Keep your eyes low in grass, field margins, and open sunny patches.',
    'near-water': 'Prioritize damp banks, seepage areas, and shaded edges near water.',
    'forest-edge': 'Cover transition zones where grass, brush, and tree roots overlap.',
    'urban-garden': 'Check mulch beds, lawns, yard edges, and ornamental trees.',
  };

  const conditionLead =
    args.conditionLabel === 'Excellent conditions'
      ? 'Conditions are lining up well for a productive walk today.'
      : args.conditionLabel === 'Good conditions'
        ? 'There is a solid chance of finding fresh mushrooms today.'
        : args.conditionLabel === 'Poor conditions'
          ? 'Expect fewer mushrooms today and focus on the most reliable microhabitats.'
          : 'Treat today as a selective search and verify anything promising carefully.';

  return `${conditionLead} ${habitatLead[args.habitat.id]} ${rainSignal} In ${SEASON_LABELS[args.season].replace(/^[^\s]+\s/, '').toLowerCase()} conditions, ${speciesList || 'common in-season species'} are your best targets. Pay extra attention to texture, underside, and substrate before you log anything.`;
}

export function buildForecast(params: {
  habitat: HabitatOption;
  weather: WeatherSnapshot;
  profile?: UserProfile;
  date?: Date;
}): ForecastResult {
  const season = getEcologicalSeason(params.date);
  const missionKeywords = getActiveMissionKeywords(params.profile);

  const ranked = allMushrooms
    .filter((entry) => entry.seasonTags.includes(season))
    .filter((entry) => entry.habitatTags.some((tag) => params.habitat.tags.includes(tag)))
    .filter((entry) => {
      if (params.weather.weatherScore <= -3) {
        return !['Rare Find', 'Lucky Find'].includes(entry.rarityTier);
      }
      return true;
    })
    .map((entry) => {
      let score = RARITY_BASE[entry.rarityTier];
      if (entry.habitatTags.some((tag) => params.habitat.tags.includes(tag))) score += 2;
      if (entry.missionTags.some((tag) => missionKeywords.has(tag.toLowerCase()))) score += 1;
      return { entry, score };
    })
    .sort((left, right) => right.score - left.score || left.entry.commonName.localeCompare(right.entry.commonName));

  const bestBets = ranked.slice(0, 12).map((item) => item.entry);
  const keepAnEyeOut = ranked
    .filter((item) => ['Special Find', 'Rare Find', 'Lucky Find'].includes(item.entry.rarityTier))
    .map((item) => item.entry);

  return {
    season,
    seasonLabel: SEASON_LABELS[season],
    bestBets: bestBets.slice(0, 8),
    keepAnEyeOut,
    strategyText: buildStrategyText({
      season,
      conditionLabel: params.weather.conditionLabel,
      habitat: params.habitat,
      topSpecies: bestBets,
      weather: params.weather,
    }),
  };
}
