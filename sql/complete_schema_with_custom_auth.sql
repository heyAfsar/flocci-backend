-- Flocci Backend - Complete PostgreSQL Schema with Custom Auth
-- Run this in Supabase SQL Editor

-- Drop existing tables if they exist (careful in production!)
DROP TABLE IF EXISTS custom_users CASCADE;
DROP TABLE IF EXISTS sessions CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;
DROP TABLE IF EXISTS orders CASCADE;
DROP TABLE IF EXISTS payment_logs CASCADE;
DROP TABLE IF EXISTS job_listings CASCADE;
DROP TABLE IF EXISTS job_applications CASCADE;
DROP TABLE IF EXISTS contact_submissions CASCADE;
DROP TABLE IF EXISTS company_contact_attempts CASCADE;
DROP TABLE IF EXISTS system_metrics CASCADE;

-- Custom Users table (bypassing Supabase Auth)
CREATE TABLE custom_users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    full_name VARCHAR(255),
    role VARCHAR(50) DEFAULT 'user' CHECK (role IN ('user', 'admin', 'company')),
    is_verified BOOLEAN DEFAULT false,
    phone VARCHAR(20),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Sessions table for custom auth
CREATE TABLE sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES custom_users(id) ON DELETE CASCADE,
    token TEXT NOT NULL,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profiles table (compatible with both custom auth and Supabase auth)
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Can reference either auth.users or custom_users
    email VARCHAR(255) UNIQUE NOT NULL,
    full_name VARCHAR(255),
    phone VARCHAR(20),
    date_of_birth DATE,
    location VARCHAR(255),
    skills TEXT[],
    experience_level VARCHAR(50) CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead')),
    resume_url TEXT,
    linkedin_url TEXT,
    portfolio_url TEXT,
    preferred_job_types TEXT[],
    preferred_locations TEXT[],
    salary_expectation_min INTEGER,
    salary_expectation_max INTEGER,
    availability VARCHAR(50) CHECK (availability IN ('immediate', 'two_weeks', 'one_month', 'flexible')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Orders table
CREATE TABLE orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID, -- Can reference either auth system
    company_name VARCHAR(255) NOT NULL,
    package_type VARCHAR(100) NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed', 'cancelled')),
    payment_id VARCHAR(255),
    payment_method VARCHAR(100),
    billing_address JSONB,
    order_details JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Payment logs table
CREATE TABLE payment_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
    payment_gateway VARCHAR(100) NOT NULL,
    gateway_transaction_id VARCHAR(255),
    gateway_order_id VARCHAR(255),
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(10) DEFAULT 'INR',
    status VARCHAR(50) NOT NULL,
    gateway_response JSONB,
    webhook_data JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job listings table
CREATE TABLE job_listings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id UUID, -- Can reference either auth system
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    requirements TEXT[],
    skills_required TEXT[],
    experience_level VARCHAR(50) CHECK (experience_level IN ('entry', 'mid', 'senior', 'lead')),
    job_type VARCHAR(50) CHECK (job_type IN ('full-time', 'part-time', 'contract', 'internship', 'freelance')),
    location VARCHAR(255),
    remote_ok BOOLEAN DEFAULT false,
    salary_min INTEGER,
    salary_max INTEGER,
    currency VARCHAR(10) DEFAULT 'INR',
    application_deadline DATE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('draft', 'active', 'paused', 'closed')),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Job applications table
CREATE TABLE job_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    job_id UUID REFERENCES job_listings(id) ON DELETE CASCADE,
    user_id UUID, -- Can reference either auth system
    cover_letter TEXT,
    resume_url TEXT,
    status VARCHAR(50) DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'shortlisted', 'interviewed', 'rejected', 'hired')),
    applied_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Contact submissions table
