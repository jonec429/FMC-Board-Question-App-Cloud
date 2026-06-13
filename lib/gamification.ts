import { supabase } from './supabase';
import { getESTDate, getTodayDateString, isPastNoon } from './qotd';
import { getRecentITEYears } from './questionFilters';

export async function processGamification(
  userId: string,
  isQotd: boolean,
  isCorrect: boolean,
  questionId?: string,
  totalQuestionsAnsweredInBlock?: number,
  blockScorePercentage?: number,
  timingStatus?: string,
  topicCategory?: string,
  /** The active block's end_date (YYYY-MM-DD) — drives the "Procrastinator" badge. */
  blockDueDate?: string
) {
  try {
    const todayStr = getTodayDateString();
    const estNow = getESTDate();
    const estHour = estNow.getHours();
    const estMinute = estNow.getMinutes();

    // 0. Fetch all existing badges to reduce DB calls during evaluation
    const { data: allBadgesData } = await supabase.from('badges').select('id, name');
    const badgeMap = new Map((allBadgesData || []).map((b: any) => [b.name, b.id]));
    
    // 0.5 Fetch user's existing badges to ensure we only report TRULY new badges
    const { data: existingUserBadges } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);
    const existingBadgeIds = new Set((existingUserBadges || []).map((ub: any) => ub.badge_id));
    
    const earnedBadgeIds = new Set<string>();

    const evaluateBadge = async (badgeName: string, condition: boolean, createIfNotExists?: { description: string; icon: string; type: string }) => {
      if (!condition) return;
      let badgeId = badgeMap.get(badgeName);
      
      if (!badgeId && createIfNotExists) {
        // Create the badge dynamically
        const { data: newBadge } = await supabase
          .from('badges')
          .insert({ name: badgeName, ...createIfNotExists })
          .select('id')
          .single();
        if (newBadge) {
          badgeId = newBadge.id;
          badgeMap.set(badgeName, badgeId);
        }
      }
      
      
      if (badgeId && !existingBadgeIds.has(badgeId)) {
        earnedBadgeIds.add(badgeId);
      }
    };

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
      await evaluateBadge('QOTD 5x Streak', current_qotd_streak >= 5);
      await evaluateBadge('QOTD 10x Streak', current_qotd_streak >= 10);
      await evaluateBadge('QOTD 30x Streak', current_qotd_streak >= 30);
      // Sharpshooter — correct QOTD answers on consecutive days (correct-streak, not just participation).
      await evaluateBadge('Sharpshooter', current_qotd_correct_streak >= 5);

      // Check "Just in Time" — answered in the 5 minutes before the 12:30 PM unlock
      if (estHour === 12 && estMinute >= 25 && estMinute <= 29) {
        await evaluateBadge('Just in Time', true);
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
          await evaluateBadge('First to Answer', true);
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

      // On-time block-streak ladder
      await evaluateBadge('On a Roll', current_block_streak >= 3);
      await evaluateBadge('Locked In', current_block_streak >= 5);
      await evaluateBadge('Unstoppable', current_block_streak >= 10);

      // 3b. Badges
      await evaluateBadge('First Step', true); // Everyone who submits gets this if they don't have it

      if (blockScorePercentage === 100) {
        await evaluateBadge('Perfect Block', true);
      }

      if (estHour >= 0 && estHour < 4) {
        await evaluateBadge('Night Owl', true);
      }

      // Early Bird — block wrapped up in the early-morning hours (4–6am EST)
      if (estHour >= 4 && estHour < 6) {
        await evaluateBadge('Early Bird', true);
      }

      // Weekend Warrior — block completed on a weekend (EST)
      const estDay = estNow.getDay(); // 0 = Sunday, 6 = Saturday
      if (estDay === 0 || estDay === 6) {
        await evaluateBadge('Weekend Warrior', true);
      }

      // Check Clubs (100 - 1000 questions)
      const { count: totalQCount } = await supabase
        .from('question_attempts')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', userId);
        
      if (totalQCount) {
        if (totalQCount >= 100) await evaluateBadge('100 Club', true);
        if (totalQCount >= 140) await evaluateBadge('Ironman', true);
        if (totalQCount >= 200) await evaluateBadge('200 Club', true);
        if (totalQCount >= 300) await evaluateBadge('300 Club', true);
        if (totalQCount >= 400) await evaluateBadge('400 Club', true);
        if (totalQCount >= 500) await evaluateBadge('500 Club', true);
        if (totalQCount >= 600) await evaluateBadge('600 Club', true);
        if (totalQCount >= 700) await evaluateBadge('700 Club', true);
        if (totalQCount >= 800) await evaluateBadge('800 Club', true);
        if (totalQCount >= 900) await evaluateBadge('900 Club', true);
        if (totalQCount >= 1000) await evaluateBadge('1k Club', true);
      }

      // Perfectionist — 100% on 5 different blocks. This block's result row is
      // already saved by the time gamification runs, so it's included.
      const { data: perfectResults } = await supabase
        .from('results')
        .select('topic')
        .eq('user_id', userId)
        .gte('percentage', 100);
      if (perfectResults) {
        const distinctPerfect = new Set(
          perfectResults
            .map((r: any) => r.topic)
            .filter((t: any) => t && !String(t).toLowerCase().includes('demo'))
        );
        await evaluateBadge('Perfectionist', distinctPerfect.size >= 5);
      }

      // Procrastinator — assigned block turned in on its last day or the day before.
      // timingStatus 'On Time'/'Early' already guarantees this is the active assigned
      // block (not a custom/mixed build), and blockDueDate is that block's end_date.
      if (blockDueDate && (timingStatus === 'On Time' || timingStatus === 'Early')) {
        const [dy, dm, dd] = String(blockDueDate).split('-').map(Number);
        const [ty, tm, td] = getTodayDateString().split('-').map(Number);
        if (dy && dm && dd && ty && tm && td) {
          const due = new Date(dy, dm - 1, dd);
          const today0 = new Date(ty, tm - 1, td);
          const daysUntilDue = Math.round((due.getTime() - today0.getTime()) / 86400000);
          if (daysUntilDue >= 0 && daysUntilDue <= 1) {
            await evaluateBadge('Procrastinator', true);
          }
        }
      }

      // 3c. Topic Master — answered every question in this category across the
      // 3 most recent ITE years (matches the app-wide freshness window).
      if (topicCategory && topicCategory !== 'Mixed Review Block' && topicCategory !== 'Demo Quiz') {
        // The 3 newest ITE years across the whole bank (dedup + sort handled by getRecentITEYears).
        const { data: yearRows } = await supabase
          .from('questions')
          .select('year')
          .not('year', 'is', null)
          .neq('year', 'Demo')
          .neq('year', 'Unspecified');
        const recentYears = getRecentITEYears((yearRows || []).map((r: any) => r.year));

        if (recentYears.length > 0) {
          // Target = every question in this category within those years.
          const { data: targetQData } = await supabase
            .from('questions')
            .select('id')
            .eq('category', topicCategory)
            .in('year', recentYears);
          const targetIds = (targetQData || []).map((q: any) => q.id);

          if (targetIds.length > 0) {
            const { data: attemptsData } = await supabase
              .from('question_attempts')
              .select('question_id')
              .eq('user_id', userId)
              .in('question_id', targetIds);
            const uniqueAttemptedIds = new Set((attemptsData || []).map((a: any) => a.question_id));

            if (uniqueAttemptedIds.size >= targetIds.length) {
              const badgeName = `Topic Master: ${topicCategory}`;
              await evaluateBadge(badgeName, true, {
                description: `Answered every ${topicCategory} question from the 3 most recent ITEs.`,
                icon: '🎓',
                type: 'block'
              });
            }
          }
        }
      }
    }

    // 3d. Over Achiever
    // Get all standard badges (excluding Topic Master and Over Achiever itself)
    const baseBadges = (allBadgesData || []).filter((b: any) => 
      !b.name.startsWith('Topic Master: ') && b.name !== 'Over Achiever'
    );
    const baseBadgeIds = new Set(baseBadges.map((b: any) => b.id));

    if (baseBadgeIds.size > 0) {
      // Get user's current badges from the database to combine with what they earned this session
      const allUserBadgeIds = new Set([
        ...Array.from(existingBadgeIds),
        ...Array.from(earnedBadgeIds)
      ]);

      // Check if all user badge IDs contain every single base badge ID
      const hasAllBaseBadges = Array.from(baseBadgeIds).every(id => allUserBadgeIds.has(id));

      if (hasAllBaseBadges) {
        await evaluateBadge('Over Achiever', true, {
          description: 'Unlocked every standard achievement in the app. Incredible work!',
          icon: '👑',
          type: 'block'
        });
      }
    }

    // 4. Batch upsert all earned badges to drastically reduce DB calls
    if (earnedBadgeIds.size > 0) {
      const batchInsert = Array.from(earnedBadgeIds).map(id => ({
        user_id: userId,
        badge_id: id
      }));
      
      const { error: upsertError } = await supabase.from('user_badges').upsert(
        batchInsert, 
        { onConflict: 'user_id, badge_id', ignoreDuplicates: true }
      );
      
      if (upsertError) {
        console.warn('Failed to batch-award badges:', upsertError.message);
      } else {
        // Fetch badge details to return for UI overlay
        const { data: newBadgesInfo } = await supabase
          .from('badges')
          .select('id, name, description, icon')
          .in('id', Array.from(earnedBadgeIds));
          
        return { 
          newlyEarnedBadgeIds: Array.from(earnedBadgeIds),
          newlyEarnedBadges: newBadgesInfo || [] 
        };
      }
    }
    
    return { newlyEarnedBadgeIds: [], newlyEarnedBadges: [] };

  } catch (err) {
    console.error('Error processing gamification:', err);
  }
}
