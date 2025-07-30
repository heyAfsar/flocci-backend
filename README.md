# FLOCCI API HUB

A secure and scalable backend service by Flocci Technologies (flocci.in), built with Next.js, Supabase, and Redis, providing comprehensive authentication, payment processing, OAuth integration, and admin monitoring capabilities.

## ✨ Features

### 🔐 **Authentication & Authorization**
  - **Custom Authentication**: Secure user signup/login with custom database tables
  - **Session Management**: Token-based sessions with Redis caching
  - **Google OAuth**: Seamless Google login integration via Supabase Auth
  - **Password Security**: Multi-layer encryption with salt and pepper
  - **Role-Based Access**: User, Admin, and Company role management
  - **Session Validation**: Secure token verification and automatic expiration

### 💳 **Payment Processing**
  - **PayU Gateway Integration**: Complete payment flow implementation
  - **Secure Transactions**: Hash verification and order tracking
  - **Payment Status Management**: Real-time status updates
  - **Order Management**: Complete order lifecycle tracking
  - **Payment Logging**: Comprehensive transaction audit trail
  - **Webhook Handling**: Automated payment status callbacks

### 🛡️ **Security & Protection**
  - **Dynamic Rate Limiting**: Route-specific rate limiting with Redis
  - **IP Management**: Whitelisting, blocking, and automatic unblocking
  - **Request Encryption**: AES-256-GCM encryption for sensitive data
  - **CSRF Protection**: Built-in middleware protection
  - **Input Validation**: Zod schema validation for all endpoints
  - **Error Handling**: Comprehensive error logging and monitoring

### 📊 **Admin Dashboard & Monitoring**
  - **Real-time Analytics**: Payment and system metrics
  - **System Health Monitoring**: Error tracking and performance metrics
  - **Rate Limit Management**: Dynamic rate limit configuration
  - **IP Management Dashboard**: Block/unblock IP addresses
  - **User Management**: Admin user oversight capabilities
  - **System Metrics**: Database performance and API usage statistics

### 📧 **Communication & Notifications**
  - **Contact Forms**: General and company-specific contact handling
  - **Email Notifications**: Automated SMTP with Gmail integration
  - **Career Applications**: Job application processing
  - **AI-Powered Email Resolution**: Company email detection using Gemini AI
  - **File Upload Support**: Secure attachment handling
  - **Template-based Emails**: Professional email templates

### 🏢 **Business Features**
  - **Job Listings**: Complete job posting and management system
  - **Company Profiles**: Company information and contact management
  - **Application Tracking**: Job application lifecycle management
  - **Profile Management**: Extended user profile capabilities
  - **Multi-tenant Support**: Company-specific data isolation

## 🛠️ Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Database**: Supabase (PostgreSQL) with Row Level Security (RLS)
- **Caching & Sessions**: Upstash Redis
- **Authentication**: Custom auth + Supabase OAuth (Google)
- **Email Service**: Nodemailer with Gmail SMTP
- **AI Integration**: Google Gemini for intelligent email resolution
- **Payment Gateway**: PayU Integration with webhook support
- **Security**: Node.js crypto module, rate limiting, IP filtering
- **Validation**: Zod schema validation
- **API Documentation**: Postman collection included
- **Development**: TypeScript, ESLint, Hot reload

## 📋 Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account and project
- Upstash Redis instance
- Gmail account with App Specific Password
- PayU merchant account (for payments)
- Google Cloud account (for Gemini AI)

## 🚀 Quick Start

### 1. Clone and Install
```bash
git clone https://github.com/heyAfsar/flocci-backend.git
cd flocci-backend
npm install
```

### 2. Environment Setup
Create a `.env` file in the root directory:

```properties
# SMTP Configuration
SMTP_HOST=smtp.gmail.com
SMTP_PORT=465
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-specific-password
ADMIN_EMAIL=admin@example.com
SMTP_BCC=bcc@example.com

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key

# AI Integration
GEMINI_API_KEY=your-google-gemini-api-key

# Payment Gateway (PayU)
PAYU_KEY=your-payu-merchant-key
PAYU_SALT=your-payu-salt
PAYU_SURL=https://your-domain.com/api/payments/success
PAYU_FURL=https://your-domain.com/api/payments/failure

# Security & Encryption
ENCRYPTION_KEY=your-32-byte-hex-encryption-key
PASSWORD_PEPPER=your-random-password-pepper-string

# Redis & Caching
UPSTASH_REDIS_URL=https://your-upstash-redis-url
UPSTASH_REDIS_TOKEN=your-upstash-redis-token

# Application Configuration
APP_URL=https://your-domain.com
ADMIN_EMAILS=admin1@example.com,admin2@example.com
WHITELISTED_IPS=127.0.0.1,::1,your-trusted-ips
```

