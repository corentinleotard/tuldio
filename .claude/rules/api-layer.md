# API Layer — Conventions

## Structure

```
apps/api/src/
  index.ts              # Express app setup + server start
  routes/               # Route definitions (grouped by domain)
  controllers/          # 1 file = 1 handler function
  middleware/
    auth.ts             # JWT verification (custom email OTP auth)
    error-handler.ts    # HandledError → JSON response
    validate.ts         # Zod request validation
```

## Auth Flow

```
POST /auth/otp/send     → generate 6-digit code, store in otp_codes (10min expiry), send via Resend
POST /auth/otp/verify   → verify code → create user if first login → return { accessToken, refreshToken }
POST /auth/refresh       → verify refresh token → return new { accessToken, refreshToken }
POST /auth/logout        → revoke refresh token
```

- Access token: JWT, 15 minutes, signed with JWT_SECRET
- Refresh token: random 64-char string, stored in DB, 90 days
- On refresh: old refresh token is revoked, new one issued (rotation)

## Rules

- Controllers are thin — extract params, call use-case, return response
- All routes require auth middleware (except health check + auth routes)
- Auth middleware extracts `userId` and `teamId` from JWT → attaches to `req`
- If access token expired → client calls /auth/refresh silently → retries
- Use-cases receive `userId` and `teamId` from controller — never trust client-sent IDs
- File uploads via multer → store on disk → pass file path to use-case
- Response format: `{ data: T }` for success, `{ error: { code, message } }` for errors
