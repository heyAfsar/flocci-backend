# FLOCCI API HUB - Frontend Integration Guide

## Core Flows

### 1. Authentication Flow

#### Sign Up
```typescript
interface SignupPayload {
  email: string;
  password: string;
  full_name: string;
  phone?: string;
  company_name?: string;
}

// POST /api/signup
const response = await fetch('/api/signup', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(signupPayload)
});

// Expected Response
interface SignupResponse {
  message: string;
  user: {
    id: string;
    email: string;
    role: string;
  };
}
```

#### Login
```typescript
interface LoginPayload {
  email: string;
  password: string;
}

// POST /api/login
const response = await fetch('/api/login', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(loginPayload)
});

// Expected Response
interface LoginResponse {
  message: string;
  session: {
    access_token: string;
    expires_at: string;
  };
  user: {
    id: string;
    email: string;
    role: string;
  };
}
```

### 2. Dashboard Views

#### User Dashboard
- Create a protected route `/dashboard`
- Use Supabase Auth hooks for session management
```typescript
// pages/dashboard.tsx
import { useSession, useSupabaseClient } from '@supabase/auth-helpers-react';

// Fetch user-specific data based on role
const { data: profile } = await supabase
  .from('profiles')
  .select('*')
  .eq('id', session.user.id)
  .single();

// Conditional rendering based on role
if (profile.role === 'admin') {
  return <AdminDashboard />;
} else if (profile.role === 'applicant') {
  return <ApplicantDashboard />;
} else {
  return <UserDashboard />;
}
```

#### Job Applicant View
```typescript
// Fetch applied jobs
const { data: applications } = await supabase
  .from('job_applications')
  .select('*, job_listings(*)')
  .eq('candidate_email', userEmail)
  .order('created_at', { ascending: false });

// UI Components needed:
- ApplicationsList: Show all applications with status
- ApplicationDetails: Show full application details
- JobSearch: Search and apply for new jobs
```

#### Admin Dashboard
```typescript
// System Metrics Component
const fetchMetrics = async () => {
  const response = await fetch('/api/admin/monitoring');
  const metrics: SystemMetrics = await response.json();
  // Update UI with error rates, blocked IPs, etc.
};

// Real-time payments monitoring using Supabase subscriptions
const ordersSubscription = supabase
  .channel('orders')
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'orders'
  }, handleNewOrder)
  .subscribe();
```

### 3. Contact Forms Integration

#### General Contact Form
```typescript
interface ContactPayload {
  name: string;
  email: string;
  phone?: string;
  message: string;
}

// Handler for contact form
const handleContact = async (data: ContactPayload) => {
  const response = await fetch('/api/contact', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    toast.success('Message sent successfully!');
  }
};
```

#### Company Contact Form with AI
```typescript
interface CompanyContactPayload {
  companyName: string;
  senderName: string;
  senderEmail: string;
  message: string;
}

// Handler with loading state for AI processing
const handleCompanyContact = async (data: CompanyContactPayload) => {
  setIsProcessing(true);
  try {
    const response = await fetch('/api/company/contact', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    
    if (response.ok) {
      toast.success('Message sent via AI resolution!');
    }
  } finally {
    setIsProcessing(false);
  }
};
```

### 4. Job Applications System

#### Job Listing Display
```typescript
// Fetch all active job listings
const { data: jobs } = await supabase
  .from('job_listings')
  .select('*')
  .eq('status', 'ACTIVE')
  .order('created_at', { ascending: false });

// UI Components needed:
- JobGrid: Display jobs in card format
- JobFilters: Filter by location, type, salary
- JobSearch: Search by title, company, skills
```

#### Job Application Process
```typescript
interface JobApplicationPayload {
  jobId: string;
  candidateName: string;
  candidateEmail: string;
  phone?: string;
  resumeBase64: string;
  resumeFileName: string;
  coverLetter?: string;
}

const handleJobApplication = async (data: JobApplicationPayload) => {
  const response = await fetch('/api/careers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  if (response.ok) {
    toast.success('Application submitted successfully!');
  }
};
```

### 5. Payment Integration

#### Payment Flow
```typescript
interface PaymentInitiation {
  amount: number;
  productinfo: string;
  firstname: string;
  email: string;
  phone?: string;
}

// 1. Initiate Payment
const initiatePayment = async (data: PaymentInitiation) => {
  const response = await fetch('/api/payments/initiate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data)
  });
  
  const { formUrl, txnid } = await response.json();
  // Store txnid in localStorage for verification
  localStorage.setItem('current_transaction', txnid);
  // Redirect to PayU form
  window.location.href = formUrl;
};

// 2. Handle Success/Failure pages
// Create routes for /payment/success and /payment/failure
// These will show appropriate messages based on the payment status
```

## UI Components Needed

1. **Authentication**
   - SignupForm
   - LoginForm
   - ForgotPasswordForm
   - ProfileEditor

2. **Dashboard**
   - DashboardLayout (with sidebar navigation)
   - MetricsCards
   - DataGrid (for various listings)
   - StatusBadges
   - ActivityFeed

3. **Contact System**
   - ContactForm
   - CompanyContactForm (with AI processing indicator)
   - MessageStatus
   - AIProcessingSpinner

4. **Job System**
   - JobListingCard
   - JobFilters
   - JobSearchBar
   - ApplicationForm
   - ResumeUploader
   - ApplicationStatus

5. **Payment System**
   - PaymentForm
   - PaymentStatus
   - TransactionHistory
   - InvoiceGenerator

## State Management Recommendations

1. Use React Query for server state:
```typescript
const { data: jobs, isLoading } = useQuery(
  'jobs',
  fetchJobs,
  { staleTime: 5 * 60 * 1000 } // 5 minutes
);
```

2. Use Zustand for UI state:
```typescript
const useStore = create((set) => ({
  filters: {},
  setFilters: (filters) => set({ filters }),
  resetFilters: () => set({ filters: {} })
}));
```

3. Use Supabase Realtime for live updates:
```typescript
const setupRealtimeSubscriptions = () => {
  const jobsSubscription = supabase
    .channel('jobs')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_listings' }, 
      (payload) => handleJobUpdate(payload)
    )
    .subscribe();
};
```

## Error Handling

1. Create a global error boundary
2. Implement toast notifications for API responses
3. Add retry logic for failed requests
4. Handle network errors gracefully

## Performance Considerations

1. Implement infinite scrolling for long lists
2. Use optimistic updates for better UX
3. Implement proper loading states
4. Cache responses where appropriate

## Security Notes

1. Always validate forms on both client and server
2. Implement proper CSRF protection
3. Use HTTP-only cookies for session management
4. Sanitize all user inputs
5. Implement proper role-based access control (RBAC)

## Testing Strategy

1. Write unit tests for all forms
2. Implement integration tests for API flows
3. Add E2E tests for critical paths
4. Test error scenarios thoroughly
