import { authClient } from "@/lib/auth-client";
import { useAuth } from "@/app/_layout";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export default function LoginScreen() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin() {
    if (!email.trim() || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signIn.email({
        email: email.trim(),
        password,
      });
      if (result.error) {
        Alert.alert(
          "Login Failed",
          result.error.message ?? "Invalid credentials",
        );
        return;
      }
      await refetch();
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#001633]"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-full bg-[#002147] border-2 border-[#d4af37] items-center justify-center mb-4">
            <Text className="text-4xl">🎓</Text>
          </View>
          <Text className="text-white text-3xl font-bold tracking-tight">
            OAU Vehicle Pass
          </Text>
          <Text className="text-amber-200/80 text-base mt-1">
            Sign in to your account
          </Text>
        </View>

        {/* Form card */}
        <View className="bg-[#002147] rounded-2xl p-6 border border-[#d4af37]/25 shadow-xl">
          {/* Email */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-2">
              Email address
            </Text>
            <TextInput
              className="bg-[#001633] text-white rounded-xl px-4 py-3.5 text-base border border-[#0d3366]"
              placeholder="you@example.com"
              placeholderTextColor="#64748b"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-gray-300 text-sm font-medium mb-2">
              Password
            </Text>
            <TextInput
              className="bg-[#001633] text-white rounded-xl px-4 py-3.5 text-base border border-[#0d3366]"
              placeholder="••••••••"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Sign in button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="bg-[#d4af37] rounded-xl py-4 items-center active:bg-[#b89628]"
          >
            {loading ? (
              <ActivityIndicator color="#001633" />
            ) : (
              <Text className="text-[#001633] font-bold text-base">Sign In</Text>
            )}
          </Pressable>
        </View>

        {/* Register link */}
        <Pressable
          onPress={() => router.push("/(auth)/register" as never)}
          className="mt-6 items-center"
        >
          <Text className="text-gray-400 text-sm">
            Don't have an account?{" "}
            <Text className="text-[#f5c542] font-semibold">Register</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
