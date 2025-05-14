import { Entity, PrimaryColumn, Column, OneToMany } from 'typeorm';

@Entity('review_cycles')
export class ReviewCycle {
  @PrimaryColumn()
  id: string;

  @Column()
  name: string;
}
