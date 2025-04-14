-- Create a table for storing waitlist signups
CREATE TABLE IF NOT EXISTS public.waitlist (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL UNIQUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT now() NOT NULL,
    notes TEXT
);

-- Set up Row Level Security (RLS)
ALTER TABLE public.waitlist ENABLE ROW LEVEL SECURITY;

-- Create policy for admin access
CREATE POLICY "Admins can do everything" ON public.waitlist
    FOR ALL
    TO authenticated
    USING (auth.jwt() ? 'aud' AND auth.jwt()->>'aud' = 'authenticated')
    WITH CHECK (auth.jwt() ? 'aud' AND auth.jwt()->>'aud' = 'authenticated');

-- Create policy for public insert only
CREATE POLICY "Allow anonymous insert" ON public.waitlist
    FOR INSERT
    TO anon
    WITH CHECK (true); 