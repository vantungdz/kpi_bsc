import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  ManyToOne,
  JoinColumn,
  OneToOne,
} from 'typeorm';
import { KpiValue } from './kpi-value.entity';
import { KpiEvaluation } from './kpi-evaluation.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';
import { Notification } from './notification.entity';
import { KpiReview } from './kpi-review.entity';
import { ObjectiveEvaluation } from './objective-evaluation.entity'; // + Import ObjectiveEvaluation

@Entity('employees')
export class Employee {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  username: string;

  @Column()
  password: string;

  @Column({ unique: true })
  email: string;

  @Column({
    type: 'varchar',
    length: 50,
    enum: ['admin', 'manager', 'department', 'section', 'employee'],
  })
  role: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @OneToMany(
    () => ObjectiveEvaluation,
    (objectiveEvaluation) => objectiveEvaluation.employee,
  )
  objectiveEvaluationsAsSubject: ObjectiveEvaluation[]; // Evaluations where this employee is the one being evaluated

  @OneToMany(
    () => ObjectiveEvaluation,
    (objectiveEvaluation) => objectiveEvaluation.evaluator,
  )
  objectiveEvaluationsAsEvaluator: ObjectiveEvaluation[]; // Evaluations submitted by this employee (as a manager/evaluator)

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @Column({ nullable: true, name: 'departmentId' })
  departmentId: number;

  @OneToMany(() => Notification, (notification) => notification.user)
  notifications: Notification[];

  @ManyToOne(() => Department, (department) => department.employees)
  @JoinColumn({ name: 'departmentId' })
  department: Department;

  @Column({ nullable: true, name: 'sectionId' })
  sectionId: number;

  @ManyToOne(() => Section, (section) => section.employees, { nullable: true })
  @JoinColumn({ name: 'sectionId' })
  section?: Section;

  @Column({ nullable: true, name: 'teamId' })
  teamId: number;

  @ManyToOne(() => Team, (team) => team.employees, { nullable: true })
  @JoinColumn({ name: 'teamId' })
  team?: Team;

  @OneToMany(() => KpiReview, (review) => review.reviewedBy)
  kpiReviews: KpiReview[];
}
