import { gateApi, type Vehicle } from "@/lib/api";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from "react-native";

export default function GateResultScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    decision: string;
    reason: string;
    vehicleJson: string;
  }>();

  const decision = params.decision as "granted" | "denied";
  const reason = params.reason;
  const vehicle: Vehicle | null = params.vehicleJson
    ? JSON.parse(params.vehicleJson)
    : null;

  const isGranted = decision === "granted";

  // Override state
  const [showOverride, setShowOverride] = useState(false);
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideDecision, setOverrideDecision] = useState<
    "granted" | "denied"
  >(isGranted ? "denied" : "granted");
  const [submitting, setSubmitting] = useState(false);

  async function handleOverride() {
    if (overrideReason.trim().length < 5) {
      Alert.alert(
        "Required",
        "Please provide a reason of at least 5 characters",
      );
      return;
    }
    setSubmitting(true);
    try {
      await gateApi.override({
        vehicleId: vehicle?.id,
        plateNumber: vehicle?.plateNumber,
        decision: overrideDecision,
        reason: overrideReason.trim(),
      });
      Alert.alert(
        "Override Logged",
        `Decision changed to: ${overrideDecision.toUpperCase()}`,
        [{ text: "OK", onPress: () => router.replace("/(gate)/" as never) }],
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not log override");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ScrollView
      className="flex-1 bg-[#001633]"
      contentContainerClassName="flex-1 pb-10"
    >
      {/* Full-bleed decision banner */}
      <View
        className={`pt-16 pb-12 px-8 items-center ${
          isGranted ? "bg-emerald-900" : "bg-red-950"
        }`}
      >
        <Text style={{ fontSize: 80 }}>{isGranted ? "✅" : "🚫"}</Text>
        <Text
          className={`text-5xl font-black mt-4 tracking-wide ${
            isGranted ? "text-emerald-300" : "text-red-400"
          }`}
        >
          {isGranted ? "GRANTED" : "DENIED"}
        </Text>
        {reason ? (
          <Text className="text-gray-300 text-center text-sm mt-3 max-w-xs">
            {reason}
          </Text>
        ) : null}
      </View>

      <View className="px-5 pt-6 gap-4">
        {/* Vehicle info */}
        {vehicle ? (
          <View className="bg-[#002147] rounded-2xl p-5 border border-[#0d3366]">
            <Text className="text-[#f5c542] text-xs font-semibold uppercase mb-3">
              Vehicle
            </Text>
            <View className="bg-white border-2 border-[#d4af37] rounded-xl px-4 py-2 self-start mb-4">
              <Text className="font-black text-gray-900 text-2xl tracking-widest">
                {vehicle.plateNumber}
              </Text>
            </View>
            <Row label="Category" value={vehicle.category} />
            {vehicle.make && <Row label="Make" value={vehicle.make} />}
            {vehicle.model && <Row label="Model" value={vehicle.model} />}
            {vehicle.color && <Row label="Color" value={vehicle.color} />}
            <Row label="Owner" value={vehicle.ownerName} />
            <Row label="Contact" value={vehicle.ownerContact} />
          </View>
        ) : (
          <View className="bg-[#002147] border border-[#0d3366] rounded-2xl p-5 items-center">
            <Text className="text-gray-400 text-sm">
              No vehicle record found
            </Text>
          </View>
        )}

        {/* Override section */}
        {!showOverride ? (
          <Pressable
            onPress={() => setShowOverride(true)}
            className="bg-[#002147] border border-[#0d3366] rounded-2xl py-4 px-5 flex-row items-center justify-between active:bg-[#001d40]"
          >
            <Text className="text-white font-medium">Manual Override</Text>
            <Text className="text-[#f5c542] text-xs font-semibold">Officer discretion</Text>
          </Pressable>
        ) : (
          <View className="bg-[#002147] rounded-2xl p-5 border border-[#d4af37]/35">
            <Text className="text-white font-bold mb-4">Manual Override</Text>

            {/* Override decision toggle */}
            <View className="flex-row gap-3 mb-4">
              {(["granted", "denied"] as const).map((d) => (
                <Pressable
                  key={d}
                  onPress={() => setOverrideDecision(d)}
                  className={`flex-1 py-3 rounded-xl items-center border-2 ${
                    overrideDecision === d
                      ? d === "granted"
                        ? "border-emerald-500 bg-emerald-900/50"
                        : "border-red-500 bg-red-900/30"
                      : "border-[#0d3366] bg-[#001633]"
                  }`}
                >
                  <Text
                    className={`font-bold text-sm ${
                      overrideDecision === d
                        ? d === "granted"
                          ? "text-emerald-400"
                          : "text-red-400"
                        : "text-gray-400"
                    }`}
                  >
                    {d === "granted" ? "✅ Grant" : "🚫 Deny"}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Reason */}
            <Text className="text-gray-300 text-sm mb-2">Reason *</Text>
            <TextInput
              className="bg-[#001633] text-white rounded-xl px-4 py-3 text-sm border border-[#0d3366] mb-4"
              placeholder="State the reason for this override…"
              placeholderTextColor="#64748b"
              multiline
              numberOfLines={3}
              value={overrideReason}
              onChangeText={setOverrideReason}
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setShowOverride(false)}
                className="flex-1 py-3 rounded-xl bg-[#001633] border border-[#0d3366] items-center"
              >
                <Text className="text-gray-300 font-semibold text-sm">
                  Cancel
                </Text>
              </Pressable>
              <Pressable
                onPress={handleOverride}
                disabled={submitting}
                className="flex-1 py-3 rounded-xl bg-[#d4af37] items-center active:bg-[#b89628]"
              >
                {submitting ? (
                  <ActivityIndicator color="#001633" />
                ) : (
                  <Text className="text-[#001633] font-bold text-sm">
                    Log Override
                  </Text>
                )}
              </Pressable>
            </View>
          </View>
        )}

        {/* Back to scanner */}
        <Pressable
          onPress={() => router.replace("/(gate)/" as never)}
          className="bg-[#d4af37] rounded-2xl py-4 items-center active:bg-[#b89628] mt-2"
        >
          <Text className="text-[#001633] font-bold text-base">← Next Vehicle</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between py-1.5 border-b border-gray-800">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-white text-sm capitalize font-medium">{value}</Text>
    </View>
  );
}