### 3. Database Setup
Run the SQL schema in your Supabase SQL Editor:

```bash
# The complete schema is provided in: /sql/complete_schema_with_custom_auth.sql
# This creates all necessary tables, indexes, RLS policies, and triggers
```

### 4. Start Development Server
```bash
npm run dev
# Server will start at http://localhost:3000
```

### 5. Import Postman Collection
Import `Flocci-Backend-API.postman_collection.json` into Postman for API testing.

## 📡 API Documentation

### 🔐 Authentication Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/signup` | Create new user account | ❌ |
| `POST` | `/api/login` | User authentication | ❌ |
| `GET` | `/api/auth/session` | Validate current session | ✅ |
| `DELETE` | `/api/auth/session` | Logout and clear session | ✅ |
| `POST` | `/api/auth/google` | Initiate Google OAuth | ❌ |
| `GET` | `/api/auth/callback` | OAuth callback handler | ❌ |

### 💳 Payment Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/payments/initiate` | Start payment process | ✅ |
| `POST` | `/api/payments/success` | Payment success callback | ❌ |
| `POST` | `/api/payments/failure` | Payment failure callback | ❌ |
| `POST` | `/api/payments/callback` | PayU webhook handler | ❌ |

### 👥 User Management

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/profiles` | Get user profiles | ✅ |
| `PUT` | `/api/profiles` | Update user profile | ✅ |
| `GET` | `/api/users/me` | Get current user info | ✅ |

### 💼 Career & Jobs

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/careers` | Get job listings | ❌ |
| `POST` | `/api/careers` | Create job listing | ✅ Admin |
| `POST` | `/api/careers/apply` | Apply for job | ✅ |
| `GET` | `/api/jobs/{id}` | Get specific job | ❌ |

### 🔧 Admin Endpoints

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `GET` | `/api/admin/dashboard` | Admin analytics | ✅ Admin |
| `GET` | `/api/admin/monitoring` | System monitoring | ✅ Admin |
| `GET` | `/api/admin/rate-limits` | Rate limit status | ✅ Admin |
| `POST` | `/api/admin/rate-limits` | Update rate limits | ✅ Admin |

### 📞 Communication

| Method | Endpoint | Description | Auth Required |
|--------|----------|-------------|---------------|
| `POST` | `/api/contact` | General contact form | ❌ |
| `POST` | `/api/company/contact` | Company contact form | ❌ |
| `GET` | `/api/health` | Health check | ❌ |

## ⚡ Rate Limiting Configuration

The API implements intelligent rate limiting based on endpoint sensitivity:

```typescript
const rateLimits = {
  // Authentication (strict limits)
  '/api/login': { requests: 5, window: 300 },      // 5 attempts per 5 minutes
  '/api/signup': { requests: 3, window: 300 },     // 3 signups per 5 minutes
  
  // Payments (moderate limits)
  '/api/payments/initiate': { requests: 10, window: 300 },  // 10 payments per 5 minutes
  
  // General API (generous limits)
  '/api/': { requests: 100, window: 60 },          // 100 requests per minute
  
  // Admin (high limits)
  '/api/admin/': { requests: 300, window: 60 },    // 300 requests per minute
  
  // Contact forms (anti-spam)
  '/api/contact': { requests: 5, window: 600 },    // 5 messages per 10 minutes
}
```

## 🗄️ Database Schema

### Core Tables

