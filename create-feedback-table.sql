-- Create feedback table
CREATE TABLE IF NOT EXISTS feedback (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE,
    device_id TEXT,
    team_name TEXT,
    display_name TEXT,
    feedback_text TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_feedback_team_id ON feedback(team_id);
CREATE INDEX IF NOT EXISTS idx_feedback_device_id ON feedback(device_id);
CREATE INDEX IF NOT EXISTS idx_feedback_created_at ON feedback(created_at);

-- Enable RLS
ALTER TABLE feedback ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Allow anyone to insert feedback (no authentication required)
CREATE POLICY "Allow public feedback insertion" ON feedback
    FOR INSERT WITH CHECK (true);

-- Only allow viewing feedback if you're the team owner or have admin access
CREATE POLICY "Allow team owners to view feedback" ON feedback
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM public.team_devices td
            WHERE td.team_id = feedback.team_id
            AND td.device_id = feedback.device_id
            AND td.role IN ('admin')
        )
    );

-- Create updated_at trigger
CREATE OR REPLACE FUNCTION update_feedback_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_feedback_updated_at
    BEFORE UPDATE ON feedback
    FOR EACH ROW
    EXECUTE FUNCTION update_feedback_updated_at();
