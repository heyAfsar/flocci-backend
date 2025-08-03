-- Add interview_marks table to existing database
-- Run this in your Supabase SQL Editor

-- Interview Marks Table (for Amity recruitment)
CREATE TABLE IF NOT EXISTS public.interview_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_email VARCHAR(255) UNIQUE NOT NULL,
    interview_marks JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for interview_marks
ALTER TABLE public.interview_marks ENABLE ROW LEVEL SECURITY;

-- Interview marks policies (restrict to authorized users only)
-- Note: Adjust these policies based on your authentication setup
CREATE POLICY "interview_marks_select_policy"
    ON public.interview_marks FOR SELECT
    USING (true); -- For now, allow all reads - you can restrict this later

CREATE POLICY "interview_marks_insert_policy"
    ON public.interview_marks FOR INSERT
    WITH CHECK (true); -- For now, allow all inserts - you can restrict this later

CREATE POLICY "interview_marks_update_policy"
    ON public.interview_marks FOR UPDATE
    USING (true); -- For now, allow all updates - you can restrict this later

-- Add trigger for updated_at (if you have the handle_updated_at function)
-- CREATE TRIGGER set_updated_at
--     BEFORE UPDATE ON public.interview_marks
--     FOR EACH ROW
--     EXECUTE FUNCTION handle_updated_at();

-- Add comment
COMMENT ON TABLE public.interview_marks IS 'Stores candidate interview marks and evaluation data for Amity recruitment';

-- Grant necessary permissions
GRANT SELECT, INSERT, UPDATE ON public.interview_marks TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.interview_marks TO anon;
