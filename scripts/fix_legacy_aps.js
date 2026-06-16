import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const targetPoints = {
  // PGY-3
  'emily.abernethy@ascension.org': 33,
  'breana.bess@ascension.org': 31,
  'katherine.bohn@ascension.org': 25,
  'addison.brown@ascension.org': 30,
  'lais.cabrera@ascension.org': 11,
  'lili.cohen@ascension.org': 22,
  'anita.fazeli@ascension.org': 19,
  'natasha.narvel@ascension.org': 17,
  'thien.ly.nguyen@ascension.org': 29,
  'mary.vargas@ascension.org': 33,

  // PGY-2
  'claire.boettcher@ascension.org': 26,
  'tiara.dean@ascension.org': 34,
  'elise.gonzalez@ascension.org': 30,
  'ruby.gravrok@ascension.org': 26,
  'brianna.kemmer@ascension.org': 25,
  'katherine.lemus@ascension.org': 31,
  'trisha.louis@ascension.org': 31,
  'morgan.martinez1@ascension.org': 26,
  'angela.nguyen1@ascension.org': 33,
  'adam.robak@ascension.org': 44,
  'austin.varni@ascension.org': 42,
  'paige.wilson@ascension.org': 48,

  // PGY-1
  'katelyn.brock@ascension.org': 36,
  'steven.celmins@ascension.org': 38,
  'jackson.hobgood@ascension.org': 36,
  'danielle.klem@ascension.org': 51,
  'keisha.parker@ascension.org': 40,
  'emma.parmer@ascension.org': 35,
  'lauren.perez@ascension.org': 20,
  'caleb.peterson@ascension.org': 21,
  'brian.roland@ascension.org': 42,
  'arianne.shipp@ascension.org': 30,
  'annlisa.simon@ascension.org': 28,
  'isaac.smith@ascension.org': 17,
};

async function run() {
  console.log('Deleting previous migration records...');
  const { error: delError } = await supabase
    .from('results')
    .delete()
    .eq('topic', '2024-2025 Legacy System Migration');
    
  if (delError) {
    console.error('Error deleting old records:', delError);
    return;
  }
  console.log('Deleted previously inserted migration records.');

  console.log('Fetching current leaderboard stats...');
  const { data: currentStats, error: statsError } = await supabase
    .rpc('get_leaderboard_stats', { p_academic_year: 0 });

  if (statsError) {
    console.error('Error fetching stats:', statsError);
    return;
  }

  const currentPointsMap = {};
  for (const row of currentStats) {
    if (row.legacy_email) {
      currentPointsMap[row.legacy_email.toLowerCase()] = Number(row.total_points);
    }
  }

  const resultsToInsert = [];
  for (const [email, target] of Object.entries(targetPoints)) {
    const current = currentPointsMap[email] || 0;
    const diff = target - current;

    if (diff !== 0) {
      resultsToInsert.push({
        topic: '2024-2025 Legacy System Migration',
        score: 0,
        total: 0,
        percentage: 100,
        academic_points: diff,
        legacy_email: email,
        category_stats: {}
      });
      console.log(`${email}: Target=${target}, Current=${current}, Diff=${diff}`);
    } else {
      console.log(`${email}: Target=${target}, Current=${current}, Diff=0 (No action)`);
    }
  }

  if (resultsToInsert.length > 0) {
    const { error: insertError } = await supabase
      .from('results')
      .insert(resultsToInsert);

    if (insertError) {
      console.error('Error inserting corrected records:', insertError);
    } else {
      console.log(`Successfully inserted ${resultsToInsert.length} corrected records!`);
    }
  } else {
    console.log('No records needed inserting.');
  }
}

run().catch(console.error);
