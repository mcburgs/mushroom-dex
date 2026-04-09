import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Image,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import { UserFind } from '../types';

const BIOME_OPTIONS = [
  { label: 'Forest', emoji: '🌲' },
  { label: 'Park', emoji: '🏞️' },
  { label: 'Trail-side', emoji: '🥾' },
  { label: 'Meadow', emoji: '🌾' },
  { label: 'Backyard', emoji: '🏡' },
  { label: 'Wetland', emoji: '💧' },
  { label: 'Log/Stump', emoji: '🪵' },
  { label: 'Other', emoji: '📍' },
];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-CA', {
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

interface Props {
  visible: boolean;
  mushroomName: string;
  pointsValue: number;
  existingFind: UserFind | null;
  onSave: (data: {
    locationNote: string;
    biomeTag: string;
    userNotes: string;
    userPhotoPaths: string[];
  }) => void;
  onClose: () => void;
}

export default function FindModal({
  visible,
  mushroomName,
  pointsValue,
  existingFind,
  onSave,
  onClose,
}: Props) {
  const [locationNote, setLocationNote] = useState(existingFind?.locationNote ?? '');
  const [biomeTag, setBiomeTag] = useState(existingFind?.biomeTag ?? '');
  const [userNotes, setUserNotes] = useState(existingFind?.userNotes ?? '');
  const [photos, setPhotos] = useState<string[]>(existingFind?.userPhotoPaths ?? []);

  const isNew = !existingFind;
  const dateLabel = existingFind
    ? formatDate(existingFind.dateFound)
    : formatDate(new Date().toISOString());

  async function handleAddPhoto() {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow Mushroom Dex to access your photos to attach them to finds.',
        [{ text: 'OK' }]
      );
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }

  async function handleTakePhoto() {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') {
      Alert.alert(
        'Permission needed',
        'Allow Mushroom Dex to use your camera to photograph your find.',
        [{ text: 'OK' }]
      );
      return;
    }
    const result = await ImagePicker.launchCameraAsync({
      quality: 0.7,
      allowsEditing: true,
      aspect: [4, 3],
    });
    if (!result.canceled && result.assets[0]) {
      setPhotos((prev) => [...prev, result.assets[0].uri]);
    }
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  }

  function handleSave() {
    onSave({ locationNote, biomeTag, userNotes, userPhotoPaths: photos });
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
          <Text style={styles.headerTitle} numberOfLines={1}>
            {isNew ? 'Log Your Find' : 'Edit Find'}
          </Text>
          <TouchableOpacity onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveText}>{isNew ? 'Save' : 'Update'}</Text>
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scroll} contentContainerStyle={styles.content}>
          {/* Mushroom + points */}
          <View style={styles.mushroomRow}>
            <Text style={styles.mushroomEmoji}>🍄</Text>
            <View style={styles.mushroomInfo}>
              <Text style={styles.mushroomName}>{mushroomName}</Text>
              {isNew && (
                <Text style={styles.pointsBadge}>+{pointsValue} points</Text>
              )}
              <Text style={styles.dateLabel}>{dateLabel}</Text>
            </View>
          </View>

          {/* Location */}
          <Text style={styles.fieldLabel}>Where did you find it?</Text>
          <TextInput
            style={styles.textInput}
            value={locationNote}
            onChangeText={setLocationNote}
            placeholder="e.g. Dundas Valley, old oak grove…"
            placeholderTextColor="#b0b0a0"
          />

          {/* Biome */}
          <Text style={styles.fieldLabel}>Habitat type</Text>
          <View style={styles.biomeGrid}>
            {BIOME_OPTIONS.map((b) => {
              const active = biomeTag === b.label;
              return (
                <TouchableOpacity
                  key={b.label}
                  style={[styles.biomeChip, active && styles.biomeChipActive]}
                  onPress={() => setBiomeTag(active ? '' : b.label)}
                >
                  <Text style={styles.biomeEmoji}>{b.emoji}</Text>
                  <Text style={[styles.biomeLabel, active && styles.biomeLabelActive]}>
                    {b.label + ' '}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Notes */}
          <Text style={styles.fieldLabel}>Field notes</Text>
          <TextInput
            style={[styles.textInput, styles.notesInput]}
            value={userNotes}
            onChangeText={setUserNotes}
            placeholder="What did you observe? Size, smell, what it was growing on…"
            placeholderTextColor="#b0b0a0"
            multiline
            textAlignVertical="top"
          />

          {/* Photos */}
          <Text style={styles.fieldLabel}>Photos</Text>
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

          {photos.length > 0 && (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
              {photos.map((uri) => (
                <View key={uri} style={styles.photoThumbContainer}>
                  <Image source={{ uri }} style={styles.photoThumb} resizeMode="cover" />
                  <TouchableOpacity
                    style={styles.photoRemove}
                    onPress={() => removePhoto(uri)}
                  >
                    <Text style={styles.photoRemoveText}>✕</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </ScrollView>
          )}

          <View style={styles.bottomPad} />
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#f9f6f0' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#d4e8b8',
    backgroundColor: '#f9f6f0',
  },
  headerTitle: { fontSize: 17, fontWeight: '700', color: '#2d4a1a', flex: 1, textAlign: 'center' },
  cancelBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 60 },
  cancelText: { fontSize: 16, color: '#8a8a7a' },
  saveBtn: { paddingVertical: 4, paddingHorizontal: 4, minWidth: 60, alignItems: 'flex-end' },
  saveText: { fontSize: 16, color: '#5a7a3a', fontWeight: '700' },
  scroll: { flex: 1 },
  content: { padding: 20 },
  mushroomRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  mushroomEmoji: { fontSize: 40, marginRight: 14 },
  mushroomInfo: { flex: 1 },
  mushroomName: { fontSize: 17, fontWeight: '700', color: '#2d4a1a' },
  pointsBadge: { fontSize: 14, color: '#8b6914', fontWeight: '700', marginTop: 2 },
  dateLabel: { fontSize: 13, color: '#8a8a7a', marginTop: 4 },
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
  biomeGrid: { flexDirection: 'row', flexWrap: 'wrap' },
  biomeChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 20,
    paddingVertical: 7,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    marginRight: 8,
    marginBottom: 8,
  },
  biomeChipActive: { backgroundColor: '#5a7a3a', borderColor: '#5a7a3a' },
  biomeEmoji: { fontSize: 15, marginRight: 5 },
  biomeLabel: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },
  biomeLabelActive: { color: '#fff' },
  photoRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
  photoButton: {
    flex: 1,
    backgroundColor: '#fff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#d4e8b8',
    paddingVertical: 14,
    alignItems: 'center',
  },
  photoButtonEmoji: { fontSize: 26, marginBottom: 4 },
  photoButtonText: { fontSize: 13, color: '#5a7a3a', fontWeight: '600' },
  photoScroll: { marginBottom: 8 },
  photoThumbContainer: { marginRight: 10, position: 'relative' },
  photoThumb: { width: 100, height: 100, borderRadius: 10 },
  photoRemove: {
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
  photoRemoveText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  bottomPad: { height: 32 },
});
