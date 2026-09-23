import { useAuth } from "@/app/_layout";
import { vehiclesApi, type Vehicle, reportsApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

const STATUS_COLORS: Record<string, string> = {
  approved: "text-emerald-400",
  pending: "text-amber-400",
  rejected: "text-red-400",
  blacklisted: "text-red-600",
};

const STATUS_BG: Record<string, string> = {
  approved: "bg-emerald-900/50",
  pending: "bg-amber-900/50",
  rejected: "bg-red-900/50",
  blacklisted: "bg-red-950",
};

export default function DriverHome() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const v = await vehiclesApi.myVehicles();
      setVehicles(v);
    } catch {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchData();
  }, [fetchData]);

  const approvedCount = vehicles.filter((v) => v.status === "approved").length;
  const pendingCount = vehicles.filter((v) => v.status === "pending").length;

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerClassName="pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor="#10b981"
        />
      }
    >
      {/* Header */}
      <View className="px-6 pt-14 pb-6">
        <View className="flex-row items-center justify-between">
          <View>
            <Text className="text-gray-400 text-sm">Welcome back,</Text>
            <Text className="text-white text-2xl font-bold">{user?.name ?? "..."}</Text>
          </View>
          <Pressable
            onPress={signOut}
            className="bg-gray-800 rounded-full px-4 py-2"
          >
            <Text className="text-gray-300 text-sm">Sign out</Text>
          </Pressable>
        </View>

        {/* OAU badge */}
        <View className="mt-4 bg-emerald-900/40 border border-emerald-800 rounded-2xl px-4 py-3 flex-row items-center gap-3">
          <Text className="text-2xl">🎓</Text>
          <View>
            <Text className="text-emerald-300 font-semibold text-sm">
              Obafemi Awolowo University
            </Text>
            <Text className="text-emerald-500 text-xs">
              Vehicle Pass Authentication System
            </Text>
          </View>
        </View>
      </View>

      {/* Stats row */}
      <View className="flex-row gap-3 px-6 mb-6">
        <View className="flex-1 bg-gray-900 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-white">{vehicles.length}</Text>
          <Text className="text-gray-400 text-xs mt-1">Registered</Text>
        </View>
        <View className="flex-1 bg-emerald-900/50 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-emerald-300">{approvedCount}</Text>
          <Text className="text-gray-400 text-xs mt-1">Active Passes</Text>
        </View>
        <View className="flex-1 bg-amber-900/30 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-amber-300">{pendingCount}</Text>
          <Text className="text-gray-400 text-xs mt-1">Pending</Text>
        </View>
      </View>

      {/* Quick action */}
      <View className="px-6 mb-6">
        <Pressable
          onPress={() => router.push("/(driver)/vehicles/register")}
          className="bg-emerald-600 rounded-2xl py-4 px-6 flex-row items-center justify-between active:bg-emerald-700"
        >
          <View>
            <Text className="text-white font-bold text-base">
              Register a Vehicle
            </Text>
            <Text className="text-emerald-200 text-xs mt-0.5">
              Get your digital vehicle pass
            </Text>
          </View>
          <Text className="text-2xl">＋</Text>
        </Pressable>
      </View>

      {/* Vehicle list */}
      <View className="px-6">
        <Text className="text-gray-400 text-sm font-semibold mb-3 uppercase tracking-wider">
          Your Vehicles
        </Text>

        {loading ? (
          <ActivityIndicator color="#10b981" className="py-8" />
        ) : vehicles.length === 0 ? (
          <View className="bg-gray-900 rounded-2xl p-8 items-center">
            <Text className="text-4xl mb-3">🚗</Text>
            <Text className="text-gray-400 text-center text-sm">
              No vehicles registered yet.{"\n"}Tap the button above to get started.
            </Text>
          </View>
        ) : (
          vehicles.map((v) => (
            <View
              key={v.id}
              className={`rounded-2xl p-4 mb-3 border border-gray-800 ${STATUS_BG[v.status] ?? "bg-gray-900"}`}
            >
              <View className="flex-row items-center justify-between mb-1">
                <Text className="text-white font-bold text-lg tracking-widest">
                  {v.plateNumber}
                </Text>
                <Text
                  className={`text-xs font-bold uppercase px-2 py-1 rounded-full ${STATUS_COLORS[v.status]}`}
                >
                  {v.status}
                </Text>
              </View>
              <Text className="text-gray-400 text-sm capitalize">
                {v.category} · {v.make ?? "—"} {v.model ?? ""}
              </Text>
              {v.status === "rejected" && v.rejectionReason && (
                <Text className="text-red-400 text-xs mt-2">
                  ⚠ {v.rejectionReason}
                </Text>
              )}
            </View>
          ))
        )}
      </View>
    </ScrollView>
  );
}
