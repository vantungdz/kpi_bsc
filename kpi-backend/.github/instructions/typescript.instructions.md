---
applyTo: "**/*.ts"
---

# TypeScript Standards

- Enable `"strict": true`, `"noImplicitAny": true`, `"strictNullChecks": true` in `tsconfig.json`
- Prefer `interface` for object types
- Avoid `any`, use `unknown` when necessary
- Use `readonly` for immutable values
- Document all public functions and classes with JSDoc comments using English
- Use `const` for constants and `let` for variables that change
- Use `async/await`, wrap with `try/catch` for error handling
