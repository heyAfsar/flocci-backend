-- Run this to create profiles for existing users who don't have them

INSERT INTO public.profiles (id, full_name, email, role, updated_at)
SELECT 
  au.id,
  COALESCE(au.raw_user_meta_data->>'full_name', au.raw_user_meta_data->>'name', split_part(au.email, '@', 1)) as full_name,
  au.email,
  'user' as role,
  NOW() as updated_at
FROM auth.users au
LEFT JOIN public.profiles p ON p.id = au.id
WHERE p.id IS NULL  -- Only for users without profiles
  AND au.email IS NOT NULL;

-- Check the results
SELECT 
  COUNT(*) as total_auth_users,
  (SELECT COUNT(*) FROM public.profiles) as total_profiles,
  COUNT(*) - (SELECT COUNT(*) FROM public.profiles) as missing_profiles
FROM auth.users;