#### `custom_users` - User Authentication
```sql
CREATE TABLE custom_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user',
    is_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `sessions` - Session Management
```sql
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES custom_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### `orders` - Payment Tracking
```sql
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID,
    company_name VARCHAR(255) NOT NULL,
    package_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'pending',
    payment_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### Additional Tables
- `profiles` - Extended user information
- `job_listings` - Job postings and management
- `job_applications` - Application tracking
- `contact_submissions` - Contact form submissions
- `company_contact_attempts` - Business inquiries
- `payment_logs` - Transaction audit trail
- `system_metrics` - Performance monitoring

*Complete schema available in `/sql/complete_schema_with_custom_auth.sql`*

## 🔒 Security Features

### Authentication Security
- **Password Hashing**: SHA-512 with unique salt + global pepper
- **Session Tokens**: 32-byte cryptographically secure tokens
- **Token Storage**: SHA-256 hashed tokens in database
- **Session Expiration**: 7-day automatic expiration
- **Secure Cookies**: HTTP-only, secure, SameSite protection

### Request Security
- **Rate Limiting**: Redis-backed, IP-based rate limiting
- **Input Validation**: Zod schema validation on all endpoints
- **CSRF Protection**: Built-in Next.js CSRF protection
- **IP Filtering**: Whitelist/blacklist with automatic unblocking
- **Request Encryption**: AES-256-GCM for sensitive data

### Payment Security
- **Hash Verification**: PayU hash validation
- **Webhook Security**: Signature verification
- **Amount Validation**: Server-side amount verification
- **Transaction Logging**: Complete audit trail
- **PCI Compliance**: No card data storage

## 🧪 Testing

### Automated Test Suite
```bash
# Run the comprehensive API test suite
chmod +x test-api.sh
./test-api.sh
```

### Postman Collection
Import `Flocci-Backend-API.postman_collection.json`:
- Complete endpoint coverage
- Authentication flow testing
- Error scenario testing
- Environment variable support
- Automated token management

### Manual Testing Checklist
- [ ] User signup and email validation
- [ ] Login with correct/incorrect credentials
- [ ] Session validation and expiration
- [ ] Google OAuth flow
- [ ] Payment initiation and callbacks
- [ ] Rate limiting enforcement
- [ ] Admin dashboard access
- [ ] Contact form submission
- [ ] Error handling and logging

## 📊 Monitoring & Analytics

### System Metrics
- **Response Times**: Average API response times
- **Error Rates**: 4xx/5xx error tracking
- **Rate Limit Hits**: Rate limiting statistics
- **Payment Success Rates**: Transaction analytics
- **User Activity**: Login/signup trends

### Admin Dashboard Features
- Real-time payment monitoring
- System performance metrics
- User activity analytics
- Error log analysis
- Rate limit management
- IP block management

### Logging
- **Request Logging**: All API requests logged
- **Error Logging**: Comprehensive error tracking
- **Payment Logging**: Complete transaction audit
- **Security Logging**: Authentication and authorization events
- **Performance Logging**: Response time tracking

## 🚀 Production Deployment

### Build Process
```bash
# Install dependencies
npm ci

# Build the application
npm run build

# Start production server
npm start
```

### Environment Configuration
1. **Supabase Setup**:
   - Enable Google OAuth in Authentication settings
   - Configure OAuth redirect URLs
   - Set up RLS policies for production

2. **Redis Configuration**:
   - Configure Redis persistence
   - Set up Redis password authentication
   - Enable Redis SSL in production

3. **SMTP Configuration**:
   - Use production SMTP service
   - Configure proper email templates
   - Set up email monitoring

4. **Payment Gateway**:
   - Switch to production PayU credentials
   - Configure production webhook URLs
   - Test payment flows thoroughly

### Performance Optimization
- **Redis Caching**: Session and rate limit caching
- **Database Indexing**: Optimized database queries
- **Connection Pooling**: Efficient database connections
- **Response Compression**: Gzip compression enabled
- **CDN Integration**: Static asset optimization

### Security Hardening
- **HTTPS Only**: Force HTTPS in production
- **Security Headers**: Comprehensive security headers
- **IP Restrictions**: Production IP whitelisting
- **Rate Limiting**: Stricter production limits
- **Error Handling**: Sanitized error responses

## 🔧 Configuration

### Environment-Specific Settings

#### Development
```properties
NODE_ENV=development
APP_URL=http://localhost:3000
# Relaxed rate limits and detailed error messages
```

#### Staging
```properties
NODE_ENV=staging
APP_URL=https://staging.flocci.in
# Production-like settings with debug capabilities
```

#### Production
```properties
NODE_ENV=production
APP_URL=https://flocci.in
# Strict security and minimal error exposure
```

### Feature Flags
```typescript
const features = {
  googleOAuth: true,
  paymentProcessing: true,
  adminDashboard: true,
  aiEmailResolution: true,
  rateLimiting: true,
  ipFiltering: true
};
```

## 🐛 Troubleshooting

### Common Issues

#### Database Connection Issues
```bash
# Check Supabase credentials
curl -H "Authorization: Bearer YOUR_SERVICE_ROLE_KEY" \
     -H "apikey: YOUR_ANON_KEY" \
     "YOUR_SUPABASE_URL/rest/v1/"
