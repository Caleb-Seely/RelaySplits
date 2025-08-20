-- Create backups table for timing data backup system
CREATE TABLE IF NOT EXISTS public.backups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
    legId INTEGER NOT NULL,
    timestamp BIGINT NOT NULL,
    data JSONB NOT NULL,
    deviceId TEXT NOT NULL,
    operation TEXT NOT NULL CHECK (operation IN ('create', 'update', 'delete')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_backups_team_id ON public.backups(team_id);
CREATE INDEX IF NOT EXISTS idx_backups_leg_id ON public.backups(legId);
CREATE INDEX IF NOT EXISTS idx_backups_timestamp ON public.backups(timestamp);
CREATE INDEX IF NOT EXISTS idx_backups_team_leg_timestamp ON public.backups(team_id, legId, timestamp DESC);

-- Enable RLS
ALTER TABLE public.backups ENABLE ROW LEVEL SECURITY;

-- Create RLS policies (simplified for now, will be updated in later migration)
CREATE POLICY "Users can view backups for their teams" ON public.backups
    FOR SELECT USING (true);

CREATE POLICY "Users can insert backups for their teams" ON public.backups
    FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update backups for their teams" ON public.backups
    FOR UPDATE USING (true);

-- Create function to automatically update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for updated_at
CREATE TRIGGER update_backups_updated_at 
    BEFORE UPDATE ON public.backups 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();
