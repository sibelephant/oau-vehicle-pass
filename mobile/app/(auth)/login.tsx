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
      className="flex-1 bg-gray-950"
      behavior={Platform.OS === "ios" ? "padding" : "height"}
    >
      <ScrollView
        className="flex-1"
        contentContainerClassName="flex-1 justify-center px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-10">
          <View className="w-20 h-20 rounded-full bg-emerald-800 items-center justify-center mb-4">
            <Text className="text-4xl">🎓</Text>
          </View>
          <Text className="text-white text-3xl font-bold tracking-tight">
            OAU Vehicle Pass
          </Text>
          <Text className="text-gray-400 text-base mt-1">
            Sign in to your account
          </Text>
        </View>

        {/* Form card */}
        <View className="bg-gray-900 rounded-2xl p-6 shadow-xl">
          {/* Email */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm font-medium mb-2">
              Email address
            </Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl px-4 py-3.5 text-base border border-gray-700"
              placeholder="you@example.com"
              placeholderTextColor="#6b7280"
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              value={email}
              onChangeText={setEmail}
            />
          </View>

          {/* Password */}
          <View className="mb-6">
            <Text className="text-gray-400 text-sm font-medium mb-2">
              Password
            </Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl px-4 py-3.5 text-base border border-gray-700"
              placeholder="••••••••"
              placeholderTextColor="#6b7280"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Sign in button */}
          <Pressable
            onPress={handleLogin}
            disabled={loading}
            className="bg-emerald-600 rounded-xl py-4 items-center active:bg-emerald-700"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">Sign In</Text>
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
            <Text className="text-emerald-400 font-semibold">Register</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
