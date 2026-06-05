import { supabase } from './supabase';
import { getESTDate, getTodayDateString, isPastNoon } from './qotd';

export async function processGamification(
  userId: string,
  isQotd: boolean,
  isCorrect: boolean,
  questionId?: string,
  totalQuestionsAnsweredInBlock?: number,
  blockScorePercentage?: number,
  timingStatus?: string,
  topicCategory?: string
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
      .maybeSingle();

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
        // Parse YYYY-MM-DD as a LOCAL date. `new Date('2026-06-04')` parses as
        // UTC midnight, which in Eastern time is the evening before — shifting the
        // day back one and fabricating a "missed weekday" every single day, which
        // reset the streak to 1. Mirrors the safe parse used in getQotdHistory.
        const [ly, lm, ld] = last_qotd_date.split('-').map(Number);
        const lastDate = new Date(ly, lm - 1, ld);
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
      await evaluateBadge(userId, 'QOTD 30x Streak', current_qotd_streak >= 30);

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

    // 3. Process Block Badges & Streaks
    if (!isQotd && totalQuestionsAnsweredInBlock) {
      // 3a. Block Streak
      let { current_block_streak, max_block_streak, last_block_date } = streakData;

      if (timingStatus === 'On Time' || timingStatus === 'Early') {
        current_block_streak = (current_block_streak || 0) + 1;
        max_block_streak = Math.max(max_block_streak || 0, current_block_streak);
      } else if (timingStatus === 'Late') {
        current_block_streak = 0;
      }

      await supabase.from('user_streaks').update({
        current_block_streak,
        max_block_streak,
        last_block_date: estNow.toISOString()
      }).eq('user_id', userId);

      // 3b. Badges
      await evaluateBadge(userId, 'First Step', true); // Everyone who submits gets this if they don't have it

      if (blockScorePercentage === 100) {
        await evaluateBadge(userId, 'Perfect Block', true);
      }

      if (estHour >= 0 && estHour < 4) {
        await evaluateBadge(userId, 'Night Owl', true);
      }

      // Check Clubs (100 - 1000 questions)
      const { count: totalQCount } = await supabase
        .from('question_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (totalQCount) {
        if (totalQCount >= 100) await evaluateBadge(userId, '100 Club', true);
        if (totalQCount >= 200) await evaluateBadge(userId, '200 Club', true);
        if (totalQCount >= 300) await evaluateBadge(userId, '300 Club', true);
        if (totalQCount >= 400) await evaluateBadge(userId, '400 Club', true);
        if (totalQCount >= 500) await evaluateBadge(userId, '500 Club', true);
        if (totalQCount >= 600) await evaluateBadge(userId, '600 Club', true);
        if (totalQCount >= 700) await evaluateBadge(userId, '700 Club', true);
        if (totalQCount >= 800) await evaluateBadge(userId, '800 Club', true);
        if (totalQCount >= 900) await evaluateBadge(userId, '900 Club', true);
        if (totalQCount >= 1000) await evaluateBadge(userId, '1k Club', true);
      }

      // 3c. Topic Master (100% completion of latest ITE for this category)
      if (topicCategory && topicCategory !== 'Mixed Review Block' && topicCategory !== 'Demo Quiz') {
        // Find max year for this category
        const { data: maxYearData } = await supabase
          .from('questions')
          .select('year')
          .eq('category', topicCategory)
          .order('year', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (maxYearData && maxYearData.year) {
          const targetYear = maxYearData.year;
          
          // Get total questions in that category & year
          const { count: targetCount } = await supabase
            .from('questions')
            .select('*', { count: 'exact', head: true })
            .eq('category', topicCategory)
            .eq('year', targetYear);

          if (targetCount && targetCount > 0) {
            // Check how many of those specific questions the user has answered
            // 1. Get IDs of target questions
            const { data: targetQData } = await supabase
              .from('questions')
              .select('id')
              .eq('category', topicCategory)
              .eq('year', targetYear);
              
            if (targetQData) {
              const targetIds = targetQData.map(q => q.id);
              
              // 2. Count distinct attempts by user for those IDs
              const { data: attemptsData } = await supabase
                .from('question_attempts')
                .select('question_id')
                .eq('user_id', userId)
                .in('question_id', targetIds);
                
              if (attemptsData) {
                const uniqueAttemptedIds = new Set(attemptsData.map(a => a.question_id));
                if (uniqueAttemptedIds.size >= targetCount) {
                  const badgeName = `Topic Master: ${topicCategory}`;
                  await evaluateBadge(userId, badgeName, true, {
                    description: `Answered every question for ${topicCategory} from the most recent ITE.`,
                    icon: '🎓',
                    type: 'block'
                  });
                }
              }
            }
          }
        }
      }
    }

  } catch (err) {
    console.error('Error processing gamification:', err);
  }
}

async function evaluateBadge(
  userId: string, 
  badgeName: string, 
  condition: boolean, 
  createIfNotExists?: { description: string; icon: string; type: string }
) {
  if (!condition) return;

  // Find badge
  let { data: badge } = await supabase
    .from('badges')
    .select('id')
    .eq('name', badgeName)
    .maybeSingle();

  if (!badge && createIfNotExists) {
    // Create the badge dynamically
    const { data: newBadge } = await supabase
      .from('badges')
      .insert({
        name: badgeName,
        description: createIfNotExists.description,
        icon: createIfNotExists.icon,
        type: createIfNotExists.type
      })
      .select('id')
      .single();
      
    badge = newBadge;
  }

  if (!badge) return;

  // Insert to user_badges. A duplicate (the user already earned this badge) is
  // expected and harmless. supabase-js returns errors as values rather than
  // throwing, so inspect the result instead of relying on try/catch — 23505 is
  // the unique-violation code we intentionally ignore; anything else we log.
  const { error: insertError } = await supabase.from('user_badges').insert({
    user_id: userId,
    badge_id: badge.id
  });
  if (insertError && insertError.code !== '23505') {
    console.warn(`Failed to award badge "${badgeName}":`, insertError.message);
  }
}
