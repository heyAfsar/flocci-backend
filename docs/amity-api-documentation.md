# Flocci Amity Recruitment API Documentation

## Base URL
```
https://apis.flocci.in
```

## Authentication
All endpoints require authentication via Bearer token in the Authorization header:
```
Authorization: Bearer <your_session_token>
```

**Note**: Currently, only the email `placementdrive@amity.in` has access to these endpoints.

---

## 1. Candidates API

### GET /api/amity/candidates
Retrieves all candidate profiles and their processing details.

#### cURL Request
```bash
curl 'https://apis.flocci.in/api/amity/candidates' \
  -X 'GET' \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -v
```

#### Alternative Simple Request
```bash
curl https://apis.flocci.in/api/amity/candidates \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### Response (200 OK)
```json
{
  "candidate_profiles": [
    {
      "candidate_email": "singheesha755@gmail.com",
      "candidate_name": "Eesha Singh",
      "achievements": [
        "many more medals at my school time and college too."
      ],
      "certifications": [
        {
          "issuer": "AMITY UNIVERSITY",
          "name": "Microsoft event",
          "year": ""
        }
      ],
      "cover_letter": "I'm excited about this internship because it bridges what I've studied with where I believe the future is headed...",
      "education": [
        "Plus 2 - DAV public school khalari, Ranchi",
        "Under Graduate - AMITY UNIVERSITY JHARKHAND"
      ],
      "education_detailed": [
        {
          "additional_info": "",
          "degree": "Plus 2",
          "grade_percentage": "",
          "institution": "DAV public school khalari, Ranchi",
          "year": "2021-2023"
        }
      ],
      "email": "singheesha755@gmail.com",
      "experience": [
        {
          "company": "",
          "description": "No professional experience",
          "duration": "",
          "position": "",
          "skills_gained": []
        }
      ],
      "github_url": "https://github.com/Eesha-Singh",
      "linkedin_url": "",
      "phone": "+919142462953",
      "portfolio_url": "",
      "projects": [
        {
          "description": "A secure user authentication system with features like login, signup, and password reset.",
          "github_link": "https://github.com/Eesha-Singh/secure-auth-system",
          "name": "Secure Authentication System",
          "technologies": ["Node.js", "Express", "MongoDB", "JWT"],
          "timeline": "2024"
        }
      ],
      "skills": ["JavaScript", "Python", "React", "Node.js", "Git", "Problem Solving"],
      "resume_url": "https://drive.google.com/file/d/1abc123/view"
    }
  ]
}
```

#### Error Responses

**401 Unauthorized**
```bash
# cURL Response
< HTTP/2 401 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden**
```bash
# cURL Response
< HTTP/2 403 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Forbidden"
}
```

---

## 2. Screening API

### GET /api/amity/screening
Retrieves AI screening results for all candidates.

#### cURL Request
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X 'GET' \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -v
```

#### Alternative Simple Request
```bash
curl https://apis.flocci.in/api/amity/screening \
  -H "Authorization: Bearer YOUR_TOKEN_HERE"
