import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  OneToOne,
} from 'typeorm';
import { Kpi } from './kpi.entity';
import { KpiValue } from './kpi-value.entity';
import { KpiEvaluation } from './kpi-evaluation.entity';
import { UserOrganizationalUnit } from './user-organizational-unit.entity';

@Entity('users')
export class User {
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
    enum: ['admin', 'manager', 'leader', 'employee'],
  })
  role: string;

  @Column({ nullable: true })
  first_name: string;

  @Column({ nullable: true })
  last_name: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Kpi, (kpi) => kpi.assignedTo)
  assignedKpis: Kpi[];

  @OneToMany(() => KpiEvaluation, (evaluation) => evaluation.evaluator)
  evaluationsAsEvaluator: KpiEvaluation[];

  @OneToMany(() => KpiEvaluation, (evaluation) => evaluation.evaluatee)
  evaluationsAsEvaluatee: KpiEvaluation[];

  @OneToMany(() => KpiValue, (kpiValue) => kpiValue.user)
  kpiValues: KpiValue[];

  @OneToOne(() => UserOrganizationalUnit, (unit) => unit.user)
  organizationalUnit: UserOrganizationalUnit;
}
