const { createClient } = require('@supabase/supabase-js');

// Initialize Supabase client
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

const supabase = createClient(supabaseUrl, supabaseKey);

async function testInviteTokenFormat() {
  console.log('🧪 Testing invite token format...\n');

  try {
    // Test the generate_invite_token function
    const { data: tokenData, error: tokenError } = await supabase.rpc('generate_invite_token');
    
    if (tokenError) {
      console.error('❌ generate_invite_token failed:', tokenError);
      return;
    }

    console.log('✅ Generated invite token:', tokenData);
    console.log('📏 Token length:', tokenData.length);
    
    // Check if it's UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
    const isUuid = uuidRegex.test(tokenData);
    
    if (isUuid) {
      console.log('✅ Token is in correct UUID format');
    } else {
      console.log('❌ Token is NOT in UUID format');
      
      // Check if it's the old hex format
      const hexRegex = /^[a-f0-9]{64}$/;
      if (hexRegex.test(tokenData)) {
        console.log('⚠️  Token is in old hex format (64 characters)');
      } else {
        console.log('⚠️  Token is in unknown format');
      }
    }

    // Test creating a team to see what format the invite token gets
    console.log('\n🧪 Testing team creation...');
    
    const { data: teamData, error: teamError } = await supabase
      .from('teams')
      .insert({
        name: 'Test Team - UUID Format',
        invite_token: tokenData,
        join_code: 'TEST12',
        admin_secret: 'test-secret',
        invite_token_rotated_at: new Date().toISOString(),
        start_time: new Date('2099-12-31T23:59:59Z').toISOString(),
      })
      .select('id, name, invite_token')
      .single();

    if (teamError) {
      console.error('❌ Team creation failed:', teamError);
    } else {
      console.log('✅ Team created successfully');
      console.log('   Team ID:', teamData.id);
      console.log('   Team Name:', teamData.name);
      console.log('   Invite Token:', teamData.invite_token);
      console.log('   Token Length:', teamData.invite_token.length);
      
      // Clean up test team
      await supabase.from('teams').delete().eq('id', teamData.id);
      console.log('🧹 Test team cleaned up');
    }

  } catch (error) {
    console.error('❌ Test failed:', error);
  }
}

// Run the test
testInviteTokenFormat();
