import React from 'react';
import { LeaderboardTeam } from '@/types/leaderboard';
import { formatFinishTime } from '@/services/leaderboard';

interface LeaderboardTableProps {
  teams: LeaderboardTeam[];
}

export const LeaderboardTable: React.FC<LeaderboardTableProps> = ({ teams }) => {
  // Helper function to format start time
  const formatStartTime = (timestamp: number): string => {
    if (!timestamp || timestamp === 0) {
      return 'N/A';
    }
    const date = new Date(timestamp);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  };

  // Helper function to calculate projected finish time of current leg
  const getCurrentLegProjectedFinish = (team: LeaderboardTeam): string => {
    // If race is finished (leg 36 completed), show "Finished"
    if (team.current_leg > 36) {
      return 'Finished';
    }
    
    if (!team.current_leg_projected_finish) {
      return 'N/A';
    }
    return formatFinishTime(team.current_leg_projected_finish);
  };

  // Helper function to get current leg display
  const getCurrentLegDisplay = (team: LeaderboardTeam): string => {
    if (team.current_leg > 36) {
      return 'Finished';
    }
    return `Leg ${team.current_leg}`;
  };

  // Helper function to get projected finish display
  const getProjectedFinishDisplay = (team: LeaderboardTeam): string => {
    if (team.current_leg > 36) {
      return 'Finished';
    }
    return formatFinishTime(team.projected_finish_time);
  };

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Rank
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Team
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Start Time
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Current Leg
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Leg Finish
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
              Projected Finish
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {teams.map((team, index) => (
            <tr key={team.id || team.team_id || `team-${index}`} className="hover:bg-gray-50">
              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                {index + 1}
              </td>
              <td className="px-6 py-4 text-sm font-medium text-gray-900 truncate max-w-[200px]">
                {team.team_name}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {formatStartTime(team.team_start_time)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {getCurrentLegDisplay(team)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {getCurrentLegProjectedFinish(team)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                {getProjectedFinishDisplay(team)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};
