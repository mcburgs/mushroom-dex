import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Image } from 'expo-image';
import { useRouter } from 'expo-router';
import { FriendFindEntry } from '../storage/friendData';
import { MushroomEntry } from '../types';
import mushroomData from '../../data/mushrooms.json';

const MUSHROOMS = mushroomData as MushroomEntry[];
const MUSHROOM_BY_ID = new Map(MUSHROOMS.map((m) => [m.id, m]));

function daysAgoLabel(dateStr: string): string {
  const diff = Math.floor(
    (Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24),
  );
  if (diff === 0) return 'today';
  if (diff === 1) return 'yesterday';
  return `${diff}d ago`;
}

function FeedItem({ entry }: { entry: FriendFindEntry }) {
  const router = useRouter();
  const mushroom = MUSHROOM_BY_ID.get(entry.find.mushroomEntryId);
  if (!mushroom) return null;

  return (
    <TouchableOpacity
      style={styles.item}
      onPress={() => router.push(`/dex/${mushroom.id}`)}
    >
      {entry.friend.avatarUrl ? (
        <Image
          source={{ uri: entry.friend.avatarUrl }}
          style={styles.avatar}
          contentFit="cover"
        />
      ) : (
        <View style={[styles.avatar, styles.avatarPlaceholder]}>
          <Text style={styles.avatarText}>
            {(entry.friend.displayName ?? '?')[0].toUpperCase()}
          </Text>
        </View>
      )}
      <View style={styles.itemContent}>
        <Text style={styles.itemText} numberOfLines={2}>
          <Text style={styles.friendName}>{entry.friend.displayName}</Text>
          {' found '}
          <Text style={styles.speciesName}>{mushroom.commonName}</Text>
        </Text>
        <Text style={styles.itemDate}>{daysAgoLabel(entry.find.dateFound)}</Text>
      </View>
    </TouchableOpacity>
  );
}

interface Props {
  entries: FriendFindEntry[];
  maxItems?: number;
}

export default function ActivityFeed({ entries, maxItems = 15 }: Props) {
  // Filter to last 30 days, cap at maxItems
  const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const filtered = entries
    .filter((e) => new Date(e.find.dateFound).getTime() > thirtyDaysAgo)
    .slice(0, maxItems);

  if (filtered.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyText}>
          No recent friend activity. Add friends to see their finds here!
        </Text>
      </View>
    );
  }

  return (
    <View>
      {filtered.map((entry, i) => (
        <FeedItem key={`${entry.friend.uid}-${entry.find.mushroomEntryId}-${i}`} entry={entry} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: '#d4e8b8',
  },
  avatar: { width: 36, height: 36, borderRadius: 18, marginRight: 10 },
  avatarPlaceholder: {
    backgroundColor: '#5a7a3a',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '700', color: '#fff' },
  itemContent: { flex: 1 },
  itemText: { fontSize: 14, color: '#2d4a1a', lineHeight: 20 },
  friendName: { fontWeight: '700' },
  speciesName: { fontWeight: '600', color: '#5a7a3a' },
  itemDate: { fontSize: 12, color: '#8a8a7a', marginTop: 2 },
  emptyBox: {
    backgroundColor: '#fff',
    borderRadius: 14,
    padding: 20,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e8e8d8',
  },
  emptyText: {
    fontSize: 14,
    color: '#8a8a7a',
    textAlign: 'center',
    lineHeight: 20,
  },
});
