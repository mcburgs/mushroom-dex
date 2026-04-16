import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { defineSecret } from 'firebase-functions/params';

initializeApp();
const db = getFirestore();
const geminiApiKey = defineSecret('GEMINI_API_KEY');

// ── Constants ────────────────────────────────────────────────────────────────

const GEMINI_MODEL = 'gemini-2.5-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;
const MAX_AI_CALLS_PER_DAY = 50;
const MAX_IMAGE_BASE64_LENGTH = 800_000; // ~600 KB decoded

// ── Enum allowlists (must match src/constants/fieldId.ts exactly) ────────────

const VALID_OVERALL_FORM = ['bracket', 'cap', 'puffball', 'coral', 'jelly', 'cup', 'tooth', 'trumpet', 'crust'];
const VALID_CAP_SHAPE = ['convex', 'flat', 'funnel', 'conical'];
const VALID_UNDERSIDE_TYPE = ['gills', 'pores', 'ridges', 'smooth', 'teeth'];
const VALID_COLOR_PRIMARY = ['white', 'cream', 'yellow', 'orange', 'brown', 'red', 'grey', 'purple', 'green'];
const VALID_SUBSTRATE = ['dead wood', 'living tree', 'soil', 'grass', 'dung'];
const VALID_GROWTH_PATTERN = ['solitary', 'clustered', 'ring', 'scattered'];
const VALID_SIZE_CLASS = ['tiny', 'small', 'medium', 'large'];

function validateEnum(value: unknown, allowlist: string[]): string | null {
  if (typeof value !== 'string') return null;
  return allowlist.includes(value) ? value : null;
}

// ── Safety filter ────────────────────────────────────────────────────────────

const SAFETY_BLOCKLIST = [
  'edible', 'safe to eat', 'good to eat', 'will kill',
];

function sanitizeAiText(text: string): string | null {
  const lower = text.toLowerCase();
  for (const term of SAFETY_BLOCKLIST) {
    if (lower.includes(term)) return null;
  }
  return text;
}

// ── Per-user rate limiter (call AFTER successful AI completion) ───────────────

async function incrementRateLimit(uid: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`users/${uid}/aiUsage/${today}`);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (snap.exists) {
      tx.update(ref, { count: FieldValue.increment(1) });
    } else {
      tx.set(ref, { count: 1 });
    }
  });
}

async function checkRateLimit(uid: string): Promise<void> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = db.doc(`users/${uid}/aiUsage/${today}`);
  const snap = await ref.get();
  const current = snap.exists ? (snap.data()?.count as number) ?? 0 : 0;
  if (current >= MAX_AI_CALLS_PER_DAY) {
    throw new HttpsError('resource-exhausted', 'Daily AI limit reached.');
  }
}

// ── Gemini API helper ────────────────────────────────────────────────────────

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

interface GeminiCallOptions {
  responseMimeType?: string;
  responseSchema?: Record<string, unknown>;
}

interface GeminiResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
}

async function callGemini(
  apiKey: string,
  parts: GeminiPart[],
  options?: GeminiCallOptions
): Promise<string> {
  const body = {
    contents: [{ parts }],
    generationConfig: {
      temperature: 0.3,
      maxOutputTokens: 1024,
      ...(options?.responseMimeType ? { responseMimeType: options.responseMimeType } : {}),
      ...(options?.responseSchema ? { responseSchema: options.responseSchema } : {}),
    },
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => 'unknown');
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = (await response.json()) as GeminiResponse;
  const responseParts = data.candidates?.[0]?.content?.parts ?? [];
  const text = responseParts
    .map((part) => (typeof part.text === 'string' ? part.text : ''))
    .join('')
    .trim();

  if (!text) throw new Error('Gemini returned no text');
  return text;
}

type JsonParseStage = 'direct' | 'cleaned' | 'extracted' | 'field_extract' | 'fallback';

function truncateForLog(text: string, maxLength = 260): string {
  const compact = text.replace(/\s+/g, ' ').trim();
  return compact.length > maxLength ? `${compact.slice(0, maxLength)}...` : compact;
}

