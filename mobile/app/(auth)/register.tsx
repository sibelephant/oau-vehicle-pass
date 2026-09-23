import { authClient, type UserRole } from "@/lib/auth-client";
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
  TouchableOpacity,
  View,
} from "react-native";

const ROLES: { value: UserRole; label: string; description: string; emoji: string }[] = [
  {
    value: "driver",
    label: "Vehicle Owner",
    description: "Register vehicles and manage your passes",
    emoji: "🚗",
  },
  {
    value: "gate_officer",
    label: "Gate Officer",
    description: "Verify vehicles at the campus gate",
    emoji: "🛡️",
  },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("driver");
  const [loading, setLoading] = useState(false);

  async function handleRegister() {
    if (!name.trim() || !email.trim() || !password) {
      Alert.alert("Error", "Please fill in all fields");
      return;
    }
    if (password.length < 8) {
      Alert.alert("Error", "Password must be at least 8 characters");
      return;
    }
    setLoading(true);
    try {
      const result = await authClient.signUp.email({
        name: name.trim(),
        email: email.trim(),
        password,
        role,
      } as any);

      if (result.error) {
        Alert.alert("Registration Failed", result.error.message ?? "Could not create account");
      }
      // Navigation handled by root layout auth guard
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
        contentContainerClassName="px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-emerald-800 items-center justify-center mb-4">
            <Text className="text-4xl">🎓</Text>
          </View>
          <Text className="text-white text-3xl font-bold tracking-tight">
            Create Account
          </Text>
          <Text className="text-gray-400 text-base mt-1">
            Join the OAU Vehicle Pass system
          </Text>
        </View>

        {/* Role selector */}
        <View className="mb-6">
          <Text className="text-gray-400 text-sm font-medium mb-3">
            I am a...
          </Text>
          <View className="flex-row gap-3">
            {ROLES.map((r) => (
              <TouchableOpacity
                key={r.value}
                onPress={() => setRole(r.value)}
                className={`flex-1 rounded-2xl p-4 border-2 ${
                  role === r.value
                    ? "bg-emerald-900 border-emerald-500"
                    : "bg-gray-900 border-gray-700"
                }`}
              >
                <Text className="text-2xl mb-1">{r.emoji}</Text>
                <Text
                  className={`font-bold text-sm ${role === r.value ? "text-emerald-300" : "text-white"}`}
                >
                  {r.label}
                </Text>
                <Text className="text-gray-400 text-xs mt-0.5">
                  {r.description}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Form */}
        <View className="bg-gray-900 rounded-2xl p-6">
          {/* Name */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm font-medium mb-2">
              Full name
            </Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl px-4 py-3.5 text-base border border-gray-700"
              placeholder="Ada Okonkwo"
              placeholderTextColor="#6b7280"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-gray-400 text-sm font-medium mb-2">
              Email address
            </Text>
            <TextInput
              className="bg-gray-800 text-white rounded-xl px-4 py-3.5 text-base border border-gray-700"
              placeholder="you@oauife.edu.ng"
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
              placeholder="Min. 8 characters"
              placeholderTextColor="#6b7280"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="bg-emerald-600 rounded-xl py-4 items-center active:bg-emerald-700"
          >
            {loading ? (
              <ActivityIndicator color="#ffffff" />
            ) : (
              <Text className="text-white font-bold text-base">
                Create Account
              </Text>
            )}
          </Pressable>
        </View>

        {/* Login link */}
        <Pressable
          onPress={() => router.back()}
          className="mt-6 items-center"
        >
          <Text className="text-gray-400 text-sm">
            Already have an account?{" "}
            <Text className="text-emerald-400 font-semibold">Sign In</Text>
          </Text>
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