```

#### cURL Response Headers
```bash
< HTTP/2 200 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
< date: Sun, 03 Aug 2025 07:29:04 GMT
< server: Vercel
```

#### Response (200 OK)
```json
{
  "job_description": "Job Title: Software Development Intern...",
  "results": [
    {
      "candidate_email": "singheesha755@gmail.com",
      "candidate_name": "Eesha Singh",
      "email_date": "",
      "email_id": "",
      "email_subject": "",
      "from": "",
      "screening_result": {
        "adaptability_growth": {
          "communication_collaboration": 6,
          "learning_agility": 7,
          "total": 13
        },
        "areas_for_development": [
          "Experience with relevant frameworks (React, Node)",
          "Understanding of RESTful APIs",
          "Exposure to AI/ML toolchains"
        ],
        "bias_detection": {
          "bias_corrected": true,
          "biases_detected": [
            "Tech stack rigidity bias detected"
          ],
          "corrections_applied": [],
          "original_score": 68
        },
        "confidence_level": "MEDIUM",
        "core_competencies": {
          "javascript_python": 7,
          "react_node_express": 5,
          "sql_databases": 4,
          "git_collaboration": 6,
          "total": 22
        },
        "cultural_fit": {
          "ownership_drive": 7,
          "curiosity_learning": 8,
          "remote_collaboration": 6,
          "total": 21
        },
        "final_recommendation": "SHORTLIST",
        "final_score": 74,
        "key_strengths": [
          "Strong foundational programming skills",
          "High learning agility and curiosity",
          "Good problem-solving approach"
        ],
        "project_experience": {
          "technical_depth": 6,
          "innovation_creativity": 7,
          "code_quality": 6,
          "total": 19
        },
        "rank": 1,
        "reasoning": "Eesha demonstrates solid foundational skills in JavaScript and Python...",
        "score_breakdown": {
          "adaptability_growth": 13,
          "core_competencies": 22,
          "cultural_fit": 21,
          "project_experience": 19,
          "total": 75
        }
      },
      "interview_marks": {
        "technical": {
          "core_fundamentals": 4,
          "system_thinking": 4,
          "problem_solving": 4
        },
        "gd": {
          "content_clarity": 4,
          "collaborative_innovation": 4,
          "leadership_drive": 4
        },
        "flocci_alignment": {
          "curiosity_proactiveness": 4,
          "culture_fit_autonomy": 4
        },
        "total": 32,
        "remarks": "Good potential with strong fundamentals.",
        "interviewer": "Test Interviewer",
        "timestamp": "2025-08-03T06:47:09.041Z"
      }
    }
  ]
}
```

### POST /api/amity/screening
Updates interview marks for a specific candidate.

#### cURL Request (Full Example)
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X 'POST' \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -H 'Accept: application/json' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36' \
  --data-raw '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {
        "core_fundamentals": 4,
        "system_thinking": 4,
        "problem_solving": 4
      },
      "gd": {
        "content_clarity": 4,
        "collaborative_innovation": 4,
        "leadership_drive": 4
      },
      "flocci_alignment": {
        "curiosity_proactiveness": 4,
        "culture_fit_autonomy": 4
      },
      "total": 32,
      "remarks": "Good potential with strong fundamentals.",
      "interviewer": "Test Interviewer",
      "timestamp": "2025-08-03T06:47:09.041Z"
    }
  }' \
  -v
```

#### cURL Request (Minimal Example)
```bash
curl https://apis.flocci.in/api/amity/screening \
  -X POST \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "candidate@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4, "system_thinking": 3, "problem_solving": 5},
      "gd": {"content_clarity": 4, "collaborative_innovation": 4, "leadership_drive": 3},
      "flocci_alignment": {"curiosity_proactiveness": 5, "culture_fit_autonomy": 4},
      "total": 32,
      "remarks": "Strong candidate",
      "interviewer": "John Doe"
    }
  }'
```

#### cURL Request (Partial Update Example)
```bash
curl https://apis.flocci.in/api/amity/screening \
  -X POST \
  -H "Authorization: Bearer YOUR_TOKEN_HERE" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "candidate@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 5},
      "remarks": "Updated technical score after review"
    }
  }'
```

#### cURL Response Headers (Success)
```bash
< HTTP/2 200 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
< date: Sun, 03 Aug 2025 07:35:15 GMT
< server: Vercel
< content-length: 1284
```

#### Request Body Schema
```json
{
  "candidate_email": "string (required)",
  "interview_marks": {
    "technical": {
      "core_fundamentals": "number (1-5)",
      "system_thinking": "number (1-5)",
      "problem_solving": "number (1-5)"
    },
    "gd": {
      "content_clarity": "number (1-5)",
      "collaborative_innovation": "number (1-5)",
      "leadership_drive": "number (1-5)"
    },
    "flocci_alignment": {
      "curiosity_proactiveness": "number (1-5)",
      "culture_fit_autonomy": "number (1-5)"
    },
    "total": "number (calculated sum)",
    "remarks": "string (optional)",
    "interviewer": "string (optional)",
    "timestamp": "string (ISO date, optional)"
  }
}
```

#### Response (200 OK)
```json
{
  "success": true,
  "message": "Interview marks updated successfully",
  "candidate": {
    "candidate_email": "singheesha755@gmail.com",
    "candidate_name": "Eesha Singh",
    "screening_result": { /* ... screening data ... */ },
    "interview_marks": {
      "technical": {
        "core_fundamentals": 4,
        "system_thinking": 4,
        "problem_solving": 4
      },
      "gd": {
        "content_clarity": 4,
        "collaborative_innovation": 4,
        "leadership_drive": 4
      },
      "flocci_alignment": {
        "curiosity_proactiveness": 4,
        "culture_fit_autonomy": 4
      },
      "total": 32,
      "remarks": "Good potential with strong fundamentals.",
      "interviewer": "Test Interviewer",
      "timestamp": "2025-08-03T06:47:09.041Z"
    }
  }
}
```

#### Response (In serverless environment - file write failure)
```bash
< HTTP/2 500 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "success": false,
  "error": "Failed to persist interview marks",
  "message": "File write failed in serverless environment - data not saved",
  "details": "EROFS: read-only file system, open '/var/task/src/app/api/amity/ai_screening_v3.json'",
  "candidate_email": "singheesha755@gmail.com",
  "interview_marks": { /* ... submitted marks ... */ }
}
```

