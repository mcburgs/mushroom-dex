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
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
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
    lat?: number;
    lng?: number;
  }) => Promise<void>;
  saving?: boolean;
  onClose: () => void;
}

export default function FindModal({
  visible,
  mushroomName,
  pointsValue,
  existingFind,
  onSave,
  saving = false,
  onClose,
}: Props) {
  const [locationNote, setLocationNote] = useState(existingFind?.locationNote ?? '');
  const [biomeTag, setBiomeTag] = useState(existingFind?.biomeTag ?? '');
  const [userNotes, setUserNotes] = useState(existingFind?.userNotes ?? '');
  const [photos, setPhotos] = useState<string[]>(existingFind?.userPhotoPaths ?? []);
  const [coords, setCoords] = useState<{ lat?: number; lng?: number }>({
    lat: existingFind?.lat,
    lng: existingFind?.lng,
  });
  const [locating, setLocating] = useState(false);
  const [photoBusy, setPhotoBusy] = useState(false);

  React.useEffect(() => {
    if (!visible) return;
    // Reset form fields — no GPS call here so the modal opens instantly
    setLocationNote(existingFind?.locationNote ?? '');
    setBiomeTag(existingFind?.biomeTag ?? '');
    setUserNotes(existingFind?.userNotes ?? '');
    setPhotos(existingFind?.userPhotoPaths ?? []);
    setCoords({ lat: existingFind?.lat, lng: existingFind?.lng });
    setLocating(false);
    setPhotoBusy(false);
  }, [visible, existingFind]);

  async function handleUseMyLocation() {
    if (saving) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('Permission needed', 'Allow FungiDex to access your location.', [{ text: 'OK' }]);
        setLocating(false);
        return;
      }
      const position = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setCoords({ lat: position.coords.latitude, lng: position.coords.longitude });
      try {
        const geoResults = await Location.reverseGeocodeAsync({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
        if (geoResults.length > 0) {
          const geo = geoResults[0];
          const parts: string[] = [];
          if (geo.name && geo.name !== geo.city && geo.name !== geo.street) {
            parts.push(geo.name);
          }
          if (geo.city) parts.push(geo.city);
          if (geo.region) parts.push(geo.region);
          const placeName = parts.filter(Boolean).join(', ');
          if (placeName) {
            setLocationNote((current) => (current.trim() === '' ? placeName : current));
          }
        }
      } catch {
        // Reverse geocode failed — locationNote stays as user typed
      }
    } catch {
      Alert.alert('Location unavailable', 'Could not get your current location.', [{ text: 'OK' }]);
    } finally {
      setLocating(false);
    }
  }

  const isNew = !existingFind;
  const dateLabel = existingFind
    ? formatDate(existingFind.dateFound)
    : formatDate(new Date().toISOString());

  async function handleAddPhoto() {
    if (photoBusy || saving) return;
    setPhotoBusy(true);
    try {
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow FungiDex to access your photos to attach them to finds.',
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
    } catch (error) {
      console.warn('[FindModal] add photo failed:', error);
      Alert.alert('Could not add photo', 'Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function handleTakePhoto() {
    if (photoBusy || saving) return;
    setPhotoBusy(true);
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert(
          'Permission needed',
          'Allow FungiDex to use your camera to photograph your find.',
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
    } catch (error) {
      console.warn('[FindModal] take photo failed:', error);
      Alert.alert('Could not open camera', 'Please try again.');
    } finally {
      setPhotoBusy(false);
    }
  }

  function removePhoto(uri: string) {
    setPhotos((prev) => prev.filter((p) => p !== uri));
  }

  async function handleSave() {
    if (saving) return;
    try {
      await onSave({
      locationNote,
      biomeTag,
      userNotes,
      userPhotoPaths: photos,
      lat: coords.lat,
      lng: coords.lng,
      });
    } catch {
      // Parent handler surfaces user-facing errors.
    }
  }

  return (
    <Modal visible={visible} animationType="slide" transparent={false}>
      <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
        <KeyboardAvoidingView
          style={styles.safe}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          {/* Header */}
          <View style={styles.header}>
            <TouchableOpacity onPress={onClose} style={styles.cancelBtn} disabled={saving}>
              <Text style={styles.cancelText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {isNew ? 'Log Your Find' : 'Edit Find'}
            </Text>
            <TouchableOpacity onPress={handleSave} style={styles.saveBtn} disabled={saving}>
              {saving ? (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <ActivityIndicator size="small" color="#5a7a3a" />
                  <Text style={[styles.saveText, { fontSize: 12 }]}>Saving…</Text>
                </View>
              ) : (
                <Text style={styles.saveText}>{isNew ? 'Save' : 'Update'}</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
          >
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
          <TouchableOpacity
            style={styles.locationButton}
            onPress={handleUseMyLocation}
            disabled={locating || saving}
          >
            <Text style={styles.locationButtonText}>
              {locating ? '📡 Getting location…' : coords.lat ? '📍 Location captured ✓' : '📍 Use My Location'}
            </Text>
          </TouchableOpacity>

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
            <TouchableOpacity style={[styles.photoButton, (photoBusy || saving) && styles.photoButtonDisabled]} onPress={handleTakePhoto} disabled={photoBusy || saving}>
              <Text style={styles.photoButtonEmoji}>📷</Text>
              <Text style={styles.photoButtonText}>Camera</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.photoButton, (photoBusy || saving) && styles.photoButtonDisabled]} onPress={handleAddPhoto} disabled={photoBusy || saving}>
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
        </KeyboardAvoidingView>
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
  locationButton: {
    marginTop: 8,
    backgroundColor: '#f0f8e8',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#b8d898',
    paddingVertical: 10,
    paddingHorizontal: 14,
    alignSelf: 'flex-start',
  },
  locationButtonText: { fontSize: 13, color: '#3a6a1a', fontWeight: '600' },
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
  photoButtonDisabled: { opacity: 0.55 },
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

