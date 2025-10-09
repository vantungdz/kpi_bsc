// Script: backup_and_cleanup_audit_log.js
// Mục đích: Xuất log cũ hơn 6 tháng ra file CSV và xóa khỏi DB
// Cách chạy: node dist/scripts/backup_and_cleanup_audit_log.js hoặc build exe bằng pkg

const fs = require('fs');
const path = require('path');
const { DataSource } = require('typeorm');

// Luôn require tĩnh từ dist để phù hợp cho cả tsc build và pkg
const AuditLog = require('../dist/entities/audit-log.entity.js').AuditLog;
const dataSourceOptions = require('../dist/data-source.js').dataSourceOptions;

(async () => {
  const ds = new DataSource({
    ...dataSourceOptions,
    entities: [AuditLog],
  });
  await ds.initialize();
  const auditLogRepo = ds.getRepository(AuditLog);

  // Lấy toàn bộ log audit
  const allLogs = await auditLogRepo.find({ order: { createdAt: 'ASC' } });

  if (!allLogs.length) {
    console.log('Không có log nào để backup.');
    process.exit(0);
  }

  // Tạo thư mục backup nếu chưa có (dùng process.cwd() để luôn tạo đúng thư mục khi chạy exe)
  const backupDir = path.join(process.cwd(), 'backup-audit-log');
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });

  // Tạo file CSV
  const now = new Date();
  const fileName = `audit_log_backup_to_${now.toISOString().slice(0,10)}.csv`;
  const filePath = path.join(backupDir, fileName);
  const header = 'id,action,resource,userId,username,ip,data,createdAt\n';
  const escapeCsv = (val) => {
    if (val === undefined || val === null) return '';
    const str = String(val);
    if (str.includes(',') || str.includes('\n') || str.includes('"')) {
      return '"' + str.replace(/"/g, '""') + '"';
    }
    return str;
  };
  const rows = allLogs.map(log => [
    log.id,
    log.action,
    log.resource,
    log.userId,
    log.username,
    log.ip,
    escapeCsv(JSON.stringify(log.data)),
    log.createdAt.toISOString(),
  ].map(escapeCsv).join(',')).join('\n');
  fs.writeFileSync(filePath, header + rows, 'utf8');
  console.log(`Đã backup ${allLogs.length} log vào ${filePath}`);

  // Xóa toàn bộ log khỏi DB
  const ids = allLogs.map(l => l.id);
  if (ids.length > 0) {
    await auditLogRepo.createQueryBuilder().delete().whereInIds(ids).execute();
    console.log(`Đã xóa ${ids.length} log khỏi database.`);
  }

  await ds.destroy();
})();