#### Error Responses

**400 Bad Request - Missing candidate_email**
```bash
# cURL Response
< HTTP/2 400 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "candidate_email is required"
}
```

**404 Not Found - Candidate doesn't exist**
```bash
# cURL Response
< HTTP/2 404 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Candidate not found"
}
```

**401 Unauthorized - Invalid or missing token**
```bash
# cURL Response
< HTTP/2 401 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Unauthorized"
}
```

**403 Forbidden - Wrong email access**
```bash
# cURL Response
< HTTP/2 403 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Forbidden"
}
```

**405 Method Not Allowed - Endpoint not deployed**
```bash
# cURL Response
< HTTP/2 405 
< access-control-allow-credentials: true
< access-control-allow-headers: Content-Type, Authorization, X-Requested-With
< access-control-allow-methods: GET, POST, PUT, DELETE, OPTIONS
< content-type: application/json
```
```json
{
  "error": "Method not allowed"
}
```

**500 Internal Server Error**
```bash
# cURL Response
< HTTP/2 500 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "error": "Internal server error",
  "details": "Specific error message"
}
```

**500 File Write Error (Serverless Environment)**
```bash
# cURL Response
< HTTP/2 500 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
< content-type: application/json
```
```json
{
  "success": false,
  "error": "Failed to persist interview marks",
  "message": "File write failed in serverless environment - data not saved",
  "details": "EROFS: read-only file system, open '/var/task/src/app/api/amity/ai_screening_v3.json'",
  "candidate_email": "singheesha755@gmail.com",
  "interview_marks": { /* ... submitted marks ... */ }
}
```

---

## 🧪 Testing Guide with cURL

### Prerequisites
```bash
# Set your token as an environment variable for easier testing
export API_TOKEN="7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb"
export BASE_URL="https://apis.flocci.in"
```

### Test 1: Check API Health (OPTIONS)
```bash
curl "$BASE_URL/api/amity/screening" \
  -X OPTIONS \
  -v
```

**Expected Response:**
```bash
< HTTP/2 200 
< access-control-allow-origin: *
< access-control-allow-methods: GET, POST, OPTIONS
< access-control-allow-headers: Content-Type, Authorization
```

### Test 2: Get All Candidates
```bash
curl "$BASE_URL/api/amity/candidates" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: application/json" \
  -v
```

**Expected Response:**
```bash
< HTTP/2 200 
< content-type: application/json
```
```json
{
  "candidate_profiles": [
    {
      "candidate_email": "singheesha755@gmail.com",
      "candidate_name": "Eesha Singh",
      "skills": ["JavaScript", "Python", "React"],
      ...
    }
  ]
}
```

### Test 3: Get Screening Results
```bash
curl "$BASE_URL/api/amity/screening" \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Accept: application/json" \
  -v
```

**Expected Response:**
```bash
< HTTP/2 200 
< content-type: application/json
```
```json
{
  "job_description": "Job Title: Software Development Intern...",
  "results": [
    {
      "candidate_email": "singheesha755@gmail.com",
      "candidate_name": "Eesha Singh",
      "screening_result": {
        "final_score": 74,
        "final_recommendation": "SHORTLIST",
        ...
      }
    }
  ]
}
```

### Test 4: Update Interview Marks (Full Update)
```bash
curl "$BASE_URL/api/amity/screening" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {
        "core_fundamentals": 4,
        "system_thinking": 4,
        "problem_solving": 4
      },
      "gd": {
        "content_clarity": 4,
        "collaborative_innovation": 4,
        "leadership_drive": 4
      },
      "flocci_alignment": {
        "curiosity_proactiveness": 4,
        "culture_fit_autonomy": 4
      },
      "total": 32,
      "remarks": "Excellent candidate with strong technical skills",
      "interviewer": "Jane Smith",
      "timestamp": "'$(date -u +"%Y-%m-%dT%H:%M:%S.%3NZ")'"
    }
  }' \
  -v
```

**Expected Response:**
```bash
< HTTP/2 200 
< content-type: application/json
```
```json
{
  "success": true,
  "message": "Interview marks updated successfully",
  "candidate": {
    "candidate_email": "singheesha755@gmail.com",
    "candidate_name": "Eesha Singh",
    "interview_marks": {
      "technical": {
        "core_fundamentals": 4,
        "system_thinking": 4,
        "problem_solving": 4
      },
      ...
    }
  }
}
```

### Test 5: Partial Update (Only Technical Scores)
```bash
curl "$BASE_URL/api/amity/screening" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {
        "core_fundamentals": 5
      },
      "remarks": "Updated core fundamentals score after detailed review"
    }
  }' \
  -v
```

