import { Entity, PrimaryGeneratedColumn, Column, OneToMany } from 'typeorm';
import { Kpi } from './kpi.entity';

// perspective.entity.ts
@Entity('perspectives')
export class Perspective {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Kpi, (kpi) => kpi.perspective)
  kpis: Kpi[];
}
