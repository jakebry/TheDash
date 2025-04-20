export interface Owner {
  id: string;
  email: string;
  full_name: string | null;
  avatar_url: string | null;
}

export interface Business {
  id: string;
  name: string;
  description: string | null;
  logo_url: string | null;
  phone_number: string | null;
  address: string | null;
  website: string | null;
  created_at: string;
  created_by: string;
  owner?: Owner;
  members?: BusinessMember[];
}

export type BusinessRole = 'owner' | 'supervisor' | 'lead' | 'employee';

export interface BusinessMember {
  id: string;
  user_id: string;
  role: string;
  business_role?: BusinessRole;
  is_creator?: boolean;
  joined_at: string;
  profile: {
    id: string;
    full_name: string | null;
    email: string;
    avatar_url: string | null;
  };
}