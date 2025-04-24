// src/data-source.ts
import { DataSource } from 'typeorm';

const AppDataSource = new DataSource({
  type: 'postgres', // <== Sử dụng type database của bạn
  host: 'localhost', // <== Sử dụng host database của bạn
  port: 5432, // <== Sử dụng port database của bạn
  username: 'postgres', // <== Sử dụng username database của bạn
  password: 'tomcat', // <== Sử dụng password database của bạn
  database: 'kpi_management', // <== Sử dụng tên database của bạn
  // Đường dẫn đến các file entity của bạn (TypeORM sẽ tìm trong thư mục này)
  entities: [__dirname + '/**/*.entity{.ts,.js}'], // Đường dẫn đến các file migration của bạn (thường là trong thư mục src/migration)
  migrations: [__dirname + '/migration/**/*.ts'], // <== Chỉ định thư mục chứa migration
  synchronize: false, // <== LUÔN set false cho file data source dùng migration
  logging: true, // <== Tùy chọn bật log query khi chạy migration
});

// Export instance DataSource
export default AppDataSource;
