import { vehiclesApi, type Vehicle } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";

const STATUS_INFO: Record<string, { label: string; color: string; bg: string; emoji: string }> = {
  approved: { label: "Approved", color: "text-emerald-400", bg: "bg-emerald-900/40", emoji: "✅" },
  pending: { label: "Pending Review", color: "text-amber-400", bg: "bg-amber-900/30", emoji: "⏳" },
  rejected: { label: "Rejected", color: "text-red-400", bg: "bg-red-900/30", emoji: "❌" },
  blacklisted: { label: "Blacklisted", color: "text-red-600", bg: "bg-red-950", emoji: "🚫" },
};

function VehicleCard({ vehicle }: { vehicle: Vehicle }) {
  const info = STATUS_INFO[vehicle.status] ?? STATUS_INFO.pending;
  const activePass = vehicle.passes?.[0];

  return (
    <View className={`rounded-2xl p-5 mb-4 border border-gray-800 ${info.bg}`}>
      {/* Plate + status */}
      <View className="flex-row items-center justify-between mb-3">
        <View className="bg-white rounded-lg px-3 py-1">
          <Text className="font-bold text-gray-900 text-lg tracking-widest">
            {vehicle.plateNumber}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          <Text>{info.emoji}</Text>
          <Text className={`${info.color} text-sm font-semibold`}>
            {info.label}
          </Text>
        </View>
      </View>

      {/* Details */}
      <View className="flex-row flex-wrap gap-3">
        <Detail label="Category" value={vehicle.category} />
        {vehicle.make && <Detail label="Make" value={vehicle.make} />}
        {vehicle.model && <Detail label="Model" value={vehicle.model} />}
        {vehicle.color && <Detail label="Color" value={vehicle.color} />}
      </View>

      {vehicle.status === "rejected" && vehicle.rejectionReason && (
        <View className="mt-3 bg-red-950/60 rounded-xl p-3">
          <Text className="text-red-400 text-sm">
            ⚠ Reason: {vehicle.rejectionReason}
          </Text>
        </View>
      )}

      {/* Pass info */}
      {activePass && (
        <View className="mt-3 bg-emerald-950/60 rounded-xl p-3">
          <Text className="text-emerald-400 text-xs">
            Pass valid until:{" "}
            {new Date(activePass.expiresAt).toLocaleDateString("en-NG", {
              day: "numeric",
              month: "short",
              year: "numeric",
            })}
          </Text>
        </View>
      )}
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View>
      <Text className="text-gray-500 text-xs">{label}</Text>
      <Text className="text-white text-sm capitalize font-medium">{value}</Text>
    </View>
  );
}

export default function VehiclesListScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchVehicles = useCallback(async () => {
    try {
      const data = await vehiclesApi.myVehicles();
      setVehicles(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVehicles();
  }, [fetchVehicles]);

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerClassName="px-5 pb-10"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchVehicles(); }} tintColor="#10b981" />
      }
    >
      <View className="pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">My Vehicles</Text>
        <Text className="text-gray-400 text-sm mt-1">
          {vehicles.length} vehicle{vehicles.length !== 1 ? "s" : ""} registered
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#10b981" className="py-16" />
      ) : vehicles.length === 0 ? (
        <View className="items-center py-20">
          <Text className="text-5xl mb-4">🚗</Text>
          <Text className="text-gray-400 text-center">
            No vehicles yet. Register one from the Home tab.
          </Text>
        </View>
      ) : (
        vehicles.map((v) => <VehicleCard key={v.id} vehicle={v} />)
      )}
    </ScrollView>
  );
}
