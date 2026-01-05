-- Extend human_design_profiles to store full API data
-- The raw_data column already exists, but we'll add structured columns for key fields

ALTER TABLE public.human_design_profiles
ADD COLUMN IF NOT EXISTS assinatura text,
ADD COLUMN IF NOT EXISTS tema_nao_self text,
ADD COLUMN IF NOT EXISTS definicao text,
ADD COLUMN IF NOT EXISTS digestao text,
ADD COLUMN IF NOT EXISTS sentido text,
ADD COLUMN IF NOT EXISTS sentido_design text,
ADD COLUMN IF NOT EXISTS motivacao text,
ADD COLUMN IF NOT EXISTS perspectiva text,
ADD COLUMN IF NOT EXISTS ambiente text,
ADD COLUMN IF NOT EXISTS variaveis jsonb,
ADD COLUMN IF NOT EXISTS planetas_personalidade jsonb,
ADD COLUMN IF NOT EXISTS planetas_design jsonb,
ADD COLUMN IF NOT EXISTS data_nascimento_utc text,
ADD COLUMN IF NOT EXISTS data_design_utc text;

-- Add comments for documentation
COMMENT ON COLUMN public.human_design_profiles.variaveis IS 'Variables: {Digestion, Environment, Awareness, Perspective} with left/right arrows';
COMMENT ON COLUMN public.human_design_profiles.planetas_personalidade IS 'Personality planets with Gate, Line, Color, Tone, Base, FixingState';
COMMENT ON COLUMN public.human_design_profiles.planetas_design IS 'Design planets with Gate, Line, Color, Tone, Base, FixingState';

