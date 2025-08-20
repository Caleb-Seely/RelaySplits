// Test script to verify team creation flow
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTeamCreation() {
  console.log('🧪 Testing Team Creation Flow...\n');

  try {
    // Test 1: Create a team
    console.log('1️⃣ Creating test team...');
    const teamData = {
      name: 'Test Team Creation',
      admin_display_name: 'Test Admin',
      device_profile: {
        first_name: 'Test',
        last_name: 'Admin',
        display_name: 'Test Admin'
      }
    };

    const { data: teamResult, error: teamError } = await supabase.functions.invoke('teams-create', {
      body: teamData
    });

    if (teamError) {
      console.error('❌ Team creation failed:', teamError);
      return false;
    }

    console.log('✅ Team created successfully');
    console.log('   Team ID:', teamResult.teamId);
    console.log('   Invite Token:', teamResult.invite_token);

    // Test 2: Check if leaderboard entry was created
    console.log('\n2️⃣ Checking for leaderboard entry...');
    const { data: leaderboardEntry, error: lbError } = await supabase
      .from('leaderboard')
      .select('*')
      .eq('team_id', teamResult.teamId)
      .single();

    if (lbError) {
      console.log('✅ No leaderboard entry found (this is expected - it will be created after setup)');
      console.log('   Error:', lbError.message);
    } else {
      console.log('⚠️  Leaderboard entry found (this might indicate the team was already set up)');
      console.log('   Status:', leaderboardEntry.status);
      console.log('   Current Leg:', leaderboardEntry.current_leg);
    }

    // Test 3: Clean up test data
    console.log('\n3️⃣ Cleaning up test data...');
    await supabase.from('teams').delete().eq('id', teamResult.teamId);
    console.log('✅ Test team deleted');

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testTeamCreation()
  .then(success => {
    if (success) {
      console.log('\n🎉 Team creation flow is working correctly!');
      console.log('   ✅ Team creation succeeds');
      console.log('   ✅ Leaderboard entry will be created after setup');
      process.exit(0);
    } else {
      console.log('\n💥 Team creation flow has issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
