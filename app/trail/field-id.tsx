import React, { useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import CandidateStrip from '../../src/components/CandidateStrip';
import DangerBanner from '../../src/components/DangerBanner';
import {
  CAP_SHAPE_OPTS,
  COLOR_OPTS,
  EMPTY_FIELD_ID_DRAFT,
  FieldIdDraft,
  FORM_OPTS,
  GROWTH_OPTS,
  QUICK_ID_STEPS,
  SIZE_OPTS,
  STEP_QUESTIONS,
  SUBSTRATE_OPTS,
  UNDERSIDE_OPTS,
  computeBroadType,
  getVisibleSteps,
  optionLabel,
} from '../../src/constants/fieldId';
import {
  buildDistinguishCopy,
  detectDangerWarnings,
  getConfidenceLabel,
  getRankedFieldIdCandidates,
} from '../../src/utils/fieldIdEngine';
import { addMysteryLogWithPoints } from '../../src/storage/mysteryLogs';
import { addUserFindWithPoints } from '../../src/storage/userFinds';
import { getUserProfile } from '../../src/storage/userProfile';
import { analyzeMushroomPhoto } from '../../src/utils/geminiClient';
import { MysteryObservation, MushroomEntry, MushroomPhotoAnalysis, UserFind } from '../../src/types';

const FULL_POINTS = 15;
const QUICK_POINTS = 8;
const STEP_FIELD_KEY: Record<number, keyof FieldIdDraft | null> = {
  0: 'substrate',
  1: 'growthPattern',
  2: 'overallForm',
  3: 'capShape',
  4: 'undersideType',
  5: 'colorPrimary',
  6: 'sizeClass',
  7: null,
};

function OptionList({
  options,
  selected,
  onSelect,
  aiSuggested,
}: {
  options: { label: string; emoji: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
  aiSuggested?: boolean;
}) {
  return (
    <View>
      {options.map((option) => {
        const active = selected === option.value;
        return (
          <TouchableOpacity
            key={option.value}
            style={[styles.optionRow, active && styles.optionRowActive]}
            onPress={() => onSelect(option.value)}
          >
            <Text style={styles.optionEmoji}>{option.emoji}</Text>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>{option.label}</Text>
            {active && aiSuggested ? <Text style={styles.optionAiBadge}>✦ AI</Text> : null}
            {active && !aiSuggested ? <Text style={styles.optionCheck}>✓</Text> : null}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

function ResultCandidate({
  entry,
  score,
  onPress,
}: {
  entry: MushroomEntry;
  score: number;
  onPress: () => void;
}) {
  const hero = entry.images.find((image) => image.isHero);
  return (
    <TouchableOpacity style={styles.resultCard} onPress={onPress}>
      <View style={styles.resultImageWrap}>
        {hero ? (
          <Image source={{ uri: hero.urlOrLocalPath }} style={styles.resultImage} resizeMode="cover" />
        ) : (
          <View style={styles.resultImageFallback}>
            <Text style={styles.resultImageFallbackText}>M</Text>
          </View>
        )}
      </View>
      <View style={styles.resultBody}>
        <Text style={styles.resultName}>{entry.commonName}</Text>
        <Text style={styles.resultScientific}>{entry.scientificName}</Text>
        <Text style={styles.resultConfidence}>{getConfidenceLabel(score)}</Text>
        <View style={styles.keyTraitRow}>
          {entry.keyTraits.slice(0, 3).map((trait) => (
            <Text key={trait} style={styles.keyTraitChip}>
              {trait}
            </Text>
          ))}
        </View>
        {entry.expertClues[0] ? <Text style={styles.resultCheck}>Check: {entry.expertClues[0]}</Text> : null}
      </View>
    </TouchableOpacity>
  );
}

export default function FieldIdScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ fromTrail?: string }>();
  const fromTrail = params.fromTrail === '1';
  const [draft, setDraft] = useState<FieldIdDraft>(EMPTY_FIELD_ID_DRAFT);
  const [step, setStep] = useState(0);
  const [quickId, setQuickId] = useState(false);
  const [phase, setPhase] = useState<'intro' | 'questions' | 'result'>('intro');
  const [savedPoints, setSavedPoints] = useState(FULL_POINTS);
  const [finishing, setFinishing] = useState(false);
  const [decisionSaving, setDecisionSaving] = useState(false);
  const [decisionComplete, setDecisionComplete] = useState<null | 'approved' | 'review' | 'discarded'>(null);
  const [pendingObservation, setPendingObservation] = useState<MysteryObservation | null>(null);
  const [resolvedCandidateId, setResolvedCandidateId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<MushroomPhotoAnalysis | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiPopulatedFields, setAiPopulatedFields] = useState<Set<string>>(new Set());

  const visibleSteps = useMemo(() => {
    const base = getVisibleSteps(draft);
    return base.filter((s) => {
      if (s === step) return true;
      if (s === 7) return true;
      const key = STEP_FIELD_KEY[s];
      if (!key) return true;
      return !draft[key];
    });
  }, [draft, step]);
  const currentStepIndex = visibleSteps.indexOf(step);
  const questionIndex = quickId ? step : currentStepIndex;
  const progressTotal = quickId ? QUICK_ID_STEPS.length : visibleSteps.length;
  const candidates = useMemo(() => getRankedFieldIdCandidates(draft, 5), [draft]);
  const resultCandidates = useMemo(() => getRankedFieldIdCandidates(draft, 3), [draft]);
  const warnings = useMemo(() => detectDangerWarnings(resultCandidates), [resultCandidates]);
  const distinguish = useMemo(() => buildDistinguishCopy(resultCandidates), [resultCandidates]);
  const topAiCandidate = useMemo(() => {
    if (candidates.length === 0) return null;
    return candidates[0];
  }, [candidates]);

  function updateDraft<K extends keyof FieldIdDraft>(key: K, value: FieldIdDraft[K]) {
    setDraft((current) => ({ ...current, [key]: value }));
  }

  function resetToFullMode() {
    setQuickId(false);
    setStep(0);
    setPhase('intro');
    setDraft(EMPTY_FIELD_ID_DRAFT);
    setAnalysisResult(null);
    setAiPopulatedFields(new Set());
    setAnalyzing(false);
    setDecisionSaving(false);
    setDecisionComplete(null);
    setPendingObservation(null);
    setResolvedCandidateId(null);
  }

  function switchToQuickId() {
    setQuickId(true);
    setPhase('questions');
    setDraft(EMPTY_FIELD_ID_DRAFT);
    setStep(0);
    setAnalysisResult(null);
    setAiPopulatedFields(new Set());
    setAnalyzing(false);
    setDecisionSaving(false);
    setDecisionComplete(null);
    setPendingObservation(null);
    setResolvedCandidateId(null);
  }

  function getFirstPendingStep(nextDraft: FieldIdDraft): number {
    const base = getVisibleSteps(nextDraft);
    const pending = base.filter((s) => {
      if (s === 7) return true;
      const key = STEP_FIELD_KEY[s];
      if (!key) return true;
      return !nextDraft[key];
    });
    return pending[0] ?? 7;
  }

  function startQuestionsFromCurrentDraft() {
    setStep(getFirstPendingStep(draft));
    setPhase('questions');
  }

  async function addPhoto(source: 'camera' | 'library', options?: { analyzeImmediately?: boolean }) {
    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (permission.status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access so you can attach a photo to this observation.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] })
        : await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            quality: 0.7,
            allowsEditing: true,
            aspect: [4, 3],
          });

    if (!result.canceled && result.assets[0]) {
      const uri = result.assets[0].uri;
      updateDraft('photos', [uri]);
      // Clear previous AI analysis when photos change
      setAnalysisResult(null);
      setAiPopulatedFields(new Set());
      if (options?.analyzeImmediately) {
        await runPhotoAnalysisForUri(uri);
      }
    }
  }

  function buildAiWriteup(result: MushroomPhotoAnalysis): string {
    const traits: string[] = [];
    if (result.overallForm) traits.push(`overall form looks ${result.overallForm}`);
    if (result.undersideType) traits.push(`underside appears ${result.undersideType}`);
    if (result.capShape) traits.push(`cap shape looks ${result.capShape}`);
    if (result.colorPrimary) traits.push(`primary color appears ${result.colorPrimary}`);
    if (result.substrate) traits.push(`it may be on ${result.substrate}`);
    if (result.sizeClass) traits.push(`size seems ${result.sizeClass}`);
    const traitLine =
      traits.length > 0
        ? `AI observations: ${traits.slice(0, 4).join(', ')}.`
        : 'AI observations were limited from this image.';

    const candidateLine = topAiCandidate
      ? `Most likely match from current signals: ${topAiCandidate.entry.commonName} (${topAiCandidate.entry.scientificName}).`
      : 'No confident species candidate yet from current signals.';

    return `${traitLine} ${candidateLine}`.trim();
  }

  async function runPhotoAnalysisForUri(uri: string) {
    if (analyzing) return;
    // Clear previous AI state before re-analyzing
    setAnalysisResult(null);
    setAiPopulatedFields(new Set());
    setAnalyzing(true);
    try {
      const result = await analyzeMushroomPhoto(uri);
      if (!result) {
        setAnalyzing(false);
        return;
      }
      setAnalysisResult(result);

      // Auto-populate form fields from AI result when present. On low confidence,
      // values are usually null and no fields will be populated.
      const populated = new Set<string>();
      const updates: Partial<FieldIdDraft> = {};

      if (result.overallForm) { updates.overallForm = result.overallForm; populated.add('overallForm'); }
      if (result.capShape) { updates.capShape = result.capShape; populated.add('capShape'); }
      if (result.undersideType) { updates.undersideType = result.undersideType; populated.add('undersideType'); }
      if (result.colorPrimary) { updates.colorPrimary = result.colorPrimary; populated.add('colorPrimary'); }
      if (result.substrate) { updates.substrate = result.substrate; populated.add('substrate'); }
      if (result.growthPattern) { updates.growthPattern = result.growthPattern; populated.add('growthPattern'); }
      if (result.sizeClass) { updates.sizeClass = result.sizeClass; populated.add('sizeClass'); }

      if (Object.keys(updates).length > 0) {
        setDraft((current) => ({ ...current, ...updates, photos: [uri] }));
        setAiPopulatedFields(populated);
      }
      setAnalyzing(false);
    } catch {
      setAnalyzing(false);
    }
  }

  async function handleAnalyzePhoto() {
    if (analyzing || draft.photos.length === 0) return;
    await runPhotoAnalysisForUri(draft.photos[0]);
  }

  async function finishFieldId() {
    if (finishing) return;
    setFinishing(true);

    let lat: number | undefined;
    let lng: number | undefined;

    try {
      try {
        const permission = await Location.requestForegroundPermissionsAsync();
        if (permission.status === 'granted') {
          const position = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = position.coords.latitude;
          lng = position.coords.longitude;
        }
      } catch {
        lat = undefined;
        lng = undefined;
      }

      const pointsAwarded = quickId ? QUICK_POINTS : FULL_POINTS;
      const observation: MysteryObservation = {
        id: `mystery-${Date.now()}`,
        date: new Date().toISOString(),
        locationNote: draft.locationNote,
        photos: draft.photos,
        substrate: draft.substrate,
        growthPattern: draft.growthPattern,
        overallForm: draft.overallForm,
        undersideType: draft.undersideType,
        capShape: draft.capShape,
        stemFeatures: [],
        colorPrimary: draft.colorPrimary,
        colorSecondary: '',
        textureTags: [],
        smellNote: '',
        bruisingNote: '',
        sizeClass: draft.sizeClass,
        notes: draft.notes,
        likelyBroadType: computeBroadType(draft),
        suggestedMushroomIds: resultCandidates.map((candidate) => candidate.entry.id),
        pointsAwarded,
        resolvedToEntryId: null,
        reviewStatus: 'active',
        lat,
        lng,
      };

      setSavedPoints(pointsAwarded);
      setPendingObservation(observation);
      setResolvedCandidateId(resultCandidates[0]?.entry.id ?? null);
      setDecisionComplete(null);
      setPhase('result');
    } catch (error) {
      console.warn('[field-id] finishFieldId failed:', error);
      Alert.alert('Error', 'Could not save observation. Please try again.');
      setFinishing(false);
    }
  }

  function advance() {
    if (finishing) return;
    if (quickId) {
      if (step >= 2) {
        void finishFieldId();
      } else {
        setStep((current) => current + 1);
      }
      return;
    }

    if (currentStepIndex >= visibleSteps.length - 1) {
      void finishFieldId();
    } else {
      setStep(visibleSteps[currentStepIndex + 1]);
    }
  }

  function retreat() {
    if (finishing) return;
    if (phase === 'result') {
      setPhase('questions');
      return;
    }
    if (phase === 'intro') {
      router.back();
      return;
    }

    if (quickId) {
      if (step === 0) {
        router.back();
      } else {
        setStep((current) => current - 1);
      }
      return;
    }

    if (currentStepIndex <= 0) {
      router.back();
    } else {
      setStep(visibleSteps[currentStepIndex - 1]);
    }
  }

  function goToDex(id: string) {
    router.push(`/dex/${id}`);
  }

  function getSeason(date: Date): 'spring' | 'summer' | 'fall' | 'winter' {
    const m = date.getMonth() + 1;
    if (m >= 3 && m <= 5) return 'spring';
    if (m >= 6 && m <= 8) return 'summer';
    if (m >= 9 && m <= 11) return 'fall';
    return 'winter';
  }

  async function handleApproveSuggestion() {
    if (decisionSaving || !pendingObservation) return;
    if (resultCandidates.length === 0) {
      Alert.alert('No suggestion available', 'There is no strong match to approve yet. Leave this for review instead.');
      return;
    }

    setDecisionSaving(true);
    try {
      const best = resultCandidates[0].entry;
      const season = getSeason(new Date());
      let bonus = 0;
      if (pendingObservation.photos.length > 0) bonus += 5;
      if (pendingObservation.notes.trim().length > 0) bonus += 3;
      if ((best.seasonTags as string[]).includes(season)) bonus += 10;
      const total = best.pointsValue + bonus;

      const find: UserFind = {
        id: `find-${best.id}-${Date.now()}`,
        mushroomEntryId: best.id,
        dateFound: pendingObservation.date,
        locationNote: pendingObservation.locationNote,
        userNotes: pendingObservation.notes,
        userPhotoPaths: pendingObservation.photos,
        biomeTag: pendingObservation.substrate || pendingObservation.likelyBroadType || '',
        confirmedByUser: true,
        lat: pendingObservation.lat,
        lng: pendingObservation.lng,
      };

      await addUserFindWithPoints(find, total);
      await addMysteryLogWithPoints(
        {
          ...pendingObservation,
          resolvedToEntryId: best.id,
          reviewStatus: 'approved',
          pointsAwarded: 0,
        },
        0
      );
      await getUserProfile({ force: true });
      setResolvedCandidateId(best.id);
      setDecisionComplete('approved');
    } catch (error) {
      console.warn('[field-id] approve suggestion failed:', error);
      Alert.alert('Could not approve', 'Please try again.');
    } finally {
      setDecisionSaving(false);
    }
  }

  async function handleLeaveForReview() {
    if (decisionSaving || !pendingObservation) return;
    setDecisionSaving(true);
    try {
      await addMysteryLogWithPoints(
        {
          ...pendingObservation,
          resolvedToEntryId: null,
          reviewStatus: 'active',
        },
        savedPoints
      );
      await getUserProfile({ force: true });
      setDecisionComplete('review');
    } catch (error) {
      console.warn('[field-id] leave for review failed:', error);
      Alert.alert('Could not save for review', 'Please try again.');
    } finally {
      setDecisionSaving(false);
    }
  }

  function handleDiscardSuggestion() {
    if (decisionSaving) return;
    setDecisionComplete('discarded');
  }

  const questionTitle = quickId ? QUICK_ID_STEPS[step] : STEP_QUESTIONS[step];
  const progressPct = Math.round((((questionIndex >= 0 ? questionIndex : 0) + 1) / Math.max(progressTotal, 1)) * 100);

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <View style={styles.topHeader}>
        <View style={styles.topHeaderText}>
          <Text style={styles.topHeaderTitle}>{quickId ? 'Quick ID' : 'Field ID'}</Text>
          <Text style={styles.topHeaderSub}>
            {quickId ? 'Fewer signals, less precise.' : 'Live identification while you are on the trail.'}
          </Text>
        </View>
        <TouchableOpacity style={styles.quickButton} onPress={quickId ? resetToFullMode : switchToQuickId}>
          <Text style={styles.quickButtonText}>{quickId ? 'Full ID' : 'Quick ID'}</Text>
        </TouchableOpacity>
      </View>

      <CandidateStrip candidates={candidates} enabled={!quickId && phase === 'questions'} />

      {phase === 'intro' && !quickId ? (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            <Text style={styles.stepQuestion}>Do you have a photo?</Text>
            <Text style={styles.introSub}>
              Start with a photo for quick trait suggestions. We will prefill what the image can support and only ask the remaining questions.
            </Text>
            <Text style={styles.introDisclaimer}>
              AI can make mistakes. Always review every suggested field before you continue.
            </Text>

            <View style={styles.photoRow}>
              <TouchableOpacity style={styles.photoButton} onPress={() => void addPhoto('camera', { analyzeImmediately: true })}>
                <Text style={styles.photoButtonEmoji}>📷</Text>
                <Text style={styles.photoButtonText}>Take Photo</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.photoButton} onPress={() => void addPhoto('library', { analyzeImmediately: true })}>
                <Text style={styles.photoButtonEmoji}>🖼️</Text>
                <Text style={styles.photoButtonText}>Upload Photo</Text>
              </TouchableOpacity>
            </View>

            {draft.photos.length > 0 ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                {draft.photos.map((uri) => (
                  <View key={uri} style={styles.thumbContainer}>
                    <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                    <TouchableOpacity
                      style={styles.thumbRemove}
                      onPress={() => {
                        updateDraft('photos', []);
                        setAnalysisResult(null);
                        setAiPopulatedFields(new Set());
                      }}
                    >
                      <Text style={styles.thumbRemoveText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                ))}
              </ScrollView>
            ) : null}

            {analyzing ? (
              <View style={styles.analyzeRow}>
                <ActivityIndicator size="small" color="#5a7a3a" />
                <Text style={styles.analyzingText}>Analyzing photo...</Text>
              </View>
            ) : analysisResult ? (
              <View style={styles.aiResultBanner}>
                <Text style={styles.aiResultText}>{buildAiWriteup(analysisResult)}</Text>
                <Text style={styles.aiConfidenceNote}>
                  {analysisResult.lowConfidence
                    ? "Image confidence is low. We'll ask more questions to improve accuracy."
                    : `AI prefilled ${aiPopulatedFields.size} field${aiPopulatedFields.size !== 1 ? 's' : ''}.`}
                </Text>
              </View>
            ) : null}

            <TouchableOpacity style={[styles.analyzeButton, { marginTop: 14 }]} onPress={startQuestionsFromCurrentDraft}>
              <Text style={styles.analyzeButtonText}>No photo - answer questions</Text>
            </TouchableOpacity>
            <View style={styles.bottomSpacer} />
          </ScrollView>
          <View style={styles.navBar}>
            <TouchableOpacity onPress={retreat} style={styles.navButton}>
              <Text style={styles.navButtonText}>Back</Text>
            </TouchableOpacity>
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>Step 0 of {progressTotal}</Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: '0%' }]} />
              </View>
            </View>
            <TouchableOpacity onPress={startQuestionsFromCurrentDraft} style={[styles.navButton, styles.navButtonPrimary]}>
              <Text style={styles.navButtonPrimaryText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : phase === 'questions' ? (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
            {analysisResult !== null ? (
              <DangerBanner
                title="⚠️ AI Safety Notice"
                message="AI suggestions are a starting point only. Never eat or handle a mushroom based on AI or app identification alone. Always verify with an expert."
              />
            ) : null}
            <Text style={styles.stepQuestion}>{questionTitle}</Text>

            {!quickId && step === 0 ? (
              <OptionList options={SUBSTRATE_OPTS} selected={draft.substrate} onSelect={(value) => updateDraft('substrate', value)} aiSuggested={aiPopulatedFields.has('substrate')} />
            ) : null}
            {!quickId && step === 1 ? (
              <OptionList options={GROWTH_OPTS} selected={draft.growthPattern} onSelect={(value) => updateDraft('growthPattern', value)} aiSuggested={aiPopulatedFields.has('growthPattern')} />
            ) : null}
            {!quickId && step === 2 ? (
              <OptionList options={FORM_OPTS} selected={draft.overallForm} onSelect={(value) => updateDraft('overallForm', value)} aiSuggested={aiPopulatedFields.has('overallForm')} />
            ) : null}
            {!quickId && step === 3 ? (
              <OptionList options={CAP_SHAPE_OPTS} selected={draft.capShape} onSelect={(value) => updateDraft('capShape', value)} aiSuggested={aiPopulatedFields.has('capShape')} />
            ) : null}
            {!quickId && step === 4 ? (
              <OptionList options={UNDERSIDE_OPTS} selected={draft.undersideType} onSelect={(value) => updateDraft('undersideType', value)} aiSuggested={aiPopulatedFields.has('undersideType')} />
            ) : null}
            {!quickId && step === 5 ? (
              <OptionList options={COLOR_OPTS} selected={draft.colorPrimary} onSelect={(value) => updateDraft('colorPrimary', value)} aiSuggested={aiPopulatedFields.has('colorPrimary')} />
            ) : null}
            {!quickId && step === 6 ? (
              <OptionList options={SIZE_OPTS} selected={draft.sizeClass} onSelect={(value) => updateDraft('sizeClass', value)} aiSuggested={aiPopulatedFields.has('sizeClass')} />
            ) : null}
            {!quickId && step === 7 ? (
              <View>
                <Text style={styles.fieldLabel}>Where did you find it? (optional)</Text>
                <TextInput
                  style={styles.textInput}
                  value={draft.locationNote}
                  onChangeText={(value) => updateDraft('locationNote', value)}
                  placeholder="e.g. Dundas Valley, near the creek…"
                  placeholderTextColor="#b0b0a0"
                />

                <Text style={styles.fieldLabel}>Field notes (optional)</Text>
                <TextInput
                  style={[styles.textInput, styles.notesInput]}
                  value={draft.notes}
                  onChangeText={(value) => updateDraft('notes', value)}
                  placeholder="Smell, bruising, texture, anything else you noticed…"
                  placeholderTextColor="#b0b0a0"
                  multiline
                  textAlignVertical="top"
                />

                <Text style={styles.fieldLabel}>Photos (optional)</Text>
                <View style={styles.photoRow}>
                  <TouchableOpacity style={styles.photoButton} onPress={() => void addPhoto('camera')}>
                    <Text style={styles.photoButtonEmoji}>📷</Text>
                    <Text style={styles.photoButtonText}>Camera</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.photoButton} onPress={() => void addPhoto('library')}>
                    <Text style={styles.photoButtonEmoji}>🖼️</Text>
                    <Text style={styles.photoButtonText}>Library</Text>
                  </TouchableOpacity>
                </View>
                {draft.photos.length > 0 ? (
                  <>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
                      {draft.photos.map((uri) => (
                        <View key={uri} style={styles.thumbContainer}>
                          <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                          <TouchableOpacity
                            style={styles.thumbRemove}
                            onPress={() => {
                              updateDraft('photos', draft.photos.filter((photo) => photo !== uri));
                              setAnalysisResult(null);
                              setAiPopulatedFields(new Set());
                            }}
                          >
                            <Text style={styles.thumbRemoveText}>✕</Text>
                          </TouchableOpacity>
                        </View>
                      ))}
                    </ScrollView>
                    {analyzing ? (
                      <View style={styles.analyzeRow}>
                        <ActivityIndicator size="small" color="#5a7a3a" />
                        <Text style={styles.analyzingText}>Analyzing photo…</Text>
                      </View>
                    ) : analysisResult && !analysisResult.lowConfidence ? (
                      <View style={styles.aiResultBanner}>
                        <Text style={styles.aiResultText}>
                          ✦ AI filled {aiPopulatedFields.size} field{aiPopulatedFields.size !== 1 ? 's' : ''}. Review and adjust before finishing.
                        </Text>
                        {analysisResult.confidenceNote ? (
                          <Text style={styles.aiConfidenceNote}>{analysisResult.confidenceNote}</Text>
                        ) : null}
                      </View>
                    ) : analysisResult && analysisResult.lowConfidence ? (
                      <View style={styles.aiResultBanner}>
                        <Text style={styles.aiResultText}>
                          Couldn't read this photo clearly — fill in what you can.
                        </Text>
                      </View>
                    ) : (
                      <TouchableOpacity style={styles.analyzeButton} onPress={() => void handleAnalyzePhoto()}>
                        <Text style={styles.analyzeButtonText}>Analyze Photo 🔍</Text>
                      </TouchableOpacity>
                    )}
                  </>
                ) : null}

                {aiPopulatedFields.size > 0 ? (
                  <View style={styles.aiFieldSummary}>
                    <Text style={styles.aiFieldSummaryTitle}>✦ AI-suggested fields</Text>
                    {aiPopulatedFields.has('overallForm') && draft.overallForm ? (
                      <Text style={styles.aiFieldItem}>Form: {draft.overallForm}</Text>
                    ) : null}
                    {aiPopulatedFields.has('capShape') && draft.capShape ? (
                      <Text style={styles.aiFieldItem}>Cap: {draft.capShape}</Text>
                    ) : null}
                    {aiPopulatedFields.has('undersideType') && draft.undersideType ? (
                      <Text style={styles.aiFieldItem}>Underside: {draft.undersideType}</Text>
                    ) : null}
                    {aiPopulatedFields.has('colorPrimary') && draft.colorPrimary ? (
                      <Text style={styles.aiFieldItem}>Color: {draft.colorPrimary}</Text>
                    ) : null}
                    {aiPopulatedFields.has('substrate') && draft.substrate ? (
                      <Text style={styles.aiFieldItem}>Substrate: {draft.substrate}</Text>
                    ) : null}
                    {aiPopulatedFields.has('growthPattern') && draft.growthPattern ? (
                      <Text style={styles.aiFieldItem}>Growth: {draft.growthPattern}</Text>
                    ) : null}
                    {aiPopulatedFields.has('sizeClass') && draft.sizeClass ? (
                      <Text style={styles.aiFieldItem}>Size: {draft.sizeClass}</Text>
                    ) : null}
                  </View>
                ) : null}
              </View>
            ) : null}

            {quickId && step === 0 ? (
              <OptionList options={FORM_OPTS} selected={draft.overallForm} onSelect={(value) => updateDraft('overallForm', value)} />
            ) : null}
            {quickId && step === 1 ? (
              <OptionList options={COLOR_OPTS} selected={draft.colorPrimary} onSelect={(value) => updateDraft('colorPrimary', value)} />
            ) : null}
            {quickId && step === 2 ? (
              <OptionList options={SUBSTRATE_OPTS} selected={draft.substrate} onSelect={(value) => updateDraft('substrate', value)} />
            ) : null}
            <View style={styles.bottomSpacer} />
          </ScrollView>

          <View style={styles.navBar}>
            <TouchableOpacity onPress={retreat} style={styles.navButton} disabled={finishing}>
              <Text style={[styles.navButtonText, finishing && styles.navButtonDisabledText]}>Back</Text>
            </TouchableOpacity>
            <View style={styles.progressWrap}>
              <Text style={styles.progressLabel}>
                Step {(questionIndex >= 0 ? questionIndex : 0) + 1} of {progressTotal}
              </Text>
              <View style={styles.progressBar}>
                <View style={[styles.progressFill, { width: `${progressPct}%` }]} />
              </View>
            </View>
            <TouchableOpacity
              onPress={advance}
              style={[styles.navButton, styles.navButtonPrimary, finishing && styles.navButtonDisabled]}
              disabled={finishing}
            >
              <Text style={styles.navButtonPrimaryText}>
                {(quickId && step === 2) || (!quickId && currentStepIndex === visibleSteps.length - 1) ? 'Done' : 'Next'}
              </Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <DangerBanner warnings={warnings} />

          <View style={styles.pointsBanner}>
            <Text style={styles.pointsEmoji}>🎉</Text>
            <Text style={styles.pointsTitle}>Review Suggestion</Text>
            <Text style={styles.pointsSub}>Choose what to do with this ID suggestion</Text>
          </View>

          <View style={styles.summaryCard}>
            <Text style={styles.summaryHeading}>What you observed</Text>
            <View style={styles.summaryChips}>
              {draft.overallForm ? <Text style={styles.summaryChip}>{optionLabel(FORM_OPTS, draft.overallForm)}</Text> : null}
              {draft.colorPrimary ? <Text style={styles.summaryChip}>{optionLabel(COLOR_OPTS, draft.colorPrimary)}</Text> : null}
              {draft.sizeClass ? <Text style={styles.summaryChip}>{optionLabel(SIZE_OPTS, draft.sizeClass).split(' — ')[0]}</Text> : null}
              {draft.substrate ? <Text style={styles.summaryChip}>{optionLabel(SUBSTRATE_OPTS, draft.substrate)}</Text> : null}
            </View>
          </View>

          {resultCandidates.length === 0 ? (
            <View style={styles.noMatchCard}>
              <Text style={styles.noMatchTitle}>No close matches in the Dex</Text>
              <Text style={styles.noMatchText}>
                Your observation has been logged. Try the full Dex browse or come back after adding more detail.
              </Text>
              <TouchableOpacity style={styles.dexButton} onPress={() => router.push('/(tabs)/dex')}>
                <Text style={styles.dexButtonText}>Browse the Dex</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <Text style={styles.resultHeading}>Top candidates</Text>
              <ResultCandidate
                entry={resultCandidates[0].entry}
                score={resultCandidates[0].score}
                onPress={() => goToDex(resultCandidates[0].entry.id)}
              />
              {distinguish ? (
                <View style={styles.compareCard}>
                  <Text style={styles.compareTitle}>{distinguish.title}</Text>
                  <Text style={styles.compareBody}>{resultCandidates[0].entry.commonName}: {distinguish.left}</Text>
                  <Text style={styles.compareBody}>{resultCandidates[1].entry.commonName}: {distinguish.right}</Text>
                </View>
              ) : null}
              {resultCandidates.slice(1).map((candidate) => (
                <ResultCandidate
                  key={candidate.entry.id}
                  entry={candidate.entry}
                  score={candidate.score}
                  onPress={() => goToDex(candidate.entry.id)}
                />
              ))}
            </>
          )}

          {decisionComplete === null ? (
            <View style={styles.decisionCard}>
              <Text style={styles.decisionTitle}>What do you want to do?</Text>
              <Text style={styles.decisionBody}>
                Approve adds the top suggestion to your Collection with your photo. Leave for review keeps this mystery active in Mystery Log. Discard skips saving.
              </Text>
              <TouchableOpacity
                style={[styles.doneButton, decisionSaving && styles.navButtonDisabled]}
                onPress={() => void handleApproveSuggestion()}
                disabled={decisionSaving}
              >
                <Text style={styles.doneButtonText}>
                  {decisionSaving ? 'Saving...' : resultCandidates.length > 0 ? 'Approve Suggestion' : 'No Suggestion to Approve'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.reviewButton, decisionSaving && styles.navButtonDisabled]}
                onPress={() => void handleLeaveForReview()}
                disabled={decisionSaving}
              >
                <Text style={styles.reviewButtonText}>{decisionSaving ? 'Saving...' : 'Leave for Review (+points)'}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.discardButton, decisionSaving && styles.navButtonDisabled]}
                onPress={handleDiscardSuggestion}
                disabled={decisionSaving}
              >
                <Text style={styles.discardButtonText}>Discard</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <>
              <View style={styles.decisionCard}>
                {decisionComplete === 'approved' ? (
                  <Text style={styles.decisionBody}>
                    Approved. Added to your Collection{resolvedCandidateId ? ' and linked to this observation' : ''}.
                  </Text>
                ) : null}
                {decisionComplete === 'review' ? (
                  <Text style={styles.decisionBody}>
                    Saved for review. This observation is now marked Active Review in Mystery Log so you can revisit later.
                  </Text>
                ) : null}
                {decisionComplete === 'discarded' ? (
                  <Text style={styles.decisionBody}>
                    Discarded. Nothing was added to Collection or Mystery Log.
                  </Text>
                ) : null}
              </View>
              <TouchableOpacity
                style={styles.doneButton}
                onPress={() => router.replace(fromTrail ? '/(tabs)/trail' : '/(tabs)/mystery')}
              >
                <Text style={styles.doneButtonText}>{fromTrail ? 'Back to Trail' : 'Back to Mystery Log'}</Text>
              </TouchableOpacity>
            </>
          )}
          <View style={styles.bottomSpacer} />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
    backgroundColor: '#f9f6f0',
    gap: 12,
  },
  topHeaderText: { flex: 1, paddingRight: 4 },
  topHeaderTitle: { fontSize: 22, fontWeight: '800', color: '#2d4a1a' },
  topHeaderSub: { fontSize: 13, color: '#5a7a3a', marginTop: 2, lineHeight: 18, flexWrap: 'wrap' },
  quickButton: {
    borderWidth: 1,
    borderColor: '#5a7a3a',
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: '#fff',
    alignSelf: 'flex-start',
  },
  quickButtonText: { color: '#5a7a3a', fontWeight: '700', fontSize: 13 },
  scroll: { flex: 1 },
  content: { padding: 16 },
  stepQuestion: { fontSize: 20, fontWeight: '800', color: '#2d4a1a', marginBottom: 18, lineHeight: 26 },
  introSub: { fontSize: 14, color: '#5a5a4a', lineHeight: 20, marginBottom: 8, flexWrap: 'wrap' },
  introDisclaimer: { fontSize: 13, color: '#8b6914', lineHeight: 19, marginBottom: 16, flexWrap: 'wrap' },
  optionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 16,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  optionRowActive: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  optionEmoji: { fontSize: 22, marginRight: 14, width: 28 },
  optionLabel: { flex: 1, fontSize: 15, color: '#2d4a1a', fontWeight: '600' },
  optionLabelActive: { color: '#fff' },
  optionCheck: { color: '#fff', fontWeight: '800', fontSize: 16 },
  optionAiBadge: {
    color: '#d4e8b8',
    fontSize: 11,
    fontWeight: '700',
  },
  fieldLabel: { fontSize: 14, fontWeight: '700', color: '#2d4a1a', marginBottom: 8, marginTop: 16 },
  textInput: {
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 15,
    color: '#2d4a1a',
  },
  notesInput: { height: 100, textAlignVertical: 'top' },
  photoRow: { flexDirection: 'row', marginBottom: 12 },
  photoButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 14,
    alignItems: 'center',
    marginRight: 10,
  },
  photoButtonEmoji: { fontSize: 26, marginBottom: 4 },
  photoButtonText: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },
  thumbContainer: { marginRight: 10, position: 'relative' },
  thumb: { width: 100, height: 100, borderRadius: 10 },
  thumbRemove: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.55)',
    borderRadius: 10,
    width: 20,
    height: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  navBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#d4e8b8',
    backgroundColor: '#f9f6f0',
  },
  navButton: {
    minWidth: 72,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 12,
    paddingHorizontal: 12,
    alignItems: 'center',
    backgroundColor: '#fff',
  },
  navButtonPrimary: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  navButtonDisabled: { backgroundColor: '#a0a090', borderColor: '#a0a090' },
  navButtonText: { color: '#2d4a1a', fontWeight: '700', fontSize: 14 },
  navButtonDisabledText: { color: '#8a8a7a' },
  navButtonPrimaryText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  progressWrap: { flex: 1, paddingHorizontal: 12 },
  progressLabel: { textAlign: 'center', fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  progressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8f5d8',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: { height: '100%', backgroundColor: '#5a7a3a' },
  pointsBanner: {
    backgroundColor: '#2d4a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsEmoji: { fontSize: 36, marginBottom: 8 },
  pointsTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  pointsSub: { fontSize: 15, color: '#d4e8b8' },
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 14,
    marginBottom: 16,
  },
  summaryHeading: { fontSize: 13, fontWeight: '700', color: '#8a8a7a', marginBottom: 10 },
  summaryChips: { flexDirection: 'row', flexWrap: 'wrap' },
  summaryChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 5,
    fontSize: 13,
    color: '#2d4a1a',
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 6,
    overflow: 'hidden',
  },
  resultHeading: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 12 },
  resultCard: {
    backgroundColor: '#fff',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    overflow: 'hidden',
    marginBottom: 12,
  },
  resultImageWrap: { width: '100%', height: 140, backgroundColor: '#e8f5d8' },
  resultImage: { width: '100%', height: '100%' },
  resultImageFallback: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  resultImageFallbackText: { fontSize: 28, fontWeight: '700', color: '#5a7a3a' },
  resultBody: { padding: 14 },
  resultName: { fontSize: 18, fontWeight: '800', color: '#2d4a1a' },
  resultScientific: { fontSize: 13, color: '#8a8a7a', fontStyle: 'italic', marginTop: 4 },
  resultConfidence: { fontSize: 13, color: '#5a7a3a', fontWeight: '700', marginTop: 8 },
  keyTraitRow: { flexDirection: 'row', flexWrap: 'wrap', marginTop: 10 },
  keyTraitChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    fontSize: 12,
    color: '#2d4a1a',
    marginRight: 6,
    marginBottom: 6,
    overflow: 'hidden',
  },
  resultCheck: { fontSize: 13, color: '#5a5a4a', marginTop: 10, lineHeight: 18 },
  compareCard: {
    backgroundColor: '#fffaf0',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#f0d9a6',
    padding: 14,
    marginBottom: 12,
  },
  compareTitle: { fontSize: 16, fontWeight: '700', color: '#8b6914', marginBottom: 8 },
  compareBody: { fontSize: 13, color: '#5a5a4a', lineHeight: 18, marginBottom: 6 },
  noMatchCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 16,
  },
  noMatchTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 8 },
  noMatchText: { fontSize: 14, color: '#5a5a4a', lineHeight: 20, marginBottom: 14 },
  dexButton: {
    alignSelf: 'flex-start',
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  dexButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  doneButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 10,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  decisionCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 14,
    marginTop: 8,
    marginBottom: 10,
  },
  decisionTitle: { fontSize: 16, fontWeight: '800', color: '#2d4a1a', marginBottom: 8 },
  decisionBody: { fontSize: 13, color: '#5a5a4a', lineHeight: 19 },
  reviewButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#fff4cc',
    borderWidth: 1,
    borderColor: '#e7c86e',
  },
  reviewButtonText: { color: '#7a5a00', fontSize: 15, fontWeight: '700' },
  discardButton: {
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e2d9c9',
  },
  discardButtonText: { color: '#7a7060', fontSize: 15, fontWeight: '700' },
  bottomSpacer: { height: 30 },
  analyzeButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  analyzeButtonText: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  analyzeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    gap: 10,
  },
  analyzingText: {
    fontSize: 14,
    color: '#5a7a3a',
    fontWeight: '600',
  },
  aiResultBanner: {
    backgroundColor: '#f0f7e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 14,
    marginTop: 4,
  },
  aiResultText: {
    fontSize: 13,
    color: '#2d4a1a',
    fontWeight: '600',
    lineHeight: 19,
  },
  aiConfidenceNote: {
    fontSize: 12,
    color: '#5a5a4a',
    marginTop: 6,
    fontStyle: 'italic',
  },
  aiFieldSummary: {
    backgroundColor: '#f0f7e8',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    padding: 14,
    marginTop: 14,
  },
  aiFieldSummaryTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#5a7a3a',
    marginBottom: 8,
  },
  aiFieldItem: {
    fontSize: 13,
    color: '#2d4a1a',
    paddingVertical: 2,
  },
});
