// Debug script to check leaderboard table
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function debugLeaderboardTable() {
  console.log('🔍 Debugging Leaderboard Table...\n');

  try {
    // Check if leaderboard table exists
    console.log('1️⃣ Checking if leaderboard table exists...');
    const { data: tableData, error: tableError } = await supabase
      .from('leaderboard')
      .select('*')
      .limit(1);

    if (tableError) {
      console.error('❌ Leaderboard table error:', tableError);
      
      // Check if leaderboard_cache exists instead
      console.log('\n2️⃣ Checking if leaderboard_cache table exists...');
      const { data: cacheData, error: cacheError } = await supabase
        .from('leaderboard_cache')
        .select('*')
        .limit(1);
        
      if (cacheError) {
        console.error('❌ Leaderboard_cache table error:', cacheError);
        return false;
      } else {
        console.log('✅ Found leaderboard_cache table instead');
        console.log('   This suggests the migration didn\'t complete properly');
      }
      
      return false;
    }

    console.log('✅ Leaderboard table exists');
    console.log('   Current entries:', tableData?.length || 0);

    // Test creating a dummy team first
    console.log('\n3️⃣ Creating test team...');
    const testTeam = {
      name: 'Debug Test Team',
      start_time: new Date().toISOString()
    };

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert(testTeam)
      .select()
      .single();

    if (teamError) {
      console.error('❌ Failed to create test team:', teamError);
      return false;
    }

    console.log('✅ Test team created:', team.id);

    // Test creating leaderboard entry
    console.log('\n4️⃣ Testing leaderboard entry creation...');
    const teamStartTime = new Date(team.start_time).getTime();
    const leaderboardEntry = {
      team_id: team.id,
      team_name: team.name,
      team_start_time: teamStartTime,
      current_leg: 1,
      projected_finish_time: teamStartTime + (36 * 30 * 60 * 1000),
      last_leg_completed_at: teamStartTime,
      status: 'not_started',
      progress_percentage: 0.00,
      current_runner_name: null,
      last_updated_at: new Date().toISOString()
    };

    const { data: lbEntry, error: lbError } = await supabase
      .from('leaderboard')
      .insert(leaderboardEntry)
      .select()
      .single();

    if (lbError) {
      console.error('❌ Failed to create leaderboard entry:', lbError);
      console.log('   Entry data:', JSON.stringify(leaderboardEntry, null, 2));
      
      // Clean up test team
      await supabase.from('teams').delete().eq('id', team.id);
      return false;
    }

    console.log('✅ Leaderboard entry created successfully');
    console.log('   Entry ID:', lbEntry.team_id);

    // Clean up test data
    console.log('\n5️⃣ Cleaning up test data...');
    await supabase.from('leaderboard').delete().eq('team_id', team.id);
    await supabase.from('teams').delete().eq('id', team.id);
    console.log('✅ Test data cleaned up');

    return true;

  } catch (error) {
    console.error('❌ Debug failed with error:', error);
    return false;
  }
}

// Run the debug
debugLeaderboardTable()
  .then(success => {
    if (success) {
      console.log('\n🎉 Leaderboard table is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 Leaderboard table has issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Debug execution failed:', error);
    process.exit(1);
  });
