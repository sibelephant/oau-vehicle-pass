import { passesApi, vehiclesApi, type Vehicle, type VehiclePass } from "@/lib/api";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  ScrollView,
  Text,
  View,
} from "react-native";
import QRCode from "react-native-qrcode-svg";

function PassCountdown({ expiresAt }: { expiresAt: string }) {
  const exp = new Date(expiresAt);
  const now = new Date();
  const diffMs = exp.getTime() - now.getTime();
  const diffDays = Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
  const diffHours = Math.max(0, Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60)));

  const expired = diffMs <= 0;
  const urgent = diffDays < 3 && !expired;

  return (
    <View
      className={`rounded-xl px-4 py-2.5 mt-4 items-center ${
        expired
          ? "bg-red-900/50"
          : urgent
            ? "bg-amber-900/40"
            : "bg-[#001d40] border border-[#d4af37]/35"
      }`}
    >
      <Text
        className={`text-sm font-semibold ${
          expired ? "text-red-400" : urgent ? "text-amber-400" : "text-[#f5c542]"
        }`}
      >
        {expired
          ? "⚠ Pass Expired — Please renew"
          : urgent
            ? `⏳ Expires in ${diffDays}d ${diffHours}h`
            : `Valid until ${exp.toLocaleDateString("en-NG", { day: "numeric", month: "short", year: "numeric" })}`}
      </Text>
    </View>
  );
}

export default function QrPassScreen() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [loading, setLoading] = useState(true);
  const [issuing, setIssuing] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const v = await vehiclesApi.myVehicles();
      setVehicles(v);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const selected = vehicles[selectedIdx];
  const activePass: VehiclePass | undefined = selected?.passes?.[0];

  async function handleIssuePass() {
    if (!selected) return;
    setIssuing(true);
    try {
      const pass = await passesApi.issue(selected.id);
      // Re-fetch to get updated pass
      const updated = await vehiclesApi.myVehicles();
      setVehicles(updated);
      Alert.alert("Pass Issued ✅", "Your QR pass is ready. Show it at the campus gate.");
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not issue pass");
    } finally {
      setIssuing(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-[#001633]"
      contentContainerClassName="px-5 pb-16"
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); fetchData(); }} tintColor="#d4af37" />
      }
    >
      <View className="pt-14 pb-4">
        <Text className="text-white text-2xl font-bold">QR Pass</Text>
        <Text className="text-amber-200/70 text-sm mt-1">
          Show this at the campus gate
        </Text>
      </View>

      {loading ? (
        <ActivityIndicator color="#d4af37" className="py-20" />
      ) : vehicles.length === 0 ? (
        <View className="items-center py-20">
          <Text className="text-5xl mb-4">📋</Text>
          <Text className="text-gray-400 text-center">
            Register a vehicle first to get a QR pass.
          </Text>
        </View>
      ) : (
        <>
          {/* Vehicle selector */}
          {vehicles.length > 1 && (
            <View className="mb-5">
              <Text className="text-gray-400 text-xs mb-2">Select vehicle</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                <View className="flex-row gap-2">
                  {vehicles.map((v, i) => (
                    <Pressable
                      key={v.id}
                      onPress={() => setSelectedIdx(i)}
                      className={`px-4 py-2.5 rounded-xl border-2 ${
                        i === selectedIdx
                          ? "border-[#d4af37] bg-[#002147]"
                          : "border-[#0d3366] bg-[#001a38]"
                      }`}
                    >
                      <Text
                        className={`font-bold tracking-wider ${i === selectedIdx ? "text-[#f5c542]" : "text-white"}`}
                      >
                        {v.plateNumber}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </ScrollView>
            </View>
          )}

          {/* QR Card */}
          <View className="bg-[#002147] rounded-3xl p-6 items-center border border-[#d4af37]/25 shadow-xl">
            {/* Plate number header */}
            <View className="bg-white rounded-xl px-5 py-2 mb-5">
              <Text className="font-black text-gray-900 text-2xl tracking-widest">
                {selected?.plateNumber}
              </Text>
            </View>

            {selected?.status !== "approved" ? (
              <View className="items-center py-10">
                <Text className="text-5xl mb-3">⏳</Text>
                <Text className="text-gray-300 font-semibold text-center">
                  {selected?.status === "pending"
                    ? "Awaiting Approval"
                    : selected?.status === "rejected"
                      ? "Registration Rejected"
                      : "Vehicle Blacklisted"}
                </Text>
                <Text className="text-gray-500 text-sm text-center mt-2">
                  {selected?.status === "pending"
                    ? "Your vehicle registration is under review. You'll be notified once approved."
                    : selected?.rejectionReason ?? "Contact security administration."}
                </Text>
              </View>
            ) : activePass ? (
              <View className="items-center w-full">
                {QRCode ? (
                  <View className="bg-white p-3 rounded-2xl">
                    <QRCode
                      value={activePass.qrToken}
                      size={220}
                      backgroundColor="white"
                      color="#111827"
                    />
                  </View>
                ) : (
                  <View className="bg-gray-800 w-56 h-56 rounded-2xl items-center justify-center">
                    <Text className="text-gray-400 text-sm text-center px-4">
                      QR code library loading…
                    </Text>
                  </View>
                )}

                <PassCountdown expiresAt={activePass.expiresAt} />

                {/* Renew button */}
                <Pressable
                  onPress={handleIssuePass}
                  disabled={issuing}
                  className="mt-4 py-3 px-6 rounded-xl bg-[#001633] border border-[#0d3366] active:bg-[#001a38]"
                >
                  {issuing ? (
                    <ActivityIndicator color="#d4af37" />
                  ) : (
                    <Text className="text-amber-200/90 text-sm font-semibold">↺ Renew Pass</Text>
                  )}
                </Pressable>
              </View>
            ) : (
              <View className="items-center py-8 w-full">
                <Text className="text-6xl mb-4">📱</Text>
                <Text className="text-white font-semibold text-center mb-2">
                  No Active Pass
                </Text>
                <Text className="text-gray-400 text-sm text-center mb-6">
                  Your vehicle is approved. Generate your QR pass now.
                </Text>
                <Pressable
                  onPress={handleIssuePass}
                  disabled={issuing}
                  className="bg-[#d4af37] rounded-xl py-3.5 px-8 active:bg-[#b89628]"
                >
                  {issuing ? (
                    <ActivityIndicator color="#001633" />
                  ) : (
                    <Text className="text-[#001633] font-bold text-base">Generate QR Pass</Text>
                  )}
                </Pressable>
              </View>
            )}
          </View>

          {/* Info */}
          <View className="bg-[#002147] rounded-2xl p-4 mt-4 border border-[#0d3366]">
            <Text className="text-gray-400 text-xs leading-5">
              🔐 Your QR pass is cryptographically signed and expires in 30 days.{"\n"}
              🚫 Screenshot sharing is prevented — the pass is tied to your vehicle record.{"\n"}
              📶 Gate officers can scan without internet (local whitelist cache).
            </Text>
          </View>
        </>
      )}
    </ScrollView>
  );
}
