import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Kpi } from './kpi.entity';
import { User } from './user.entity';

@Entity('kpi_values')
export class KpiValue {
  @PrimaryGeneratedColumn()
  id: number;

  @ManyToOne(() => Kpi, (kpi) => kpi.values, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'id' })
  kpi: Kpi;

  @Column()
  kpi_id: number;

  @Column('numeric')
  value: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  timestamp: Date;

  @ManyToOne(() => User, (user) => user.kpiValues)
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column()
  user_id: number;

  @Column({ type: 'text', nullable: true })
  notes: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;
}
