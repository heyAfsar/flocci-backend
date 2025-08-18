# Google OAuth Fix for Supabase

## Problem
Users getting "Database error saving new user" when logging in via Google OAuth.

## Root Cause
When a user signs up via Google OAuth, Supabase creates a record in `auth.users` but doesn't automatically create a corresponding record in your `public.profiles` table. The RLS policies expect a profile to exist.

## Solution

### Method 1: Automatic Fix (Recommended)
Run the fix script:
```bash
./fix-auth.sh
```

### Method 2: Manual Setup
If the script doesn't work, manually run these steps in your Supabase SQL editor:

1. **Apply the trigger fix:**
   - Go to your Supabase dashboard
   - Navigate to SQL Editor
   - Copy and paste the contents of `sql/fix_auth_trigger.sql`
   - Execute the query

2. **Enable RLS properly:**
   ```sql
   -- Ensure RLS is properly configured
   ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
   
   -- Update the insert policy to allow trigger creation
   DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
   CREATE POLICY "Users can insert their own profile"
       ON public.profiles FOR INSERT
       WITH CHECK (auth.uid() = id OR auth.role() = 'supabase_auth_admin');
   ```

3. **Test the setup:**
   - Try logging in with Google OAuth
   - Check if a profile is created automatically
   - Verify no more database errors

### Method 3: Environment Variables Check
Ensure these environment variables are set:
```
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
APP_URL=your_app_url
```

## How It Works

1. **Trigger Function:** `handle_new_user()` automatically creates a profile when a user is inserted into `auth.users`
2. **Fallback Handler:** The auth callback also checks and creates profiles if missing
3. **Error Handling:** Both methods include error handling to prevent login failures

## Verification

After applying the fix:

1. **Check trigger exists:**
   ```sql
   SELECT * FROM information_schema.triggers 
   WHERE trigger_name = 'on_auth_user_created';
   ```

2. **Test Google login:**
   - Use the Google OAuth flow
   - Check that a profile is created in `public.profiles`
   - Verify no more "Database error saving new user" errors

3. **Check profiles table:**
   ```sql
   SELECT p.*, au.email 
   FROM public.profiles p 
   JOIN auth.users au ON p.id = au.id;
   ```

## Troubleshooting

### Issue: Trigger still not working
**Solution:** Check RLS policies and permissions:
```sql
GRANT USAGE ON SCHEMA public TO supabase_auth_admin;
GRANT ALL ON public.profiles TO supabase_auth_admin;
```

### Issue: Profile creation fails in callback
**Solution:** Check service role key permissions and ensure it has bypass RLS capability.

### Issue: Users still can't login
**Solution:** Temporarily disable RLS on profiles table for testing:
```sql
ALTER TABLE public.profiles DISABLE ROW LEVEL SECURITY;
-- Test login, then re-enable:
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
```

## Files Modified
- `sql/fix_auth_trigger.sql` - Database trigger fix
- `src/app/api/auth/callback/route.ts` - Enhanced callback handler
- `fix-auth.sh` - Automated fix script
