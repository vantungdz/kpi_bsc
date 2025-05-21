import { DataSource } from 'typeorm';
import { Permission } from '../entities/permission.entity';
import { RBAC_PERMISSION_PAIRS } from '../common/rbac/rbac.constants';
import { join } from 'path';

// Adjust the path to your data-source config if needed
const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [join(__dirname, '../entities/*.entity.{ts,js}')],
  synchronize: false,
});

async function seedPermissions() {
  await AppDataSource.initialize();
  const permissionRepo = AppDataSource.getRepository(Permission);

  // Remove all existing permissions
  await permissionRepo.clear();

  // Insert all RBAC_PERMISSION_PAIRS
  const permissions = RBAC_PERMISSION_PAIRS.map(pair =>
    permissionRepo.create({ action: pair.action, resource: pair.resource })
  );
  await permissionRepo.save(permissions);
  console.log(`Seeded ${permissions.length} permissions.`);
  await AppDataSource.destroy();
}

seedPermissions().catch(e => {
  console.error(e);
  process.exit(1);
});
