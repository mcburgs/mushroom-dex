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
  | 'Tracker'
  | 'Observer'
  | 'Naturalist'
  | 'Field Expert'
  | 'Mycologist'
  | 'Master Mycologist';

export type MissionType =
  | 'find'
  | 'biome'
  | 'skill'
  | 'category'
  | 'seasonal'
  | 'journal'
  | 'rarityFind';

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
  lat?: number;
  lng?: number;
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
  reviewStatus?: 'active' | 'approved' | 'discarded';
  lat?: number;
  lng?: number;
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

export interface WeeklyChallenge extends Mission {
  emoji: string;
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

export interface LessonImage {
  url: string;
  caption: string;
  credit?: string;
}

export type CurriculumTier = 1 | 2 | 3 | 4;

export type QuizQuestionType = 'mcq' | 'truefalse' | 'image_mcq' | 'match' | 'sequence';

export interface MCQQuestion {
  type: 'mcq';
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface TrueFalseQuestion {
  type: 'truefalse';
  statement: string;
  isTrue: boolean;
  explanation: string;
}

export interface ImageMCQQuestion {
  type: 'image_mcq';
  question: string;
  imageUrl: string;
  imageCaption?: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface MatchQuestion {
  type: 'match';
  instruction: string;
  pairs: Array<{ term: string; definition: string }>;
  explanation: string;
}

export interface SequenceQuestion {
  type: 'sequence';
  instruction: string;
  items: string[];
  explanation: string;
}

export type QuizQuestion =
  | MCQQuestion
  | TrueFalseQuestion
  | ImageMCQQuestion
  | MatchQuestion
  | SequenceQuestion;

export interface LearnLesson {
  id: string;
  title: string;
  topic: string;
  cat: string;
  summary: string;
  tier: CurriculumTier;
  unlockTier: ProgressionStage;
  body: string;
  images: LessonImage[];
  quizQuestions: QuizQuestion[];
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
  avatarUrl?: string;
  lastFindDate?: string; // ISO date string — updated on every find save
}

// ─── Stage thresholds ────────────────────────────────────────────────────────

export const STAGE_THRESHOLDS: Record<ProgressionStage, number> = {
  'Explorer':           0,
  'Tracker':          100,
  'Observer':         300,
  'Naturalist':       650,
  'Field Expert':   1_200,
  'Mycologist':     2_000,
  'Master Mycologist': 3_200,
};

export function getStageForPoints(points: number): ProgressionStage {
  if (points >= STAGE_THRESHOLDS['Master Mycologist']) return 'Master Mycologist';
  if (points >= STAGE_THRESHOLDS['Mycologist']) return 'Mycologist';
  if (points >= STAGE_THRESHOLDS['Field Expert']) return 'Field Expert';
  if (points >= STAGE_THRESHOLDS['Naturalist']) return 'Naturalist';
  if (points >= STAGE_THRESHOLDS['Observer']) return 'Observer';
  if (points >= STAGE_THRESHOLDS['Tracker']) return 'Tracker';
  return 'Explorer';
}

// ─── Challenges ─────────────────────────────────────────────────────────────

export type ChallengeStatus = 'pending' | 'active' | 'completed' | 'declined' | 'expired';

export interface Challenge {
  challengeId: string;
  weekKey: string;
  targetMushroomId: string;
  targetMushroomName: string;
  initiatorUid: string;
  initiatorName: string;
  inviteeUid: string;
  inviteeName: string;
  status: ChallengeStatus;
  createdAt: unknown; // Firestore Timestamp
  resolvedAt: unknown | null;
  winnerId: string | null;
  loserId: string | null;
  pointsAwarded: number;
  initiatorFoundAt: unknown | null;
  inviteeFoundAt: unknown | null;
}

// ── AI Feature Types ─────────────────────────────────────────────────────────

export interface MushroomPhotoAnalysis {
  overallForm: string | null;
  capShape: string | null;
  undersideType: string | null;
  colorPrimary: string | null;
  substrate: string | null;
  growthPattern: string | null;
  sizeClass: string | null;
  confidenceNote: string;
  lowConfidence: boolean;
}

export interface TrailInsightsParams {
  season: string;
  conditionLabel: string;
  habitatLabel: string;
  rainLastFiveDaysMm: number;
  rainLastThreeDaysMm: number;
  tempMinC: number;
  tempMaxC: number;
  bestBetNames: string[];
  spotlightSpecies: {
    commonName: string;
    scientificName: string;
    broadType: string;
    keyTraits: string[];
    habitatTags: string[];
  };
  userLevel: string;
  locationName?: string;
}

export interface TrailInsightsResult {
  fieldBriefing: string | null;
  speciesSpotlight: string | null;
}
