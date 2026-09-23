import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { ActivityIndicator, View } from "react-native";
import { Stack, useRouter, useSegments } from "expo-router";

import { authClient, type AppUser, type UserRole } from "@/lib/auth-client";
import "./global.css";

// ─── Auth Context ─────────────────────────────────────────────────────────────

interface AuthState {
  user: AppUser | null;
  isLoading: boolean;
  signOut: () => Promise<void>;
  refetch: () => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isLoading: true,
  signOut: async () => {},
  refetch: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

// ─── Role-based redirect ──────────────────────────────────────────────────────

function useProtectedRoute(user: AppUser | null, isLoading: boolean) {
  // Cast to string[] so segment comparisons don't hit Expo Router's narrow
  // literal type (which is only known after route generation runs).
  const segments = useSegments() as unknown as string[];
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";
    const inDriverGroup = segments[0] === "(driver)";
    const inGateGroup = segments[0] === "(gate)";

    if (!user) {
      if (!inAuthGroup) router.replace("/(auth)/login" as never);
      return;
    }

    const role: UserRole = (user.role as UserRole) ?? "driver";

    if (inAuthGroup) {
      if (role === "gate_officer" || role === "admin") {
        router.replace("/(gate)/" as never);
      } else {
        router.replace("/(driver)/" as never);
      }
      return;
    }

    if (role === "driver" && inGateGroup) {
      router.replace("/(driver)/" as never);
    } else if ((role === "gate_officer" || role === "admin") && inDriverGroup) {
      router.replace("/(gate)/" as never);
    }
  }, [user, isLoading, segments]);
}

// ─── Provider ─────────────────────────────────────────────────────────────────

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AppUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchSession = useCallback(async () => {
    try {
      const session = await authClient.getSession();
      // better-auth session user won't include `role` in its built-in types
      // because it's an additionalField — cast through unknown to our AppUser.
      const sessionUser = session?.data?.user;
      setUser(sessionUser ? (sessionUser as unknown as AppUser) : null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSession();
  }, [fetchSession]);

  const signOut = useCallback(async () => {
    await authClient.signOut();
    setUser(null);
  }, []);

  useProtectedRoute(user, isLoading);

  return (
    <AuthContext.Provider value={{ user, isLoading, signOut, refetch: fetchSession }}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Root Layout ──────────────────────────────────────────────────────────────

export default function RootLayout() {
  return (
    <AuthProvider>
      <RootNavigator />
    </AuthProvider>
  );
}

function RootNavigator() {
  const { isLoading } = useAuth();

  if (isLoading) {
    return (
      <View className="flex-1 bg-gray-950 items-center justify-center">
        <ActivityIndicator size="large" color="#10b981" />
      </View>
    );
  }

  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(driver)" />
      <Stack.Screen name="(gate)" />
    </Stack>
  );
}
