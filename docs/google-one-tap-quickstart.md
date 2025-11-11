# Google One Tap - Frontend Quick Start

## 🚀 Ready to Use!
The backend now supports Google One Tap authentication.

## Endpoint
```
POST /api/auth/google
```

## Request Format
```json
{
  "credential": "eyJhbGciOiJSUzI1NiIsImtpZCI6..." // Google ID token
}
```

## Response Format
```json
{
  "user": {
    "id": "user_uuid",
    "email": "user@example.com",
    "name": "User Name",
    "role": "user"
  },
  "session_token": "your_secure_token",
  "expiresAt": "2024-11-18T12:00:00.000Z"
}
```

## HTML Setup
```html
<script src="https://accounts.google.com/gsi/client" async defer></script>

<div id="g_id_onload"
     data-client_id="547138038457-vfv8e8cqkqd19rjqd7ebtlgbfslqmlgm.apps.googleusercontent.com"
     data-callback="handleCredentialResponse">
</div>
<div class="g_id_signin" data-type="standard"></div>
```

## JavaScript Handler
```javascript
async function handleCredentialResponse(response) {
  try {
    const res = await fetch('http://localhost:3000/api/auth/google', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ credential: response.credential })
    });
    
    const data = await res.json();
    
    if (res.ok) {
      // Store session token
      localStorage.setItem('session_token', data.session_token);
      localStorage.setItem('user', JSON.stringify(data.user));
      
      // Redirect to dashboard
      window.location.href = '/dashboard';
    } else {
      console.error('Login failed:', data.error);
      alert('Login failed: ' + data.error);
    }
  } catch (error) {
    console.error('Network error:', error);
    alert('Login failed. Please try again.');
  }
}
```

## Use Session Token
```javascript
// In authenticated API calls
const response = await fetch('/api/protected-endpoint', {
  headers: {
    'Authorization': `Bearer ${localStorage.getItem('session_token')}`
  }
});
```

## Error Handling
- **401**: Invalid or expired Google credential
- **500**: Server error (check logs)

## Testing
1. Add the HTML to your login page
2. Click "Sign in with Google"
3. Check console for response
4. Verify session token is stored

## Backward Compatibility ✅
The existing OAuth redirect flow still works:
```javascript
// Old way (still works)
POST /api/auth/google
Body: {}
Response: { "url": "https://accounts.google.com/..." }
```

## Need Help?
- Check `/docs/google-one-tap-implementation.md` for full details
- Test with `./test-google-auth.sh`
- Console logs show detailed flow information
