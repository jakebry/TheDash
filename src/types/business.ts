@@ .. @@
 export interface BusinessMember {
   id: string;
   user_id: string;
   role: string;
   business_role?: BusinessRole;
+  is_creator?: boolean;
   joined_at: string;
   profile: {
     id: string;
     full_name: string | null;
     email: string;
     avatar_url: string | null;
   };
 }