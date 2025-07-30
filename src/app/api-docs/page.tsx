'use client'

import { Card } from '@/components/ui/card'
import { useState, useEffect } from 'react'

// Custom collapsible section component
const CollapsibleSection = ({ title, children, defaultOpen = false }: {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}) => {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  
  return (
    <div className="border border-gray-200 rounded-lg mb-4">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-6 py-4 text-left bg-gray-50 hover:bg-gray-100 transition-colors duration-200 flex items-center justify-between rounded-t-lg"
      >
        <span className="text-xl font-semibold">{title}</span>
        <span className={`transform transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
          ▼
        </span>
      </button>
      {isOpen && (
        <div className="px-6 py-4 bg-white rounded-b-lg">
          {children}
        </div>
      )}
    </div>
  )
}

export default function APIDocsPage() {
  // Set document title
  useEffect(() => {
    document.title = 'Flocci API Documentation'
  }, [])
  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-4xl font-bold mb-8">Flocci API Documentation</h1>
      
      {/* Table of Contents */}
      <Card className="p-6 mb-8">
        <h2 className="text-2xl font-bold mb-4">📋 Table of Contents</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h3 className="font-semibold mb-2">🔐 Authentication</h3>
            <ul className="text-sm space-y-1 ml-4">
              <li>• POST /api/signup - User registration</li>
              <li>• POST /api/login - User authentication</li>
              <li>• GET /api/auth/session - Session validation</li>
              <li>• POST /api/auth/session - Logout</li>
              <li>• GET /api/auth/google - Google OAuth</li>
              <li>• GET /api/auth/callback - OAuth callback</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">💳 Payments</h3>
            <ul className="text-sm space-y-1 ml-4">
              <li>• POST /api/payments/initiate - Start payment</li>
              <li>• POST /api/payments/callback - PayU callback</li>
              <li>• GET /api/payments/success - Success page</li>
              <li>• GET /api/payments/failure - Failure page</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">👑 Admin</h3>
            <ul className="text-sm space-y-1 ml-4">
              <li>• GET /api/admin/dashboard - Analytics</li>
              <li>• GET /api/admin/monitoring - System health</li>
              <li>• GET /api/admin/rate-limits - Rate limits</li>
            </ul>
          </div>
          <div>
            <h3 className="font-semibold mb-2">📧 Contact</h3>
            <ul className="text-sm space-y-1 ml-4">
              <li>• POST /api/contact - General contact</li>
              <li>• POST /api/company/contact - Company contact</li>
              <li>• POST /api/careers - Job applications</li>
            </ul>
          </div>
        </div>
      </Card>
      
      
      <div className="space-y-4">
        {/* Authentication */}
        <CollapsibleSection title="🔐 Authentication" defaultOpen={false}>
          <div className="space-y-4">
              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/signup</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Register a new user</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      email: "user@example.com",
                      password: "minimum_6_chars",
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Signup successful",
                      user: { id: "uuid", email: "user@example.com" }
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/login</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Authenticate user</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      email: "user@example.com",
                      password: "user_password",
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Login successful",
                      session: { token: "session_token" },
                      user: { id: "uuid", email: "user@example.com" }
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <h3 className="text-lg font-bold">/api/auth/session</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Validate user session</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Headers:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      "Authorization": "Bearer session_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      valid: true,
                      user: { id: "uuid", email: "user@example.com" }
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/auth/session</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Logout user (invalidate session)</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Headers:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      "Authorization": "Bearer session_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Logout successful"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <h3 className="text-lg font-bold">/api/auth/google</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Initiate Google OAuth login</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <p>Redirects to Google OAuth consent screen</p>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <h3 className="text-lg font-bold">/api/auth/callback</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Handle Google OAuth callback</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Query Parameters:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      code: "oauth_code",
                      state: "state_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <p>Creates user session and redirects to success page</p>
                </div>
              </Card>
            </div>
        </CollapsibleSection>

        {/* Payments */}
        <CollapsibleSection title="💳 Payments" defaultOpen={false}>
          <div className="space-y-4">
              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/payments/initiate</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Start a new payment flow</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      amount: "100.00",
                      productinfo: "Product Description",
                      firstname: "User Name",
                      email: "user@example.com",
                      phone: "1234567890"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <p>HTML form for PayU redirect</p>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/payments/callback</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">PayU server-to-server callback</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <p>PayU form data with transaction details</p>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Callback processed successfully"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <h3 className="text-lg font-bold">/api/payments/success</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Payment success page redirect</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Query Parameters:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      txnid: "transaction_id",
                      amount: "100.00",
                      status: "success"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <h3 className="text-lg font-bold">/api/payments/failure</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Payment failure page redirect</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Query Parameters:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      txnid: "transaction_id",
                      amount: "100.00",
                      status: "failure",
                      error: "error_message"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>
            </div>
        </CollapsibleSection>

        {/* Admin */}
        <CollapsibleSection title="👑 Admin" defaultOpen={false}>
          <div className="space-y-4">
              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">ADMIN</span>
                  <h3 className="text-lg font-bold">/api/admin/dashboard</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Get payment analytics and statistics</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Headers:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      "Authorization": "Bearer admin_session_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Query Parameters:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      startDate: "ISO date",
                      endDate: "ISO date",
                      status: "COMPLETED|FAILED|PENDING",
                      limit: "50",
                      offset: "0"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      totalTransactions: 1250,
                      totalAmount: "125000.00",
                      successRate: 92.5,
                      transactions: [
                        {
                          id: "txn_123",
                          amount: "100.00",
                          status: "COMPLETED",
                          created_at: "2024-01-15T10:30:00Z"
                        }
                      ]
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">ADMIN</span>
                  <h3 className="text-lg font-bold">/api/admin/monitoring</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">System health and metrics</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Headers:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      "Authorization": "Bearer admin_session_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Query Parameters:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      minutes: "60" // Time window for metrics
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      system: {
                        status: "healthy",
                        uptime: "99.9%",
                        lastCheck: "2024-01-15T10:30:00Z"
                      },
                      database: {
                        status: "connected",
                        latency: "12ms"
                      },
                      redis: {
                        status: "connected",
                        memory: "45%"
                      }
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-blue-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs font-medium">GET</span>
                  <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs font-medium">ADMIN</span>
                  <h3 className="text-lg font-bold">/api/admin/rate-limits</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Rate limit status and management</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Headers:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      "Authorization": "Bearer admin_session_token"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      rateLimits: {
                        "/api/login": {
                          limit: 5,
                          window: "5 minutes",
                          current: 2,
                          resetTime: "2024-01-15T10:35:00Z"
                        },
                        "/api/payments/initiate": {
                          limit: 10,
                          window: "5 minutes",
                          current: 1,
                          resetTime: "2024-01-15T10:35:00Z"
                        }
                      }
                    }, null, 2)}
                  </pre>
                </div>
              </Card>
            </div>
        </CollapsibleSection>

        {/* Contact */}
        <CollapsibleSection title="📧 Contact" defaultOpen={false}>
          <div className="space-y-4">
              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <h3 className="text-lg font-bold">/api/contact</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Send a general contact message</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      name: "Sender Name",
                      email: "sender@example.com",
                      phone: "1234567890",
                      message: "Contact message"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Contact form submitted successfully",
                      id: "contact_123"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">AI</span>
                  <h3 className="text-lg font-bold">/api/company/contact</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Contact a specific company (uses AI email resolution)</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      companyName: "Company Name",
                      senderName: "Sender Name",
                      senderEmail: "sender@example.com",
                      message: "Inquiry message"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Company contact form submitted successfully",
                      companyEmail: "resolved@company.com",
                      id: "company_contact_123"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>

              <Card className="p-4 border-l-4 border-green-500">
                <div className="flex items-center gap-2 mb-2">
                  <span className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs font-medium">POST</span>
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded text-xs font-medium">AI</span>
                  <h3 className="text-lg font-bold">/api/careers</h3>
                </div>
                <p className="text-sm text-gray-600 mt-2">Submit a job application (uses AI email resolution)</p>
                <div className="mt-4">
                  <h4 className="font-semibold">Request Body:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      jobId: 123,
                      candidateName: "Candidate Name",
                      candidateEmail: "candidate@example.com",
                      phone: "1234567890",
                      resumeBase64: "base64_encoded_file",
                      resumeFileName: "resume.pdf",
                      coverLetter: "Cover letter text",
                      jobTitle: "Job Title",
                      companyName: "Company Name"
                    }, null, 2)}
                  </pre>
                </div>
                <div className="mt-4">
                  <h4 className="font-semibold">Response:</h4>
                  <pre className="bg-gray-100 p-2 rounded mt-2">
                    {JSON.stringify({
                      message: "Job application submitted successfully",
                      applicationId: "app_123",
                      hrEmail: "hr@company.com"
                    }, null, 2)}
                  </pre>
                </div>
              </Card>
            </div>
        </CollapsibleSection>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">🔑 Authentication</h2>
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">Session-based Authentication</h3>
          <p className="mb-4">Most endpoints require authentication via session tokens:</p>
          <pre className="bg-gray-100 p-2 rounded mb-4">
            {JSON.stringify({
              "Authorization": "Bearer <session_token>"
            }, null, 2)}
          </pre>
          <h4 className="font-semibold mb-2">🛡️ Admin Endpoints</h4>
          <p className="mb-2">Admin endpoints require users with admin privileges:</p>
          <ul className="list-disc list-inside text-sm space-y-1">
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/admin/dashboard</code> - Payment analytics</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/admin/monitoring</code> - System health</li>
            <li><code className="bg-gray-100 px-2 py-1 rounded">/api/admin/rate-limits</code> - Rate limit management</li>
          </ul>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">⚡ Rate Limits</h2>
        <Card className="p-4">
          <p className="mb-4">All endpoints are protected by rate limiting to ensure fair usage:</p>
          <div className="overflow-x-auto">
            <pre className="bg-gray-100 p-2 rounded">
              {JSON.stringify({
                "/api/login": { requests: 5, window: "5 minutes" },
                "/api/signup": { requests: 3, window: "5 minutes" },
                "/api/payments/initiate": { requests: 10, window: "5 minutes" },
                "/api/": { requests: 100, window: "1 minute" },
                "/api/admin/": { requests: 300, window: "1 minute" }
              }, null, 2)}
            </pre>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">🚨 Error Responses</h2>
        <Card className="p-4">
          <h3 className="text-lg font-semibold mb-2">HTTP Status Codes</h3>
          <div className="overflow-x-auto mb-4">
            <pre className="bg-gray-100 p-2 rounded">
              {JSON.stringify({
                "200": "Success - Request completed successfully",
                "400": "Bad Request - Invalid input data or validation error",
                "401": "Unauthorized - Authentication required or invalid token",
                "403": "Forbidden - Insufficient permissions (admin required)",
                "404": "Not Found - Resource or endpoint not found",
                "429": "Too Many Requests - Rate limit exceeded",
                "500": "Internal Server Error - Server-side error"
              }, null, 2)}
            </pre>
          </div>
          <h3 className="text-lg font-semibold mb-2">Error Response Format</h3>
          <div className="overflow-x-auto">
            <pre className="bg-gray-100 p-2 rounded">
              {JSON.stringify({
                error: "Error message description",
                code: "ERROR_CODE",
                details: "Additional error details if available"
              }, null, 2)}
            </pre>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">🧪 Testing</h2>
        <Card className="p-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-lg font-semibold mb-2">📦 Postman Collection</h3>
              <p className="mb-2">Import the Postman collection for easy API testing:</p>
              <code className="bg-gray-100 p-2 rounded block mb-4">
                /Flocci-Backend-API.postman_collection.json
              </code>
              <p className="text-sm text-gray-600">Contains all endpoints with pre-configured requests and examples.</p>
            </div>
            <div>
              <h3 className="text-lg font-semibold mb-2">🔧 Test Script</h3>
              <p className="mb-2">Run the automated test script:</p>
              <code className="bg-gray-100 p-2 rounded block mb-4">
                ./test-api.sh
              </code>
              <p className="text-sm text-gray-600">Automated bash script to test all endpoints with sample data.</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="mt-8">
        <h2 className="text-2xl font-bold mb-4">🚀 Quick Start</h2>
        <Card className="p-4">
          <div className="space-y-4">
            <div>
              <h3 className="font-semibold">1. Authentication Flow</h3>
              <p className="text-sm text-gray-600">Start by registering or logging in to get a session token</p>
            </div>
            <div>
              <h3 className="font-semibold">2. Use Session Token</h3>
              <p className="text-sm text-gray-600">Include the session token in the Authorization header for protected endpoints</p>
            </div>
            <div>
              <h3 className="font-semibold">3. Test Payments</h3>
              <p className="text-sm text-gray-600">Use the payments/initiate endpoint to test PayU integration</p>
            </div>
            <div>
              <h3 className="font-semibold">4. Admin Access</h3>
              <p className="text-sm text-gray-600">Ensure your user has admin privileges for admin endpoints</p>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
