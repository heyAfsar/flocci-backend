#!/bin/bash

# Multiple Sessions Login Test
echo "🔄 Testing Multiple Sessions Login Scenarios..."
echo "================================================"

BASE_URL="http://localhost:3001"
TEST_EMAIL="multisession.$(date +%s)@example.com"
TEST_PASSWORD="password123"
TEST_NAME="Multi Session User $(date +%s)"

echo "📧 Test User: $TEST_EMAIL"
echo ""

# First, create a test user
echo "👤 Creating test user..."
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"full_name\": \"$TEST_NAME\"
  }")
echo "$SIGNUP_RESPONSE" | jq '.' || echo "Signup response: $SIGNUP_RESPONSE"
echo ""

# Test multiple rapid login attempts (should now use user-based rate limiting)
echo "🔀 Test 1: Multiple rapid login attempts from same IP..."
for i in {1..10}; do
  echo "Login attempt $i:"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -H "User-Agent: Device-$i-Browser" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"$TEST_PASSWORD\"
    }")
  
  STATUS=$(echo "$RESPONSE" | jq -r '.message // .error')
  echo "  Result: $STATUS"
  
  # Check if we got rate limited
  if echo "$RESPONSE" | grep -q "Too many"; then
    echo "  ⚠️  Rate limited on attempt $i"
    RETRY_AFTER=$(echo "$RESPONSE" | jq -r '.retryAfter // "unknown"')
    echo "  ⏱️  Retry after: $RETRY_AFTER seconds"
    break
  fi
  
  sleep 1
done
echo ""

# Test login with different user agent (simulating different device)
echo "📱 Test 2: Login from different device (different User-Agent)..."
DEVICE2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -H "User-Agent: iPhone-Safari-Mobile" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")
echo "$DEVICE2_RESPONSE" | jq '.' || echo "Device 2 response: $DEVICE2_RESPONSE"
echo ""

# Test with wrong password (should hit user rate limit, not IP)
echo "❌ Test 3: Failed login attempts (wrong password)..."
for i in {1..8}; do
  echo "Failed attempt $i:"
  RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
    -H "Content-Type: application/json" \
    -d "{
      \"email\": \"$TEST_EMAIL\",
      \"password\": \"wrongpassword\"
    }")
  
  STATUS=$(echo "$RESPONSE" | jq -r '.message // .error')
  echo "  Result: $STATUS"
  
  if echo "$RESPONSE" | grep -q "Too many"; then
    echo "  ⚠️  User rate limited on attempt $i"
    RETRY_AFTER=$(echo "$RESPONSE" | jq -r '.retryAfter // "unknown"')
    echo "  ⏱️  Retry after: $RETRY_AFTER seconds"
    break
  fi
  
  sleep 0.5
done
echo ""

# Test if different user can still login from same IP
echo "👥 Test 4: Different user login from same IP..."
DIFFERENT_EMAIL="different.$(date +%s)@example.com"

# Create different user
echo "Creating different user: $DIFFERENT_EMAIL"
SIGNUP2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DIFFERENT_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"full_name\": \"Different User\"
  }")

# Try login with different user
LOGIN2_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$DIFFERENT_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")
echo "$LOGIN2_RESPONSE" | jq '.' || echo "Different user response: $LOGIN2_RESPONSE"
echo ""

echo "✅ Multiple Sessions Test Completed!"
echo "================================================"
echo ""
echo "💡 Expected behavior:"
echo "   - User-specific rate limiting should block individual accounts"
echo "   - Other users from same IP should still be able to login"
echo "   - IP blocks should have shorter cooldown for auth endpoints (5 min vs 15 min)"
echo "   - Rate limit increased from 5 to 15 requests per 5 minutes"