CREATE TABLE contact_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    subject VARCHAR(255),
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'general' CHECK (type IN ('general', 'support', 'business', 'career')),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'in_progress', 'resolved', 'closed')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Company contact attempts table
CREATE TABLE company_contact_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_name VARCHAR(255) NOT NULL,
    contact_person VARCHAR(255),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    message TEXT NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    status VARCHAR(50) DEFAULT 'new' CHECK (status IN ('new', 'contacted', 'follow_up', 'converted', 'not_interested')),
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- System metrics table
CREATE TABLE system_metrics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    metric_name VARCHAR(100) NOT NULL,
    metric_value DECIMAL(15,2) NOT NULL,
    metric_type VARCHAR(50) NOT NULL CHECK (metric_type IN ('counter', 'gauge', 'histogram')),
    labels JSONB,
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX idx_custom_users_email ON custom_users(email);
CREATE INDEX idx_sessions_token ON sessions(token);
CREATE INDEX idx_sessions_user_id ON sessions(user_id);
CREATE INDEX idx_sessions_expires_at ON sessions(expires_at);
CREATE INDEX idx_profiles_email ON profiles(email);
CREATE INDEX idx_profiles_user_id ON profiles(user_id);
CREATE INDEX idx_orders_user_id ON orders(user_id);
CREATE INDEX idx_orders_status ON orders(status);
CREATE INDEX idx_payment_logs_order_id ON payment_logs(order_id);
CREATE INDEX idx_job_listings_company_id ON job_listings(company_id);
CREATE INDEX idx_job_listings_status ON job_listings(status);
CREATE INDEX idx_job_applications_job_id ON job_applications(job_id);
CREATE INDEX idx_job_applications_user_id ON job_applications(user_id);
CREATE INDEX idx_contact_submissions_status ON contact_submissions(status);
CREATE INDEX idx_company_contact_attempts_status ON company_contact_attempts(status);
CREATE INDEX idx_system_metrics_name ON system_metrics(metric_name);
CREATE INDEX idx_system_metrics_timestamp ON system_metrics(timestamp);

-- Update triggers for all tables with updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_custom_users_updated_at BEFORE UPDATE ON custom_users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_profiles_updated_at BEFORE UPDATE ON profiles FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_orders_updated_at BEFORE UPDATE ON orders FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_listings_updated_at BEFORE UPDATE ON job_listings FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_job_applications_updated_at BEFORE UPDATE ON job_applications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_contact_submissions_updated_at BEFORE UPDATE ON contact_submissions FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_company_contact_attempts_updated_at BEFORE UPDATE ON company_contact_attempts FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS) on all tables
ALTER TABLE custom_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_listings ENABLE ROW LEVEL SECURITY;
ALTER TABLE job_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE contact_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE company_contact_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE system_metrics ENABLE ROW LEVEL SECURITY;

-- RLS Policies for custom_users (users can only see their own data)
CREATE POLICY "Users can view own profile" ON custom_users FOR SELECT USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Users can update own profile" ON custom_users FOR UPDATE USING (auth.uid()::text = id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can insert users" ON custom_users FOR INSERT WITH CHECK (auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can delete users" ON custom_users FOR DELETE USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for sessions
CREATE POLICY "Users can view own sessions" ON sessions FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage sessions" ON sessions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for profiles
CREATE POLICY "Users can view own profile" ON profiles FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage profiles" ON profiles FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for orders
CREATE POLICY "Users can view own orders" ON orders FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage orders" ON orders FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for payment_logs
CREATE POLICY "Service role can manage payment logs" ON payment_logs FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for job_listings
CREATE POLICY "Anyone can view active job listings" ON job_listings FOR SELECT USING (status = 'active' OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Companies can manage own job listings" ON job_listings FOR ALL USING (auth.uid()::text = company_id::text OR auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for job_applications
CREATE POLICY "Users can view own applications" ON job_applications FOR SELECT USING (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Users can create applications" ON job_applications FOR INSERT WITH CHECK (auth.uid()::text = user_id::text OR auth.jwt() ->> 'role' = 'service_role');
CREATE POLICY "Service role can manage applications" ON job_applications FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for contact submissions
CREATE POLICY "Service role can manage contact submissions" ON contact_submissions FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for company contact attempts
CREATE POLICY "Service role can manage company contacts" ON company_contact_attempts FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- RLS Policies for system metrics
CREATE POLICY "Service role can manage metrics" ON system_metrics FOR ALL USING (auth.jwt() ->> 'role' = 'service_role');

-- Insert some sample data for testing
INSERT INTO custom_users (email, password_hash, full_name, role, is_verified) 
VALUES ('admin@flocci.in', 'dummy_hash', 'Admin User', 'admin', true);

-- Success message
SELECT 'Schema created successfully! All tables, indexes, triggers, and RLS policies are in place.' as message;
