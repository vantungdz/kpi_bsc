import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('kpi_formula')
export class KpiFormula {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column('text')
  expression: string;

  @Column({ type: 'text', nullable: true })
  description?: string;
}
