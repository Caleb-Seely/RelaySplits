// Test script to debug teams-create function
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseKey) {
  console.error('❌ SUPABASE_SERVICE_ROLE_KEY environment variable is required');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testTeamsCreate() {
  console.log('🧪 Testing Teams Create Function...\n');

  try {
    // Test 1: Check if database functions exist
    console.log('1️⃣ Testing database functions...');
    
    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_invite_token');
    if (tokenError) {
      console.error('❌ generate_invite_token failed:', tokenError);
      return false;
    }
    console.log('✅ generate_invite_token works:', tokenData);

    const { data: codeData, error: codeError } = await supabase.rpc('generate_join_code');
    if (codeError) {
      console.error('❌ generate_join_code failed:', codeError);
      return false;
    }
    console.log('✅ generate_join_code works:', codeData);

    const { data: secretData, error: secretError } = await supabase.rpc('generate_admin_secret');
    if (secretError) {
      console.error('❌ generate_admin_secret failed:', secretError);
      return false;
    }
    console.log('✅ generate_admin_secret works:', secretData);

    // Test 2: Test teams-create Edge Function
    console.log('\n2️⃣ Testing teams-create Edge Function...');
    const teamData = {
      name: 'Test Team Debug',
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
      console.error('❌ teams-create failed:', teamError);
      return false;
    }

    console.log('✅ teams-create succeeded:', teamResult);

    // Test 3: Clean up
    console.log('\n3️⃣ Cleaning up test data...');
    if (teamResult.teamId) {
      await supabase.from('teams').delete().eq('id', teamResult.teamId);
      console.log('✅ Test team deleted');
    }

    return true;

  } catch (error) {
    console.error('❌ Test failed with error:', error);
    return false;
  }
}

// Run the test
testTeamsCreate()
  .then(success => {
    if (success) {
      console.log('\n🎉 Teams create function is working correctly!');
      process.exit(0);
    } else {
      console.log('\n💥 Teams create function has issues');
      process.exit(1);
    }
  })
  .catch(error => {
    console.error('💥 Test execution failed:', error);
    process.exit(1);
  });
