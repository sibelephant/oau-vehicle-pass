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

export default function RegisterScreen() {
  const router = useRouter();
  const { refetch } = useAuth();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
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
      });

      if (result.error) {
        Alert.alert("Registration Failed", result.error.message ?? "Could not create account");
        return;
      }

      await refetch();
      router.replace("/(driver)/" as never);
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
        contentContainerClassName="px-6 py-12"
        keyboardShouldPersistTaps="handled"
      >
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-20 h-20 rounded-full bg-[#002147] border-2 border-[#d4af37] items-center justify-center mb-4">
            <Text className="text-4xl">🎓</Text>
          </View>
          <Text className="text-white text-3xl font-bold tracking-tight">
            Create Account
          </Text>
          <Text className="text-amber-200/80 text-base mt-1">
            Join the OAU Vehicle Pass system
          </Text>
          <View className="mt-3 px-3 py-1.5 rounded-full bg-[#001d40] border border-[#0d3366] flex-row items-center gap-1.5">
            <Text className="text-xs">🚗</Text>
            <Text className="text-xs text-gray-300">Vehicle Owner Registration</Text>
          </View>
        </View>

        {/* Form */}
        <View className="bg-[#002147] rounded-2xl p-6 border border-[#d4af37]/25 shadow-xl">
          {/* Name */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-2">
              Full name
            </Text>
            <TextInput
              className="bg-[#001633] text-white rounded-xl px-4 py-3.5 text-base border border-[#0d3366]"
              placeholder="Ada Okonkwo"
              placeholderTextColor="#64748b"
              autoCapitalize="words"
              value={name}
              onChangeText={setName}
            />
          </View>

          {/* Email */}
          <View className="mb-4">
            <Text className="text-gray-300 text-sm font-medium mb-2">
              Email address
            </Text>
            <TextInput
              className="bg-[#001633] text-white rounded-xl px-4 py-3.5 text-base border border-[#0d3366]"
              placeholder="you@oauife.edu.ng"
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
              placeholder="Min. 8 characters"
              placeholderTextColor="#64748b"
              secureTextEntry
              value={password}
              onChangeText={setPassword}
            />
          </View>

          {/* Submit */}
          <Pressable
            onPress={handleRegister}
            disabled={loading}
            className="bg-[#d4af37] rounded-xl py-4 items-center active:bg-[#b89628]"
          >
            {loading ? (
              <ActivityIndicator color="#001633" />
            ) : (
              <Text className="text-[#001633] font-bold text-base">
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
            <Text className="text-[#f5c542] font-semibold">Sign In</Text>
          </Text>
        </Pressable>

        {/* Gate officer note */}
        <View className="mt-4 px-4 items-center">
          <Text className="text-gray-500 text-xs text-center">
            Gate officer accounts are assigned by Campus Security Administration.
          </Text>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
