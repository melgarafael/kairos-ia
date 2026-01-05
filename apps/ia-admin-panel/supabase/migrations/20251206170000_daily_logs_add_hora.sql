-- Add hora (time) field to daily_logs to allow multiple entries per day
-- This enables users to track their feelings throughout the day as they change

-- Add id column if not exists (as primary key)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'daily_logs' 
    AND column_name = 'id'
  ) THEN
    ALTER TABLE public.daily_logs ADD COLUMN id uuid PRIMARY KEY DEFAULT gen_random_uuid();
  END IF;
END $$;

-- Add hora column (stores time as HH:MM format)
ALTER TABLE public.daily_logs 
ADD COLUMN IF NOT EXISTS hora text DEFAULT to_char(now() AT TIME ZONE 'UTC', 'HH24:MI');

-- Add updated_at column for tracking edits
ALTER TABLE public.daily_logs 
ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- Create index for better query performance on date + time
DROP INDEX IF EXISTS idx_daily_logs_user_date;
CREATE INDEX IF NOT EXISTS idx_daily_logs_user_date_hora 
ON public.daily_logs(user_id, data DESC, hora DESC);

-- Add comment for documentation
COMMENT ON COLUMN public.daily_logs.hora IS 'Time of the entry in HH:MM format, allowing multiple check-ins per day';

