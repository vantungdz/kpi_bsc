import {
  Controller,
  Get,
  Post,
  Delete,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  Body,
  Query,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { Employee } from 'src/employees/entities/employee.entity';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Notification } from 'src/notification/entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationService: NotificationService) {}

  @Get()
  @ApiOperation({ summary: 'Get notifications for the current user' })
  @ApiResponse({
    status: 200,
    description: 'List of notifications',
    type: [Notification],
  })
  async getNotifications(
    @Req() req: { user: Employee },
    @Query('page') page?: number,
    @Query('limit') limit?: number,
  ) {
    const pageNum = page ? parseInt(page.toString()) : 1;
    const limitNum = limit ? parseInt(limit.toString()) : 10;
    return this.notificationService.getNotificationsForUser(
      req.user.id,
      pageNum,
      limitNum,
    );
  }

  @Get('unread-count')
  @ApiOperation({
    summary: 'Get unread notification count for the current user',
  })
  @ApiResponse({
    status: 200,
    description: 'Unread notification count',
    type: Number,
  })
  async getUnreadCount(
    @Req() req: { user: Employee },
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadNotificationCount(
      req.user.id,
    );
    return { count };
  }

  @Post(':id/mark-as-read')
  @ApiOperation({ summary: 'Mark a specific notification as read' })
  @ApiResponse({
    status: 200,
    description: 'Notification marked as read',
    type: Notification,
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async markAsRead(
    @Param('id', ParseIntPipe) notificationId: number,
    @Req() req: { user: Employee },
  ): Promise<Notification> {
    return this.notificationService.markAsRead(notificationId, req.user.id);
  }

  @Post('mark-all-as-read')
  @ApiOperation({
    summary: 'Mark all notifications as read for the current user',
  })
  @ApiResponse({ status: 200, description: 'All notifications marked as read' })
  async markAllAsRead(
    @Req() req: { user: Employee },
  ): Promise<{ affected: number }> {
    return this.notificationService.markAllAsRead(req.user.id);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a specific notification' })
  @ApiResponse({
    status: 200,
    description: 'Notification deleted successfully',
  })
  @ApiResponse({ status: 404, description: 'Notification not found' })
  async deleteNotification(
    @Param('id', ParseIntPipe) notificationId: number,
    @Req() req: { user: Employee },
  ): Promise<{ message: string }> {
    await this.notificationService.deleteNotification(
      notificationId,
      req.user.id,
    );
    return { message: 'Notification deleted successfully' };
  }
}
