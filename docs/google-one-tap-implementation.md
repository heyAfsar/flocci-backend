# Google One Tap Integration - Backend Implementation

## Overview
Added support for Google One Tap ID token authentication to the `/api/auth/google` endpoint while maintaining full backward compatibility with the existing OAuth redirect flow.

## Changes Made

### 1. Package Installation
- Installed `google-auth-library` package for ID token verification
- Version: Latest (installed via `npm install google-auth-library`)

### 2. Updated `/src/app/api/auth/google/route.ts`

#### New Imports
```typescript
import { OAuth2Client } from 'google-auth-library';
import { createClient } from '@supabase/supabase-js';
import { createSession } from '@/lib/auth';
```

#### New Components
- **Google OAuth2 Client**: Configured with client ID for ID token verification
- **Supabase Admin Client**: For user creation and profile management
- **Dual Flow Detection**: Checks for `credential` field in request body

## API Behavior

### Flow 1: Google One Tap (NEW) ✨
**Request:**
```bash
POST /api/auth/google
Content-Type: application/json

{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6IjI3M..." // Google ID token (JWT)
}
```

**Response (Success - 200):**
```json
{
  "user": {
    "id": "uuid-here",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  },
  "session_token": "secure_session_token_here",
  "expiresAt": "2024-11-18T12:00:00.000Z"
}
```

**Response (Error - 401):**
```json
{
  "error": "Invalid Google credential",
  "details": "Error message"
}
```

#### Processing Steps:
1. Verifies ID token using Google's OAuth2Client
2. Extracts user info: `sub` (Google ID), `email`, `name`, `picture`
3. Checks if user exists in `custom_users` table
4. If not exists:
   - Creates or finds user in Supabase Auth
   - Creates entry in `custom_users` table
   - Upserts profile in `profiles` table
5. Generates secure session token (7-day expiry)
6. Returns user data + session token

### Flow 2: OAuth Redirect (EXISTING) 🔄
**Request:**
```bash
POST /api/auth/google
Content-Type: application/json

{}  # Empty body or no 'credential' field
```

**Response (Success - 200):**
```json
{
  "message": "Redirect to Google OAuth",
  "url": "https://accounts.google.com/o/oauth2/v2/auth?..."
}
```

**Behavior:** Unchanged - returns OAuth redirect URL for traditional flow

## Database Schema

### Tables Used
1. **custom_users**: Stores user credentials and basic info
   - `id` (UUID, primary key)
   - `email` (unique)
   - `full_name`
   - `role`
   - `password_hash` (empty for OAuth users)

2. **profiles**: Extended user profile information
   - `id` (UUID, references custom_users)
   - `full_name`
   - `email`
   - `avatar_url` (from Google profile picture)
   - `role`
   - `updated_at`

3. **sessions**: Session management
   - `user_id` (references custom_users)
   - `token` (hashed session token)
   - `expires_at`

## Security Features

1. **Token Verification**: Uses Google's official library to verify ID tokens
2. **Audience Validation**: Ensures token was issued for our client ID
3. **Secure Sessions**: Generates cryptographically secure session tokens
4. **Token Hashing**: Session tokens are hashed before storage
5. **7-Day Expiry**: Sessions automatically expire after 7 days

## Configuration

### Environment Variables Required
```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key

# App
APP_URL=https://your-domain.com  # For OAuth redirect

# Google OAuth (already configured)
# Client ID is hardcoded: 547138038457-vfv8e8cqkqd19rjqd7ebtlgbfslqmlgm.apps.googleusercontent.com
```

## Testing

### Test Script
Run `./test-google-auth.sh` to test both flows:
```bash
chmod +x test-google-auth.sh
./test-google-auth.sh
```

### Manual Testing

#### Test OAuth Redirect Flow:
```bash
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{}'
```

#### Test Google One Tap Flow:
```bash
# Get a real ID token from Google One Tap on frontend
curl -X POST http://localhost:3000/api/auth/google \
  -H "Content-Type: application/json" \
  -d '{"credential":"<ACTUAL_GOOGLE_ID_TOKEN>"}'
```

## Frontend Integration

### Google One Tap Implementation
```html
<!-- Add to your HTML -->
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div id="g_id_onload"
     data-client_id="547138038457-vfv8e8cqkqd19rjqd7ebtlgbfslqmlgm.apps.googleusercontent.com"
     data-callback="handleCredentialResponse">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

### JavaScript Callback
```javascript
function handleCredentialResponse(response) {
  // response.credential contains the ID token
  fetch('http://localhost:3000/api/auth/google', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ credential: response.credential })
  })
  .then(res => res.json())
  .then(data => {
    // data.user - user information
    // data.session_token - store this for authenticated requests
    // data.expiresAt - session expiration time
    
    // Store session token
    localStorage.setItem('session_token', data.session_token);
    
    // Redirect or update UI
    window.location.href = '/dashboard';
  })
  .catch(error => {
    console.error('Login failed:', error);
  });
}
```

### Using Session Token
```javascript
// Include in API requests
fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
  }
});
```

## Backward Compatibility ✅

- **Existing OAuth flow**: Completely unchanged
- **Response format**: OAuth redirect flow returns same structure
- **Session format**: Both flows create compatible sessions
- **Database structure**: No breaking changes to existing tables
- **Client code**: Existing OAuth implementations continue to work

## Error Handling

### Common Errors

| Error | Status | Cause | Solution |
|-------|--------|-------|----------|
| Invalid token payload | 401 | Token verification failed | Check token is valid Google ID token |
| Email not found in token | 401 | Email missing from Google profile | Ensure email scope is requested |
| Failed to create user account | 500 | Database error | Check Supabase configuration |
| Failed to create user profile | 500 | Profile table error | Verify database schema |

## Monitoring & Logging

Console logs are added for debugging:
- `=== GOOGLE LOGIN API CALLED ===` - Entry point
- `=== Processing Google One Tap ID Token ===` - ID token flow
- `=== Processing OAuth Redirect Flow ===` - OAuth flow
- `Token verified for: <email>` - Successful verification
- `Creating new user for: <email>` - New user creation
- `✅ Google One Tap login successful for: <email>` - Success

## Next Steps

1. **Frontend Implementation**: Add Google One Tap button to login page
2. **Testing**: Test with real Google accounts
3. **Monitoring**: Add analytics for flow usage
4. **Documentation**: Update API docs with new endpoint behavior

## Files Modified
- `/src/app/api/auth/google/route.ts` - Main implementation
- `/package.json` - Added google-auth-library dependency

## Files Created
- `/test-google-auth.sh` - Test script for both flows
- `/docs/google-one-tap-implementation.md` - This documentation
