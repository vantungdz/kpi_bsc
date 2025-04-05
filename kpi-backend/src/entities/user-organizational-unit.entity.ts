import {
  Entity,
  PrimaryColumn,
  ManyToOne,
  Column,
  OneToOne,
  JoinColumn,
} from 'typeorm';
import { User } from './user.entity';
import { Department } from './department.entity';
import { Section } from './section.entity';
import { Team } from './team.entity';

@Entity('user_organizational_units')
export class UserOrganizationalUnit {
  @PrimaryColumn()
  user_id: number;

  @OneToOne(() => User, (user) => user.organizationalUnit, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Department, (department) => department.userUnits, {
    nullable: true,
  })
  @JoinColumn({ name: 'department_id' })
  department: Department;

  @Column({ nullable: true })
  department_id: number;

  @ManyToOne(() => Section, (section) => section.userUnits, { nullable: true })
  @JoinColumn({ name: 'section_id' })
  section: Section;

  @Column({ nullable: true })
  section_id: number;

  @ManyToOne(() => Team, (team) => team.userUnits, { nullable: true })
  @JoinColumn({ name: 'team_id' })
  team: Team;

  @Column({ nullable: true })
  team_id: number;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  assigned_at: Date;
}