function stripMarkdownFences(text: string): string {
  return text.replace(/```[\w-]*\s*/gi, '').replace(/```/g, '').trim();
}

function extractFirstJsonObject(text: string): string | null {
  const start = text.indexOf('{');
  if (start < 0) return null;

  let depth = 0;
  let inString = false;
  let escaping = false;

  for (let i = start; i < text.length; i++) {
    const ch = text[i];

    if (inString) {
      if (escaping) {
        escaping = false;
      } else if (ch === '\\') {
        escaping = true;
      } else if (ch === '"') {
        inString = false;
      }
      continue;
    }

    if (ch === '"') {
      inString = true;
      continue;
    }
    if (ch === '{') {
      depth += 1;
      continue;
    }
    if (ch === '}') {
      depth -= 1;
      if (depth === 0) {
        return text.slice(start, i + 1).trim();
      }
    }
  }

  return null;
}

function parseJsonWithFallback<T>(rawText: string): { parsed: T; stage: JsonParseStage } {
  try {
    return { parsed: JSON.parse(rawText) as T, stage: 'direct' };
  } catch {
    // Continue with fallback stages.
  }

  const cleaned = stripMarkdownFences(rawText);
  try {
    return { parsed: JSON.parse(cleaned) as T, stage: 'cleaned' };
  } catch {
    // Continue with extraction fallback.
  }

  const extracted = extractFirstJsonObject(cleaned);
  if (extracted) {
    return { parsed: JSON.parse(extracted) as T, stage: 'extracted' };
  }

  throw new Error('Failed to parse JSON after all fallback stages.');
}

function extractQuotedField(rawText: string, fieldName: string): string | null {
  const keyPattern = new RegExp(`"${fieldName}"\\s*:\\s*"`, 'i');
  const keyMatch = keyPattern.exec(rawText);
  if (!keyMatch) return null;

  let i = (keyMatch.index ?? 0) + keyMatch[0].length;
  let escaping = false;
  let out = '';

  while (i < rawText.length) {
    const ch = rawText[i];
    if (escaping) {
      out += ch;
      escaping = false;
      i += 1;
      continue;
    }
    if (ch === '\\') {
      out += ch;
      escaping = true;
      i += 1;
      continue;
    }
    if (ch === '"') {
      return out
        .replace(/\\n/g, '\n')
        .replace(/\\r/g, '\r')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\')
        .trim();
    }
    out += ch;
    i += 1;
  }

  return null;
}

function extractTrailInsightsFields(rawText: string): { fieldBriefing?: string; speciesSpotlight?: string } | null {
  const source = stripMarkdownFences(rawText);
  const fieldBriefing = extractQuotedField(source, 'fieldBriefing');
  const speciesSpotlight = extractQuotedField(source, 'speciesSpotlight');

  if (!fieldBriefing && !speciesSpotlight) return null;
  return { fieldBriefing: fieldBriefing ?? undefined, speciesSpotlight: speciesSpotlight ?? undefined };
}

// ── analyzeMushroomPhoto ─────────────────────────────────────────────────────

const PHOTO_ANALYSIS_PROMPT = `You are a mushroom morphology assistant. Analyze this photo and return a JSON object.
Use ONLY the exact values listed for each field. Return null for fields you cannot determine.

{
  "overallForm": one of ["bracket","cap","puffball","coral","jelly","cup","tooth","trumpet","crust"] or null,
  "capShape": one of ["convex","flat","funnel","conical"] or null,
  "undersideType": one of ["gills","pores","ridges","smooth","teeth"] or null,
  "colorPrimary": one of ["white","cream","yellow","orange","brown","red","grey","purple","green"] or null,
  "substrate": one of ["dead wood","living tree","soil","grass","dung"] or null,
  "growthPattern": one of ["solitary","clustered","ring","scattered"] or null,
  "sizeClass": one of ["tiny","small","medium","large"] or null,
  "confidenceNote": string (brief note on what visual features you used or why confidence is limited),
  "lowConfidence": boolean (true if photo quality, angle, or lighting makes analysis unreliable)
}

Return ONLY valid JSON. No explanation, no markdown, no text outside the JSON object.`;

