import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Section } from './section.entity';
import { UserOrganizationalUnit } from './user-organizational-unit.entity';
import { Kpi } from './kpi.entity';

@Entity('teams')
export class Team {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @ManyToOne(() => Section, (section) => section.teams, {
    nullable: true,
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ nullable: true })
  section_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  created_at: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updated_at: Date;

  @OneToMany(() => Kpi, (kpi) => kpi.team)
  kpis: Kpi[];

  @OneToMany(() => UserOrganizationalUnit, (unit) => unit.section)
  userUnits: UserOrganizationalUnit[];
}
