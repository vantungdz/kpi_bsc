---
applyTo: "**/*.ts"
---

# NestJS Architecture Guidelines

- Organize into feature modules (e.g., `UsersModule`)
- Use `@Controller`, `@Injectable`, `@Module`
- Thin controllers, logic in services
- Use DTOs with `class-validator`, `class-transformer`
- Use constructor injection with `readonly` modifier
- Use `@nestjs/config` with schema validation (e.g., Joi)
- Use `ValidationPipe` globally or per controller
- Use `@nestjs/swagger` for API documentation
- Use `@nestjs/typeorm` for database integration