interface PhotoAnalysisRaw {
  overallForm?: unknown;
  capShape?: unknown;
  undersideType?: unknown;
  colorPrimary?: unknown;
  substrate?: unknown;
  growthPattern?: unknown;
  sizeClass?: unknown;
  confidenceNote?: unknown;
  lowConfidence?: unknown;
}

interface PhotoAnalysisResult {
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

function buildFallbackPhotoAnalysis(): PhotoAnalysisResult {
  return {
    overallForm: null,
    capShape: null,
    undersideType: null,
    colorPrimary: null,
    substrate: null,
    growthPattern: null,
    sizeClass: null,
    confidenceNote: 'AI could not confidently parse the response. Review traits manually.',
    lowConfidence: true,
  };
}

function normalizePhotoAnalysis(raw: PhotoAnalysisRaw): PhotoAnalysisResult {
  const result: PhotoAnalysisResult = {
    overallForm: validateEnum(raw.overallForm, VALID_OVERALL_FORM),
    capShape: validateEnum(raw.capShape, VALID_CAP_SHAPE),
    undersideType: validateEnum(raw.undersideType, VALID_UNDERSIDE_TYPE),
    colorPrimary: validateEnum(raw.colorPrimary, VALID_COLOR_PRIMARY),
    substrate: validateEnum(raw.substrate, VALID_SUBSTRATE),
    growthPattern: validateEnum(raw.growthPattern, VALID_GROWTH_PATTERN),
    sizeClass: validateEnum(raw.sizeClass, VALID_SIZE_CLASS),
    confidenceNote: '',
    lowConfidence: typeof raw.lowConfidence === 'boolean' ? raw.lowConfidence : true,
  };

  if (typeof raw.confidenceNote === 'string' && raw.confidenceNote.length > 0) {
    const safe = sanitizeAiText(raw.confidenceNote);
    result.confidenceNote = safe ?? '';
  }

  return result;
}

export const analyzeMushroomPhoto = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const { imageBase64, mimeType } = request.data as {
      imageBase64?: string;
      mimeType?: string;
    };

    if (!imageBase64 || typeof imageBase64 !== 'string') {
      throw new HttpsError('invalid-argument', 'imageBase64 required.');
    }
    if (imageBase64.length > MAX_IMAGE_BASE64_LENGTH) {
      throw new HttpsError('invalid-argument', 'Image too large. Max ~600KB.');
    }

    // Check rate limit before calling Gemini (reject early if over limit)
    await checkRateLimit(request.auth.uid);

    const apiKey = geminiApiKey.value();

    const rawText = await callGemini(
      apiKey,
      [
        { text: PHOTO_ANALYSIS_PROMPT },
        {
          inlineData: {
            mimeType: mimeType || 'image/jpeg',
            data: imageBase64,
          },
        },
      ],
      { responseMimeType: 'application/json' }
    );

    let raw: PhotoAnalysisRaw;
    let parseStage: JsonParseStage = 'direct';
    try {
      const parseResult = parseJsonWithFallback<PhotoAnalysisRaw>(rawText);
      raw = parseResult.parsed;
      parseStage = parseResult.stage;
      if (parseStage !== 'direct') {
        console.warn(
          `[analyzeMushroomPhoto] Parsed AI response after fallback stage=${parseStage}. snippet="${truncateForLog(rawText)}"`
        );
      }
    } catch {
      console.warn(
        `[analyzeMushroomPhoto] Failed to parse AI response; using deterministic fallback. rawSnippet="${truncateForLog(rawText)}"`
      );
      raw = buildFallbackPhotoAnalysis();
      parseStage = 'fallback';
    }

    const result = normalizePhotoAnalysis(raw);

    // Increment rate limit AFTER successful completion
    await incrementRateLimit(request.auth.uid);

