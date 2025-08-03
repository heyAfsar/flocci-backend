-- Schema for FLOCCI API HUB Database (Supabase Version)
-- Note: auth.users table is already handled by Supabase Auth

-- Enable necessary extensions (most are already enabled in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Profile Table (extends Supabase auth.users)
CREATE TABLE public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    full_name VARCHAR(100),
    phone VARCHAR(20),
    company_name VARCHAR(100),
    role VARCHAR(50) DEFAULT 'user',
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT username_length CHECK (char_length(full_name) >= 3)
);

-- Enable RLS (Row Level Security)
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create profiles policies
CREATE POLICY "Public profiles are viewable by everyone"
    ON public.profiles FOR SELECT
    USING (true);

CREATE POLICY "Users can insert their own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (auth.uid() = id);

-- Orders Table
CREATE TABLE public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    txnid VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'INR',
    status VARCHAR(20) NOT NULL DEFAULT 'PENDING',
    productinfo TEXT NOT NULL,
    firstname VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    payment_method VARCHAR(50),
    payu_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Create orders policies
CREATE POLICY "Users can view their own orders"
    ON public.orders FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own orders"
    ON public.orders FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all orders"
    ON public.orders FOR SELECT
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Payment Logs Table
CREATE TABLE public.payment_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    event_type VARCHAR(50) NOT NULL,
    status VARCHAR(50) NOT NULL,
    details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.payment_logs ENABLE ROW LEVEL SECURITY;

-- Create payment_logs policies
CREATE POLICY "Admin only access"
    ON public.payment_logs
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Job Listings Table
CREATE TABLE public.job_listings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    title VARCHAR(200) NOT NULL,
    company_name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    location VARCHAR(100),
    is_remote BOOLEAN DEFAULT false,
    job_type VARCHAR(50),
    salary_min INTEGER,
    salary_max INTEGER,
    required_skills TEXT[],
    status VARCHAR(20) DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.job_listings ENABLE ROW LEVEL SECURITY;

-- Create job_listings policies
CREATE POLICY "Job listings are viewable by everyone"
    ON public.job_listings FOR SELECT
    USING (true);

CREATE POLICY "Only admins can manage job listings"
    ON public.job_listings
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Job Applications Table
CREATE TABLE public.job_applications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES public.job_listings(id) ON DELETE CASCADE,
    candidate_name VARCHAR(100) NOT NULL,
    candidate_email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    resume_url TEXT NOT NULL,
    cover_letter TEXT,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.job_applications ENABLE ROW LEVEL SECURITY;

-- Create job_applications policies
CREATE POLICY "Only admins can view applications"
    ON public.job_applications
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Anyone can submit applications"
    ON public.job_applications FOR INSERT
    WITH CHECK (true);

-- Contact Submissions Table
CREATE TABLE public.contact_submissions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.contact_submissions ENABLE ROW LEVEL SECURITY;

-- Create contact_submissions policies
CREATE POLICY "Only admins can view submissions"
    ON public.contact_submissions
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Anyone can submit contact form"
    ON public.contact_submissions FOR INSERT
    WITH CHECK (true);

-- Company Contact Attempts Table
CREATE TABLE public.company_contact_attempts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    company_name VARCHAR(100) NOT NULL,
    resolved_email VARCHAR(255),
    sender_name VARCHAR(100) NOT NULL,
    sender_email VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'PENDING',
    ai_response JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.company_contact_attempts ENABLE ROW LEVEL SECURITY;

-- Create company_contact_attempts policies
CREATE POLICY "Only admins can view all attempts"
    ON public.company_contact_attempts
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

CREATE POLICY "Anyone can create contact attempts"
    ON public.company_contact_attempts FOR INSERT
    WITH CHECK (true);

-- System Metrics Table (Admin only)
CREATE TABLE public.system_metrics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value JSONB NOT NULL,
    collected_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS
ALTER TABLE public.system_metrics ENABLE ROW LEVEL SECURITY;

-- Create system_metrics policies
CREATE POLICY "Admin only metrics access"
    ON public.system_metrics
    USING (EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'admin'
    ));

-- Indexes
CREATE INDEX idx_orders_txnid ON public.orders(txnid);
CREATE INDEX idx_orders_status ON public.orders(status);
CREATE INDEX idx_payment_logs_order_id ON public.payment_logs(order_id);
CREATE INDEX idx_job_applications_job_id ON public.job_applications(job_id);
CREATE INDEX idx_company_contact_company_name ON public.company_contact_attempts(company_name);

-- Enable realtime for specific tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.job_listings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.system_metrics;

-- Function to handle updated_at
CREATE OR REPLACE FUNCTION handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Add updated_at triggers
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.profiles
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.orders
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.job_listings
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.job_applications
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();

-- Comments
COMMENT ON TABLE public.profiles IS 'Holds extended profile information for users';
COMMENT ON TABLE public.orders IS 'Stores payment order information';
COMMENT ON TABLE public.payment_logs IS 'Stores detailed payment event logs';
COMMENT ON TABLE public.job_listings IS 'Stores job posting information';
COMMENT ON TABLE public.job_applications IS 'Stores job application submissions';
COMMENT ON TABLE public.contact_submissions IS 'Stores general contact form submissions';
COMMENT ON TABLE public.company_contact_attempts IS 'Stores company contact attempts with AI email resolution';
COMMENT ON TABLE public.system_metrics IS 'Stores system-wide metrics and statistics';
COMMENT ON TABLE public.interview_marks IS 'Stores candidate interview marks and evaluation data';

-- Interview Marks Table (for Amity recruitment)
CREATE TABLE public.interview_marks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    candidate_email VARCHAR(255) UNIQUE NOT NULL,
    interview_marks JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Enable RLS for interview_marks
ALTER TABLE public.interview_marks ENABLE ROW LEVEL SECURITY;

-- Interview marks policies (restrict to authorized users only)
CREATE POLICY "interview_marks_select_policy"
    ON public.interview_marks FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.custom_users cu
            JOIN public.sessions s ON s.user_id = cu.id
            WHERE cu.email = 'placementdrive@amity.in'
            AND s.expires_at > CURRENT_TIMESTAMP
        )
    );

CREATE POLICY "interview_marks_insert_policy"
    ON public.interview_marks FOR INSERT
    WITH CHECK (
        EXISTS (
            SELECT 1 FROM public.custom_users cu
            JOIN public.sessions s ON s.user_id = cu.id
            WHERE cu.email = 'placementdrive@amity.in'
            AND s.expires_at > CURRENT_TIMESTAMP
        )
    );

CREATE POLICY "interview_marks_update_policy"
    ON public.interview_marks FOR UPDATE
    USING (
        EXISTS (
            SELECT 1 FROM public.custom_users cu
            JOIN public.sessions s ON s.user_id = cu.id
            WHERE cu.email = 'placementdrive@amity.in'
            AND s.expires_at > CURRENT_TIMESTAMP
        )
    );

-- Add trigger for updated_at
CREATE TRIGGER set_updated_at
    BEFORE UPDATE ON public.interview_marks
    FOR EACH ROW
    EXECUTE FUNCTION handle_updated_at();
