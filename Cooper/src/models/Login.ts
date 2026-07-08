export interface LoginRequest {
  username: string;
  password: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  name: string;
  role: string;
dealerName?: string;      // optional now
  areaId?: string;  
  profilePic: string | null;   // can be null if user hasn't uploaded one
  iat: number;
  exp: number;
}