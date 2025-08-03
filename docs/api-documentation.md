# Flocci Backend API Documentation

## Table of Contents
1. [Overview](#overview)
2. [Authentication](#authentication)
3. [API Endpoints](#api-endpoints)
4. [Amity Campus Drive Integration](#amity-campus-drive-integration)
5. [Interview Scoring System](#interview-scoring-system)
6. [Error Handling](#error-handling)
7. [Data Models](#data-models)
8. [Usage Examples](#usage-examples)

---

## Overview

The Flocci Backend API provides secure endpoints for managing the Amity University Jharkhand campus drive scheduled for **August 4, 2025**. The API supports candidate screening data retrieval and real-time interview marks capture during the campus recruitment process.

### Base URLs
- **Local Development:** `http://localhost:3000`
- **Production:** `https://apis.flocci.in`

### Key Features
- **Secure Authentication** - Session-based auth with role restrictions
- **Real-time Interview Scoring** - Live capture of interview marks
- **Incremental Updates** - Section-by-section scoring capability
- **Data Persistence** - File-based storage with JSON structure
- **Comprehensive Candidate Data** - AI screening results + interview marks

---

## Authentication

All protected endpoints require authentication as `placementdrive@amity.in`. Session tokens are automatically managed via HTTP-only cookies.

### Authentication Flow
1. **Signup** → Create user account
2. **Login** → Receive session token
3. **Protected API Access** → Use session token for Amity endpoints

---

## API Endpoints

### 1. User Authentication

#### 1.1 Sign Up
Create a new user account.

**Endpoint:** `POST /api/signup`

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}
```

**Success Response (201):**
```json
{
  "message": "Signup successful",
  "user": {
    "id": "79d46c0c-e58b-456e-8661-223176909f02",
    "email": "user@example.com",
    "full_name": "John Doe"
  }
}
```

**cURL Example:**
```bash
curl --location 'http://localhost:3000/api/signup' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "user@example.com",
  "password": "securepassword123",
  "full_name": "John Doe"
}'
```

#### 1.2 Login
Authenticate user and receive session token.

**Endpoint:** `POST /api/login`

**Request Body:**
```json
{
  "email": "placementdrive@amity.in",
  "password": "your_password"
}
```

**Success Response (200):**
```json
{
  "message": "Login successful",
  "user": {
    "id": "79d46c0c-e58b-456e-8661-223176909f02",
    "email": "placementdrive@amity.in",
    "full_name": "Technical Staff",
    "role": "user"
  },
  "session_token": "9e9d46a70a889ba5fa3f9a1ed3086a5491c835c6d90332bb22619a2babee319e"
}
```

**cURL Example:**
```bash
curl --location 'http://localhost:3000/api/login' \
--header 'Content-Type: application/json' \
--data-raw '{
  "email": "placementdrive@amity.in",
  "password": "your_password"
}'
```

---

### 2. Amity Campus Drive APIs

#### 2.1 Get Candidates Data
Retrieve candidate processing data for the campus drive.

**Endpoint:** `GET /api/amity/candidates`
**Authentication:** Required (`placementdrive@amity.in` only)
**Data Source:** `processing_v3.json`

**Success Response (200):**
```json
{
  "candidates": [
    {
      "id": "candidate_001",
      "name": "John Doe",
      "email": "john@example.com",
      "skills": ["Python", "React"],
      "experience": "2 years",
      "university": "Amity University"
    }
  ],
  "meta": {
    "total_candidates": 35,
    "processed_date": "2025-08-04"
  }
}
```

**cURL Example:**
```bash
curl --location 'http://localhost:3000/api/amity/candidates' \
--header 'Cookie: session_token=your_session_token'
```

#### 2.2 Get Screening Data
Retrieve AI screening results and interview marks for all candidates.

**Endpoint:** `GET /api/amity/screening`
**Authentication:** Required (`placementdrive@amity.in` only)
**Data Source:** `ai_screening_v3.json`

**Success Response (200):**
```json
{
  "job_description": "Software Development Intern at Flocci...",
  "results": [
    {
      "candidate_email": "singh05satayam@gmail.com",
      "candidate_name": "Satyam Singh",
      "email_date": "",
      "email_id": "",
      "email_subject": "",
      "from": "",
      "screening_result": {
        "adaptability_growth": {
          "communication_collaboration": 5,
          "learning_agility": 6,
          "total": 11
        },
        "areas_for_development": [
          "Depth in specific technologies",
          "Experience with AI/ML tools"
        ],
        "confidence_level": "MEDIUM",
        "cultural_fit": {
          "startup_mindset": 5,
          "tech_passion": 7,
          "total": 12
        },
        "technical_competence": {
          "ai_ml_potential": 3,
          "development_skills": 10,
          "programming_fundamentals": 14,
          "system_understanding": 3,
          "total": 30
        },
        "overall_score": 68,
        "recommendation": "INTERVIEW"
      },
      "interview_marks": {
        "gd": {
          "content_clarity": 8,
          "collaborative_innovation": 9,
          "leadership_drive": 4
        },
        "technical": {
          "core_fundamentals": 12,
          "system_thinking": 13,
          "problem_solving": 14
        },
        "flocci_alignment": {
          "curiosity_proactiveness": 13,
          "culture_fit_autonomy": 14
        },
        "total": 91,
        "remarks": "Strong technical and team skills.",
        "interviewer": "Afsar Hussain",
        "timestamp": "2025-08-04T14:30:00Z"
      }
    }
  ]
}
```

**cURL Example:**
```bash
curl --location 'http://localhost:3000/api/amity/screening' \
--header 'Cookie: session_token=your_session_token'
```

#### 2.3 Update Interview Marks
Add or update interview marks for specific candidates during the campus drive.

**Endpoint:** `PATCH /api/amity/screening`
**Authentication:** Required (`placementdrive@amity.in` only)
**Features:** 
- Incremental updates (section by section)
- Overwrite existing marks
- Merge with existing data

**Request Body:**
```json
{
  "candidate_email": "candidate@example.com",
  "interview_marks": {
    "gd": {
      "content_clarity": 8,
      "collaborative_innovation": 9,
      "leadership_drive": 4
    }
  }
}
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Interview marks updated successfully",
  "candidate": {
    "candidate_email": "candidate@example.com",
    "candidate_name": "Candidate Name",
    "screening_result": { ... },
    "interview_marks": {
      "gd": {
        "content_clarity": 8,
        "collaborative_innovation": 9,
        "leadership_drive": 4
      }
    }
  }
}
```

---

## Amity Campus Drive Integration

### Campus Drive Details
- **Date:** Monday, August 4, 2025
- **Time:** 11:00 AM – 5:00 PM  
- **Venue:** Amity University Jharkhand
- **Team Members:** 4 interviewers
- **Expected Candidates:** 35–40
- **Target Selections:** 15–20 interns

### Interview Schedule
| Time Slot | Activity |
|-----------|----------|
| 11:00 AM – 12:00 PM | Group Discussion (6 groups × 10 mins) |
| 12:00 PM – 1:15 PM | Technical Interviews (Round 1) |
| 1:15 PM – 2:00 PM | Lunch Break |
| 2:00 PM – 5:00 PM | Technical Interviews (Round 2) |

### API Integration Workflow
1. **Pre-Drive:** Access candidate data via `/api/amity/candidates`
2. **During Drive:** Real-time scoring via `PATCH /api/amity/screening`
3. **Live Updates:** Incremental marks capture for each interview section
4. **Post-Drive:** Complete assessment data available via `/api/amity/screening`

---

## Interview Scoring System

### Scoring Categories (Total: 100 Points)

#### 1. Group Discussion (25 Points)
```json
"gd": {
  "content_clarity": 10,        // Articulation, logical flow, relevance
  "collaborative_innovation": 10, // Builds on ideas, openness, listening
  "leadership_drive": 5         // Guides conversation, assertiveness
}
```

#### 2. Technical & Analytical Acumen (45 Points)
```json
"technical": {
  "core_fundamentals": 15,      // DS/Algo, SQL, OOPs, DBMS, REST APIs
  "system_thinking": 15,        // End-to-end app understanding
  "problem_solving": 15         // Logic, breakdown, reasoning process
}
```

#### 3. Flocci Alignment & Potential (30 Points)
```json
"flocci_alignment": {
  "curiosity_proactiveness": 15, // Projects, Github, self-learning
  "culture_fit_autonomy": 15     // Ownership, adaptability, remote-readiness
}
```

#### 4. Additional Metadata
```json
{
  "total": 91,
  "remarks": "Strong technical and team skills.",
  "interviewer": "Interviewer Name",
  "timestamp": "2025-08-04T14:30:00Z"
}
```

---

## Usage Examples

### Incremental Scoring Workflow

#### Step 1: Add GD Marks
```bash
curl --location --request PATCH 'http://localhost:3000/api/amity/screening' \
--header 'Content-Type: application/json' \
--header 'Cookie: session_token=your_session_token' \
--data-raw '{
  "candidate_email": "singh05satayam@gmail.com",
  "interview_marks": {
    "gd": {
      "content_clarity": 8,
      "collaborative_innovation": 9,
      "leadership_drive": 4
    }
  }
}'
```

#### Step 2: Add Technical Marks (Preserves GD)
```bash
curl --location --request PATCH 'http://localhost:3000/api/amity/screening' \
--header 'Content-Type: application/json' \
--header 'Cookie: session_token=your_session_token' \
--data-raw '{
  "candidate_email": "singh05satayam@gmail.com",
  "interview_marks": {
    "technical": {
      "core_fundamentals": 12,
      "system_thinking": 13,
      "problem_solving": 14
    }
  }
}'
```

#### Step 3: Add Final Marks + Metadata
```bash
curl --location --request PATCH 'http://localhost:3000/api/amity/screening' \
--header 'Content-Type: application/json' \
--header 'Cookie: session_token=your_session_token' \
--data-raw '{
  "candidate_email": "singh05satayam@gmail.com",
  "interview_marks": {
    "flocci_alignment": {
      "curiosity_proactiveness": 13,
      "culture_fit_autonomy": 14
    },
    "total": 91,
    "remarks": "Strong technical and team skills.",
    "interviewer": "Afsar Hussain",
    "timestamp": "2025-08-04T14:30:00Z"
  }
}'
```

#### Step 4: Update Existing Marks (Overwrite)
```bash
curl --location --request PATCH 'http://localhost:3000/api/amity/screening' \
--header 'Content-Type: application/json' \
--header 'Cookie: session_token=your_session_token' \
--data-raw '{
  "candidate_email": "singh05satayam@gmail.com",
  "interview_marks": {
    "gd": {
      "content_clarity": 10,
      "collaborative_innovation": 8,
      "leadership_drive": 5
    },
    "total": 95
  }
}'
```

---

## Error Handling

### Common Error Responses

#### Authentication Errors
```json
// 401 Unauthorized
{
  "error": "Unauthorized"
}

