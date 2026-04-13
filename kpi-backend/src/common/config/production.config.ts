import { registerAs } from '@nestjs/config';

export default registerAs('production', () => ({
  // Database configuration
  database: {
    synchronize: process.env.NODE_ENV !== 'production',
    logging: process.env.NODE_ENV === 'development',
    migrationsRun: process.env.NODE_ENV === 'production',
    dropSchema: false, // Never drop schema in production
  },
  
  // Security configuration
  security: {
    jwtSecret: process.env.JWT_SECRET_KEY,
    jwtExpiresIn: process.env.JWT_TOKEN_EXPIRED_TIME || '24h',
    bcryptRounds: process.env.NODE_ENV === 'production' ? 12 : 10,
  },
  
  // Performance configuration
  performance: {
    defaultPageSize: 20,
    maxPageSize: 100,
    cacheTimeout: 5 * 60 * 1000, // 5 minutes
    queryTimeout: 30000, // 30 seconds
  },
  
  // Logging configuration
  logging: {
    level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'error' : 'debug'),
    enableFileLogging: process.env.NODE_ENV === 'production',
    enableConsoleLogging: true,
  },
  
  // CORS configuration
  cors: {
    origin: process.env.FRONTEND_URL || 'http://localhost:8080',
    credentials: true,
  },
  
  // Rate limiting
  rateLimit: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: process.env.NODE_ENV === 'production' ? 100 : 1000, // limit each IP
  },
}));