#!/bin/bash

# Script to apply Supabase auth fixes
# Run this script to fix Google OAuth user creation issues

echo "🔧 Applying Supabase Auth Fixes..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "npm install -g supabase"
    exit 1
fi

# Check if we're in a Supabase project
if [ ! -f "supabase/config.toml" ]; then
    echo "❌ No Supabase project found. Please run 'supabase init' first or ensure you're in the right directory."
    exit 1
fi

# Apply the auth trigger fix
echo "📝 Applying auth trigger fix..."
supabase db push --file sql/fix_auth_trigger.sql

if [ $? -eq 0 ]; then
    echo "✅ Auth trigger fix applied successfully!"
else
    echo "❌ Failed to apply auth trigger fix. Please check your Supabase connection and try again."
    echo "You can also manually run the SQL in sql/fix_auth_trigger.sql in your Supabase dashboard."
fi

echo ""
echo "🎯 Next steps:"
echo "1. Test Google OAuth login again"
echo "2. Check Supabase dashboard for any remaining RLS policy issues"
echo "3. Monitor logs for any authentication errors"
echo ""
echo "📊 To check if the fix worked:"
echo "- Try logging in with Google"
echo "- Check if a profile is created in the 'profiles' table"
echo "- Verify no more 'Database error saving new user' errors"
