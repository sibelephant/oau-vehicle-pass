import { useAuth } from "@/app/_layout";
import { vehiclesApi } from "@/lib/api";
import { useList } from "@/lib/use-list";
import { useRouter } from "expo-router";
import {
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

export default function DriverHome() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const { data: vehicles, refreshing, onRefresh } = useList(vehiclesApi.myVehicles);

  const approvedCount = vehicles.filter((v) => v.status === "approved").length;
  const pendingCount = vehicles.filter((v) => v.status === "pending").length;

  return (
    <ScrollView
      className="flex-1 bg-[#001633]"
      contentContainerClassName="pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#d4af37"
        />
      }
    >
      {/* Header */}
      <View className="px-6 pt-14 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-gray-400 text-sm">Welcome back,</Text>
            <Text className="text-white text-2xl font-bold">
              {user?.name ?? "..."}
            </Text>
          </View>
          <Pressable
            onPress={signOut}
            className="bg-[#002147] border border-[#0d3366] rounded-full px-4 py-2"
          >
            <Text className="text-gray-300 text-sm">Sign out</Text>
          </Pressable>
        </View>

        {/* OAU badge */}
        <View className="mt-4 bg-[#002147] border border-[#d4af37]/40 rounded-2xl px-4 py-3 flex-row items-center gap-3">
          <Text className="text-2xl">🎓</Text>
          <View>
            <Text className="text-[#f5c542] font-semibold text-sm">
              Obafemi Awolowo University
            </Text>
            <Text className="text-amber-200/70 text-xs">
              Vehicle Pass Authentication System
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row gap-3 px-6 mb-6">
        <View className="flex-1 bg-[#002147] border border-[#0d3366] rounded-2xl p-4">
          <Text className="text-3xl font-bold text-white">
            {vehicles.length}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">Registered</Text>
        </View>
        <View className="flex-1 bg-[#002147] border border-[#d4af37]/40 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-[#f5c542]">
            {approvedCount}
          </Text>
          <Text className="text-amber-200/80 text-xs mt-1">Active Passes</Text>
        </View>
        <View className="flex-1 bg-[#002147] border border-[#0d3366] rounded-2xl p-4">
          <Text className="text-3xl font-bold text-amber-400">
            {pendingCount}
          </Text>
          <Text className="text-gray-400 text-xs mt-1">Pending</Text>
        </View>
      </View>

      {/* Quick action */}
      <View className="px-6 mb-6">
        <Pressable
          onPress={() => router.push("/(driver)/vehicles/register" as never)}
          className="bg-[#d4af37] rounded-2xl py-4 px-6 flex-row items-center justify-between active:bg-[#b89628]"
        >
          <View>
            <Text className="text-[#001633] font-bold text-base">
              Register a Vehicle
            </Text>
            <Text className="text-[#001633]/80 text-xs mt-0.5">
              Get your digital vehicle pass
            </Text>
          </View>
          <Text className="text-[#001633] text-2xl font-bold">＋</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}
