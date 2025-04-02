export interface Business {
  id: string;
  name: string;
}

export type User = {
  id: string;
  email: string;
  full_name?: string;
  role: 'admin' | 'business' | 'user';
  businesses?: Business[]; // <- this must exist for type safety
};
