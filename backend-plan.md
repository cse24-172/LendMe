# Lendme backend plan

GitHub Pages hosts static files only. A real system needs a server.

## Stack
- Java Spring Boot (REST API)
- PostgreSQL (database)
- Spring Security with hashed passwords (BCrypt) and HTTPS
- Private file storage for documents (never in the public repository)

## Database tables
- users: id, full_name, email, password_hash, institution, created_at
- applications: id, user_id, amount, status (PENDING / APPROVED / REJECTED), signed_name, submitted_at
- documents: id, application_id, type (STUDENT_ID / PROOF_OF_REGISTRATION / RESULTS / BANK_STATEMENT), storage_path

## API endpoints
- POST /api/register, POST /api/login
- POST /api/applications, GET /api/applications/me
- POST /api/applications/{id}/documents
- PATCH /api/applications/{id}/status (staff only)

## Before going live
- Check Botswana licensing and regulation for lending (for example with NBFIRA)
- Privacy and data-protection compliance for personal and financial documents
- Staff review screen for approvals
- Never commit passwords, API keys or real documents to GitHub
