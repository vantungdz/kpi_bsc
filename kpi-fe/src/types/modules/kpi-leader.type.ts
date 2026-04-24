
interface LeaderMemberListResponse {
    members: LeaderMember[]
}

interface LeaderMember {
    memberId: string
    fullName: string
    email: string;
    rank: string
    jobLevel: string;
    jobTitle: string;
    score: number
    status: string
}