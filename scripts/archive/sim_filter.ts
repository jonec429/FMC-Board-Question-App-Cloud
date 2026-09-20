import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl!, supabaseKey!);

export function getCurrentAcademicYear(now: Date = new Date()): number {
  const month = now.getMonth();
  const date = now.getDate();
  const year = now.getFullYear();
  const isRollover = month > 5 || (month === 5 && date >= 14);
  return isRollover ? year + 1 : year;
}

async function run() {
  const { data: blocks } = await supabase.from('blocks').select('*');
  const { data: block_schedule } = await supabase.from('block_schedule').select('*');
  
  if (!blocks || !block_schedule) return;
  
  const selectedYear = 2027; // AY 26-27

  const filtered = blocks.filter(b => {
    let year = b.academic_year ? Number(b.academic_year) : 0;
    if (!year || isNaN(year) || year === 0) {
      const sched = block_schedule.find((s: any) => s.block_id === b.id);
      if (sched?.end_date) {
        const d = new Date(sched.end_date + "T12:00:00Z");
        year = d.getFullYear() + (d.getMonth() >= 6 ? 1 : 0);
      } else {
        year = getCurrentAcademicYear();
      }
    }
    return year === selectedYear;
  });

  console.log(`Blocks passing filter for selectedYear=${selectedYear}:`);
  for (const b of filtered) {
    console.log(` - ${b.title} (DB AY: ${b.academic_year})`);
  }
}
run();
