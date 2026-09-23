import { gateApi, type AccessLog } from "@/lib/api";
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

function LogItem({ log }: { log: AccessLog }) {
  const isGranted = log.decision === "granted";
  const time = new Date(log.timestamp).toLocaleTimeString("en-NG", {
    hour: "2-digit",
    minute: "2-digit",
  });

  return (
    <View
      className={`flex-row items-center gap-3 px-4 py-3.5 rounded-2xl mb-2 border ${
        isGranted
          ? "bg-emerald-950/40 border-emerald-900"
          : "bg-red-950/40 border-red-900"
      }`}
    >
      <Text className="text-2xl">{isGranted ? "✅" : "🚫"}</Text>
      <View className="flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-white font-bold tracking-wider">
            {log.vehicle?.plateNumber ?? log.plateNumber ?? "Unknown"}
          </Text>
          <Text className="text-gray-500 text-xs">{time}</Text>
        </View>
        <Text className="text-gray-400 text-xs mt-0.5 capitalize">
          via {log.channel}
          {log.vehicle?.category ? ` · ${log.vehicle.category}` : ""}
        </Text>
        {log.overrideReason && (
          <Text className="text-amber-500 text-xs mt-0.5">
            ⚡ Override: {log.overrideReason}
          </Text>
        )}
      </View>
      <Text
        className={`text-xs font-black uppercase px-2 py-1 rounded-lg ${
          isGranted ? "text-emerald-400" : "text-red-400"
        }`}
      >
        {log.decision}
      </Text>
    </View>
  );
}

export default function GateLogScreen() {
  const router = useRouter();
  const [logs, setLogs] = useState<AccessLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchLogs = useCallback(async () => {
    try {
      const data = await gateApi.todayLog();
      setLogs(data);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const granted = logs.filter((l) => l.decision === "granted").length;
  const denied = logs.filter((l) => l.decision === "denied").length;

  return (
    <ScrollView
      className="flex-1 bg-gray-950"
      contentContainerClassName="pb-10"
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() => { setRefreshing(true); fetchLogs(); }}
          tintColor="#10b981"
        />
      }
    >
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center gap-4">
        <Pressable
          onPress={() => router.back()}
          className="w-9 h-9 rounded-full bg-gray-800 items-center justify-center"
        >
          <Text className="text-white">←</Text>
        </Pressable>
        <View>
          <Text className="text-white text-xl font-bold">Today's Log</Text>
          <Text className="text-gray-400 text-xs">
            {new Date().toLocaleDateString("en-NG", {
              weekday: "long",
              day: "numeric",
              month: "long",
            })}
          </Text>
        </View>
      </View>

      {/* Stats */}
      <View className="flex-row gap-3 px-5 mb-5">
        <View className="flex-1 bg-gray-900 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-white">{logs.length}</Text>
          <Text className="text-gray-400 text-xs mt-1">Total</Text>
        </View>
        <View className="flex-1 bg-emerald-900/40 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-emerald-300">{granted}</Text>
          <Text className="text-gray-400 text-xs mt-1">Granted</Text>
        </View>
        <View className="flex-1 bg-red-900/30 rounded-2xl p-4">
          <Text className="text-3xl font-bold text-red-400">{denied}</Text>
          <Text className="text-gray-400 text-xs mt-1">Denied</Text>
        </View>
      </View>

      {/* Log entries */}
      <View className="px-5">
        <Text className="text-gray-400 text-xs font-semibold uppercase tracking-wider mb-3">
          Access Events
        </Text>

        {loading ? (
          <ActivityIndicator color="#10b981" className="py-16" />
        ) : logs.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-4xl mb-3">📋</Text>
            <Text className="text-gray-400 text-center">
              No access events recorded today yet.
            </Text>
          </View>
        ) : (
          logs.map((log) => <LogItem key={log.id} log={log} />)
        )}
      </View>
    </ScrollView>
  );
}
