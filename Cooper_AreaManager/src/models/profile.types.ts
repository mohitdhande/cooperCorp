// Shape of GET /api/me/profile — confirmed against the real backend
// reference (mobile-profile.md), not guessed. profilePic anywhere in this
// response is either a signed GCS URL (valid 24h) or null, never a
// relative path.

export type ProfileAddress = {
  line1?: string;
  city?: string;
  district?: string;
  state?: string;
  pinCode?: string;
} | null;

// The AM above this user. For an area_manager themselves, only areaNames
// is populated (no superior AM) — _id/name/profilePic are absent.
export type ProfileContextAM = {
  _id?: string;
  name?: string;
  profilePic?: string | null;
  areaNames?: string[];
} | null;

// The dealer above this user — engineer only, null for every other role.
export type ProfileContextDealer = {
  _id: string;
  name: string;
  dealerName: string | null;
  profilePic: string | null;
} | null;

// Role-dependent: peer engineers (engineer), engineers under the dealer
// (dealer), dealers under the AM (area_manager), or [] (rsm/admin).
export type ProfileTeamMember = {
  _id: string;
  name: string;
  dealerName?: string | null;
  profilePic: string | null;
};

export type MyProfileResponse = {
  name: string;
  username: string;
  email: string | null;
  mobile: string | null;
  address: ProfileAddress;
  role: string;
  dealerName: string | null;
  profilePic: string | null;
  context: {
    am: ProfileContextAM;
    dealer: ProfileContextDealer;
  };
  team: ProfileTeamMember[];
};
