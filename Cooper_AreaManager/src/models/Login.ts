import { Role } from '../constants/permissions';

// Shape of the login request payload sent to the auth API.
export interface LoginRequest {
  username: string;
  password: string;
}

// Shape of the authenticated user profile returned by the API.
export interface UserProfile {
  userId: string;
  username: string;
  name: string;
  role: Role;
  dealerName?: string;
  areaId?: string;
  profilePic: string | null;
  iat: number;
  exp: number;
}
