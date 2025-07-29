-- Add content column to notifications table
ALTER TABLE public.notifications 
ADD COLUMN IF NOT EXISTS content TEXT;

-- Update existing rows to move data from message to content if needed
DO $$
BEGIN
    -- Check if message column exists and has data
    IF EXISTS (SELECT 1 FROM information_schema.columns 
               WHERE table_schema = 'public' 
               AND table_name = 'notifications' 
               AND column_name = 'message') THEN
        
        -- Copy data from message to content where content is null
        UPDATE public.notifications 
        SET content = message 
        WHERE content IS NULL AND message IS NOT NULL;
        
        -- Optionally, drop the message column if no longer needed
        -- ALTER TABLE public.notifications DROP COLUMN message;
    END IF;
END $$;

-- Update RLS policies if they reference the message column
-- (Add your RLS policy updates here if needed)
