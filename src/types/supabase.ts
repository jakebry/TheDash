export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json }
  | Json[];

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          role: string | null;
          // add other fields if needed
        };
        Insert: {
          id: string;
          role?: string | null;
        };
        Update: {
          id?: string;
          role?: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      ensure_profile_exists: {
        Args: { user_id: string };
        Returns: void;
      };
      get_all_auth_roles: {
        Args: { target_id: string };
        Returns: {
          is_admin_in_jwt: boolean;
          is_admin_in_profile: boolean;
          is_admin_in_user_metadata: boolean;
          is_admin_in_app_metadata: boolean;
          profile_role: string | null;
          user_metadata_role: string | null;
          app_metadata_role: string | null;
        };
      };
    };
  };
}
