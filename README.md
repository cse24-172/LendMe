# Lendme backend (Spring Boot)

REST API for the Lendme student loan prototype. Java 17, Spring Boot 3.3, PostgreSQL, JWT login, BCrypt password hashing.

## Run locally (test mode, in-memory database)
```
mvn spring-boot:run -Dspring-boot.run.profiles=dev
```
Health check: http://localhost:8080/api/health
Test staff login in dev mode: staff@lendme.test / StaffPass123

## Run for real (PostgreSQL)
Set these environment variables, then `mvn spring-boot:run`:
- `DB_URL` e.g. `jdbc:postgresql://HOST:5432/lendme`, `DB_USER`, `DB_PASSWORD`
- `JWT_SECRET` at least 32 random characters (the app refuses to start without it)
- `CORS_ORIGINS` your site address, e.g. `https://YOUR-USERNAME.github.io`
- `STAFF_EMAIL` and `STAFF_PASSWORD` (8+ characters) to create the staff account
- `UPLOAD_DIR` folder for uploaded documents (use a persistent disk)

A `Dockerfile` is included for hosts that run containers. GitHub Pages cannot run this: host it on a Java or Docker host and use HTTPS.

The backend also serves the website files from the folder above, so one command runs everything.
Interest: 30% per year (shown on the website and calculator).

## Endpoints
| Method | Path | Who |
|---|---|---|
| POST | /api/auth/register | anyone: fullName, email, password, institution |
| POST | /api/auth/login | anyone: email, password. Returns a token |
| GET | /api/me | logged in |
| POST | /api/applications | student: multipart with amount, signedName, studentId, proofOfRegistration, results, bankStatement (PDF/JPG/PNG, 5 MB each) |
| GET | /api/applications/me | student: own applications and status |
| GET | /api/admin/applications | staff: all applications |
| PATCH | /api/admin/applications/{id}/status | staff: `{"status":"APPROVED"}` (or PENDING, REJECTED) |
| GET | /api/admin/documents/{id} | staff: download a document |

Send the token as `Authorization: Bearer <token>`.

## Before real students use it
Lending is regulated: get the licensing and data-protection requirements checked for Botswana. Use HTTPS, back up the database, and keep uploads and secrets out of GitHub. This code has not been security-audited.
