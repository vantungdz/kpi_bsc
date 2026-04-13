---
applyTo: "**/*.spec.ts,**/*.e2e-spec.ts"
---

# Testing Strategy

- Use Jest as testing framework
- Unit test services with mocked repositories
- Use `Test.createTestingModule()`
- Use `supertest` for E2E tests
- Maintain separate test DB
- Target high code coverage for business logic
