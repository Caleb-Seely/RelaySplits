import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchLeaderboardData } from '@/services/leaderboard';
import { LeaderboardTable } from '@/components/leaderboard/LeaderboardTable';
import { LoadingSpinner } from '@/components/ui/loading-states';
import LeaderboardErrorBoundary from '@/components/ErrorBoundary';

export const LeaderboardPage: React.FC = () => {
  const { data, isLoading, error } = useQuery({
    queryKey: ['leaderboard'],
    queryFn: fetchLeaderboardData,
    refetchInterval: 60000, // 1 minute refresh
    staleTime: 30000,
  });

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error loading leaderboard. Please try again.
        </div>
      </div>
    );
  }

  return (
    <LeaderboardErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-3xl font-bold mb-8">Race Leaderboard</h1>
        <LeaderboardTable teams={data?.teams || []} />
      </div>
    </LeaderboardErrorBoundary>
  );
};

export default LeaderboardPage;
