import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { KpiCrudService } from '../kpis/services/kpi-crud.service';
import { NotificationService } from './notification.service';
import { NotificationType } from '../notification/entities/notification.entity';

@Injectable()
export class KpiExpiryScheduler {
  private readonly logger = new Logger(KpiExpiryScheduler.name);
  constructor(
    private readonly kpiCrudService: KpiCrudService,
    private readonly notificationService: NotificationService,
  ) {}

  /**
   * Runs daily to check KPIs that are expiring soon or have expired and send notifications to all related users
   */
  @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
  async handleKpiExpiryCheck() {
    this.logger.log('Running KPI expiry check...');
    const allKpis = await this.kpiCrudService.getAllKpisForExpiryCheck();
    for (const kpi of allKpis) {
      const status = kpi.kpiStatus;
      if (status === 'expiring_soon' || status === 'expired') {
        const relatedUserIds =
          await this.kpiCrudService.getAllRelatedUserIdsForKpi(kpi);
        for (const userId of relatedUserIds) {
          const message =
            status === 'expired'
              ? `KPI "${kpi.name}" has expired on ${kpi.end_date}`
              : `KPI "${kpi.name}" will expire on ${kpi.end_date}`;
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