    return result;
  }
);

// ── generateTrailInsights ────────────────────────────────────────────────────

interface TrailInsightsInput {
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

function buildTrailInsightsPrompt(input: TrailInsightsInput): string {
  const bestBetList = input.bestBetNames.join(', ');
  const sp = input.spotlightSpecies;
  return `You are an expert mycologist. Return a JSON object with exactly two string fields.

Current conditions:
- Season: ${input.season}
- Conditions: ${input.conditionLabel}
- Habitat: ${input.habitatLabel}
- Rainfall last 5 days: ${input.rainLastFiveDaysMm}mm
- Rainfall last 3 days: ${input.rainLastThreeDaysMm}mm
- Today's temperature: ${input.tempMinC}°C to ${input.tempMaxC}°C
- Top species likely today: ${bestBetList}
- Forager skill level: ${input.userLevel}
${input.locationName ? `- Location: ${input.locationName}` : ''}

Spotlight species: ${sp.commonName} (${sp.scientificName})
- Type: ${sp.broadType}
- Key traits: ${sp.keyTraits.join(', ')}
- Typical habitat: ${sp.habitatTags.join(', ')}

Return this JSON structure:
{
  "fieldBriefing": "<3-4 sentence field briefing. Be specific about what these weather numbers mean for fungal activity right now. Name the most promising microhabitat feature to target in a ${input.habitatLabel} habitat. Include one timing or seasonal note relevant to the species listed.${input.locationName ? ` If you recognize ${input.locationName} as a specific natural area, park, or conservation land, incorporate what you know about its characteristic ecology or fungal species. Otherwise use the regional mycology context.` : ''} Match depth and terminology to a ${input.userLevel} skill level. Second person, present tense. No edibility or safety claims.>",
  "speciesSpotlight": "<2-3 sentence 'how to find it today' note for ${sp.commonName}. Say where exactly to look in the habitat given today's conditions. Name one distinguishing visual trait that helps confirm the ID in the field. One sentence on timing, substrate preference, or growth trigger if relevant. No edibility or safety claims. Second person, present tense.>"
}

Return ONLY valid JSON. No explanation, no markdown, no text outside the JSON object.`;
}

interface TrailInsightsOutput {
  fieldBriefing: string | null;
  speciesSpotlight: string | null;
}

function isIncompleteNarrative(text: string): boolean {
  const trimmed = text.trim();
  if (trimmed.length < 80) return true;
  // Require terminal sentence punctuation to avoid mid-sentence cutoffs.
  if (!/[.!?]["')\]]?$/.test(trimmed)) return true;
  return false;
}

function normalizeTrailInsights(parsed: { fieldBriefing?: string | null; speciesSpotlight?: string | null }): TrailInsightsOutput {
  const result: TrailInsightsOutput = {
    fieldBriefing: null,
    speciesSpotlight: null,
  };

  if (parsed.fieldBriefing && typeof parsed.fieldBriefing === 'string') {
    result.fieldBriefing = sanitizeAiText(parsed.fieldBriefing);
  }
  if (parsed.speciesSpotlight && typeof parsed.speciesSpotlight === 'string') {
    result.speciesSpotlight = sanitizeAiText(parsed.speciesSpotlight);
  }

  return result;
}

function buildFallbackTrailInsights(input: TrailInsightsInput): TrailInsightsOutput {
  const rainfallSummary = `${Math.round(input.rainLastFiveDaysMm)}mm over 5 days`;
  const temperatureSummary = `${Math.round(input.tempMinC)}°C to ${Math.round(input.tempMaxC)}°C`;
  const primaryBestBet = input.bestBetNames[0] ?? input.spotlightSpecies.commonName;
  const habitatPhrase = input.habitatLabel.toLowerCase();

  return {
    fieldBriefing:
      `Current conditions are ${input.conditionLabel.toLowerCase()} for ${input.season.toLowerCase()} (${rainfallSummary}, ${temperatureSummary})${input.locationName ? ` in ${input.locationName}` : ''}. ` +
      `In ${habitatPhrase}, focus first on damp substrate transitions like shaded edges, woody debris, and sheltered ground cover. ` +
      `Prioritize fresh, moist patches early in the day and use ${primaryBestBet} as your lead indicator species.`,
    speciesSpotlight:
      `For ${input.spotlightSpecies.commonName}, check ${habitatPhrase} pockets with stable moisture and nearby organic material. ` +
      `Confirm using visible traits such as ${input.spotlightSpecies.keyTraits.slice(0, 2).join(' and ') || 'overall shape and surface texture'}. ` +
      `After cool nights, new fruiting is most likely where humidity stays trapped near the substrate.`,
  };
}

const TRAIL_INSIGHTS_RESPONSE_SCHEMA: Record<string, unknown> = {
  type: 'object',
  properties: {
    fieldBriefing: { type: 'string' },
    speciesSpotlight: { type: 'string' },
  },
  required: ['fieldBriefing', 'speciesSpotlight'],
};

export const generateTrailInsights = onCall(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 20,
    secrets: [geminiApiKey],
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required.');
    }

    const input = request.data as TrailInsightsInput;

    // Check rate limit before calling Gemini
    await checkRateLimit(request.auth.uid);

    const apiKey = geminiApiKey.value();
    const prompt = buildTrailInsightsPrompt(input);
    const rawText = await callGemini(
      apiKey,
      [{ text: prompt }],
      {
        responseMimeType: 'application/json',
        responseSchema: TRAIL_INSIGHTS_RESPONSE_SCHEMA,
      }
    );

    let parsed: { fieldBriefing?: string | null; speciesSpotlight?: string | null };
    let parseStage: JsonParseStage = 'direct';
    try {
      const parseResult = parseJsonWithFallback<{ fieldBriefing?: string; speciesSpotlight?: string }>(rawText);
      parsed = parseResult.parsed;
      parseStage = parseResult.stage;
      if (parseStage !== 'direct') {
        console.warn(
          `[generateTrailInsights] Parsed AI response after fallback stage=${parseStage}. snippet="${truncateForLog(rawText)}"`
        );
      }
    } catch {
      const extractedFields = extractTrailInsightsFields(rawText);
      if (extractedFields) {
        parsed = extractedFields;
        parseStage = 'field_extract';
        console.warn(
          `[generateTrailInsights] Recovered AI response via stage=${parseStage}. snippet="${truncateForLog(rawText)}"`
        );
      } else {
        console.warn(
          `[generateTrailInsights] Failed to parse AI response; using deterministic fallback. rawSnippet="${truncateForLog(rawText)}"`
        );
        parsed = buildFallbackTrailInsights(input);
        parseStage = 'fallback';
      }
    }

    const result = normalizeTrailInsights(parsed);
    const deterministicFallback = buildFallbackTrailInsights(input);

    if (result.fieldBriefing && isIncompleteNarrative(result.fieldBriefing)) {
      console.warn(
        `[generateTrailInsights] Replacing incomplete fieldBriefing from stage=${parseStage}. snippet="${truncateForLog(result.fieldBriefing)}"`
      );
      result.fieldBriefing = deterministicFallback.fieldBriefing;
    }
    if (result.speciesSpotlight && isIncompleteNarrative(result.speciesSpotlight)) {
      console.warn(
        `[generateTrailInsights] Replacing incomplete speciesSpotlight from stage=${parseStage}. snippet="${truncateForLog(result.speciesSpotlight)}"`
      );
      result.speciesSpotlight = deterministicFallback.speciesSpotlight;
    }

    // Increment rate limit AFTER successful completion
    await incrementRateLimit(request.auth.uid);

    return result;
  }
);

export const __testing = {
  parseJsonWithFallback,
  extractTrailInsightsFields,
  buildFallbackTrailInsights,
  buildFallbackPhotoAnalysis,
  normalizePhotoAnalysis,
  normalizeTrailInsights,
  sanitizeAiText,
};
