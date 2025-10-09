import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  DeleteDateColumn,
  Index,
} from 'typeorm';
import { Employee } from '../../employees/entities/employee.entity';
import { Section } from '../../sections/entities/section.entity'; // Added import

export enum NotificationType {
  NEW_KPI_ASSIGNMENT = 'NEW_KPI_ASSIGNMENT',
  KPI_APPROVAL_PENDING = 'KPI_APPROVAL_PENDING',
  KPI_VALUE_SUBMITTED = 'KPI_VALUE_SUBMITTED',
  KPI_VALUE_APPROVED = 'KPI_VALUE_APPROVED',
  KPI_VALUE_REJECTED = 'KPI_VALUE_REJECTED',
  // Add notification types for Review
  REVIEW_PENDING_EMPLOYEE_FEEDBACK = 'REVIEW_PENDING_EMPLOYEE_FEEDBACK', // Send to employee when manager finishes review, waiting for employee feedback
  REVIEW_EMPLOYEE_RESPONDED = 'REVIEW_EMPLOYEE_RESPONDED', // Send to manager when employee has responded
  REVIEW_COMPLETED = 'REVIEW_COMPLETED', // Send to employee when manager completes review
  KPI_EXPIRY = 'KPI_EXPIRY', // Notification for KPI about to expire/expired
  REVIEW_PENDING_SECTION_REVIEW = 'REVIEW_PENDING_SECTION_REVIEW', // Send to section leader when employee completes self-evaluation
  REVIEW_PENDING_DEPARTMENT_REVIEW = 'REVIEW_PENDING_DEPARTMENT_REVIEW', // Send to department leader when section approval is done
  REVIEW_PENDING_MANAGER_REVIEW = 'REVIEW_PENDING_MANAGER_REVIEW', // Send to manager when department approval is done
  REVIEW_REJECTED_BY_SECTION = 'REVIEW_REJECTED_BY_SECTION', // Send to employee when rejected by section
  REVIEW_REJECTED_BY_DEPARTMENT = 'REVIEW_REJECTED_BY_DEPARTMENT', // Send to employee when rejected by department
  REVIEW_REJECTED_BY_MANAGER = 'REVIEW_REJECTED_BY_MANAGER', // Send to employee when rejected by manager
  // Add other notification types as needed
}

@Entity('notifications')
export class Notification {
  @PrimaryGeneratedColumn()
  id: number;

  @Index()
  @Column({ name: 'user_id', nullable: true }) // A notification might be for a section or a user
  userId: number | null;

  @ManyToOne(() => Employee, (employee) => employee.notifications, {
    onDelete: 'CASCADE',
    nullable: true, // A notification might not always be for a specific user if it's for a section
  })
  @JoinColumn({ name: 'user_id' })
  user: Employee | null;

  @Index()
  @Column({ name: 'section_id', nullable: true }) // ID of the section this notification might belong to
  sectionId: number | null;

  @ManyToOne(() => Section, (section) => section.notifications, {
    onDelete: 'SET NULL', // Or 'CASCADE' if notifications should be deleted with the section
    nullable: true, // A notification might not always belong to a section
  })
  @JoinColumn({ name: 'section_id' })
  section: Section | null;

  @Column({
    type: 'enum',
    enum: NotificationType,
    nullable: true,
  })
  type: NotificationType;

  @Column('text')
  message: string;

  @Column({ name: 'related_entity_id', type: 'int', nullable: true })
  relatedEntityId: number | null;

  @Column({
    name: 'related_entity_type',
    type: 'varchar',
    length: 50,
    nullable: true,
  })
  relatedEntityType: string | null;

  @Index()
  @Column({ name: 'kpi_id', type: 'int', nullable: true })
  kpiId: number | null;

  @Column({ name: 'is_read', type: 'boolean', default: false })
  isRead: boolean;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp with time zone' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamp with time zone' })
  updatedAt: Date;

  @DeleteDateColumn({
    name: 'deleted_at',
    type: 'timestamp with time zone',
    nullable: true,
  })
  deletedAt: Date | null;
}
