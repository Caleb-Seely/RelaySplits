// Simple test script to debug leaderboard data
const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLeaderboardData() {
  try {
    console.log('🔍 Debugging leaderboard data...\n');

    // Fetch leaderboard data
    const { data: leaderboardData, error } = await supabase
      .from('leaderboard')
      .select('*')
      .order('current_leg', { ascending: false });

    if (error) {
      console.error('❌ Error fetching leaderboard data:', error);
      return;
    }

    if (!leaderboardData || leaderboardData.length === 0) {
      console.log('ℹ️  No leaderboard entries found');
      return;
    }

    console.log(`📊 Found ${leaderboardData.length} leaderboard entries\n`);

    leaderboardData.forEach((entry, index) => {
      const startTime = new Date(entry.team_start_time);
      const finishTime = new Date(entry.projected_finish_time);
      const totalTimeMs = entry.projected_finish_time - entry.team_start_time;
      const totalTimeHours = totalTimeMs / (1000 * 60 * 60);
      
      console.log(`🏃 Team ${index + 1}: ${entry.team_name}`);
      console.log(`   Current Leg: ${entry.current_leg}`);
      console.log(`   Start Time: ${startTime.toISOString()} (${startTime.toLocaleTimeString()})`);
      console.log(`   Finish Time: ${finishTime.toISOString()} (${finishTime.toLocaleTimeString()})`);
      console.log(`   Total Time: ${totalTimeHours.toFixed(2)} hours (${totalTimeMs}ms)`);
      
      // Check if this is exactly 18 hours
      if (Math.abs(totalTimeHours - 18) < 0.1) {
        console.log(`   ⚠️  SUSPICIOUS: Exactly 18 hours!`);
      }
      
      // Check if this is a finished team
      if (entry.current_leg === 37) {
        console.log(`   ✅ FINISHED TEAM`);
      }
      
      console.log('');
    });

    // Check for finished teams specifically
    const finishedTeams = leaderboardData.filter(entry => entry.current_leg === 37);
    if (finishedTeams.length > 0) {
      console.log(`\n🏁 Found ${finishedTeams.length} finished teams:`);
      finishedTeams.forEach((team, index) => {
        const totalTimeMs = team.projected_finish_time - team.team_start_time;
        const totalTimeHours = totalTimeMs / (1000 * 60 * 60);
        console.log(`   ${index + 1}. ${team.team_name}: ${totalTimeHours.toFixed(2)} hours`);
      });
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
debugLeaderboardData();
