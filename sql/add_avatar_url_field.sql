-- Add avatar_url field to profiles table
-- Run this in Supabase SQL Editor

ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Add comment
COMMENT ON COLUMN public.profiles.avatar_url IS 'User profile picture URL from OAuth provider or uploaded image';

-- Update existing profiles with avatar URLs from auth.users metadata
UPDATE public.profiles 
SET avatar_url = COALESCE(
  au.raw_user_meta_data->>'avatar_url',
  au.raw_user_meta_data->>'picture'
)
FROM auth.users au
WHERE public.profiles.id = au.id
  AND public.profiles.avatar_url IS NULL
  AND (
    au.raw_user_meta_data->>'avatar_url' IS NOT NULL OR 
    au.raw_user_meta_data->>'picture' IS NOT NULL
  );

-- Update the auto-creation trigger to include avatar_url
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, avatar_url, role, updated_at)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', NEW.raw_user_meta_data->>'picture'),
    'user',
    NOW()
  )
  ON CONFLICT (id) DO UPDATE SET
    full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
    email = COALESCE(EXCLUDED.email, public.profiles.email),
    avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
    updated_at = NOW();
  
  RETURN NEW;
EXCEPTION
  WHEN others THEN
    -- Log the error but don't fail the user creation
    RAISE WARNING 'Failed to create/update profile for user %: %', NEW.id, SQLERRM;
    RETURN NEW;
END;
$$ language 'plpgsql' SECURITY DEFINER;

SELECT 'Avatar URL field added successfully and trigger updated!' as message;
