import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Notification, NotificationType } from '../entities/notification.entity';

@Injectable()
export class NotificationService {
  private readonly logger = new Logger(NotificationService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationRepository: Repository<Notification>,
  ) {}

  async createNotification(
    userId: number,
    type: NotificationType,
    message: string,
    relatedEntityId?: number | null,
    relatedEntityType?: string | null,
    kpiId?: number | null,
  ): Promise<Notification> {
    try {
      const notification = this.notificationRepository.create({
        userId,
        type,
        message,
        relatedEntityId,
        relatedEntityType,
        kpiId,
        isRead: false,
      });
      return await this.notificationRepository.save(notification);
    } catch (error) {
      this.logger.error(
        `Failed to create notification for user ${userId}: ${error.message}`,
        error.stack,
      );
      // Depending on your error handling strategy, you might rethrow or handle differently
      throw error;
    }
  }

  async getNotificationsForUser(
    userId: number,
    page = 1,
    limit = 10,
  ): Promise<{ data: Notification[]; total: number; unreadCount: number }> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.notificationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: limit,
      skip: skip,
    });

    const unreadCount = await this.getUnreadNotificationCount(userId);

    return { data, total, unreadCount };
  }

  async getUnreadNotificationCount(userId: number): Promise<number> {
    return this.notificationRepository.count({
      where: { userId, isRead: false },
    });
  }

  async markAsRead(
    notificationId: number,
    userId: number,
  ): Promise<Notification> {
    const notification = await this.notificationRepository.findOne({
      where: { id: notificationId, userId },
    });

    if (!notification) {
      throw new NotFoundException(
        `Notification with ID ${notificationId} not found for user ${userId}.`,
      );
    }

    if (!notification.isRead) {
      notification.isRead = true;
      await this.notificationRepository.save(notification);
    }
    return notification;
  }

  async markAllAsRead(userId: number): Promise<{ affected: number }> {
    const result = await this.notificationRepository.update(
      { userId, isRead: false },
      { isRead: true },
    );
    return { affected: result.affected || 0 };
  }

  // Optional: Method to find a specific notification, e.g., for admin purposes
  async findOne(notificationId: number): Promise<Notification | null> {
    return this.notificationRepository.findOneBy({ id: notificationId });
  }

  // Optional: Method to delete a notification
  async deleteNotification(
    notificationId: number,
    userId?: number, // If you want to ensure only the owner can delete
  ): Promise<void> {
    const findConditions: any = { id: notificationId };
    if (userId) {
      findConditions.userId = userId;
    }

    const notification = await this.notificationRepository.findOneBy(
      findConditions,
    );

    if (!notification) {
      let errorMessage = `Notification with ID ${notificationId} not found.`;
      if (userId) {
        errorMessage += ` for user ${userId}.`;
      }
      throw new NotFoundException(errorMessage);
    }

    await this.notificationRepository.remove(notification);
  }
}