### Test 6: Error Cases

**Test Invalid Token:**
```bash
curl "$BASE_URL/api/amity/screening" \
  -H "Authorization: Bearer invalid_token_123" \
  -v
```

**Expected Response:**
```bash
< HTTP/2 403 
```
```json
{
  "error": "Forbidden"
}
```

**Test Missing candidate_email:**
```bash
curl "$BASE_URL/api/amity/screening" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "interview_marks": {
      "technical": {"core_fundamentals": 4}
    }
  }' \
  -v
```

**Expected Response:**
```bash
< HTTP/2 400 
```
```json
{
  "error": "candidate_email is required"
}
```

**Test Non-existent Candidate:**
```bash
curl "$BASE_URL/api/amity/screening" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "nonexistent@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4}
    }
  }' \
  -v
```

**Expected Response:**
```bash
< HTTP/2 404 
```
```json
{
  "error": "Candidate not found"
}
```

### Test 7: Browser-like Request (with all headers)
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X 'POST' \
  -H 'sec-ch-ua-platform: "macOS"' \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Referer: https://your-frontend-domain.com/' \
  -H 'User-Agent: Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/138.0.0.0 Safari/537.36' \
  -H 'sec-ch-ua: "Not)A;Brand";v="8", "Chromium";v="138", "Google Chrome";v="138"' \
  -H 'Content-Type: application/json' \
  -H 'sec-ch-ua-mobile: ?0' \
  --data-raw '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4, "system_thinking": 4, "problem_solving": 4},
      "gd": {"content_clarity": 4, "collaborative_innovation": 4, "leadership_drive": 4},
      "flocci_alignment": {"curiosity_proactiveness": 4, "culture_fit_autonomy": 4},
      "total": 32,
      "remarks": "Good potential with strong fundamentals.",
      "interviewer": "Test Interviewer",
      "timestamp": "2025-08-03T06:47:09.041Z"
    }
  }' \
  -v
```

---

## CORS Headers
All endpoints include CORS headers:
```
Access-Control-Allow-Origin: *
Access-Control-Allow-Methods: GET, POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization
```

---

## Rate Limiting
Please implement reasonable rate limiting on the frontend side to avoid overwhelming the API.

---

## Error Handling Best Practices

1. **Always check the response status code**
2. **Handle 401/403 errors by redirecting to login**
3. **Show user-friendly error messages for 4xx errors**
4. **Implement retry logic for 5xx errors**
5. **Handle network timeouts gracefully**

## Frontend Integration Examples

### React/JavaScript Example
```javascript
const API_BASE = 'https://apis.flocci.in';

// Get candidates
async function getCandidates(token) {
  try {
    const response = await fetch(`${API_BASE}/api/amity/candidates`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching candidates:', error);
    throw error;
  }
}

// Get screening results
async function getScreeningResults(token) {
  try {
    const response = await fetch(`${API_BASE}/api/amity/screening`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error fetching screening results:', error);
    throw error;
  }
}

// Update interview marks
async function updateInterviewMarks(token, candidateEmail, interviewMarks) {
  try {
    const response = await fetch(`${API_BASE}/api/amity/screening`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        candidate_email: candidateEmail,
        interview_marks: interviewMarks
      })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    return await response.json();
  } catch (error) {
    console.error('Error updating interview marks:', error);
    throw error;
  }
}
```

## Notes for Frontend Engineers

1. **Authentication**: Make sure to include the Bearer token in all requests
2. **Error Handling**: Implement proper error handling for all API calls
3. **Loading States**: Show loading indicators while API calls are in progress
4. **Data Validation**: Validate interview marks on the frontend before sending to API
5. **Optimistic Updates**: Consider implementing optimistic updates for better UX
6. **Caching**: Consider caching candidate and screening data to reduce API calls
7. **Real-time Updates**: If multiple users are updating interview marks, consider implementing polling or WebSocket updates

## Interview Marks Scoring Guide

- **Scale**: 1-5 (where 5 is excellent, 1 is poor)
- **Technical Skills**:
  - Core Fundamentals: Basic programming concepts, data structures
  - System Thinking: Understanding of system design and architecture
  - Problem Solving: Ability to break down and solve complex problems
- **Group Discussion**:
  - Content Clarity: Clear articulation of ideas
  - Collaborative Innovation: Ability to build on others' ideas
  - Leadership Drive: Taking initiative and guiding discussions
- **Flocci Alignment**:
  - Curiosity Proactiveness: Asking questions, showing interest
  - Culture Fit Autonomy: Independence and alignment with company values
