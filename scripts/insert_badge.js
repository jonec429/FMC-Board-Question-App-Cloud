const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  console.log("Inserting Over Achiever badge...");
  const { data, error } = await supabase
    .from('badges')
    .upsert([
      {
        name: 'Over Achiever',
        description: 'Unlocked every standard achievement in the app. Incredible work!',
        icon: '👑',
        type: 'block'
      }
    ], { onConflict: 'name', ignoreDuplicates: true });

  if (error) {
    console.error("Error inserting badge:", error);
  } else {
    console.log("Success! Badge inserted.");
  }
}

main();
