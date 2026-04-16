import { collection, getDocs, query, where } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { Mission, UserFind, UserProfile, MysteryObservation } from '../types';
import mushroomData from '../../data/mushrooms.json';

type MushroomLookupEntry = {
  broadType?: string;
  rarityTier?: string;
};

type MissionProgress = { current: number; target: number };

type MissionEvaluation = {
  claimable: boolean;
  progress: MissionProgress;
};

const mushroomById: Record<string, MushroomLookupEntry> = (mushroomData as any[]).reduce(
  (acc, item) => {
    if (item?.id) {
      acc[item.id] = {
        broadType: item.broadType,
        rarityTier: item.rarityTier,
      };
    }
    return acc;
  },
  {} as Record<string, MushroomLookupEntry>,
);

function getEffectiveItems(
  finds: UserFind[],
  mysteries: MysteryObservation[],
  sinceDate?: Date,
): { finds: UserFind[]; mysteries: MysteryObservation[] } {
  if (!sinceDate) return { finds, mysteries };
  return {
    finds: finds.filter((f) => new Date(f.dateFound) >= sinceDate),
    mysteries: mysteries.filter((m) => new Date(m.date) >= sinceDate),
  };
}

export async function getMissionEvaluation(
  mission: Mission,
  finds: UserFind[],
  profile: UserProfile,
  mysteries: MysteryObservation[],
  sinceDate?: Date,
): Promise<MissionEvaluation> {
  const effective = getEffectiveItems(finds, mysteries, sinceDate);
  const ef = effective.finds;
  const em = effective.mysteries;
  const c = mission.criteria;

  switch (mission.missionType) {
    case 'find': {
      const target = (c.count as number) ?? 1;
      const current = ef.length;
      return { claimable: current >= target, progress: { current, target } };
    }

    case 'category': {
      const broadType = c.broadType as string;
      const target = (c.count as number) ?? 1;
      const current = ef.filter((f) => mushroomById[f.mushroomEntryId]?.broadType === broadType).length;
      return { claimable: current >= target, progress: { current, target } };
    }

    case 'biome': {
      if (c.distinctBiomes) {
        const current = new Set(ef.map((f) => f.biomeTag).filter(Boolean)).size;
        const target = c.distinctBiomes as number;
        return { claimable: current >= target, progress: { current, target } };
      }

      const biomeTag = c.biomeTag as string;
      const target = (c.count as number) ?? 1;
      const current = ef.filter((f) => f.biomeTag === biomeTag).length;
      return { claimable: current >= target, progress: { current, target } };
    }

    case 'skill': {
      const target = (c.count as number) ?? 1;
      if (c.action === 'mystery') {
        const current = em.length;
        return { claimable: current >= target, progress: { current, target } };
      }
      if (c.action === 'lesson') {
        let current = profile.completedLessons.length;
        if (sinceDate) {
          const userId = auth.currentUser?.uid;
          if (userId) {
            try {
              const q = query(
                collection(db, 'users', userId, 'lessonCompletions'),
                where('completedAt', '>=', sinceDate)
              );
              const snap = await getDocs(q);
              current = snap.size;
            } catch (err) {
              console.warn('[missionEngine] Failed to query lesson completions:', err);
              // Fallback to profile array if query fails (though it won't be windowed)
              current = profile.completedLessons.length;
            }
          }
        }
        return { claimable: current >= target, progress: { current, target } };
      }
      return { claimable: false, progress: { current: 0, target } };
    }

    case 'journal': {
      const target = (c.count as number) ?? 1;
      if (c.withPhoto && c.withNotes) {
        const current = ef.filter(
          (f) => f.userPhotoPaths.length > 0 && (f.userNotes ?? '').trim().length > 0,
        ).length;
        return { claimable: current >= target, progress: { current, target } };
      }
      if (c.withPhoto) {
        const current = ef.filter((f) => f.userPhotoPaths.length > 0).length;
        return { claimable: current >= target, progress: { current, target } };
      }
      if (c.withNotes) {
        const current = ef.filter((f) => (f.userNotes ?? '').trim().length > 0).length;
        return { claimable: current >= target, progress: { current, target } };
      }
      return { claimable: false, progress: { current: 0, target } };
    }

    case 'rarityFind': {
      const tiers = c.rarityTiers as string[];
      const current = ef.filter((f) => tiers.includes(mushroomById[f.mushroomEntryId]?.rarityTier ?? '')).length;
      return { claimable: current > 0, progress: { current, target: 1 } };
    }

    case 'seasonal': {
      const seasons = new Set<string>();
      ef.forEach((f) => {
        const mo = new Date(f.dateFound).getMonth();
        if (mo >= 2 && mo <= 4) seasons.add('spring');
        else if (mo >= 5 && mo <= 7) seasons.add('summer');
        else if (mo >= 8 && mo <= 10) seasons.add('fall');
        else seasons.add('winter');
      });

      const current = seasons.size;
      const target = 4;
      if (!c.allSeasons) {
        return { claimable: false, progress: { current, target } };
      }
      return { claimable: current >= target, progress: { current, target } };
    }

    default:
      return { claimable: false, progress: { current: 0, target: 1 } };
  }
}

export async function evaluateMission(
  mission: Mission,
  finds: UserFind[],
  profile: UserProfile,
  mysteries: MysteryObservation[],
  sinceDate?: Date,
): Promise<boolean> {
  const evalResult = await getMissionEvaluation(mission, finds, profile, mysteries, sinceDate);
  return evalResult.claimable;
}

export async function getMissionProgress(
  mission: Mission,
  finds: UserFind[],
  profile: UserProfile,
  mysteries: MysteryObservation[],
  sinceDate?: Date,
): Promise<{ current: number; target: number }> {
  const evalResult = await getMissionEvaluation(mission, finds, profile, mysteries, sinceDate);
  return evalResult.progress;
}

