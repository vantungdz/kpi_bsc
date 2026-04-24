/** Standard API response envelope */
export interface ApiResponse<T> {
  success: boolean
  message: string | null
  timestamp?: string
  status?: number
  data: T
}

export interface PageData<T> {
  content: T[]
  page: number
  size: number
  totalElements: number
  totalPages: number
  first: boolean
  last: boolean
}

export interface LoginRequest {
  email: string
  password: string
}

export interface AuthTokens {
  accessToken: string
  refreshToken: string
  expiresIn?: number
}

export interface AuthUser {
  id: string
  email: string
  username?: string
  name: string
  fullName?: string
  role: 'GM' | 'PM' | 'LEADER' | 'MEMBER' | 'ADMIN'
  rank?: string
  position?: string
  isActive?: boolean
}

export interface LoginResponse {
  accessToken: string
  refreshToken: string
  user: AuthUser
}
