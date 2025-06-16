import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, OneToMany } from 'typeorm';
import { Perspective } from './perspective.entity';
import { Kpi } from './kpi.entity';

@Entity()
export class StrategicObjective {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description?: string;

  @ManyToOne(() => Perspective, perspective => perspective.strategicObjectives, { nullable: false })
  perspective: Perspective;

  @OneToMany(() => Kpi, kpi => kpi.strategicObjective)
  kpis: Kpi[];

  @Column({ type: 'date', nullable: true })
  startDate?: Date;

  @Column({ type: 'date', nullable: true })
  endDate?: Date;

  @Column({ default: true })
  isActive: boolean;
}
