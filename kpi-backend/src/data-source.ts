
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres', 
  host: 'localhost', 
  port: 5432, 
  username: 'postgres', 
  password: 'tomcat', 
  database: 'kpi_management', 
  
  entities: [__dirname + '/**/*.entity{.ts,.js}'], 
  migrations: [__dirname + '/migration/**/*.ts'], 
  synchronize: false, 
  logging: true, 
});


export default AppDataSource;
