export interface Business {
  id: string;
  name: string;
}

export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'admin' | 'business' | 'user';
  created_at: string;
  businesses?: Business[];
}