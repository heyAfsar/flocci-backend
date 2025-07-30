# FLOCCI API HUB - Detailed Frontend Integration Guide for flocci.in

## 1. Authentication Flow Implementation

### 1.1 Sign Up API
**Endpoint:** `POST /api/signup`
```typescript
// Request Payload
interface SignupRequest {
    email: string;        // Required, valid email format
    password: string;     // Required, min 6 characters
    full_name: string;    // Required, min 3 characters
    phone?: string;       // Optional
    company_name?: string;// Optional
}

// Success Response (201)
interface SignupSuccess {
    message: string;      // "Signup successful"
    user: {
        id: string;
        email: string;
        role: string;     // "user" by default
    };
}

// Error Response (400)
interface SignupError {
    error: string;
    details: {
        email?: string[];
        password?: string[];
        full_name?: string[];
    };
}
```

**UI Implementation:**
```typescript
// components/auth/SignupForm.tsx
export const SignupForm = () => {
    const supabase = useSupabaseClient();
    const router = useRouter();
    
    const onSubmit = async (data: SignupRequest) => {
        setLoading(true);
        try {
            const response = await fetch('/api/signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) {
                const error = await response.json();
                throw new Error(error.details?.email?.[0] || error.error);
            }
            
            // Create profile after successful signup
            const { user } = await response.json();
            await supabase.from('profiles').insert({
                id: user.id,
                full_name: data.full_name,
                phone: data.phone,
                company_name: data.company_name
            });
            
            router.push('/dashboard');
            toast.success('Welcome to FLOCCI API HUB!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };
    
    return (
        <Form onSubmit={handleSubmit(onSubmit)}>
            {/* Form fields with validation */}
        </Form>
    );
};
```

### 1.2 Login API
**Endpoint:** `POST /api/login`
```typescript
// Request Payload
interface LoginRequest {
    email: string;
    password: string;
}

// Success Response (200)
interface LoginSuccess {
    message: string;          // "Login successful"
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

// Error Response (401)
interface LoginError {
    error: string;           // "Invalid credentials"
}
```

**UI Implementation:**
```typescript
// components/auth/LoginForm.tsx
export const LoginForm = () => {
    const supabase = useSupabaseClient();
    const router = useRouter();
    
    const onSubmit = async (data: LoginRequest) => {
        setLoading(true);
        try {
            const response = await fetch('/api/login', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(data)
            });
            
            if (!response.ok) throw new Error('Invalid credentials');
            
            const { user, session } = await response.json();
            
            // Store session
            await supabase.auth.setSession(session);
            
            // Redirect based on role
            if (user.role === 'admin') {
                router.push('/admin/dashboard');
            } else {
                router.push('/dashboard');
            }
            
            toast.success('Welcome back!');
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
        }
    };
};
```

## 2. Dashboard Implementation

### 2.1 User Dashboard
**Required Data Fetching:**
```typescript
// hooks/useUserDashboard.ts
export const useUserDashboard = () => {
    const supabase = useSupabaseClient();
    const { user } = useUser();
    
    const fetchUserData = async () => {
        // Fetch user's profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
            
        // Fetch user's job applications
        const { data: applications } = await supabase
            .from('job_applications')
            .select(\`
                *,
                job_listings (
                    title,
                    company_name,
                    location,
                    status
                )
            \`)
            .eq('candidate_email', user.email);
            
        return { profile, applications };
    };
    
    return useQuery('userDashboard', fetchUserData);
};
```

**UI Components:**
```typescript
// components/dashboard/UserDashboard.tsx
export const UserDashboard = () => {
    const { data, isLoading } = useUserDashboard();
    
    if (isLoading) return <DashboardSkeleton />;
    
    return (
        <div className="grid grid-cols-12 gap-6">
            <div className="col-span-12 lg:col-span-8">
                <ApplicationsOverview applications={data.applications} />
            </div>
            <div className="col-span-12 lg:col-span-4">
                <ProfileCard profile={data.profile} />
                <JobSearchCard />
            </div>
        </div>
    );
};
```

### 2.2 Admin Dashboard
**Endpoints:**
1. `GET /api/admin/monitoring`
```typescript
// Response
interface MonitoringResponse {
    errorRate: number;
    rateLimitHits: number;
    topErrorTypes: [string, number][];
    blockedIPs: string[];
    errorTrend: {
        intervals: string[];
        counts: number[];
    };
    systemStatus: {
        healthy: boolean;
        lastError?: string;
        lastErrorTime?: string;
    };
}
```

2. `GET /api/admin/dashboard`
```typescript
// Query Parameters
interface DashboardParams {
    startDate?: string;   // ISO date string
    endDate?: string;     // ISO date string
    status?: string;      // Filter by status
    limit?: number;       // Default: 50
    offset?: number;      // Default: 0
}

// Response
interface DashboardResponse {
    orders: {
        total: number;
        completed: number;
        pending: number;
        failed: number;
        revenue: number;
    };
    recentOrders: Order[];
    paymentStats: {
        hourly: { timestamp: string; amount: number }[];
        daily: { date: string; amount: number }[];
    };
}
```

