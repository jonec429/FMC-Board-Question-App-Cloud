import { supabase } from './supabase';
import { getESTDate, getTodayDateString, isPastNoon } from './qotd';

export async function processGamification(
  userId: string,
  isQotd: boolean,
  isCorrect: boolean,
  questionId?: string,
  totalQuestionsAnsweredInBlock?: number,
  blockScorePercentage?: number
) {
  try {
    const todayStr = getTodayDateString();
    const estNow = getESTDate();
    const estHour = estNow.getHours();
    const estMinute = estNow.getMinutes();

    // 1. Fetch user streaks
    let { data: streakData } = await supabase
      .from('user_streaks')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (!streakData) {
      // Initialize if missing
      const { data: newStreak } = await supabase
        .from('user_streaks')
        .insert({ user_id: userId })
        .select()
        .single();
      streakData = newStreak;
    }

    if (!streakData) return; // Should not happen

    // 2. Process QOTD Streaks
    if (isQotd) {
      let { current_qotd_streak, max_qotd_streak, current_qotd_correct_streak, max_qotd_correct_streak, last_qotd_date } = streakData;

      // Check if they missed a weekday
      let streakBroken = false;
      if (last_qotd_date && last_qotd_date !== todayStr) {
        const lastDate = new Date(last_qotd_date);
        const todayDate = getESTDate();
        todayDate.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);

        // Count weekdays between last date and today
        let missedWeekdays = 0;
        let tempDate = new Date(lastDate);
        tempDate.setDate(tempDate.getDate() + 1);

        while (tempDate < todayDate) {
          const day = tempDate.getDay();
          if (day !== 0 && day !== 6) {
            missedWeekdays++;
          }
          tempDate.setDate(tempDate.getDate() + 1);
        }

        // If they missed at least 1 weekday, or if they are submitting today but past noon (meaning they missed the 12pm deadline today, wait, the submission is blocked after 12pm anyway in UI)
        if (missedWeekdays > 0) {
          streakBroken = true;
        }
      }

      if (streakBroken) {
        current_qotd_streak = 0;
        current_qotd_correct_streak = 0;
      }

      // Increment streaks (only if they haven't already answered today)
      if (last_qotd_date !== todayStr) {
        current_qotd_streak += 1;
        max_qotd_streak = Math.max(max_qotd_streak, current_qotd_streak);

        if (isCorrect) {
          current_qotd_correct_streak += 1;
          max_qotd_correct_streak = Math.max(max_qotd_correct_streak, current_qotd_correct_streak);
        } else {
          current_qotd_correct_streak = 0;
        }
      }

      // Save updated streaks
      await supabase.from('user_streaks').update({
        current_qotd_streak,
        max_qotd_streak,
        current_qotd_correct_streak,
        max_qotd_correct_streak,
        last_qotd_date: todayStr
      }).eq('user_id', userId);

      // --- BADGE EVALUATION (QOTD) ---
      await evaluateBadge(userId, 'QOTD 5x Streak', current_qotd_streak >= 5);
      await evaluateBadge(userId, 'QOTD 10x Streak', current_qotd_streak >= 10);

      // Check "Just in Time" (11:55am - 11:59am EST)
      if (estHour === 11 && estMinute >= 55 && estMinute <= 59) {
        await evaluateBadge(userId, 'Just in Time', true);
      }

      // Check "First to Answer"
      if (questionId) {
        const { count } = await supabase
          .from('question_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('question_id', questionId)
          .eq('is_qotd', true)
          .gte('created_at', todayStr + 'T00:00:00Z');

        // if count is exactly 1 (meaning the one they just inserted is the ONLY one)
        if (count === 1) {
          await evaluateBadge(userId, 'First to Answer', true);
        }
      }
    }

    // 3. Process Block Badges
    if (!isQotd && totalQuestionsAnsweredInBlock) {
      if (blockScorePercentage === 100) {
        await evaluateBadge(userId, 'Flawless Victory', true);
      }

      if (estHour >= 0 && estHour < 4) {
        await evaluateBadge(userId, 'Night Owl', true);
      }

      // Check Marathoner (100 total questions answered)
      const { count } = await supabase
        .from('question_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (count && count >= 100) {
        await evaluateBadge(userId, 'Marathoner', true);
      }
    }

  } catch (err) {
    console.error('Error processing gamification:', err);
  }
}

async function evaluateBadge(userId: string, badgeName: string, condition: boolean) {
  if (!condition) return;

  // Find badge
  const { data: badge } = await supabase
    .from('badges')
    .select('id')
    .eq('name', badgeName)
    .single();

  if (!badge) return;

  // Insert to user_badges (on conflict do nothing is handled by DB unique constraint)
  await supabase.from('user_badges').insert({
    user_id: userId,
    badge_id: badge.id
  }).catch(() => { /* Ignore duplicate key errors */ });
}
