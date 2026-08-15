export type TeamMemberAddress = {
  line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
};

// Shape returned by GET /api/users?roles=dealer or ?roles=engineer — a
// dealer managing engineers and an area manager managing dealers see the
// same record shape, just for a different subordinate role.
export type TeamMember = {
  _id: string;
  username: string;
  name: string;
  role: string;
  dealerName?: string;
  address?: TeamMemberAddress;
  email: string;
  mobile: string;
  dealerId?: string;
  pincodes?: string[];
  status?: string; // 'active' | 'inactive' | 'archived' — absent means active
  createdAt: string;
  updatedAt: string;
  profilePic?: string | null;
};
