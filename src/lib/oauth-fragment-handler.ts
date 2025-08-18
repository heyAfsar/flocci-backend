/**
 * Frontend JavaScript to handle Google OAuth URL fragments
 * Add this to your frontend login page or as a separate page
 */

export function handleOAuthFragments() {
  // Check if we're on the client side and have fragments
  if (typeof window === 'undefined') return;
  
  const hash = window.location.hash;
  
  if (hash && hash.includes('access_token=')) {
    console.log('Detected OAuth fragments, processing...');
    
    // Parse the URL fragments
    const params = new URLSearchParams(hash.substring(1));
    const accessToken = params.get('access_token');
    const refreshToken = params.get('refresh_token');
    const expiresAt = params.get('expires_at');
    
    // Also try to get user_id from the token (decode JWT)
    let userId = null;
    if (accessToken) {
      try {
        const payload = JSON.parse(atob(accessToken.split('.')[1]));
        userId = payload.sub;
      } catch (e) {
        console.error('Failed to decode token:', e);
      }
    }
    
    if (accessToken && userId) {
      // Send to backend for processing
      fetch('https://apis.flocci.in/api/auth/fragment-handler', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          access_token: accessToken,
          refresh_token: refreshToken,
          user_id: userId,
          expires_at: expiresAt
        })
      })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          // Clear the URL fragments and redirect
          window.history.replaceState(null, '', window.location.pathname);
          window.location.href = data.redirect;
        } else {
          console.error('Fragment processing failed:', data.error);
          window.location.href = '/login?error=fragment_processing_failed';
        }
      })
      .catch(error => {
        console.error('Network error:', error);
        window.location.href = '/login?error=network_error';
      });
    } else {
      console.error('Missing required OAuth parameters');
      window.location.href = '/login?error=missing_oauth_params';
    }
  }
}

// Auto-run on page load
if (typeof window !== 'undefined') {
  window.addEventListener('load', handleOAuthFragments);
}
