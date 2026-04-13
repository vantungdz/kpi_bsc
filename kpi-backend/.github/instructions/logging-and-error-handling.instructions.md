---
applyTo: "**/*.ts"
---

# Logging and Error Handling

- Use `Logger` from `@nestjs/common`
- Log key events, errors, and debug info
- Use built-in NestJS exceptions (e.g., `BadRequestException`)
- Create custom exceptions extending `HttpException`
- Implement a global exception filter
- Use `@Catch()` decorator for custom filters
- Use `@UseFilters()` to apply filters to specific controllers or routes