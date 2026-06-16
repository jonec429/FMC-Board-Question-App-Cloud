import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

// Load environment variables
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials in .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

const legacyPoints = {
  // PGY-3
  'Abernethy': 33,
  'Bess': 31,
  'Bohn': 25,
  'Brown': 30,
  'Cabrera': 11,
  'Cohen': 22,
  'Fazeli': 19,
  'Narvel': 17,
  'Nguyen': 29, // Thienly
  'Vargas': 33,

  // PGY-2
  'Boettcher': 26,
  'Dean': 34,
  'Gonzalez': 30,
  'Gravrok': 26,
  'Kemmer': 25,
  'Lemus': 31,
  'Louis': 31,
  'Martinez': 26,
  'Nguyen, A': 33, // Angela
  'Robak': 44,
  'Varni': 42,
  'Wilson': 48,

  // PGY-1
  'Brock': 36,
  'Celmins': 38,
  'Hobgood': 36,
  'Klem': 51,
  'Parker': 40,
  'Parmer': 35,
  'Perez': 20,
  'Peterson': 21,
  'Roland': 42,
  'Shipp': 30,
  'Simon': 28,
  'Smith': 17,
};

async function run() {
  const rosterRaw = fs.readFileSync('roster.csv', 'utf8');
  const lines = rosterRaw.split('\n').map(l => l.trim()).filter(l => l && !l.startsWith('Resident Name'));
  
  const resultsToInsert = [];

  for (const line of lines) {
    const parts = line.split(',');
    const name = parts[0];
    const email = parts[1];
    const pgy = parts[2];
    
    // Find matching key in legacyPoints
    let matchedKey = null;
    for (const key of Object.keys(legacyPoints)) {
      if (name.includes(key)) {
        // Special case for Nguyens
        if (key === 'Nguyen' && name.includes('Thienly')) {
          matchedKey = key;
        } else if (key === 'Nguyen, A' && name.includes('Angela')) {
          matchedKey = key;
        } else if (!key.includes('Nguyen')) {
          matchedKey = key;
        }
      }
    }

    if (matchedKey) {
      const points = legacyPoints[matchedKey];
      resultsToInsert.push({
        topic: '2024-2025 Legacy System Migration',
        score: 0,
        total: 0,
        percentage: 100,
        academic_points: points,
        legacy_email: email,
        category_stats: {}
      });
      console.log(`Matched: ${name} (${email}) -> ${points} APs`);
      delete legacyPoints[matchedKey]; // mark as processed
    }
  }

  // Check if any were missed
  const missedKeys = Object.keys(legacyPoints);
  if (missedKeys.length > 0) {
    console.error('WARNING: Could not find matches for these residents in roster.csv:');
    console.error(missedKeys);
  }

  console.log(`\nReady to insert ${resultsToInsert.length} records...`);

  const { data, error } = await supabase
    .from('results')
    .insert(resultsToInsert);

  if (error) {
    console.error('Error inserting records:', error);
  } else {
    console.log('Successfully inserted all legacy points records!');
  }
}

run().catch(console.error);
