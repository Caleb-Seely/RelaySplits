// Simple test to check if team creation works
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testSimpleTeamCreation() {
  console.log('🧪 Testing Simple Team Creation...\n');

  try {
    // Test teams-create Edge Function
    console.log('1️⃣ Testing teams-create Edge Function...');
    const teamData = {
      name: 'Simple Test Team',
      admin_display_name: 'Test Admin',
      device_profile: {
        first_name: 'Test',
        last_name: 'Admin',
        display_name: 'Test Admin'
      }
    };

    console.log('📤 Sending request with data:', teamData);

    const { data: teamResult, error: teamError } = await supabase.functions.invoke('teams-create', {
      body: teamData
    });

    if (teamError) {
      console.error('❌ teams-create failed:', teamError);
      console.error('Error details:', JSON.stringify(teamError, null, 2));
      return false;
    }

    console.log('✅ teams-create succeeded:', teamResult);

    // Test 2: Verify team was created in database
    console.log('\n2️⃣ Verifying team in database...');
    const { data: dbTeam, error: dbError } = await supabase
      .from('teams')
      .select('*')
      .eq('id', teamResult.teamId)
      .single();

    if (dbError) {
      console.error('❌ Database query failed:', dbError);
      return false;
    }

    console.log('✅ Team found in database:', dbTeam);

    // Test 3: Check if device was created
    console.log('\n3️⃣ Checking device creation...');
    const { data: device, error: deviceError } = await supabase
      .from('team_devices')
      .select('*')
      .eq('team_id', teamResult.teamId)
      .single();

    if (deviceError) {
      console.error('❌ Device query failed:', deviceError);
      return false;
    }

    console.log('✅ Device found:', device);

    // Test 4: Clean up
    console.log('\n4️⃣ Cleaning up test data...');
    await supabase.from('team_devices').delete().eq('team_id', teamResult.teamId);
    await supabase.from('teams').delete().eq('id', teamResult.teamId);
    console.log('✅ Test data cleaned up');

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testSimpleTeamCreation()
  .then(success => {
    if (success) {
      console.log('\n🎉 Simple team creation is working!');
      console.log('   The issue might be with the frontend or leaderboard integration');
      process.exit(0);
    } else {
      console.log('\n💥 Simple team creation has issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
