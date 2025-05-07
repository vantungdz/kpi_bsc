// e:\project\kpi-backend\src\notification\notification.module.ts
import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../entities/notification.entity';
import { Employee } from '../entities/employee.entity'; // If used by service/listener
import { NotificationService } from './notification.service';
import { NotificationEventListener } from './notification.listener'; // Assuming you have this
import { NotificationsController } from './notification.controller';
import { EmployeesModule } from '../employees/employees.module'; // If NotificationEventListener or Service needs EmployeesService

@Module({
  imports: [
    TypeOrmModule.forFeature([Notification, Employee]), // Add other entities if NotificationService interacts with them
    EmployeesModule, // Needed if NotificationEventListener injects EmployeesService
  ],
  providers: [NotificationService, NotificationEventListener], // Add NotificationEventListener if it exists
  controllers: [NotificationsController],
  exports: [NotificationService], // Export if other modules need to directly use NotificationService
})
export class NotificationModule {}
