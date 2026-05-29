-- migrate_push_receipts.sql

CREATE TABLE IF NOT EXISTS public.push_receipts (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    run_id text NOT NULL,
    endpoint text NOT NULL,
    email text,
    delivered_at timestamptz DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_receipts ENABLE ROW LEVEL SECURITY;

-- Allow authenticated users to view receipts
CREATE POLICY "Allow authenticated read access on push_receipts" 
ON public.push_receipts FOR SELECT 
TO authenticated 
USING (true);

-- Allow service role to manage receipts
CREATE POLICY "Allow service role all access on push_receipts"
ON public.push_receipts FOR ALL
TO service_role
USING (true);
