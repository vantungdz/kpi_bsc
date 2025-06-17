// e:\project\kpi-backend\src\notification\notifications.controller.ts
import {
  Controller,
  Get,
  Post,
  Param,
  UseGuards,
  Req,
  ParseIntPipe,
  Body,
} from '@nestjs/common';
import { NotificationService } from './notification.service';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard'; // Đảm bảo đường dẫn đúng
import { Employee } from 'src/employees/entities/employee.entity'; // Đảm bảo đường dẫn đúng
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { Notification } from 'src/notification/entities/notification.entity';

@ApiTags('Notifications')
@ApiBearerAuth() // Cho Swagger UI biết cần JWT token
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
  }) // Cần định nghĩa DTO cho response nếu phức tạp hơn
  async getNotifications(
    @Req() req: { user: Employee },
    // Thêm các query params cho phân trang nếu cần, ví dụ:
    // @Query('page', new ParseIntPipe({ optional: true })) page?: number,
    // @Query('limit', new ParseIntPipe({ optional: true })) limit?: number,
  ) {
    // const { page = 1, limit = 10 } = queryParams; // Nếu dùng query params
    return this.notificationService.getNotificationsForUser(
      req.user.id /*, page, limit*/,
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
  }) // Hoặc một DTO { count: number }
  async getUnreadCount(
    @Req() req: { user: Employee },
  ): Promise<{ count: number }> {
    const count = await this.notificationService.getUnreadNotificationCount(
      req.user.id,
    );
    return { count }; // Frontend đang mong đợi response.data.count
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
  @ApiResponse({ status: 200, description: 'All notifications marked as read' }) // Có thể trả về số lượng đã update
  async markAllAsRead(
    @Req() req: { user: Employee },
  ): Promise<{ affected: number }> {
    return this.notificationService.markAllAsRead(req.user.id);
  }
}
