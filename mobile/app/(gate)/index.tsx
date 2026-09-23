import { useAuth } from "@/app/_layout";
import { gateApi } from "@/lib/api";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Pressable,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";

import { CameraView, useCameraPermissions } from "expo-camera";

type ScanMode = "qr" | "plate";

export default function GateScanScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>("qr");
  const [plateInput, setPlateInput] = useState("");
  const [scanning, setScanning] = useState(true); // camera active
  const [processing, setProcessing] = useState(false);
  const lastScanRef = useRef<number>(0);

  // Camera permissions
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);
  const [plateImageUri, setPlateImageUri] = useState<string | null>(null);

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
  }, [permission?.granted, requestPermission]);

  // ─── QR scan handler ───────────────────────────────────────────────────────

  const handleBarcodeScan = useCallback(
    async ({ data }: { data: string }) => {
      // Throttle: don't re-scan within 3 seconds
      const now = Date.now();
      if (now - lastScanRef.current < 3000 || processing) return;
      lastScanRef.current = now;

      setProcessing(true);
      setScanning(false);
      try {
        const result = await gateApi.scanQr(data);
        router.push({
          pathname: "/(gate)/result" as never,
          params: {
            decision: result.decision,
            reason: result.reason ?? "",
            vehicleJson: JSON.stringify(result.vehicle),
          },
        });
      } catch (e: any) {
        Alert.alert("Scan Error", e?.message ?? "Could not process QR");
        setScanning(true);
      } finally {
        setProcessing(false);
      }
    },
    [processing, router],
  );

  // ─── Plate scan handler ────────────────────────────────────────────────────

  async function handlePlateScan() {
    if (!plateInput.trim()) {
      Alert.alert("Enter plate number", "Type the plate number to look up");
      return;
    }
    setProcessing(true);
    try {
      const result = await gateApi.scanPlate(
        plateInput.trim(),
        plateImageUri ?? undefined,
      );
      router.push({
        pathname: "/(gate)/result" as never,
        params: {
          decision: result.decision,
          reason: result.reason ?? "",
          vehicleJson: JSON.stringify(result.vehicle),
        },
      });
      setPlateInput("");
      setPlateImageUri(null);
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not look up plate");
    } finally {
      setProcessing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-gray-950"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Header */}
      <View className="px-5 pt-14 pb-4 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-xl font-bold">Gate Scanner</Text>
          <Text className="text-gray-400 text-xs mt-0.5">
            {user?.name} · Officer
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/(gate)/log" as never)}
            className="bg-gray-800 rounded-full px-4 py-2"
          >
            <Text className="text-gray-300 text-sm">📋 Log</Text>
          </Pressable>
          <Pressable
            onPress={signOut}
            className="bg-gray-800 rounded-full px-3 py-2"
          >
            <Text className="text-gray-300 text-sm">⏻</Text>
          </Pressable>
        </View>
      </View>

      {/* Mode toggle */}
      <View className="flex-row mx-5 bg-gray-900 rounded-2xl p-1 mb-4">
        {(["qr", "plate"] as ScanMode[]).map((m) => (
          <Pressable
            key={m}
            onPress={() => {
              setMode(m);
              setScanning(true);
              setPlateInput("");
            }}
            className={`flex-1 py-3 rounded-xl items-center ${mode === m ? "bg-emerald-700" : ""}`}
          >
            <Text
              className={`font-bold text-sm ${mode === m ? "text-white" : "text-gray-400"}`}
            >
              {m === "qr" ? "📱 QR Code" : "🔢 Plate Number"}
            </Text>
          </Pressable>
        ))}
      </View>

      {/* Scanner area */}
      <View className="flex-1 mx-5 mb-5">
        {mode === "qr" ? (
          <View className="flex-1 rounded-3xl overflow-hidden bg-black">
            {!permission?.granted ? (
              <View className="flex-1 items-center justify-center gap-4">
                <Text className="text-6xl">📷</Text>
                <Text className="text-white text-center px-8">
                  Camera access is needed to scan QR codes
                </Text>
                <Pressable
                  onPress={requestPermission}
                  className="bg-emerald-600 rounded-xl px-6 py-3"
                >
                  <Text className="text-white font-bold">Allow Camera</Text>
                </Pressable>
              </View>
            ) : processing ? (
              <View className="flex-1 items-center justify-center gap-4">
                <ActivityIndicator size="large" color="#10b981" />
                <Text className="text-gray-300">Verifying…</Text>
              </View>
            ) : (
              <CameraView
                style={{ flex: 1 }}
                facing="back"
                onBarcodeScanned={scanning ? handleBarcodeScan : undefined}
                barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
              >
                {/* QR viewfinder overlay */}
                <View className="flex-1 items-center justify-center">
                  <View
                    style={{
                      width: 240,
                      height: 240,
                      borderRadius: 16,
                      borderWidth: 2,
                      borderColor: "#10b981",
                    }}
                  />
                  <Text className="text-emerald-400 text-sm mt-4 font-medium">
                    Aim camera at the driver's QR pass
                  </Text>
                </View>
              </CameraView>
            )}
          </View>
        ) : (
          /* Plate capture and lookup mode */
          <View className="flex-1 gap-4">
            <View className="flex-1 rounded-3xl overflow-hidden bg-black">
              {permission?.granted ? (
                <CameraView ref={cameraRef} style={{ flex: 1 }} facing="back" />
              ) : (
                <View className="flex-1 items-center justify-center">
                  <Text className="text-gray-400 text-center px-8">
                    Camera access is needed to capture a plate image
                  </Text>
                </View>
              )}
            </View>
            <View className="bg-gray-900 rounded-3xl p-8 w-full items-center">
              <Text className="text-gray-400 text-sm mb-3">
                Capture the plate, then enter the detected number
              </Text>
              <Pressable
                onPress={async () => {
                  const photo = await cameraRef.current?.takePictureAsync({
                    quality: 0.7,
                    base64: true,
                  });
                  if (photo?.base64)
                    setPlateImageUri(`data:image/jpeg;base64,${photo.base64}`);
                }}
                disabled={!permission?.granted || processing}
                className="mb-4 bg-gray-800 rounded-xl px-5 py-3"
              >
                <Text className="text-emerald-400 font-bold">
                  {plateImageUri
                    ? "Plate image captured"
                    : "Capture plate image"}
                </Text>
              </Pressable>
              <TextInput
                className="bg-white text-gray-900 text-center text-3xl font-black tracking-widest rounded-2xl px-6 py-4 w-full"
                placeholder="ABC 123 XY"
                placeholderTextColor="#9ca3af"
                value={plateInput}
                onChangeText={(t) => setPlateInput(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                returnKeyType="search"
                onSubmitEditing={handlePlateScan}
              />
              <Pressable
                onPress={handlePlateScan}
                disabled={processing}
                className="mt-5 bg-emerald-600 rounded-2xl py-4 px-12 active:bg-emerald-700"
              >
                {processing ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text className="text-white font-bold text-lg">Verify →</Text>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}
