const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

const envPath = path.resolve(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split(/\r?\n/).forEach(line => {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    if (value.startsWith('"') && value.endsWith('"')) value = value.slice(1, -1);
    if (value.startsWith("'") && value.endsWith("'")) value = value.slice(1, -1);
    env[match[1]] = value.trim();
  }
});

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY
);

const OLD_EMAIL = 'isaac.smith@ascension.org';
const NEW_EMAIL = 'isaac.smith1@ascension.org';
const NEW_USER_ID = '44f06046-034e-4449-9924-5b59f4212c78';

async function migrate() {
  console.log(`Starting migration from ${OLD_EMAIL} to ${NEW_EMAIL} (user_id: ${NEW_USER_ID})...`);

  // 1. Fetch current attendance records
  const { data: attendanceRows, error: attFetchErr } = await supabase
    .from('attendance')
    .select('*')
    .eq('resident_email', OLD_EMAIL);

  if (attFetchErr) {
    console.error('Error fetching attendance rows:', attFetchErr);
    process.exit(1);
  }

  // 2. Fetch current results records
  const { data: resultsRows, error: resFetchErr } = await supabase
    .from('results')
    .select('*')
    .eq('legacy_email', OLD_EMAIL);

  if (resFetchErr) {
    console.error('Error fetching results rows:', resFetchErr);
    process.exit(1);
  }

  // 3. Backup records before modification
  const backup = {
    timestamp: new Date().toISOString(),
    oldEmail: OLD_EMAIL,
    newEmail: NEW_EMAIL,
    newUserId: NEW_USER_ID,
    attendanceCount: attendanceRows.length,
    resultsCount: resultsRows.length,
    attendanceRows,
    resultsRows
  };

  const backupPath = path.resolve(__dirname, 'isaac_smith_migration_backup.json');
  fs.writeFileSync(backupPath, JSON.stringify(backup, null, 2), 'utf8');
  console.log(`Saved backup of ${attendanceRows.length} attendance rows and ${resultsRows.length} results rows to: ${backupPath}`);

  // 4. Update attendance table
  console.log(`Updating ${attendanceRows.length} attendance rows...`);
  const { data: attUpdateData, error: attUpdateErr } = await supabase
    .from('attendance')
    .update({
      resident_email: NEW_EMAIL,
      user_id: NEW_USER_ID
    })
    .eq('resident_email', OLD_EMAIL)
    .select('id');

  if (attUpdateErr) {
    console.error('Error updating attendance table:', attUpdateErr);
    process.exit(1);
  }
  console.log(`Updated attendance rows count: ${attUpdateData?.length}`);

  // 5. Update results table
  console.log(`Updating ${resultsRows.length} results rows...`);
  const { data: resUpdateData, error: resUpdateErr } = await supabase
    .from('results')
    .update({
      legacy_email: NEW_EMAIL,
      user_id: NEW_USER_ID
    })
    .eq('legacy_email', OLD_EMAIL)
    .select('id');

  if (resUpdateErr) {
    console.error('Error updating results table:', resUpdateErr);
    process.exit(1);
  }
  console.log(`Updated results rows count: ${resUpdateData?.length}`);

  // 6. Verification
  console.log('\n--- Running Verification ---');
  const { count: remainingOldAtt } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('resident_email', OLD_EMAIL);

  const { count: newAttCount } = await supabase
    .from('attendance')
    .select('*', { count: 'exact', head: true })
    .eq('resident_email', NEW_EMAIL);

  const { count: remainingOldRes } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('legacy_email', OLD_EMAIL);

  const { count: newResCount } = await supabase
    .from('results')
    .select('*', { count: 'exact', head: true })
    .eq('legacy_email', NEW_EMAIL);

  console.log({
    remainingOldAttendance: remainingOldAtt,
    newAttendanceCount: newAttCount,
    remainingOldResults: remainingOldRes,
    newResultsCount: newResCount
  });

  // Verify Leaderboard stats
  const { data: leaderboard } = await supabase
    .rpc('get_leaderboard_stats', { p_academic_year: 0 });

  const isaacEntry = leaderboard?.find(r => r.legacy_email?.toLowerCase() === NEW_EMAIL.toLowerCase());
  console.log('Leaderboard stats for new email:', isaacEntry);

  console.log('\nMigration completed successfully!');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
