import { Entity, PrimaryGeneratedColumn, Column } from 'typeorm';

@Entity('review_cycles')
export class ReviewCycle {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({ type: 'date' })
  startDate: Date;

  @Column({ type: 'date' })
  endDate: Date;
}
