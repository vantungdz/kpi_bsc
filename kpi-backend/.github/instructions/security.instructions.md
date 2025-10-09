---
applyTo: "**/*.ts"
---

# Security Guidelines

- Use JWT authentication with `@nestjs/passport`, `passport-jwt`
- Apply `RolesGuard`, `@Roles()` for authorization
- Sanitize input and validate with DTOs
- Use `helmet`, `@nestjs/throttler` for security headers and rate limiting
- Avoid SQL injection and XSS
