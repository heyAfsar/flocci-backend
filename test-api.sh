#!/bin/bash

# Flocci Backend API Test Suite
echo "🚀 Starting Flocci Backend API Test Suite..."
echo "================================================"

BASE_URL="http://localhost:3000"
TEST_EMAIL="test.$(date +%s)@example.com"
TEST_PASSWORD="password123"
TEST_NAME="Test User $(date +%s)"

echo "📧 Test User: $TEST_EMAIL"
echo ""

# Test 1: Health Check
echo "🏥 Test 1: Health Check"
curl -s -X GET "$BASE_URL/api/health" | jq '.' || echo "Health check failed"
echo ""

# Test 2: User Signup
echo "🧪 Test 2: User Signup"
SIGNUP_RESPONSE=$(curl -s -X POST "$BASE_URL/api/signup" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\",
    \"full_name\": \"$TEST_NAME\"
  }")
echo "$SIGNUP_RESPONSE" | jq '.' || echo "Signup failed"
echo ""

# Test 3: User Login
echo "🔐 Test 3: User Login"
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"$TEST_PASSWORD\"
  }")
echo "$LOGIN_RESPONSE" | jq '.' || echo "Login failed"

# Extract session token
SESSION_TOKEN=$(echo "$LOGIN_RESPONSE" | jq -r '.session_token // empty')
echo "Session Token: ${SESSION_TOKEN:0:20}..."
echo ""

# Test 4: Session Validation
echo "📋 Test 4: Session Validation"
if [ -n "$SESSION_TOKEN" ]; then
  curl -s -X GET "$BASE_URL/api/auth/session" \
    -H "Cookie: session_token=$SESSION_TOKEN" | jq '.' || echo "Session validation failed"
else
  echo "❌ No session token available for validation"
fi
echo ""

# Test 5: Google OAuth Initiation
echo "🔗 Test 5: Google OAuth"
curl -s -X POST "$BASE_URL/api/auth/google" | jq '.' || echo "Google OAuth failed"
echo ""

# Test 6: Logout
echo "🚪 Test 6: Logout"
if [ -n "$SESSION_TOKEN" ]; then
  curl -s -X DELETE "$BASE_URL/api/auth/session" \
    -H "Cookie: session_token=$SESSION_TOKEN" | jq '.' || echo "Logout failed"
else
  curl -s -X DELETE "$BASE_URL/api/auth/session" | jq '.' || echo "Logout failed"
fi
echo ""

# Test 7: Invalid Login
echo "❌ Test 7: Invalid Login"
curl -s -X POST "$BASE_URL/api/login" \
  -H "Content-Type: application/json" \
  -d "{
    \"email\": \"invalid@example.com\",
    \"password\": \"wrongpassword\"
  }" | jq '.' || echo "Invalid login test failed"
echo ""

echo "✅ Test Suite Completed!"
echo "================================================"