```

#### Redis Connection Issues
```bash
# Test Redis connectivity
curl -X POST YOUR_UPSTASH_REDIS_URL \
     -H "Authorization: Bearer YOUR_REDIS_TOKEN" \
     -d '["PING"]'
```

#### Payment Integration Issues
- Verify PayU credentials are correct
- Check webhook URL accessibility
- Validate hash generation logic
- Test with PayU sandbox first

#### OAuth Issues
- Verify Google OAuth credentials in Supabase
- Check redirect URLs configuration
- Ensure proper scopes are requested

### Debug Mode
```bash
# Enable debug logging
DEBUG=flocci:* npm run dev

# Check specific modules
DEBUG=flocci:auth,flocci:payments npm run dev
```

## 📚 API Examples

### Authentication Flow
```javascript
// 1. Sign up
const signupResponse = await fetch('/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123',
    full_name: 'John Doe'
  })
});

// 2. Login
const loginResponse = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'user@example.com',
    password: 'password123'
  })
});

const { session_token } = await loginResponse.json();

// 3. Authenticated requests
const profileResponse = await fetch('/api/auth/session', {
  headers: { 'Cookie': `session_token=${session_token}` }
});
```

### Payment Processing
```javascript
// Initiate payment
const paymentResponse = await fetch('/api/payments/initiate', {
  method: 'POST',
  headers: { 
    'Content-Type': 'application/json',
    'Cookie': `session_token=${session_token}`
  },
  body: JSON.stringify({
    company_name: 'Tech Corp',
    package_type: 'Premium Job Posting',
    amount: 2999.00,
    currency: 'INR'
  })
});
```

## 🤝 Contributing

We welcome contributions to improve the Flocci Backend! Here's how to get started:

### Development Setup
1. **Fork the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/flocci-backend.git
   cd flocci-backend
   ```

2. **Create feature branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

3. **Install dependencies**
   ```bash
   npm install
   ```

4. **Set up environment**
   - Copy `.env.example` to `.env`
   - Fill in your development credentials

5. **Run tests**
   ```bash
   npm test
   ./test-api.sh
   ```

### Code Standards
- **TypeScript**: All code must be TypeScript
- **ESLint**: Follow the configured ESLint rules
- **Prettier**: Code formatting enforced
- **Zod Validation**: All inputs must be validated
- **Error Handling**: Comprehensive error handling required
- **Documentation**: Comment complex logic

### Pull Request Process
1. **Update documentation** if needed
2. **Add tests** for new features
3. **Run test suite** and ensure all pass
4. **Update CHANGELOG.md** with your changes
5. **Submit PR** with detailed description

### Commit Convention
```
feat: add new authentication endpoint
fix: resolve payment callback issue
docs: update API documentation
style: format code with prettier
refactor: improve error handling
test: add payment flow tests
```

## 📄 License

This project is licensed under the **MIT License** - see the [LICENSE](LICENSE) file for details.

```
MIT License

Copyright (c) 2024 Flocci Technologies

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

## 🙏 Acknowledgments

- **Next.js Team** - For the excellent framework
- **Supabase** - For the powerful backend-as-a-service platform
- **Upstash** - For Redis hosting and management
- **PayU** - For payment gateway integration
- **Google** - For Gemini AI and OAuth services
- **Vercel** - For deployment and hosting platform

## 📞 Support & Contact

- **Website**: [flocci.in](https://flocci.in)
- **Email**: [support@flocci.in](mailto:support@flocci.in)
- **Documentation**: [API Docs](https://flocci.in/api-docs)
- **Issues**: [GitHub Issues](https://github.com/heyAfsar/flocci-backend/issues)
- **Discussions**: [GitHub Discussions](https://github.com/heyAfsar/flocci-backend/discussions)

### Getting Help
1. **Check Documentation**: Start with this README and API docs
2. **Search Issues**: Look for existing solutions
3. **Create Issue**: Provide detailed reproduction steps
4. **Join Discussions**: Ask questions and share ideas

---

**Built with ❤️ by [Flocci Technologies](https://flocci.in)**

*Empowering businesses with intelligent API solutions*
