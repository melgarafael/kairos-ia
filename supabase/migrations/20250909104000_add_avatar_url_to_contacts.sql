-- Add avatar_url column to whatsapp_contacts if it doesn't exist
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.columns 
        WHERE table_name = 'whatsapp_contacts' 
        AND column_name = 'avatar_url'
    ) THEN
        ALTER TABLE whatsapp_contacts 
        ADD COLUMN avatar_url text;
    END IF;
END $$;
