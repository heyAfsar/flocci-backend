# Interview Marks API - Quick Reference

## Base URL
```
https://apis.flocci.in
```

## Authentication
```
Authorization: Bearer <your_session_token>
```

---

## Individual Interview Marks Update

### POST /api/amity/screening
Updates interview marks for a single candidate.

#### Single Candidate - Full Update
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
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
      "timestamp": "2025-08-03T08:30:00.000Z"
    }
  }'
```

**Success Response (200):**
```json
{
  "success": true,
  "message": "Interview marks updated successfully in database",
  "candidate": {
    "candidate_email": "singheesha755@gmail.com",
    "candidate_name": "Eesha Singh",
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
      "timestamp": "2025-08-03T08:30:00.000Z"
    }
  }
}
```

#### Single Candidate - Partial Update (Technical Only)
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {
        "core_fundamentals": 5
      },
      "remarks": "Updated core fundamentals after technical round 2"
    }
  }'
```

#### Single Candidate - Partial Update (GD Only)
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "gd": {
        "content_clarity": 5,
        "collaborative_innovation": 4,
        "leadership_drive": 5
      },
      "interviewer": "John Doe",
      "timestamp": "2025-08-03T09:15:00.000Z"
    }
  }'
```

#### Single Candidate - Remarks Only Update
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "remarks": "Final decision: Recommended for hire. Strong technical and communication skills.",
      "interviewer": "HR Panel",
      "timestamp": "2025-08-03T10:00:00.000Z"
    }
  }'
```

---

## Bulk Interview Marks Update

**Note:** Currently, the API handles individual updates only. For bulk updates, you need to make multiple API calls. Here are examples:

### Bulk Update Script (Multiple Candidates)
```bash
#!/bin/bash

API_TOKEN="7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb"
BASE_URL="https://apis.flocci.in/api/amity/screening"

# Candidate 1
curl "$BASE_URL" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "candidate1@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4, "system_thinking": 3, "problem_solving": 4},
      "gd": {"content_clarity": 4, "collaborative_innovation": 4, "leadership_drive": 3},
      "flocci_alignment": {"curiosity_proactiveness": 5, "culture_fit_autonomy": 4},
      "total": 31,
      "remarks": "Good technical skills, needs improvement in leadership",
      "interviewer": "Tech Panel"
    }
  }'

# Candidate 2
curl "$BASE_URL" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "candidate2@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 5, "system_thinking": 4, "problem_solving": 5},
      "gd": {"content_clarity": 5, "collaborative_innovation": 5, "leadership_drive": 4},
      "flocci_alignment": {"curiosity_proactiveness": 4, "culture_fit_autonomy": 5},
      "total": 37,
      "remarks": "Outstanding candidate, strong across all areas",
      "interviewer": "Tech Panel"
    }
  }'

# Candidate 3
curl "$BASE_URL" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "candidate_email": "candidate3@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 3, "system_thinking": 3, "problem_solving": 2},
      "gd": {"content_clarity": 3, "collaborative_innovation": 2, "leadership_drive": 2},
      "flocci_alignment": {"curiosity_proactiveness": 3, "culture_fit_autonomy": 3},
      "total": 21,
      "remarks": "Needs significant improvement, not recommended",
      "interviewer": "Tech Panel"
    }
  }'
```

### Bulk Update using PowerShell (Windows)
```powershell
$API_TOKEN = "7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb"
$BASE_URL = "https://apis.flocci.in/api/amity/screening"

$candidates = @(
    @{
        email = "candidate1@example.com"
        marks = @{
            technical = @{ core_fundamentals = 4; system_thinking = 3; problem_solving = 4 }
            gd = @{ content_clarity = 4; collaborative_innovation = 4; leadership_drive = 3 }
            flocci_alignment = @{ curiosity_proactiveness = 5; culture_fit_autonomy = 4 }
            total = 31
            remarks = "Good technical skills"
            interviewer = "Tech Panel"
        }
    },
    @{
        email = "candidate2@example.com"
        marks = @{
            technical = @{ core_fundamentals = 5; system_thinking = 4; problem_solving = 5 }
            gd = @{ content_clarity = 5; collaborative_innovation = 5; leadership_drive = 4 }
            flocci_alignment = @{ curiosity_proactiveness = 4; culture_fit_autonomy = 5 }
            total = 37
            remarks = "Outstanding candidate"
            interviewer = "Tech Panel"
        }
    }
)

foreach ($candidate in $candidates) {
    $body = @{
        candidate_email = $candidate.email
        interview_marks = $candidate.marks
    } | ConvertTo-Json -Depth 3

    Invoke-RestMethod -Uri $BASE_URL -Method POST -Headers @{
        "Authorization" = "Bearer $API_TOKEN"
        "Content-Type" = "application/json"
    } -Body $body
}
```

---

## Error Responses

### 400 - Missing candidate_email
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -d '{
    "interview_marks": {
      "technical": {"core_fundamentals": 4}
    }
  }'
```

**Error Response (400):**
```json
{
  "error": "candidate_email is required"
}
```

### 404 - Candidate not found
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Authorization: Bearer 7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb' \
  -H 'Content-Type: application/json' \
  -d '{
    "candidate_email": "nonexistent@example.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4}
    }
  }'
```

**Error Response (404):**
```json
{
  "error": "Candidate not found"
}
```

### 401 - Unauthorized
```bash
curl 'https://apis.flocci.in/api/amity/screening' \
  -X POST \
  -H 'Content-Type: application/json' \
  -d '{
    "candidate_email": "singheesha755@gmail.com",
    "interview_marks": {
      "technical": {"core_fundamentals": 4}
    }
  }'
```

**Error Response (401):**
```json
{
  "error": "Unauthorized"
}
```

### 500 - Storage failure
**Error Response (500):**
```json
{
  "success": false,
  "error": "Failed to persist interview marks",
  "message": "Both database and file storage failed",
  "db_error": "relation \"interview_marks\" does not exist",
  "file_error": "EROFS: read-only file system",
  "candidate_email": "singheesha755@gmail.com",
  "interview_marks": { /* submitted data */ }
}
```

---

## Interview Marks Schema

### Complete Schema
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

### Scoring Guide
- **Scale**: 1-5 (1 = Poor, 5 = Excellent)
- **Total Score**: Sum of all individual scores (max 40)
- **Technical**: Core programming, system design, problem-solving
- **GD**: Group discussion skills - clarity, collaboration, leadership
- **Flocci Alignment**: Cultural fit and company values alignment

---

## Quick Test Commands

### Environment Setup
```bash
export API_TOKEN="7cac108dafee36a87949b851cd7b1df7658e37f3ff76ceff9677b9ab5ea79abb"
export BASE_URL="https://apis.flocci.in/api/amity/screening"
```

### Quick Test - Minimal Update
```bash
curl "$BASE_URL" \
  -X POST \
  -H "Authorization: Bearer $API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"candidate_email":"singheesha755@gmail.com","interview_marks":{"technical":{"core_fundamentals":4},"remarks":"Quick test update"}}'
```

### Quick Test - Get Updated Data
```bash
curl "https://apis.flocci.in/api/amity/screening" \
  -H "Authorization: Bearer $API_TOKEN" | jq '.results[] | select(.candidate_email=="singheesha755@gmail.com") | .interview_marks'
```
