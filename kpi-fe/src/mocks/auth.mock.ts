import type { AuthUser } from '@/types/api'

export interface MockUser extends AuthUser {
  password: string
}

export const MOCK_USERS_DB: MockUser[] = [
  {
    id: 'u-gm-1',
    email: 'gm@kpi.com',
    username: 'gm',
    name: 'Trần Văn GM',
    fullName: 'Trần Văn GM',
    role: 'GM',
    rank: 'R8',
    position: 'General Manager',
    isActive: true,
    password: 'password',
  },
  {
    id: 'u-pm-1',
    email: 'pm@kpi.com',
    username: 'pm1',
    name: 'Nguyễn Văn PM',
    fullName: 'Nguyễn Văn PM',
    role: 'PM',
    rank: 'R6',
    position: 'Project Manager',
    isActive: true,
    password: 'password',
  },
  {
    id: 'u-leader-1',
    email: 'leader@kpi.com',
    username: 'leader1',
    name: 'Lê Thị Leader',
    fullName: 'Lê Thị Leader',
    role: 'LEADER',
    rank: 'R5',
    position: 'Team Leader',
    isActive: true,
    password: 'password',
  },
  {
    id: 'u-member-1',
    email: 'member@kpi.com',
    username: 'member1',
    name: 'Trần Văn Phước',
    fullName: 'Trần Văn Phước',
    role: 'MEMBER',
    rank: 'R3',
    position: 'Software Engineer (Production)',
    isActive: true,
    password: 'password',
  },
]