// 403 Forbidden (Wrong user)
{
  "error": "Forbidden"
}
```

#### Validation Errors
```json
// 400 Bad Request
{
  "error": "candidate_email is required"
}

// 404 Not Found
{
  "error": "Candidate not found"
}
```

#### Server Errors
```json
// 500 Internal Server Error
{
  "error": "Internal server error"
}
```

---

## Data Models

### Candidate Screening Result
```typescript
interface CandidateScreeningResult {
  candidate_email: string;
  candidate_name: string;
  email_date: string;
  email_id: string;
  email_subject: string;
  from: string;
  screening_result: {
    adaptability_growth: {
      communication_collaboration: number;
      learning_agility: number;
      total: number;
    };
    areas_for_development: string[];
    confidence_level: "LOW" | "MEDIUM" | "HIGH";
    cultural_fit: {
      startup_mindset: number;
      tech_passion: number;
      total: number;
    };
    technical_competence: {
      ai_ml_potential: number;
      development_skills: number;
      programming_fundamentals: number;
      system_understanding: number;
      total: number;
    };
    overall_score: number;
    recommendation: "INTERVIEW" | "CONSIDER" | "REJECT";
  };
  interview_marks?: InterviewMarks;
}
```

### Interview Marks
```typescript
interface InterviewMarks {
  gd?: {
    content_clarity: number;        // 0-10
    collaborative_innovation: number; // 0-10
    leadership_drive: number;       // 0-5
  };
  technical?: {
    core_fundamentals: number;      // 0-15
    system_thinking: number;        // 0-15
    problem_solving: number;        // 0-15
  };
  flocci_alignment?: {
    curiosity_proactiveness: number; // 0-15
    culture_fit_autonomy: number;   // 0-15
  };
  total?: number;                   // 0-100
  remarks?: string;
  interviewer?: string;
  timestamp?: string;               // ISO 8601 format
}
```

---

## Implementation Notes

### Data Storage
- **Candidate Data:** Stored in `src/app/api/amity/processing_v3.json`
- **Screening Data:** Stored in `src/app/api/amity/ai_screening_v3.json`
- **Interview Marks:** Appended to screening data structure
- **Persistence:** Real-time file updates during interview process

### Security Features
- **Role-based Access:** Only `placementdrive@amity.in` can access Amity APIs
- **Session Management:** 7-day expiration with HTTP-only cookies
- **Token Hashing:** Session tokens are hashed before database storage
- **Input Validation:** Comprehensive request body validation

### Performance Considerations
- **File-based Storage:** Suitable for campus drive scale (35-40 candidates)
- **Incremental Updates:** Minimize data transfer during live interviews
- **Session Caching:** Efficient authentication for repeated requests
- **Error Recovery:** Robust error handling for interview disruptions

---

## Support Information

### Campus Drive Day Contacts
- **Technical Lead:** Afsar Hussain
- **API Endpoint:** `https://apis.flocci.in` or `http://localhost:3000`
- **Backup Procedures:** Manual data entry forms available
- **Real-time Support:** Technical team on-site

### Troubleshooting
1. **Authentication Issues:** Verify `placementdrive@amity.in` login
2. **Session Expiry:** Re-login to obtain fresh session token
3. **Candidate Not Found:** Verify exact email address spelling
4. **Network Issues:** Switch to local development server if needed

---

*Last Updated: August 3, 2025*
*Ready for Amity University Jharkhand Campus Drive - August 4, 2025*
