-- Expand HD Library Schema for Ra Uru Hu Doctrine
-- Adds category, source attribution, and priority for 80/20 content organization

-- Add category column for content organization
ALTER TABLE public.hd_library_entries 
ADD COLUMN IF NOT EXISTS category text;

-- Add source URL for canonical reference tracking
ALTER TABLE public.hd_library_entries 
ADD COLUMN IF NOT EXISTS source_url text;

-- Add priority for 80/20 content (higher = more important)
-- Priority 100 = Core (Type, Strategy, Authority)
-- Priority 80 = Essential (Not-Self, Signature, Definition)
-- Priority 60 = Important (Centers, Profiles)
-- Priority 40 = Secondary (Channels, Gates)
-- Priority 20 = Advanced (Variables, Substructure)
ALTER TABLE public.hd_library_entries 
ADD COLUMN IF NOT EXISTS priority integer DEFAULT 50;

-- Add search vector for full-text search
ALTER TABLE public.hd_library_entries 
ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Create indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_hd_library_category 
ON public.hd_library_entries(category);

CREATE INDEX IF NOT EXISTS idx_hd_library_priority 
ON public.hd_library_entries(priority DESC);

CREATE INDEX IF NOT EXISTS idx_hd_library_search_vector 
ON public.hd_library_entries USING gin(search_vector);

-- Create function to update search vector
CREATE OR REPLACE FUNCTION hd_library_search_vector_update() 
RETURNS trigger AS $$
BEGIN
  NEW.search_vector := 
    setweight(to_tsvector('portuguese', coalesce(NEW.title, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.slug, '')), 'B') ||
    setweight(to_tsvector('portuguese', coalesce(NEW.content, '')), 'C');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic search vector update
DROP TRIGGER IF EXISTS hd_library_search_vector_trigger ON public.hd_library_entries;
CREATE TRIGGER hd_library_search_vector_trigger
  BEFORE INSERT OR UPDATE ON public.hd_library_entries
  FOR EACH ROW
  EXECUTE FUNCTION hd_library_search_vector_update();

-- Update existing entries to populate search vector
UPDATE public.hd_library_entries 
SET search_vector = 
  setweight(to_tsvector('portuguese', coalesce(title, '')), 'A') ||
  setweight(to_tsvector('portuguese', coalesce(slug, '')), 'B') ||
  setweight(to_tsvector('portuguese', coalesce(content, '')), 'C');

-- Add comment for documentation
COMMENT ON COLUMN public.hd_library_entries.category IS 'Content category: tipo, estrategia, autoridade, centro, perfil, definicao, canal, porta, variavel, not-self, assinatura';
COMMENT ON COLUMN public.hd_library_entries.source_url IS 'Canonical source URL from Jovian Archive or Desenho Humano Brasil';
COMMENT ON COLUMN public.hd_library_entries.priority IS 'Content priority for 80/20 rule: 100=Core, 80=Essential, 60=Important, 40=Secondary, 20=Advanced';

