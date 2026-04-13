---
applyTo: "**/entities/**/*.ts,**/repositories/**/*.ts"
---

# TypeORM Guidelines

- Use `@Entity`, `@PrimaryGeneratedColumn('uuid')`, `@CreateDateColumn`, `@UpdateDateColumn`
- Define relationships using `@ManyToOne`, `@OneToMany`, etc.
- Inject repositories with `@InjectRepository`
- Use migrations; avoid `synchronize: true` in production
- Prefer QueryBuilder for complex queries
