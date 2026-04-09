import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Image,
  Alert,
} from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { MysteryObservation, MushroomEntry } from '../../src/types';
import { getMysteryLogs, addMysteryLog } from '../../src/storage/mysteryLogs';
import { addPoints } from '../../src/storage/userProfile';
import mushroomData from '../../data/mushrooms.json';

// ─── Wizard option sets ───────────────────────────────────────────────────────

const SUBSTRATE_OPTS = [
  { label: 'Dead wood / log / stump', emoji: '🪵', value: 'dead wood' },
  { label: 'Living tree / bark', emoji: '🌲', value: 'living tree' },
  { label: 'Soil / forest floor', emoji: '🌱', value: 'soil' },
  { label: 'Grass / lawn', emoji: '🌿', value: 'grass' },
  { label: 'Dung / compost', emoji: '💩', value: 'dung' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

const GROWTH_OPTS = [
  { label: 'Single, on its own', emoji: '🍄', value: 'solitary' },
  { label: 'Clustered together', emoji: '👥', value: 'clustered' },
  { label: 'In a ring or arc', emoji: '⭕', value: 'ring' },
  { label: 'Scattered, a few nearby', emoji: '🌿', value: 'scattered' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

const FORM_OPTS = [
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

const CAP_SHAPE_OPTS = [
  { label: 'Rounded or dome-shaped', emoji: '⛰️', value: 'convex' },
  { label: 'Flat or plate-like', emoji: '💿', value: 'flat' },
  { label: 'Wavy or funnel-shaped', emoji: '〰️', value: 'funnel' },
  { label: 'Pointy or bell-shaped', emoji: '🔔', value: 'conical' },
  { label: 'Not sure', emoji: '❓', value: 'unknown' },
];

const UNDERSIDE_OPTS = [
  { label: 'Gills — thin blades from centre', emoji: '🍄', value: 'gills' },
  { label: 'Pores — tiny holes (spongy)', emoji: '🔵', value: 'pores' },
  { label: 'Ridges or wrinkled folds', emoji: '〰️', value: 'ridges' },
  { label: 'Smooth — no texture', emoji: '⬜', value: 'smooth' },
  { label: 'Teeth or hanging spines', emoji: '🦷', value: 'teeth' },
  { label: "Couldn't check", emoji: '❓', value: 'unknown' },
];

const COLOR_OPTS = [
  { label: 'White', emoji: '⬜', value: 'white' },
  { label: 'Cream or tan', emoji: '🟤', value: 'cream' },
  { label: 'Yellow or gold', emoji: '🟡', value: 'yellow' },
  { label: 'Orange', emoji: '🟠', value: 'orange' },
  { label: 'Brown or rusty', emoji: '🤎', value: 'brown' },
  { label: 'Red or brick red', emoji: '🔴', value: 'red' },
  { label: 'Grey or black', emoji: '⬛', value: 'grey' },
  { label: 'Purple or violet', emoji: '🟣', value: 'purple' },
  { label: 'Green', emoji: '🟢', value: 'green' },
];

const SIZE_OPTS = [
  { label: 'Tiny — smaller than a golf ball', emoji: '🔹', value: 'tiny' },
  { label: 'Small — golf ball to fist', emoji: '🔸', value: 'small' },
  { label: 'Medium — fist to dinner plate', emoji: '🟧', value: 'medium' },
  { label: 'Large — dinner plate or bigger', emoji: '🟥', value: 'large' },
];

// ─── Types ────────────────────────────────────────────────────────────────────

type Phase = 'list' | 'wizard' | 'result';

interface WizardData {
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

const EMPTY: WizardData = {
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

// ─── Step config ──────────────────────────────────────────────────────────────

const ALL_STEPS = [0, 1, 2, 3, 4, 5, 6, 7]; // 7 = notes/photo step
const STEP_QUESTIONS = [
  'Where is it growing?',
  'How is it growing?',
  'What shape is it overall?',
  'What shape is the cap?',
  'What does the underside look like?',
  'What colour is it?',
  'How big is it?',
  'Add any extra details',
];

const MYSTERY_POINTS = 15;

// ─── Suggestion engine ────────────────────────────────────────────────────────

function computeBroadType(data: WizardData): string {
  const form = FORM_OPTS.find((f) => f.value === data.overallForm);
  if (!form) return 'Other';
  if (form.value === 'cap' || form.value === 'trumpet') {
    if (data.undersideType === 'pores') return 'Boletes/Pored';
    if (data.undersideType === 'teeth') return 'Tooth';
    return 'Gilled';
  }
  return form.broadType;
}

function scoreMushroom(entry: MushroomEntry, data: WizardData): number {
  let score = 0;
  const broad = computeBroadType(data);

  // Broad type is the strongest signal
  if (entry.broadType === broad) score += 5;

  // Substrate
  if (data.substrate && data.substrate !== 'unknown') {
    const s = data.substrate.toLowerCase();
    for (const tag of entry.substrateTags) {
      const t = tag.toLowerCase();
      const match =
        t.includes(s) ||
        s.includes(t) ||
        (s === 'dead wood' && (t.includes('log') || t.includes('wood') || t.includes('stump') || t.includes('dead'))) ||
        (s === 'soil' && (t.includes('soil') || t.includes('ground') || t.includes('humus') || t.includes('duff'))) ||
        (s === 'living tree' && (t.includes('tree') || t.includes('bark') || t.includes('trunk'))) ||
        (s === 'grass' && (t.includes('grass') || t.includes('lawn') || t.includes('meadow')));
      if (match) { score += 2; break; }
    }
  }

  // Colour
  if (data.colorPrimary && data.colorPrimary !== 'unknown') {
    const c = data.colorPrimary.toLowerCase();
    for (const tag of entry.colorTags) {
      const t = tag.toLowerCase();
      const match =
        t.includes(c) ||
        (c === 'cream' && (t.includes('tan') || t.includes('buff') || t.includes('pale') || t.includes('beige'))) ||
        (c === 'brown' && (t.includes('rust') || t.includes('chestnut') || t.includes('ochre') || t.includes('tawny'))) ||
        (c === 'yellow' && (t.includes('gold') || t.includes('amber') || t.includes('ochre') || t.includes('sulphur'))) ||
        (c === 'orange' && (t.includes('orange') || t.includes('salmon') || t.includes('apricot'))) ||
        (c === 'white' && (t.includes('white') || t.includes('ivory') || t.includes('cream')));
      if (match) { score += 2; break; }
    }
  }

  return score;
}

function getSuggestions(data: WizardData): MushroomEntry[] {
  const all = mushroomData as MushroomEntry[];
  const scored = all.map((e) => ({ e, s: scoreMushroom(e, data) }));
  scored.sort((a, b) => b.s - a.s);
  return scored.filter((x) => x.s >= 3).slice(0, 3).map((x) => x.e);
}

// ─── Shared sub-component ─────────────────────────────────────────────────────

function OptionList({
  options,
  selected,
  onSelect,
}: {
  options: { label: string; emoji: string; value: string }[];
  selected: string;
  onSelect: (value: string) => void;
}) {
  return (
    <View>
      {options.map((opt) => {
        const active = selected === opt.value;
        return (
          <TouchableOpacity
            key={opt.value}
            style={[styles.optionRow, active && styles.optionRowActive]}
            onPress={() => onSelect(opt.value)}
          >
            <Text style={styles.optionEmoji}>{opt.emoji}</Text>
            <Text style={[styles.optionLabel, active && styles.optionLabelActive]}>
              {opt.label + ' '}
            </Text>
            {active && <Text style={styles.optionCheck}>✓</Text>}
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function MysteryScreen() {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('list');
  const [step, setStep] = useState(0);
  const [data, setData] = useState<WizardData>(EMPTY);
  const [logs, setLogs] = useState<MysteryObservation[]>([]);
  const [suggestions, setSuggestions] = useState<MushroomEntry[]>([]);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      getMysteryLogs().then((l) => { if (active) setLogs(l); });
      return () => { active = false; };
    }, [])
  );

  // Which steps are shown given current form selection
  function getVisibleSteps(d: WizardData): number[] {
    const steps = [0, 1, 2];
    // Cap shape — only if cap-on-stem or trumpet
    if (d.overallForm === 'cap' || d.overallForm === 'trumpet') steps.push(3);
    // Underside — skip for puffball, coral, jelly, crust, unknown, or not yet selected
    if (d.overallForm && !['puffball', 'coral', 'jelly', 'crust', 'unknown'].includes(d.overallForm)) {
      steps.push(4);
    }
    steps.push(5, 6, 7);
    return steps;
  }

  function advance() {
    const visible = getVisibleSteps(data);
    const idx = visible.indexOf(step);
    if (idx < visible.length - 1) {
      setStep(visible[idx + 1]);
    } else {
      doFinish();
    }
  }

  function retreat() {
    const visible = getVisibleSteps(data);
    const idx = visible.indexOf(step);
    if (idx <= 0) {
      setPhase('list');
    } else {
      setStep(visible[idx - 1]);
    }
  }

  function pick(field: keyof WizardData, value: string) {
    setData((d) => ({ ...d, [field]: value }));
  }

  function startWizard() {
    setData(EMPTY);
    setStep(0);
    setSuggestions([]);
    setPhase('wizard');
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow camera access to photograph your find.', [{ text: 'OK' }]);
      return;
    }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.7, allowsEditing: true, aspect: [4, 3] });
    if (!result.canceled && result.assets[0]) {
      setData((d) => ({ ...d, photos: [...d.photos, result.assets[0].uri] }));
    }
  }

  async function handleAddPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert('Permission needed', 'Allow access to your photos.', [{ text: 'OK' }]);
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setData((d) => ({ ...d, photos: [...d.photos, result.assets[0].uri] }));
    }
  }

  async function doFinish() {
    const found = getSuggestions(data);
    setSuggestions(found);

    const newLog: MysteryObservation = {
      id: `mystery-${Date.now()}`,
      date: new Date().toISOString(),
      locationNote: data.locationNote,
      photos: data.photos,
      substrate: data.substrate,
      growthPattern: data.growthPattern,
      overallForm: data.overallForm,
      undersideType: data.undersideType,
      capShape: data.capShape,
      stemFeatures: [],
      colorPrimary: data.colorPrimary,
      colorSecondary: '',
      textureTags: [],
      smellNote: '',
      bruisingNote: '',
      sizeClass: data.sizeClass,
      notes: data.notes,
      likelyBroadType: computeBroadType(data),
      suggestedMushroomIds: found.map((m) => m.id),
      pointsAwarded: MYSTERY_POINTS,
      resolvedToEntryId: null,
    };

    await addMysteryLog(newLog);
    await addPoints(MYSTERY_POINTS);
    const updated = await getMysteryLogs();
    setLogs(updated);
    setPhase('result');
  }

  // ─── Wizard header ────────────────────────────────────────────────────────

  const visible = getVisibleSteps(data);
  const stepIdx = visible.indexOf(step);
  const progressPct = visible.length > 0 ? Math.round(((stepIdx + 1) / visible.length) * 100) : 0;
  const isLastStep = stepIdx === visible.length - 1;

  // ─── LIST phase ───────────────────────────────────────────────────────────

  if (phase === 'list') {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.header}>
          <Text style={styles.title}>🔍 Mystery Finder</Text>
          <Text style={styles.subtitle}>Guided field observation</Text>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Start button */}
          <TouchableOpacity style={styles.startButton} onPress={startWizard}>
            <Text style={styles.startEmoji}>🔍</Text>
            <View style={styles.startInfo}>
              <Text style={styles.startTitle}>New Mystery Observation</Text>
              <Text style={styles.startSub}>{'Answer a few questions — earn +' + MYSTERY_POINTS + ' pts '}</Text>
            </View>
            <Text style={styles.startArrow}>{'›'}</Text>
          </TouchableOpacity>

          {/* Past logs */}
          {logs.length > 0 ? (
            <>
              <Text style={styles.sectionTitle}>Past Observations</Text>
              {logs.map((log) => {
                const formLabel = FORM_OPTS.find((f) => f.value === log.overallForm)?.label ?? log.likelyBroadType;
                const colorLabel = COLOR_OPTS.find((c) => c.value === log.colorPrimary)?.label ?? log.colorPrimary;
                return (
                  <View key={log.id} style={styles.logCard}>
                    {log.photos.length > 0 && (
                      <Image
                        source={{ uri: log.photos[0] }}
                        style={styles.logPhoto}
                        resizeMode="cover"
                      />
                    )}
                    <View style={styles.logBody}>
                      <Text style={styles.logDate}>
                        {new Date(log.date).toLocaleDateString('en-CA', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        })}
                      </Text>
                      <View style={styles.logChipRow}>
                        {formLabel ? (
                          <Text style={styles.logChip}>{formLabel + ' '}</Text>
                        ) : null}
                        {colorLabel ? (
                          <Text style={styles.logChip}>{colorLabel + ' '}</Text>
                        ) : null}
                      </View>
                      {log.locationNote ? (
                        <Text style={styles.logLocation} numberOfLines={1}>
                          {'📍 ' + log.locationNote}
                        </Text>
                      ) : null}
                      {log.suggestedMushroomIds.length > 0 ? (
                        <Text style={styles.logMatches}>
                          {log.suggestedMushroomIds.length +
                            ' possible match' +
                            (log.suggestedMushroomIds.length === 1 ? '' : 'es') +
                            ' in Dex '}
                        </Text>
                      ) : (
                        <Text style={styles.logNoMatch}>No close matches found</Text>
                      )}
                    </View>
                  </View>
                );
              })}
            </>
          ) : (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyEmoji}>🌱</Text>
              <Text style={styles.emptyTitle}>No observations yet</Text>
              <Text style={styles.emptyText}>
                Found something mysterious? Start an observation above and earn points!
              </Text>
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── WIZARD phase ─────────────────────────────────────────────────────────

  if (phase === 'wizard') {
    return (
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Wizard header */}
        <View style={styles.wizardBar}>
          <TouchableOpacity onPress={retreat} style={styles.wizardBack}>
            <Text style={styles.wizardBackText}>{'‹ Back '}</Text>
          </TouchableOpacity>
          <View style={styles.wizardCenter}>
            <Text style={styles.wizardStepLabel}>
              {'Step ' + (stepIdx + 1) + ' of ' + visible.length + ' '}
            </Text>
            <View style={styles.wizardProgressBar}>
              <View style={[styles.wizardProgressFill, { width: `${progressPct}%` }]} />
            </View>
          </View>
          <TouchableOpacity onPress={advance} style={styles.wizardNext}>
            <Text style={styles.wizardNextText}>{isLastStep ? 'Done ' : 'Next '}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          <Text style={styles.stepQuestion}>{STEP_QUESTIONS[step]}</Text>

          {step === 0 && (
            <OptionList
              options={SUBSTRATE_OPTS}
              selected={data.substrate}
              onSelect={(v) => pick('substrate', v)}
            />
          )}
          {step === 1 && (
            <OptionList
              options={GROWTH_OPTS}
              selected={data.growthPattern}
              onSelect={(v) => pick('growthPattern', v)}
            />
          )}
          {step === 2 && (
            <OptionList
              options={FORM_OPTS}
              selected={data.overallForm}
              onSelect={(v) => pick('overallForm', v)}
            />
          )}
          {step === 3 && (
            <OptionList
              options={CAP_SHAPE_OPTS}
              selected={data.capShape}
              onSelect={(v) => pick('capShape', v)}
            />
          )}
          {step === 4 && (
            <OptionList
              options={UNDERSIDE_OPTS}
              selected={data.undersideType}
              onSelect={(v) => pick('undersideType', v)}
            />
          )}
          {step === 5 && (
            <OptionList
              options={COLOR_OPTS}
              selected={data.colorPrimary}
              onSelect={(v) => pick('colorPrimary', v)}
            />
          )}
          {step === 6 && (
            <OptionList
              options={SIZE_OPTS}
              selected={data.sizeClass}
              onSelect={(v) => pick('sizeClass', v)}
            />
          )}
          {step === 7 && (
            <View>
              <Text style={styles.fieldLabel}>Where did you find it? (optional)</Text>
              <TextInput
                style={styles.textInput}
                value={data.locationNote}
                onChangeText={(v) => setData((d) => ({ ...d, locationNote: v }))}
                placeholder="e.g. Dundas Valley, near the creek…"
                placeholderTextColor="#b0b0a0"
              />

              <Text style={styles.fieldLabel}>Field notes (optional)</Text>
              <TextInput
                style={[styles.textInput, styles.notesInput]}
                value={data.notes}
                onChangeText={(v) => setData((d) => ({ ...d, notes: v }))}
                placeholder="Smell, bruising, texture, anything else you noticed…"
                placeholderTextColor="#b0b0a0"
                multiline
                textAlignVertical="top"
              />

              <Text style={styles.fieldLabel}>Photos (optional)</Text>
              <View style={styles.photoRow}>
                <TouchableOpacity style={styles.photoButton} onPress={handleTakePhoto}>
                  <Text style={styles.photoButtonEmoji}>📷</Text>
                  <Text style={styles.photoButtonText}>Camera</Text>
                </TouchableOpacity>
                <TouchableOpacity style={styles.photoButton} onPress={handleAddPhoto}>
                  <Text style={styles.photoButtonEmoji}>🖼️</Text>
                  <Text style={styles.photoButtonText}>Library</Text>
                </TouchableOpacity>
              </View>
              {data.photos.length > 0 && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                  {data.photos.map((uri) => (
                    <View key={uri} style={styles.thumbContainer}>
                      <Image source={{ uri }} style={styles.thumb} resizeMode="cover" />
                      <TouchableOpacity
                        style={styles.thumbRemove}
                        onPress={() => setData((d) => ({ ...d, photos: d.photos.filter((p) => p !== uri) }))}
                      >
                        <Text style={styles.thumbRemoveText}>✕</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </ScrollView>
              )}
            </View>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // ─── RESULT phase ─────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Points banner */}
        <View style={styles.pointsBanner}>
          <Text style={styles.pointsEmoji}>🎉</Text>
          <Text style={styles.pointsTitle}>{'+' + MYSTERY_POINTS + ' points! '}</Text>
          <Text style={styles.pointsSub}>Mystery observation logged</Text>
        </View>

        {/* Summary chips */}
        <View style={styles.summaryCard}>
          <Text style={styles.summaryHeading}>What you observed</Text>
          <View style={styles.summaryChips}>
            {data.overallForm ? (
              <Text style={styles.summaryChip}>
                {(FORM_OPTS.find((f) => f.value === data.overallForm)?.label ?? data.overallForm) + ' '}
              </Text>
            ) : null}
            {data.colorPrimary ? (
              <Text style={styles.summaryChip}>
                {(COLOR_OPTS.find((c) => c.value === data.colorPrimary)?.label ?? data.colorPrimary) + ' '}
              </Text>
            ) : null}
            {data.sizeClass ? (
              <Text style={styles.summaryChip}>
                {(SIZE_OPTS.find((s) => s.value === data.sizeClass)?.label.split(' — ')[0] ?? data.sizeClass) + ' '}
              </Text>
            ) : null}
            {data.substrate && data.substrate !== 'unknown' ? (
              <Text style={styles.summaryChip}>
                {(SUBSTRATE_OPTS.find((s) => s.value === data.substrate)?.label ?? data.substrate) + ' '}
              </Text>
            ) : null}
          </View>
        </View>

        {/* Suggestions */}
        <Text style={styles.suggestHeading}>
          {suggestions.length > 0 ? 'Possible matches in the Dex' : 'No close matches found'}
        </Text>
        {suggestions.length === 0 && (
          <Text style={styles.noMatchText}>
            Your observation does not closely match anything in the current Dex. Keep exploring!
          </Text>
        )}
        {suggestions.map((entry) => {
          const hero = entry.images.find((img) => img.isHero);
          return (
            <TouchableOpacity
              key={entry.id}
              style={styles.suggestionCard}
              onPress={() => { setPhase('list'); router.push(`/dex/${entry.id}`); }}
            >
              <View style={styles.suggestionImageBox}>
                {hero ? (
                  <Image source={{ uri: hero.urlOrLocalPath }} style={styles.suggestionImg} resizeMode="cover" />
                ) : (
                  <Text style={styles.suggestionFallback}>🍄</Text>
                )}
              </View>
              <View style={styles.suggestionBody}>
                <Text style={styles.suggestionName}>{entry.commonName}</Text>
                <Text style={styles.suggestionSci}>{entry.scientificName}</Text>
                <Text style={styles.suggestionTap}>View in Dex →</Text>
              </View>
            </TouchableOpacity>
          );
        })}

        <TouchableOpacity style={styles.doneButton} onPress={() => setPhase('list')}>
          <Text style={styles.doneButtonText}>Back to Mystery Log</Text>
        </TouchableOpacity>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: { padding: 16 },

  // List header
  header: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
  },
  title: { fontSize: 24, fontWeight: '800', color: '#2d4a1a' },
  subtitle: { fontSize: 13, color: '#5a7a3a', marginTop: 2 },

  // Start button
  startButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#5a7a3a',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
  },
  startEmoji: { fontSize: 32, marginRight: 14 },
  startInfo: { flex: 1 },
  startTitle: { fontSize: 17, fontWeight: '700', color: '#fff' },
  startSub: { fontSize: 13, color: '#c8e8a8', marginTop: 2 },
  startArrow: { fontSize: 28, color: '#fff', marginLeft: 8 },

  // Section
  sectionTitle: { fontSize: 17, fontWeight: '700', color: '#2d4a1a', marginBottom: 10 },

  // Log cards
  logCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    marginBottom: 10,
    overflow: 'hidden',
  },
  logPhoto: { width: 80, height: 80 },
  logBody: { flex: 1, padding: 12 },
  logDate: { fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  logChipRow: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 4 },
  logChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 2,
    fontSize: 11,
    color: '#2d4a1a',
    fontWeight: '600',
    marginRight: 6,
    marginBottom: 4,
    overflow: 'hidden',
    alignSelf: 'flex-start',
  },
  logLocation: { fontSize: 12, color: '#5a5a4a', marginBottom: 2 },
  logMatches: { fontSize: 12, color: '#5a7a3a', fontWeight: '600' },
  logNoMatch: { fontSize: 12, color: '#8a8a7a' },

  // Empty state
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 32,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8d8',
  },
  emptyEmoji: { fontSize: 48, marginBottom: 12 },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: '#2d4a1a', marginBottom: 8 },
  emptyText: { fontSize: 14, color: '#8a8a7a', textAlign: 'center', lineHeight: 20 },

  // Wizard bar
  wizardBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
    backgroundColor: '#f9f6f0',
  },
  wizardBack: { minWidth: 60, paddingVertical: 4 },
  wizardBackText: { fontSize: 16, color: '#5a7a3a', fontWeight: '600' },
  wizardCenter: { flex: 1, alignItems: 'center' },
  wizardStepLabel: { fontSize: 12, color: '#8a8a7a', marginBottom: 4 },
  wizardProgressBar: {
    width: '100%',
    height: 6,
    backgroundColor: '#e8f5d8',
    borderRadius: 3,
    overflow: 'hidden',
  },
  wizardProgressFill: { height: '100%', backgroundColor: '#5a7a3a', borderRadius: 3 },
  wizardNext: { minWidth: 60, paddingVertical: 4, alignItems: 'flex-end' },
  wizardNextText: { fontSize: 16, color: '#5a7a3a', fontWeight: '700' },

  // Step
  stepQuestion: { fontSize: 20, fontWeight: '800', color: '#2d4a1a', marginBottom: 20, lineHeight: 26 },

  // Options
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
  optionCheck: { fontSize: 16, color: '#fff', fontWeight: '700' },

  // Notes step
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
  photoScroll: { marginBottom: 8 },
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

  // Result — points banner
  pointsBanner: {
    backgroundColor: '#2d4a1a',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  pointsEmoji: { fontSize: 40, marginBottom: 8 },
  pointsTitle: { fontSize: 28, fontWeight: '800', color: '#fff', marginBottom: 4 },
  pointsSub: { fontSize: 15, color: '#a8d878' },

  // Result — summary
  summaryCard: {
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#e8e8d8',
    padding: 14,
    marginBottom: 20,
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
    alignSelf: 'flex-start',
  },

  // Result — suggestions
  suggestHeading: { fontSize: 17, fontWeight: '700', color: '#2d4a1a', marginBottom: 12 },
  noMatchText: { fontSize: 14, color: '#8a8a7a', lineHeight: 20, marginBottom: 16 },
  suggestionCard: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginBottom: 10,
    overflow: 'hidden',
  },
  suggestionImageBox: {
    width: 90,
    height: 90,
    backgroundColor: '#e8f5d8',
    alignItems: 'center',
    justifyContent: 'center',
  },
  suggestionImg: { width: 90, height: 90 },
  suggestionFallback: { fontSize: 40 },
  suggestionBody: { flex: 1, padding: 14, justifyContent: 'center' },
  suggestionName: { fontSize: 16, fontWeight: '700', color: '#2d4a1a' },
  suggestionSci: { fontSize: 12, color: '#8a8a7a', fontStyle: 'italic', marginTop: 2 },
  suggestionTap: { fontSize: 12, color: '#5a7a3a', fontWeight: '600', marginTop: 6 },

  // Done button
  doneButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  doneButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },

  bottomPad: { height: 32 },
});
