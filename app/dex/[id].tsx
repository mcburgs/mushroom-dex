import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Modal,
  StatusBar,
} from 'react-native';
import { Image } from 'expo-image';
import { useLocalSearchParams, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MushroomEntry, UserFind } from '../../src/types';
import { getFind, getCachedFinds, addUserFindWithPoints, updateUserFind, removeUserFind } from '../../src/storage/userFinds';
import mushroomData from '../../data/mushrooms.json';
import FindModal from '../../src/components/FindModal';

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

function TagRow({ label, tags }: { label: string; tags: string[] }) {
  if (!tags.length) return null;
  return (
    <View style={styles.tagRowContainer}>
      <Text style={styles.tagRowLabel}>{label}</Text>
      <View style={styles.tagRow}>
        {tags.map((tag, i) => (
          <View key={i} style={styles.tag}>
            <Text style={styles.tagText}>{tag + ' '}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

export default function DetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const entry = (mushroomData as MushroomEntry[]).find((m) => m.id === id);

  const [find, setFind] = useState<UserFind | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [heroError, setHeroError] = useState(false);
  const [heroLoaded, setHeroLoaded] = useState(false);
  const [lightboxVisible, setLightboxVisible] = useState(false);
  const [savingFind, setSavingFind] = useState(false);
  const [removingFind, setRemovingFind] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (!id) return;
      let active = true;
      // Sync cache lookup — avoids Firestore round-trip on every dex entry open
      const cached = getCachedFinds();
      if (cached) setFind(cached.find((f) => f.mushroomEntryId === id) ?? null);
      getFind(id).then((f) => { if (active) setFind(f); });
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

  function getSeason(d: Date): string {
    const m = d.getMonth();
    if (m >= 2 && m <= 4) return 'spring';
    if (m >= 5 && m <= 7) return 'summer';
    if (m >= 8 && m <= 10) return 'fall';
    return 'winter';
  }

  async function handleModalSave(data: {
    locationNote: string;
    biomeTag: string;
    userNotes: string;
    userPhotoPaths: string[];
    lat?: number;
    lng?: number;
  }): Promise<void> {
    if (savingFind) return;
    setSavingFind(true);
    try {
      if (find) {
        const updated = { ...find, ...data };
        await updateUserFind(find.id, data);
        setFind(updated);
      } else {
        const newFind: UserFind = {
          id: `find-${entry!.id}-${Date.now()}`,
          mushroomEntryId: entry!.id,
          dateFound: new Date().toISOString(),
          confirmedByUser: true,
          ...data,
        };

        let bonus = 0;
        if (data.userPhotoPaths?.length > 0) bonus += 5;
        if (data.userNotes?.trim().length > 0) bonus += 3;
        const season = getSeason(new Date());
        if ((entry!.seasonTags as string[]).includes(season)) bonus += 10;
        const total = entry!.pointsValue + bonus;

        const { awarded } = await addUserFindWithPoints(newFind, total);
        setFind(newFind);

        const bonusParts: string[] = [];
        if (data.userPhotoPaths?.length > 0) bonusParts.push('📷 +5');
        if (data.userNotes?.trim().length > 0) bonusParts.push('✏️ +3');
        if ((entry!.seasonTags as string[]).includes(season)) bonusParts.push('🌿 +10 seasonal');
        const bonusLine = bonusParts.length > 0 ? `\n${bonusParts.join('  ')}` : '';

        Alert.alert(
          awarded ? `+${total} points!` : 'Find updated',
          awarded 
            ? `${entry!.commonName} added to your collection!${bonusLine}`
            : `${entry!.commonName} is back in your collection. Points were already earned for this species.`,
          [{ text: 'Awesome!' }]
        );
      }
      setModalVisible(false);
    } catch (error) {
      console.warn('[Dex] Failed to save find:', error);
      Alert.alert('Could not save find', 'Please try again.');
      throw error;
    } finally {
      setSavingFind(false);
    }
  }
  function handleRemoveFind() {
    if (!find || !entry) return;
    const findToRemove = find; // capture before state change
    Alert.alert(
      'Remove from collection?',
      `This will unmark ${entry.commonName} as found and remove it from your collection log. Points already earned will stay as-is.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () => {
            if (removingFind) return;
            setRemovingFind(true);
            setFind(null);
            removeUserFind(findToRemove.id)
              .catch((e) => {
                console.warn('[FungiDex] removeUserFind failed:', e);
                setFind(findToRemove); // restore on failure
                Alert.alert('Could not remove find', 'Please try again.');
              })
              .finally(() => {
                setRemovingFind(false);
              });
          },
        },
      ]
    );
  }

  const findPhotos = find?.userPhotoPaths ?? [];

  return (
    <SafeAreaView style={styles.safe} edges={['bottom']}>
      <ScrollView style={styles.scroll}>
        {/* Reference hero image */}
        <TouchableOpacity
          activeOpacity={heroImage && !heroError ? 0.85 : 1}
          onPress={() => { if (heroImage && !heroError) setLightboxVisible(true); }}
          style={styles.heroContainer}
        >
          {heroImage && !heroError ? (
            <>
              {!heroLoaded && (
                <View style={styles.heroPlaceholder}>
                  <Text style={styles.heroEmoji}>🍄</Text>
                </View>
              )}
              <Image
                source={{ uri: heroImage.urlOrLocalPath }}
                style={[styles.heroImage, !heroLoaded && { position: 'absolute', opacity: 0 }]}
                contentFit="cover"
                onLoad={() => setHeroLoaded(true)}
                onError={() => setHeroError(true)}
              />
              {heroLoaded && (
                <View style={styles.expandBadge}>
                  <Text style={styles.expandBadgeText}>⤢</Text>
                </View>
              )}
            </>
          ) : (
            <View style={styles.heroPlaceholder}>
              <Text style={styles.heroEmoji}>🍄</Text>
            </View>
          )}
        </TouchableOpacity>

        {/* Fullscreen lightbox */}
        <Modal
          visible={lightboxVisible}
          transparent
          animationType="fade"
          onRequestClose={() => setLightboxVisible(false)}
        >
          <StatusBar hidden />
          <TouchableOpacity
            style={styles.lightboxBackdrop}
            activeOpacity={1}
            onPress={() => setLightboxVisible(false)}
          >
            <Image
              source={{ uri: heroImage?.urlOrLocalPath }}
              style={styles.lightboxImage}
              contentFit="contain"
            />
            <View style={styles.lightboxClose}>
              <Text style={styles.lightboxCloseText}>✕</Text>
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Your find photos */}
        {findPhotos.length > 0 && (
          <View style={styles.findPhotosSection}>
            <Text style={styles.findPhotosLabel}>Your photos</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {findPhotos.map((uri) => (
                <Image
                  key={uri}
                  source={{ uri }}
                  style={styles.findPhoto}
                  contentFit="cover"
                />
              ))}
            </ScrollView>
          </View>
        )}

        {/* Names */}
        <View style={styles.namesSection}>
          <Text style={styles.commonName}>{entry.commonName}</Text>
          <Text style={styles.scientificName}>{entry.scientificName}</Text>
          {entry.alternateNames.length > 0 && (
            <Text style={styles.altNames}>
              {'Also called: ' + entry.alternateNames.join(', ')}
            </Text>
          )}
          <View style={styles.metaRow}>
            <View style={styles.typeChip}>
              <Text style={styles.typeChipText}>{entry.broadType + ' '}</Text>
            </View>
            <Text style={[styles.rarityText, { color: RARITY_COLOUR[entry.rarityTier] ?? '#8a8a7a' }]}>
              {'● ' + entry.rarityTier + ' '}
            </Text>
            <Text style={styles.pointsText}>{'+' + entry.pointsValue + ' pts'}</Text>
          </View>
        </View>

        {/* Tags */}
        <View style={styles.tagsSection}>
          <TagRow label="🗓️  Season" tags={entry.seasonTags} />
          <TagRow label="🌲  Habitat" tags={entry.habitatTags} />
          <TagRow label="🪵  Substrate" tags={entry.substrateTags} />
        </View>

        {/* About */}
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
        {heroImage?.attribution ? (
          <Text style={styles.attribution}>{'Photo: ' + heroImage.attribution}</Text>
        ) : null}

        {/* Found card */}
        <View style={styles.card}>
          {!find ? (
            <>
              <SectionHeader title="Found it?" />
              <Text style={styles.findPrompt}>
                {'Found this one in the wild? Mark it and earn ' + entry.pointsValue + ' points!'}
              </Text>
              <TouchableOpacity
                style={styles.markButton}
                disabled={savingFind || removingFind}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.markButtonText}>Mark as Found 🍄</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={styles.foundHeader}>
                <Text style={styles.foundBadgeLabel}>✓ Found</Text>
                <Text style={styles.foundDate}>
                  {new Date(find.dateFound).toLocaleDateString('en-CA', {
                    month: 'long',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </Text>
              </View>

              {(find.biomeTag || find.locationNote) ? (
                <View style={styles.findDetailRow}>
                  {find.biomeTag ? (
                    <Text style={styles.findDetailChip}>{find.biomeTag + ' '}</Text>
                  ) : null}
                  {find.locationNote ? (
                    <Text style={styles.findLocationText} numberOfLines={2}>
                      {'📍 ' + find.locationNote}
                    </Text>
                  ) : null}
                </View>
              ) : null}

              {find.userNotes ? (
                <Text style={styles.findNotes}>{find.userNotes}</Text>
              ) : null}

              <TouchableOpacity
                style={styles.editButton}
                disabled={savingFind || removingFind}
                onPress={() => setModalVisible(true)}
              >
                <Text style={styles.editButtonText}>Edit Find</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.removeButton, (savingFind || removingFind) && styles.buttonDisabled]}
                disabled={savingFind || removingFind}
                onPress={handleRemoveFind}
              >
                <Text style={styles.removeButtonText}>Remove from Collection</Text>
              </TouchableOpacity>
            </>
          )}
        </View>

        <View style={styles.bottomPad} />
      </ScrollView>

      <FindModal
        visible={modalVisible}
        mushroomName={entry.commonName}
        pointsValue={entry.pointsValue}
        existingFind={find}
        onSave={handleModalSave}
        saving={savingFind}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  scroll: { flex: 1 },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { fontSize: 18, color: '#8a8a7a' },

  // Hero
  heroContainer: { width: '100%', height: 240, backgroundColor: '#e8f5d8' },
  heroImage: { width: '100%', height: '100%' },
  heroPlaceholder: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroEmoji: { fontSize: 80 },
  expandBadge: {
    position: 'absolute',
    bottom: 10,
    right: 10,
    backgroundColor: 'rgba(0,0,0,0.45)',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
  },
  expandBadgeText: { color: '#fff', fontSize: 14 },

  // Lightbox
  lightboxBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.95)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxImage: { width: '100%', height: '100%' },
  lightboxClose: {
    position: 'absolute',
    top: 48,
    right: 20,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 20,
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lightboxCloseText: { color: '#fff', fontSize: 18, fontWeight: '700' },

  // Find photos
  findPhotosSection: { paddingHorizontal: 16, paddingTop: 12 },
  findPhotosLabel: { fontSize: 12, fontWeight: '700', color: '#5a7a3a', marginBottom: 8 },
  findPhoto: { width: 120, height: 90, borderRadius: 10, marginRight: 10 },

  // Names
  namesSection: { padding: 16, paddingBottom: 0 },
  commonName: { fontSize: 26, fontWeight: '800', color: '#2d4a1a', lineHeight: 32 },
  scientificName: { fontSize: 16, fontStyle: 'italic', color: '#5a7a3a', marginTop: 4 },
  altNames: { fontSize: 13, color: '#8a8a7a', marginTop: 4 },
  metaRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10, flexWrap: 'wrap' },
  typeChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginRight: 8,
    alignSelf: 'flex-start',
  },
  typeChipText: { fontSize: 13, fontWeight: '600', color: '#2d4a1a' },
  rarityText: { fontSize: 13, fontWeight: '600', marginRight: 8 },
  pointsText: { fontSize: 13, color: '#8b6914', fontWeight: '700' },

  // Tags
  tagsSection: { paddingHorizontal: 16, paddingTop: 12 },
  tagRowContainer: { width: '100%', marginBottom: 10 },
  tagRowLabel: { fontSize: 12, fontWeight: '700', color: '#5a7a3a', marginBottom: 6 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', width: '100%' },
  tag: {
    backgroundColor: '#fff',
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginRight: 6,
    marginBottom: 6,
    alignSelf: 'flex-start',
  },
  tagText: { fontSize: 12, color: '#5a7a3a' },

  // Cards
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
  sectionHeader: { fontSize: 15, fontWeight: '700', color: '#2d4a1a', marginBottom: 8 },
  descriptionShort: {
    fontSize: 15,
    fontWeight: '600',
    color: '#3a3a2a',
    lineHeight: 22,
    marginBottom: 10,
  },
  descriptionLong: { fontSize: 14, color: '#5a5a4a', lineHeight: 21 },
  traitList: {},
  traitRow: { flexDirection: 'row', marginBottom: 8 },
  traitBullet: { color: '#5a7a3a', fontSize: 15, marginRight: 8, lineHeight: 21 },
  traitText: { flex: 1, fontSize: 14, color: '#3a3a2a', lineHeight: 21 },
  attribution: {
    fontSize: 11,
    color: '#b0b0a0',
    textAlign: 'center',
    marginTop: 8,
    marginHorizontal: 16,
  },

  // Found card
  findPrompt: { fontSize: 14, color: '#8a8a7a', marginBottom: 14 },
  markButton: {
    backgroundColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  markButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  foundHeader: {
    flexDirection: 'column',
    backgroundColor: '#e8f5d8',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  foundBadgeLabel: { fontSize: 16, fontWeight: '700', color: '#2d4a1a', marginBottom: 2 },
  foundDate: { fontSize: 13, color: '#5a7a3a' },
  findDetailRow: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 },
  findDetailChip: {
    backgroundColor: '#e8f5d8',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
    fontSize: 13,
    color: '#2d4a1a',
    fontWeight: '600',
    marginRight: 8,
    marginBottom: 4,
    overflow: 'hidden',
  },
  findLocationText: { fontSize: 13, color: '#5a5a4a', flex: 1 },
  findNotes: {
    fontSize: 14,
    color: '#5a5a4a',
    fontStyle: 'italic',
    lineHeight: 20,
    marginBottom: 12,
    backgroundColor: '#f4f4ec',
    borderRadius: 8,
    padding: 10,
  },
  editButton: {
    borderWidth: 1,
    borderColor: '#5a7a3a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  editButtonText: { color: '#5a7a3a', fontSize: 15, fontWeight: '700' },
  removeButton: {
    borderWidth: 1,
    borderColor: '#8b1a1a',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginTop: 10,
  },
  removeButtonText: { color: '#8b1a1a', fontSize: 15, fontWeight: '700' },
  buttonDisabled: { opacity: 0.65 },
  bottomPad: { height: 32 },
});

