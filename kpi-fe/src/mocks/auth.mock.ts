import type { AuthUser } from "@/types/api";

export interface MockUser extends AuthUser {
  password: string;
}

export const MOCK_USERS_DB: MockUser[] = [
  {
    id: "u-gm-1",
    email: "nguyen.gm@company.vn",
    username: "gm",
    name: "Trần Văn GM",
    fullName: "Trần Văn GM",
    role: "GM",
    rank: "R8",
    position: "General Manager",
    isActive: true,
    password: "Abc@12345",
  },
  {
    id: "u-pm-1",
    email: "tran.pm@company.vn",
    username: "pm1",
    name: "Nguyễn Văn PM",
    fullName: "Nguyễn Văn PM",
    role: "PM",
    rank: "R6",
    position: "Project Manager",
    isActive: true,
    password: "Abc@12345",
  },
  {
    id: "u-leader-1",
    email: "tran.leader@company.vn",
    username: "leader1",
    name: "Lê Thị Leader",
    fullName: "Lê Thị Leader",
    role: "LEADER",
    rank: "R5",
    position: "Team Leader",
    isActive: true,
    password: "Abc@12345",
  },
  {
    id: "u-member-1",
    email: "huy.nguyen@company.vn",
    username: "member1",
    name: "Trần Văn Phước",
    fullName: "Trần Văn Phước",
    role: "MEMBER",
    rank: "R3",
    position: "Software Engineer (Production)",
    isActive: true,
    password: "Abc@12345",
  },
  {
    id: "u-admin-1",
    email: "admin@company.vn",
    username: "admin",
    name: "System Admin",
    fullName: "System Admin",
    role: "ADMIN",
    rank: undefined,
    position: "HR Administrator",
    isActive: true,
    password: "Abc@12345",
  },
];
