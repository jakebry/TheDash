import { createContext, useEffect, useState } from "react";
import { User } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import { refreshSession } from "../lib/tokenRefresh";
import toast from 'react-hot-toast';

interface SignUpOptions {
  full_name: string;
  role: "admin" | "business" | "user";
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, options: SignUpOptions) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initializeAuth = async () => {
      const { data } = await supabase.auth.getSession();
      if (data?.session?.user) {
        setUser(data.session.user);
      }
      setLoading(false);
    };

    initializeAuth();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => authListener?.subscription?.unsubscribe?.();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
    if (data.user) setUser(data.user);
  };

  const signUp = async (email: string, password: string, options: SignUpOptions) => {
    const { full_name } = options;

    // First check if user exists
    const { data: existingUser } = await supabase
      .from('profiles')
      .select('id')
      .eq('email', email)
      .maybeSingle();

    if (existingUser) {
      throw new Error('User already exists with this email');
    }

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { 
          full_name,
          role: 'user'
        },
      },
    });

    if (error) throw error;

    const newUser = data.user;
    if (!newUser) throw new Error('Failed to create user');
    
    try {
      // Wait for trigger to create profile and validate role
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Validate and repair user role - use throttled refresh
      await refreshSession(supabase);
      await supabase.rpc('validate_user_role', { user_id: newUser.id });

      // Now sign in with the new credentials
      await signIn(email, password);
      
      toast.success('Account created successfully!');
    } catch (error: any) {
      console.error('Signup error:', error);
      throw new Error(error.message || 'Failed to complete signup');
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
};

export { AuthProvider, AuthContext };