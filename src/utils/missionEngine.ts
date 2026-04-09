import { Mission, UserFind, UserProfile, MysteryObservation } from '../types';
import mushroomData from '../../data/mushrooms.json';

export function evaluateMission(
  mission: Mission,
  finds: UserFind[],
  profile: UserProfile,
  mysteries: MysteryObservation[],
): boolean {
  const c = mission.criteria;

  switch (mission.missionType) {
    case 'find': {
      return finds.length >= ((c.count as number) ?? 1);
    }

    case 'category': {
      const broadType = c.broadType as string;
      const target = (c.count as number) ?? 1;
      const matching = finds.filter((f) => {
        const entry = (mushroomData as any[]).find((m) => m.id === f.mushroomEntryId);
        return entry?.broadType === broadType;
      });
      return matching.length >= target;
    }

    case 'biome': {
      if (c.distinctBiomes) {
        const biomes = new Set(finds.map((f) => f.biomeTag).filter(Boolean));
        return biomes.size >= (c.distinctBiomes as number);
      }
      const biomeTag = c.biomeTag as string;
      const target = (c.count as number) ?? 1;
      return finds.filter((f) => f.biomeTag === biomeTag).length >= target;
    }

    case 'skill': {
      const target = (c.count as number) ?? 1;
      if (c.action === 'mystery') return mysteries.length >= target;
      if (c.action === 'lesson') return profile.completedLessons.length >= target;
      return false;
    }

    case 'journal': {
      const target = (c.count as number) ?? 1;
      if (c.withPhoto) {
        return finds.filter((f) => f.userPhotoPaths.length > 0).length >= target;
      }
      if (c.withNotes) {
        return finds.filter((f) => (f.userNotes ?? '').trim().length > 0).length >= target;
      }
      return false;
    }

    default:
      return false;
  }
}

export function getMissionProgress(
  mission: Mission,
  finds: UserFind[],
  profile: UserProfile,
  mysteries: MysteryObservation[],
): { current: number; target: number } {
  const c = mission.criteria;

  switch (mission.missionType) {
    case 'find':
      return { current: finds.length, target: (c.count as number) ?? 1 };

    case 'category': {
      const broadType = c.broadType as string;
      const current = finds.filter((f) => {
        const entry = (mushroomData as any[]).find((m) => m.id === f.mushroomEntryId);
        return entry?.broadType === broadType;
      }).length;
      return { current, target: (c.count as number) ?? 1 };
    }

    case 'biome': {
      if (c.distinctBiomes) {
        const biomes = new Set(finds.map((f) => f.biomeTag).filter(Boolean));
        return { current: biomes.size, target: c.distinctBiomes as number };
      }
      const biomeTag = c.biomeTag as string;
      return {
        current: finds.filter((f) => f.biomeTag === biomeTag).length,
        target: (c.count as number) ?? 1,
      };
    }

    case 'skill': {
      const target = (c.count as number) ?? 1;
      if (c.action === 'mystery') return { current: mysteries.length, target };
      if (c.action === 'lesson') return { current: profile.completedLessons.length, target };
      return { current: 0, target };
    }

    case 'journal': {
      const target = (c.count as number) ?? 1;
      if (c.withPhoto) {
        return { current: finds.filter((f) => f.userPhotoPaths.length > 0).length, target };
      }
      if (c.withNotes) {
        return { current: finds.filter((f) => (f.userNotes ?? '').trim().length > 0).length, target };
      }
      return { current: 0, target };
    }

    default:
      return { current: 0, target: 1 };
  }
}
