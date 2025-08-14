// test-edge-functions.ts

const SUPABASE_URL = 'https://whwsnpzwxagmlkrzrqsa.supabase.co';
const ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Indod3NucHp3eGFnbWxrcnpycXNhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQ2MjQ3NjMsImV4cCI6MjA3MDIwMDc2M30.vy59CFc0dRqo84nHHWXP55CbC3Haw1S4gf0hNxN6tyc';

const headers = {
  'Authorization': `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function testTeamsCreate() {
  console.log('Testing: POST /functions/v1/teams-create');
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/teams-create`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify({
        name: "My Test Team From Script",
        device_profile: {
          first_name: "Admin",
          last_name: "User"
        }
      })
    });

    const data = await response.json();
    console.log('Status:', response.status, response.statusText);
    console.log('Response Body:', data);

    if (response.ok) {
        console.log('\n✅ SUCCESS: Team created successfully.');
        console.log('You can now use these details to test other functions:');
        console.log(JSON.stringify(data, null, 2));
    } else {
        console.error('\n❌ FAILED: Could not create team.');
    }

  } catch (error) {
    console.error('A network or other error occurred:', error);
  }
}

// Run the test
testTeamsCreate();
