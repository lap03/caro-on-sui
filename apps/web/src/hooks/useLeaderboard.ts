import { useState, useEffect, useCallback } from 'react';
import { useSuiClient } from '@mysten/dapp-kit';
import { LEADERBOARD_ID } from '@/lib/constants';

export interface PlayerStats {
  address: string;
  wins: number;
  losses: number;
  draws: number;
  currentStreak: number;
  bestStreak: number;
  rank: number;
}

export function useLeaderboard() {
  const suiClient = useSuiClient();
  const [data, setData] = useState<PlayerStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = useCallback(async () => {
    if (LEADERBOARD_ID === '0x0') {
      setIsLoading(false);
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      // 1. Fetch the Leaderboard object
      const lbObject = await suiClient.getObject({
        id: LEADERBOARD_ID,
        options: { showContent: true },
      });

      if (!lbObject.data?.content || lbObject.data.content.dataType !== 'moveObject') {
        throw new Error('Leaderboard object not found or invalid format');
      }

      const fields = lbObject.data.content.fields as any;
      const statsTableId = fields.stats?.fields?.id?.id;

      if (!statsTableId) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // 2. Fetch all dynamic fields from the stats table
      const dynamicFields = await suiClient.getDynamicFields({
        parentId: statsTableId,
      });

      if (dynamicFields.data.length === 0) {
        setData([]);
        setIsLoading(false);
        return;
      }

      // 3. For each field, fetch the actual DynamicFieldObject
      // The keys are addresses, the values are PlayerStats structs
      const objectIds = dynamicFields.data.map((df) => df.objectId);
      
      const objects = await suiClient.multiGetObjects({
        ids: objectIds,
        options: { showContent: true },
      });

      const parsedData: PlayerStats[] = objects
        .map((obj) => {
          if (!obj.data?.content || obj.data.content.dataType !== 'moveObject') {
            return null;
          }
          const dfFields = (obj.data.content.fields as any);
          // Standard dynamic field structure has 'name' and 'value' fields
          const address = dfFields.name;
          const stats = dfFields.value?.fields;
          
          if (!stats) return null;

          return {
            address,
            wins: Number(stats.wins || 0),
            losses: Number(stats.losses || 0),
            draws: Number(stats.draws || 0),
            currentStreak: Number(stats.win_streak || 0),
            bestStreak: Number(stats.best_streak || 0),
            rank: 0, // Assigned later
          };
        })
        .filter((item): item is PlayerStats => item !== null);

      // Sort by wins by default
      parsedData.sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        return b.bestStreak - a.bestStreak;
      });

      // Assign ranks
      parsedData.forEach((p, idx) => { p.rank = idx + 1; });

      setData(parsedData);
    } catch (err: any) {
      console.error('Failed to fetch leaderboard:', err);
      setError(err.message || 'Failed to fetch leaderboard data');
    } finally {
      setIsLoading(false);
    }
  }, [suiClient]);

  useEffect(() => {
    fetchLeaderboard();
    // Auto refresh every 30s
    const interval = setInterval(fetchLeaderboard, 30_000);
    return () => clearInterval(interval);
  }, [fetchLeaderboard]);

  return { data, isLoading, error, refetch: fetchLeaderboard };
}
