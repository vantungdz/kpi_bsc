import { DataSource } from 'typeorm';
require('dotenv').config();

const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432', 10),
  username: process.env.DB_USERNAME || 'postgres',
  password: process.env.DB_PASSWORD || 'tomcat',
  database: process.env.DB_DATABASE || 'kpi_management',
  entities: [__dirname + '/**/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migration/**/*.ts'],
  synchronize: false,
  logging: true,
});

export const dataSourceOptions = AppDataSource.options;
export default AppDataSource;
