# **App Name**: NexusConnect

## Core Features:

- Unified Signup API: Handle user signups, updating user details in the Supabase PostgreSQL database to align with auth from Google/Meta/Github etc.
- Centralized Login API: Verify user credentials against a common user table for login, accommodating users registered via signup or social auth providers.
- General Contact Email: Send contact form submissions via email using SMTP through Gmail.
- Intelligent Company Contact: Use a Large Language Model (LLM) tool to resolve a recipient email address for a specific company using company name resolution via LLM prompt, and then dispatch an email using SMTP.

## Style Guidelines:

- Primary color: A calm and trustworthy blue (#4285F4) for conveying reliability.
- Background color: Light, desaturated blue (#E8F0FE) to keep the interface airy and professional.
- Accent color: A vibrant green (#34A853) to highlight actions and provide a sense of progress.
- Clean, sans-serif fonts for optimal readability and a modern feel.
- Use simple, outlined icons for intuitive navigation.
- Subtle transitions and animations to acknowledge user actions and enhance the overall experience.