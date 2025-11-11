#!/bin/bash

# Test script for Google OAuth endpoints
BASE_URL="http://localhost:3000"

echo "=================================="
echo "Testing Google OAuth Endpoints"
echo "=================================="

echo ""
echo "Test 1: OAuth Redirect Flow (Existing)"
echo "---------------------------------------"
echo "POST $BASE_URL/api/auth/google (empty body)"
curl -X POST "$BASE_URL/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' 2>/dev/null || echo "Response received"

echo ""
echo ""
echo "Test 2: Google One Tap Flow (New)"
echo "---------------------------------------"
echo "POST $BASE_URL/api/auth/google (with credential)"
echo "Note: This will fail without a valid Google ID token"
echo "Expected: 401 Invalid Google credential"
curl -X POST "$BASE_URL/api/auth/google" \
  -H "Content-Type: application/json" \
  -d '{"credential":"invalid_token_for_testing"}' \
  -w "\nHTTP Status: %{http_code}\n" \
  2>/dev/null | jq '.' 2>/dev/null || echo "Response received"

echo ""
echo ""
echo "=================================="
echo "Tests Complete!"
echo "=================================="
echo ""
echo "To test with a real Google One Tap token:"
echo "1. Start the dev server: npm run dev"
echo "2. Implement Google One Tap on frontend"
echo "3. Use the actual ID token from Google"
echo ""
