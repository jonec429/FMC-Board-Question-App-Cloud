import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local', quiet: true });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const supabase = createClient(supabaseUrl, supabaseKey);

async function migrateRoster() {
  const csvPath = path.join(__dirname, 'roster.csv');
  if (!fs.existsSync(csvPath)) {
    console.error('roster.csv not found!');
    return;
  }

  const content = fs.readFileSync(csvPath, 'utf8');
  const lines = content.split('\n');
  const profiles = [];

  for (let i = 1; i < lines.length; i++) {
    if (!lines[i].trim()) continue;
    const row = lines[i].split(',').map(v => v.trim());
    
    // Headers: ["Resident Name", "Email", "Class Of (PGY)", "Faculty Advisor"]
    profiles.push({
      full_name: row[0],
      email: row[1]?.toLowerCase(),
      pgy: row[2],
      advisor: row[3],
      role: 'resident'
    });
  }

  console.log(`Migrating ${profiles.length} residents...`);
  
  // Note: We can't insert into profiles directly if they don't have an auth.uid() yet
  // However, we can use this to PRE-AUTHORIZE them in a separate table if we want.
  // For now, we'll just log it.
  console.log('Roster data ready. We will use this to validate sign-ups.');
}

migrateRoster();