**UI Implementation:**
```typescript
// components/admin/AdminDashboard.tsx
export const AdminDashboard = () => {
    // Fetch monitoring data
    const { data: monitoring } = useQuery(
        'monitoring',
        () => fetch('/api/admin/monitoring').then(res => res.json()),
        { refetchInterval: 30000 } // Refresh every 30s
    );
    
    // Fetch dashboard data with date range
    const { data: dashboard } = useQuery(
        ['dashboard', dateRange],
        () => fetch(\`/api/admin/dashboard?startDate=\${dateRange.start}&endDate=\${dateRange.end}\`)
            .then(res => res.json())
    );
    
    return (
        <div className="space-y-6">
            <SystemHealthCard metrics={monitoring} />
            <RevenueChart data={dashboard.paymentStats} />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                <MetricCard
                    title="Total Orders"
                    value={dashboard.orders.total}
                    trend={calculateTrend(dashboard.orders)}
                />
                {/* More metric cards */}
            </div>
            <RecentOrdersTable orders={dashboard.recentOrders} />
        </div>
    );
};
```

## 3. Payment Integration

### 3.1 Payment Initiation
**Endpoint:** `POST /api/payments/initiate`
```typescript
// Request Payload
interface PaymentRequest {
    amount: number;
    productinfo: string;
    firstname: string;
    email: string;
    phone?: string;
}

// Success Response
interface PaymentInitiationResponse {
    txnid: string;
    formUrl: string;    // PayU form URL
    key: string;        // PayU merchant key
    hash: string;       // Generated hash for verification
}
```

**UI Implementation:**
```typescript
// components/payment/PaymentInitiation.tsx
export const PaymentInitiation = ({ amount, productInfo }) => {
    const initiatePayment = async () => {
        try {
            const response = await fetch('/api/payments/initiate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    productinfo: productInfo,
                    firstname: user.fullName,
                    email: user.email
                })
            });
            
            const { formUrl, txnid } = await response.json();
            
            // Store transaction ID for verification
            localStorage.setItem('current_txn', txnid);
            
            // Redirect to PayU form
            window.location.href = formUrl;
        } catch (error) {
            toast.error('Payment initiation failed');
        }
    };
};
```

### 3.2 Payment Success/Failure Handling
```typescript
// pages/payment/success.tsx
export const PaymentSuccessPage = () => {
    const router = useRouter();
    const txnid = router.query.txnid;
    
    useEffect(() => {
        const verifyPayment = async () => {
            const storedTxn = localStorage.getItem('current_txn');
            if (storedTxn !== txnid) {
                toast.error('Invalid transaction');
                router.push('/dashboard');
                return;
            }
            
            // Clear stored transaction
            localStorage.removeItem('current_txn');
            
            // Show success message
            toast.success('Payment successful!');
            router.push('/dashboard');
        };
        
        if (txnid) verifyPayment();
    }, [txnid]);
};
```

## 4. Real-time Updates Implementation

### 4.1 Supabase Realtime Subscriptions
```typescript
// hooks/useRealtimeUpdates.ts
export const useRealtimeUpdates = () => {
    const supabase = useSupabaseClient();
    
    useEffect(() => {
        // Subscribe to orders table
        const ordersSubscription = supabase
            .channel('orders')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'orders' },
                handleOrderUpdate
            )
            .subscribe();
            
        // Subscribe to job listings
        const jobsSubscription = supabase
            .channel('jobs')
            .on('postgres_changes',
                { event: '*', schema: 'public', table: 'job_listings' },
                handleJobUpdate
            )
            .subscribe();
            
        return () => {
            ordersSubscription.unsubscribe();
            jobsSubscription.unsubscribe();
        };
    }, []);
};
```

## 5. Error Handling and Rate Limiting

### 5.1 Global Error Handling
```typescript
// utils/api.ts
export const handleApiError = (error: any) => {
    if (error.status === 429) {
        toast.error('Too many requests. Please try again later.');
    } else if (error.status === 401) {
        toast.error('Please log in again.');
        router.push('/login');
    } else {
        toast.error(error.message || 'An unexpected error occurred');
    }
};
```

### 5.2 Rate Limit Handling
```typescript
// hooks/useRateLimitedApi.ts
export const useRateLimitedApi = () => {
    const callApi = async (endpoint: string, options: RequestInit) => {
        try {
            const response = await fetch(endpoint, options);
            
            if (response.status === 429) {
                const data = await response.json();
                throw new Error(\`Rate limit exceeded. Try again in \${data.retryAfter} seconds\`);
            }
            
            return response;
        } catch (error) {
            handleApiError(error);
            throw error;
        }
    };
    
    return { callApi };
};
```

## Implementation Order

1. Start with Authentication:
   - Implement SignupForm and LoginForm components
   - Set up auth state management with Supabase
   - Create protected route wrapper

2. Build Dashboard Structure:
   - Create layout with navigation
   - Implement role-based routing
   - Add dashboard skeletons

3. Implement User Features:
   - Job applications list
   - Profile management
   - Application status tracking

4. Add Admin Features:
   - Monitoring dashboard
   - System metrics
   - Order management

5. Integrate Payments:
   - Payment initiation flow
   - Success/failure handling
   - Transaction history

6. Add Real-time Features:
   - Set up Supabase subscriptions
   - Implement real-time updates
   - Add notification system

## Performance Optimizations

1. Implement proper data caching:
```typescript
const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 5 * 60 * 1000, // 5 minutes
            cacheTime: 30 * 60 * 1000, // 30 minutes
        },
    },
});
```

2. Use optimistic updates for better UX:
```typescript
const updateApplication = useMutation(
    (data) => api.updateApplication(data),
    {
        onMutate: async (newData) => {
            await queryClient.cancelQueries('applications');
            const previous = queryClient.getQueryData('applications');
            queryClient.setQueryData('applications', old => ({
                ...old,
                [newData.id]: newData
            }));
            return { previous };
        },
        onError: (err, newData, context) => {
            queryClient.setQueryData('applications', context.previous);
        }
    }
);
```

3. Implement proper loading states and skeletons for each section
