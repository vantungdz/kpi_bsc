import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KpisService } from '../kpis/kpis.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class KpiExpiryScheduler {
  private readonly logger = new Logger(KpiExpiryScheduler.name);
  constructor(
    private readonly kpisService: KpisService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Chạy mỗi ngày để kiểm tra KPI sắp hết hạn hoặc đã hết hạn và gửi notification cho tất cả người liên quan
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleKpiExpiryCheck() {
    this.logger.log('Running KPI expiry check...');
    const today = new Date();
    const soon = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
    // Lấy tất cả KPI active, expiring_soon, expired
    const allKpis = await this.kpisService.getAllKpisForExpiryCheck();
    for (const kpi of allKpis) {
      const status = kpi.kpiStatus;
      if (status === 'expiring_soon' || status === 'expired') {
        // Lấy tất cả người liên quan: người tạo, người được assign, leader, manager...
        const relatedUserIds = await this.kpisService.getAllRelatedUserIdsForKpi(kpi);
        for (const userId of relatedUserIds) {
          const message = status === 'expired'
            ? `KPI "${kpi.name}" đã hết hạn vào ngày ${kpi.end_date}`
            : `KPI "${kpi.name}" sẽ hết hạn vào ngày ${kpi.end_date}`;
          await this.notificationService.createNotification(
            userId,
            NotificationType.KPI_EXPIRY,
            message,
            kpi.id,
            'KPI',
            kpi.id,
          );
        }
      }
    }
  }
}
