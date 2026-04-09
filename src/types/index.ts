// ─── FungiDex — Core Type Definitions ────────────────────────────────────────

export type BroadType =
  | 'Gilled'
  | 'Boletes/Pored'
  | 'Bracket/Polypore'
  | 'Puffball'
  | 'Coral'
  | 'Jelly'
  | 'Cup'
  | 'Tooth'
  | 'Stinkhorn'
  | 'Crust'
  | 'Morel'
  | 'Other';

export type RarityTier =
  | 'Common'
  | 'Uncommon'
  | 'Special Find'
  | 'Rare Find'
  | 'Lucky Find';

export type IdDifficulty = 'Easy' | 'Moderate' | 'Tricky' | 'Expert';

export type ProgressionStage =
  | 'Explorer'
  | 'Observer'
  | 'Naturalist'
  | 'Junior Expert';

export type MissionType =
  | 'find'
  | 'biome'
  | 'skill'
  | 'category'
  | 'seasonal'
  | 'journal';

// ─── Mushroom Entry ──────────────────────────────────────────────────────────

export interface ImageAsset {
  id: string;
  mushroomEntryId: string;
  urlOrLocalPath: string;
  caption: string;
  sourceName: string;
  sourceUrl: string;
  attribution: string;
  notes: string;
  isHero: boolean;
}

export interface MushroomEntry {
  id: string;
  commonName: string;
  scientificName: string;
  alternateNames: string[];
  taxonLevel: 'species' | 'species-group' | 'genus';
  descriptionShort: string;
  descriptionLong: string;
  broadType: BroadType;
  habitatTags: string[];
  substrateTags: string[];
  seasonTags: string[];
  colorTags: string[];
  shapeTags: string[];
  textureTags: string[];
  keyTraits: string[];
  expertClues: string[];
  confusionWarnings: string[];
  compareWithIds: string[];
  rarityTier: RarityTier;
  encounterRarity: string;
  idDifficulty: IdDifficulty;
  pointsValue: number;
  missionTags: string[];
  images: ImageAsset[];
  sourceNotes: string;
  inDex: boolean;
}

// ─── User Data ───────────────────────────────────────────────────────────────

export interface UserFind {
  id: string;
  mushroomEntryId: string;
  dateFound: string; // ISO date string
  locationNote: string;
  userNotes: string;
  userPhotoPaths: string[];
  biomeTag: string;
  confirmedByUser: boolean;
}

export interface MysteryObservation {
  id: string;
  date: string;
  locationNote: string;
  photos: string[];
  substrate: string;
  growthPattern: string;
  overallForm: string;
  undersideType: string;
  capShape: string;
  stemFeatures: string[];
  colorPrimary: string;
  colorSecondary: string;
  textureTags: string[];
  smellNote: string;
  bruisingNote: string;
  sizeClass: string;
  notes: string;
  likelyBroadType: string;
  suggestedMushroomIds: string[];
  pointsAwarded: number;
  resolvedToEntryId: string | null;
}

// ─── Missions & Badges ───────────────────────────────────────────────────────

export interface Mission {
  id: string;
  title: string;
  description: string;
  missionType: MissionType;
  criteria: Record<string, unknown>;
  rewardPoints: number;
  rewardBadge: string | null;
  active: boolean;
  seasonalWindow: string | null;
  repeatable: boolean;
  difficultyTier: 'Beginner' | 'Explorer' | 'Naturalist' | 'Expert';
}

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  unlockCriteria: Record<string, unknown>;
  pointsBonus: number;
}

// ─── Learn ───────────────────────────────────────────────────────────────────

export interface QuizQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface LearnLesson {
  id: string;
  title: string;
  topic: string;
  body: string;
  images: ImageAsset[];
  quizQuestions: QuizQuestion[];
  unlockTier: ProgressionStage;
}

// ─── User Profile ────────────────────────────────────────────────────────────

export interface UserProfile {
  name: string;
  level: ProgressionStage;
  totalPoints: number;
  unlockedBadges: string[];
  completedMissions: string[];
  completedLessons: string[];
  preferences: Record<string, unknown>;
}

// ─── Stage thresholds ────────────────────────────────────────────────────────

export const STAGE_THRESHOLDS: Record<ProgressionStage, number> = {
  Explorer: 0,
  Observer: 150,
  Naturalist: 500,
  'Junior Expert': 1200,
};

export function getStageForPoints(points: number): ProgressionStage {
  if (points >= STAGE_THRESHOLDS['Junior Expert']) return 'Junior Expert';
  if (points >= STAGE_THRESHOLDS['Naturalist']) return 'Naturalist';
  if (points >= STAGE_THRESHOLDS['Observer']) return 'Observer';
  return 'Explorer';
}
