-- Create the QOTD Schedule table
CREATE TABLE IF NOT EXISTS public.qotd_schedule (
    schedule_date DATE PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.qotd_schedule ENABLE ROW LEVEL SECURITY;

-- Allow read access for authenticated users
CREATE POLICY "Allow read access for authenticated users" 
ON public.qotd_schedule
FOR SELECT 
TO authenticated 
USING (true);

-- Allow all access for admins (assuming we have an admin role or rely on service role)
-- For this app, service role usually manages this, or admin can update it

-- Generate initial schedule for the next 365 days using questions from the last 3 years
-- This is a procedural block to populate the table automatically based on existing questions
DO $$
DECLARE
    q_record RECORD;
    current_schedule_date DATE := CURRENT_DATE;
BEGIN
    -- Only insert if the table is currently empty
    IF NOT EXISTS (SELECT 1 FROM public.qotd_schedule) THEN
        FOR q_record IN 
            SELECT id FROM public.questions 
            WHERE year >= (EXTRACT(YEAR FROM CURRENT_DATE) - 3)
            ORDER BY year DESC, id ASC -- Newest first, deterministic order
        LOOP
            INSERT INTO public.qotd_schedule (schedule_date, question_id)
            VALUES (current_schedule_date, q_record.id);
            
            -- Increment date (skip weekends)
            current_schedule_date := current_schedule_date + INTERVAL '1 day';
            
            -- Keep incrementing until it's a weekday
            WHILE EXTRACT(ISODOW FROM current_schedule_date) > 5 LOOP
                current_schedule_date := current_schedule_date + INTERVAL '1 day';
            END LOOP;
        END LOOP;
    END IF;
END $$;
