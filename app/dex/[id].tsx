import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MushroomEntry, UserFind } from '../../src/types';
import { getFind, addUserFind, updateUserFind } from '../../src/storage/userFinds';
import { addPoints } from '../../src/storage/userProfile';
import mushroomData from '../../data/mushrooms.json';

const RARITY_COLOUR: Record<string, string> = {
  'Common': '#8a8a7a',
  'Uncommon': '#5a7a3a',
  'Special Find': '#8b6914',
  'Rare Find': '#8b3a14',
  'Lucky Find': '#6a1a8b',
};

function SectionHeader({ title }: { title: string }) {
  return <Text style={styles.sectionHeader}>{title}</Text>;
}

function TraitList({ items }: { items: string[] }) {
  return (
    <View style={styles.traitList}>
      {items.map((item, i) => (
        <View key={i} style={styles.traitRow}>
          <Text style={styles.traitBullet}>•</Text>
          <Text style={styles.traitText}>{item}</Text>
        </View>
      ))}
    </View>
  );
}

function TagRow({ tags }: { tags: string[] }) {
  return (
    <View style={styles.tagRow}>
      {tags.map((tag, i) => (
        <View key={i} style={styles.tag}>
          <Text style={styles.tagText}>{tag}</Text>
        </View>
      ))}
    </View>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = (mushroomData as MushroomEntry[]).find((m) => m.id === id);

  const [find, setFind] = useState<UserFind | null>(null);
  const [notes, setNotes] = useState('');
  const [notesEditing, setNotesEditing] = useState(false);
  const [justMarked, setJustMarked] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      getFind(id).then((f) => {
        if (!active) return;
        setFind(f);
        setNotes(f?.userNotes ?? '');
      });
      return () => { active = false; };
    }, [id])
  );

  if (!entry) {
    return (
      <View style={styles.notFound}>
        <Text style={styles.notFoundText}>Mushroom not found.</Text>
      </View>
    );
  }

  const heroImage = entry.images.find((img) => img.isHero);

  async function handleMarkFound() {
    const newFind: UserFind = {
      id: `find-${entry!.id}-${Date.now()}`,
      mushroomEntryId: entry!.id,
      dateFound: new Date().toISOString(),
      locationNote: '',
      userNotes: '',
      userPhotoPaths: [],
      biomeTag: '',
      confirmedByUser: true,
    };
    const updatedFinds = await addUserFind(newFind);
    const thisFind = updatedFinds.find((f) => f.mushroomEntryId === entry!.id) ?? newFind;
    await addPoints(entry!.pointsValue);
    setFind(thisFind);
    setJustMarked(true);
    Alert.alert(
      `+${entry!.pointsValue} points!`,
      `You found ${entry!.commonName}! Added to your collection.`,
      [{ text: 'Awesome!' }]
    );
  }

  async function handleSaveNotes() {
    if (!find) return;
    await updateUserFind(find.id, { userNotes: notes });
    setFind({ ...find, userNotes: notes });
    setNotesEditing(false);
  }

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
        {/* Hero image */}
        <View style={styles.heroContainer}>
          {heroImage ? (
            <Image
              source={{ uri: heroImage.urlOrLocalPath }}
              style={styles.heroImage}
              resizeMode="cover"
            />
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroEmoji}>🍄</Text>
            </View>
          )}
        </View>

        {/* Names */}
        <View style={styles.namesSection}>
          <Text style={styles.commonName}>{entry.commonName}</Text>
          <Text style={styles.scientificName}>{entry.scientificName}</Text>
          {entry.alternateNames.length > 0 && (
            <Text style={styles.altNames}>
              Also called: {entry.alternateNames.join(', ')}
            </Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{entry.broadType}</Text>
            </View>
            <Text style={[styles.rarityText, { color: RARITY_COLOUR[entry.rarityTier] ?? '#8a8a7a' }]}>
              ● {entry.rarityTier}
            </Text>
            <Text style={styles.pointsText}>+{entry.pointsValue} pts</Text>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.tagsSection}>
          <TagRow tags={entry.seasonTags.map((t) => `🗓️ ${t}`)} />
          <TagRow tags={entry.habitatTags.map((t) => `🌲 ${t}`)} />
          <TagRow tags={entry.substrateTags.map((t) => `🪵 ${t}`)} />
        </View>

        {/* Description */}
        <View style={styles.card}>
          <SectionHeader title="About" />
          <Text style={styles.descriptionShort}>{entry.descriptionShort}</Text>
          <Text style={styles.descriptionLong}>{entry.descriptionLong}</Text>
        </View>

        {/* What to notice */}
        {entry.keyTraits.length > 0 && (
          <View style={styles.card}>
            <SectionHeader title="What to Notice" />
            <TraitList items={entry.keyTraits} />
          </View>
        )}

        {/* Expert clues */}
        {entry.expertClues.length > 0 && (
          <View style={styles.card}>
            <SectionHeader title="What Experts Notice" />
            <TraitList items={entry.expertClues} />
          </View>
        )}

        {/* Confusion warnings */}
        {entry.confusionWarnings.length > 0 && (
          <View style={[styles.card, styles.warningCard]}>
            <SectionHeader title="⚠️ Don't Confuse With" />
            <TraitList items={entry.confusionWarnings} />
          </View>
        )}

        {/* Attribution */}
        {heroImage && heroImage.attribution && (
          <Text style={styles.attribution}>
            Photo: {heroImage.attribution}
          </Text>
        )}

        {/* Mark found / notes */}
        <View style={styles.card}>
          {!find ? (
            <>
              <SectionHeader title="Found it?" />
              <Text style={styles.findPrompt}>
                Mark this mushroom when you've spotted it in the wild!
              </Text>
              <TouchableOpacity style={styles.markButton} onPress={handleMarkFound}>
                <Text style={styles.markButtonText}>Mark as Found 🍄</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.foundHeader}>
                <Text style={styles.foundBadgeLabel}>✓ Found!</Text>
                <Text style={styles.foundDate}>
                  {new Date(find.dateFound).toLocaleDateString('en-CA', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>
              <SectionHeader title="Your Notes" />
              {notesEditing ? (
                <>
                  <TextInput
                    style={styles.notesInput}
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                    placeholder="What did you notice? Where did you find it?"
                    placeholderTextColor="#bbb"
                    autoFocus
                  />
                  <View style={styles.notesActions}>
                    <TouchableOpacity style={styles.saveButton} onPress={handleSaveNotes}>
                      <Text style={styles.saveButtonText}>Save Notes</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.cancelButton}
                      onPress={() => { setNotes(find.userNotes); setNotesEditing(false); }}
                    >
                      <Text style={styles.cancelButtonText}>Cancel</Text>
                    </TouchableOpacity>
                  </View>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.notesDisplay}
                  onPress={() => setNotesEditing(true)}
                >
                  <Text style={notes ? styles.notesText : styles.notesPlaceholder}>
                    {notes || 'Tap to add notes about your find…'}
                  </Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  content: {},
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 18, color: '#8a8a7a' },
  heroContainer: { width: '100%', height: 240, backgroundColor: '#e8f5d8' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 80 },
  namesSection: { padding: 16, paddingBottom: 0 },
  commonName: { fontSize: 26, fontWeight: '800', color: '#2d4a1a', lineHeight: 32 },
  scientificName: { fontSize: 16, fontStyle: 'italic', color: '#5a7a3a', marginTop: 4 },
  altNames: { fontSize: 13, color: '#8a8a7a', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 10 },
  typeChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#2d4a1a' },
  rarityText: { fontSize: 13, fontWeight: '600' },
  pointsText: { fontSize: 13, color: '#8b6914', fontWeight: '700' },
  tagsSection: { paddingHorizontal: 16, paddingTop: 12, gap: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  tag: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  tagText: { fontSize: 12, color: '#5a7a3a' },
  card: {
    backgroundColor: '#fff',
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginTop: 14,
    borderWidth: 1,
    borderColor: '#e8e8d8',
  },
  warningCard: { borderColor: '#f5c8a0', backgroundColor: '#fff8f0' },
  sectionHeader: {
    fontSize: 15,
    fontWeight: '700',
    color: '#2d4a1a',
    marginBottom: 8,
  },
  descriptionShort: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a3a2a',
    lineHeight: 22,
    marginBottom: 10,
  },
  descriptionLong: { fontSize: 14, color: '#5a5a4a', lineHeight: 21 },
  traitList: { gap: 8 },
  traitRow: { flexDirection: 'row', gap: 8 },
  traitBullet: { color: '#5a7a3a', fontSize: 15, lineHeight: 21 },
  traitText: { flex: 1, fontSize: 14, color: '#3a3a2a', lineHeight: 21 },
  attribution: {
    fontSize: 11,
    color: '#b0b0a0',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },
  findPrompt: { fontSize: 14, color: '#8a8a7a', marginBottom: 14, lineHeight: 20 },
  markButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  markButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  foundHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 14,
    backgroundColor: '#e8f5d8',
    borderRadius: 10,
    padding: 12,
  },
  foundBadgeLabel: { fontSize: 16, fontWeight: '700', color: '#2d4a1a' },
  foundDate: { fontSize: 13, color: '#5a7a3a' },
  notesDisplay: {
    minHeight: 60,
    backgroundColor: '#f4f4ec',
    borderRadius: 10,
    padding: 12,
  },
  notesText: { fontSize: 14, color: '#3a3a2a', lineHeight: 20 },
  notesPlaceholder: { fontSize: 14, color: '#bbb', fontStyle: 'italic' },
  notesInput: {
    minHeight: 80,
    backgroundColor: '#f4f4ec',
    borderRadius: 10,
    padding: 12,
    fontSize: 14,
    color: '#3a3a2a',
    lineHeight: 20,
    textAlignVertical: 'top',
  },
  notesActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  saveButton: {
    flex: 1,
    backgroundColor: '#5a7a3a',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  cancelButton: {
    flex: 1,
    backgroundColor: '#e8e8d8',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  cancelButtonText: { color: '#5a5a4a', fontSize: 14, fontWeight: '600' },
  bottomPad: { height: 32 },
});
