import React, { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { authClient, type SessionUser } from "../lib/auth-client";

interface AuthContextType {
  user: SessionUser | null;
  authChecked: boolean;
  setUser: React.Dispatch<React.SetStateAction<SessionUser | null>>;
  signOut: () => Promise<void>;
  checkSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);

  const checkSession = useCallback(async () => {
    try {
      const session = await authClient.getSession({ query: {} });
      const sessionUser = session?.data?.user as unknown as SessionUser | undefined;
      if (sessionUser && (sessionUser.role === "admin" || sessionUser.role === "gate_officer")) {
        setUser(sessionUser);
      } else {
        setUser(null);
      }
    } catch (err) {
      console.error("Session check failed:", err);
      setUser(null);
    } finally {
      setAuthChecked(true);
    }
  }, []);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

  const signOut = useCallback(async () => {
    try {
      await authClient.signOut({});
    } catch {
      // ignore
    }
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, authChecked, setUser, signOut, checkSession }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};
