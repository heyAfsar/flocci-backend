# PayU Payment Gateway Configuration

## Overview
This project integrates with PayU payment gateway for processing payments. PayU provides separate environments for testing and production.

## Environment Configuration

### Test Environment (Current)
```bash
PAYU_KEY=gtKFFx
PAYU_SALT=eCwWELxi
PAYU_ENV=test
```
- **URL**: `https://test.payu.in/_payment`
- **Purpose**: Development and testing
- **Card Numbers**: Use PayU test card numbers for testing

### Production Environment
```bash
PAYU_KEY=8IYKB1
PAYU_SALT=K9rBSGk44fa1hxU9b5VX3whsr8TwDQMT
PAYU_ENV=production
```
- **URL**: `https://secure.payu.in/_payment`
- **Purpose**: Live transactions with real money
- **Requirements**: Valid PayU merchant account

## Test Card Numbers
For testing in PayU test environment, use these card numbers:

### Successful Transactions
- **Visa**: 4111111111111111
- **MasterCard**: 5123456789012346
- **CVV**: Any 3 digits
- **Expiry**: Any future date

### Failed Transactions
- **Card**: 4000000000000002 (Declined card)

## API Integration

### 1. Payment Initiation
**Endpoint**: `POST /api/payments/initiate`

**Request Body**:
```json
{
  "amount": "100.00",
  "productinfo": "Product Description",
  "firstname": "Customer Name",
  "email": "customer@example.com",
  "phone": "1234567890"
}
```

**Response**: HTML form that auto-submits to PayU

### 2. Success Callback
**Endpoint**: `GET /api/payments/success`
- Handles successful payment responses from PayU
- Updates order status in database
- Redirects user to success page

### 3. Failure Callback
**Endpoint**: `GET /api/payments/failure`
- Handles failed payment responses from PayU
- Updates order status in database
- Redirects user to failure page

### 4. Server-to-Server Callback
**Endpoint**: `POST /api/payments/callback`
- Receives payment status updates from PayU
- Verifies payment hash for security
- Updates order status in database

## Hash Generation
PayU requires SHA-512 hash for security:

```typescript
const hashString = `${key}|${txnid}|${amount}|${productinfo}|${firstname}|${email}|||||||||||${salt}`;
const hash = crypto.createHash("sha512").update(hashString).digest("hex");
```

## Environment Switching

### Development → Production Checklist
1. ✅ Update `PAYU_KEY` and `PAYU_SALT` to production values
2. ✅ Set `PAYU_ENV=production`
3. ✅ Verify callback URLs are accessible from PayU servers
4. ✅ Test with small amounts first
5. ✅ Monitor transaction logs

### Current Configuration Status
- **Environment**: Test
- **Key**: gtKFFx (PayU Test Key)
- **Salt**: eCwWELxi (PayU Test Salt)
- **URL**: https://test.payu.in/_payment

## Testing Checklist
- [ ] Payment initiation works
- [ ] Success callback processes correctly
- [ ] Failure callback processes correctly
- [ ] Hash verification works
- [ ] Order status updates in database
- [ ] User receives proper feedback

## Security Notes
1. **Never expose salt in client-side code**
2. **Always verify hash in callbacks**
3. **Use HTTPS for all callback URLs**
4. **Validate all payment parameters**
5. **Log all payment transactions**

## Troubleshooting

### Common Errors
1. **"Incorrect key or salt"**
   - Verify you're using correct test/production credentials
   - Check environment variable values

2. **"Hash mismatch"**
   - Verify hash generation logic
   - Check parameter order in hash string

3. **"Callback URL not reachable"**
   - Ensure URLs are publicly accessible
   - Check SSL certificates

### Contact Information
- **PayU Support**: Contact your Account Manager
- **Documentation**: https://devguide.payu.in/
- **Test Environment**: https://test.payu.in/

## Current Status
✅ **Test Environment Active**
- Ready for development and testing
- Use test card numbers for transactions
- Safe for development without real money
