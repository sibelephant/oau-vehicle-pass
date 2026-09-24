import { useAuth } from "@/app/_layout";
import { gateApi, type Vehicle } from "@/lib/api";
import { offlineGate } from "@/lib/offline-gate";
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
  Modal,
  Image,
} from "react-native";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as Haptics from "expo-haptics";

type ScanMode = "qr" | "plate";

export default function GateScanScreen() {
  const { user, signOut } = useAuth();
  const router = useRouter();
  const [mode, setMode] = useState<ScanMode>("qr");

  // Camera & Scanning States
  const [scanning, setScanning] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [processingMessage, setProcessingMessage] = useState("Verifying…");
  const [torchOn, setTorchOn] = useState(false);
  const lastScanRef = useRef<number>(0);

  // Offline Tolerance & Local Cache State
  const [lastSyncTime, setLastSyncTime] = useState<string | null>(null);
  const [cachedWhitelistCount, setCachedWhitelistCount] = useState<number>(0);
  const [pendingOfflineLogs, setPendingOfflineLogs] = useState<number>(0);
  const [syncingOffline, setSyncingOffline] = useState<boolean>(false);

  // Camera permissions & ref
  const [permission, requestPermission] = useCameraPermissions();
  const cameraRef = useRef<CameraView>(null);

  // Plate Recognition States
  const [manualEntryVisible, setManualEntryVisible] = useState(false);
  const [plateInput, setPlateInput] = useState("");
  const [capturedImageBase64, setCapturedImageBase64] = useState<string | null>(null);
  const [confirmationModalVisible, setConfirmationModalVisible] = useState(false);
  const [detectedPlateText, setDetectedPlateText] = useState("");
  const [detectedConfidence, setDetectedConfidence] = useState(0);

  async function performCacheSync() {
    setSyncingOffline(true);
    try {
      const res = await offlineGate.syncFromServer();
      setLastSyncTime(res.lastSync);
      setCachedWhitelistCount(res.whitelistCount);
      const pending = await offlineGate.getPendingCount();
      setPendingOfflineLogs(pending);
    } catch {
      // Offline fallback: load existing local cache count
      const wl = await offlineGate.getWhitelist();
      setCachedWhitelistCount(wl.length);
      const last = await offlineGate.getLastSyncTime();
      setLastSyncTime(last);
      const pending = await offlineGate.getPendingCount();
      setPendingOfflineLogs(pending);
    } finally {
      setSyncingOffline(false);
    }
  }

  useEffect(() => {
    if (!permission?.granted) {
      requestPermission();
    }
    performCacheSync();
  }, [permission?.granted, requestPermission]);

  // ─── QR Code Scan Handler ──────────────────────────────────────────────────

  const handleBarcodeScan = useCallback(
    async ({ data }: { data: string }) => {
      // Throttle: don't re-scan within 3 seconds
      const now = Date.now();
      if (now - lastScanRef.current < 3000 || processing) return;
      lastScanRef.current = now;

      try {
        await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      } catch {}

      setProcessing(true);
      setProcessingMessage("Verifying QR Pass…");
      setScanning(false);

      try {
        const result = await gateApi.scanQr(data);
        router.push({
          pathname: "/(gate)/result" as never,
          params: {
            decision: result.decision,
            reason: result.reason ?? "",
            vehicleJson: JSON.stringify(result.vehicle),
            isOffline: "false",
          },
        });
      } catch (e: any) {
        // Fallback to local offline cache
        console.log("[GateScanner] Online verify failed, checking offline whitelist:", e?.message);
        try {
          const offlineRes = await offlineGate.verifyQrOffline(data);
          const pending = await offlineGate.getPendingCount();
          setPendingOfflineLogs(pending);

          router.push({
            pathname: "/(gate)/result" as never,
            params: {
              decision: offlineRes.decision,
              reason: offlineRes.reason ?? "",
              vehicleJson: JSON.stringify(offlineRes.vehicle),
              isOffline: "true",
            },
          });
        } catch {
          Alert.alert("Scan Error", e?.message ?? "Could not process QR code");
          setScanning(true);
        }
      } finally {
        setProcessing(false);
      }
    },
    [processing, router],
  );

  // ─── ANPR Camera Plate Capture & Recognition ───────────────────────────────

  async function handleCaptureAndRecognizePlate() {
    if (!cameraRef.current) return;

    try {
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    } catch {}

    setProcessing(true);
    setProcessingMessage("Capturing & analyzing plate via ANPR…");

    try {
      const photo = await cameraRef.current.takePictureAsync({
        quality: 0.85,
        base64: true,
      });

      if (!photo?.base64) {
        Alert.alert("Capture Failed", "Could not capture image from camera.");
        return;
      }

      const base64Data = photo.base64;
      setCapturedImageBase64(base64Data);

      // Call the server ANPR recognition engine
      setProcessingMessage("Running ANPR plate recognition…");
      const anprResult = await gateApi.recognizeAnpr(base64Data);

      if (anprResult.detectedPlate) {
        setDetectedPlateText(anprResult.detectedPlate);
        setDetectedConfidence(Math.round(anprResult.confidence || 85));

        // If confidence is high and vehicle is registered, navigate directly
        if (anprResult.confidence >= 75 && anprResult.vehicle) {
          try {
            await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          } catch {}

          // Finalize and log the plate scan
          const verified = await gateApi.scanPlate(
            anprResult.detectedPlate,
            `data:image/jpeg;base64,${base64Data}`,
          );

          router.push({
            pathname: "/(gate)/result" as never,
            params: {
              decision: verified.decision,
              reason: verified.reason ?? "",
              vehicleJson: JSON.stringify(verified.vehicle),
            },
          });
          return;
        }

        // Otherwise open confirmation sheet for officer inspection
        setConfirmationModalVisible(true);
      } else {
        // Fallback: could not read plate clearly
        try {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } catch {}

        Alert.alert(
          "Plate Not Clear",
          "Could not automatically detect plate text. Realign camera or enter manually.",
          [
            { text: "Try Again", style: "cancel" },
            {
              text: "Enter Manually",
              onPress: () => {
                setPlateInput("");
                setManualEntryVisible(true);
              },
            },
          ],
        );
      }
    } catch (e: any) {
      Alert.alert("ANPR Error", e?.message ?? "An error occurred during plate recognition.");
    } finally {
      setProcessing(false);
    }
  }

  // Pick photo from device gallery (testing / external camera)
  async function handlePickPhoto() {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.85,
        base64: true,
      });

      if (!result.canceled && result.assets[0]?.base64) {
        const base64Data = result.assets[0].base64;
        setCapturedImageBase64(base64Data);
        setProcessing(true);
        setProcessingMessage("Running ANPR recognition…");

        const anprResult = await gateApi.recognizeAnpr(base64Data);
        if (anprResult.detectedPlate) {
          setDetectedPlateText(anprResult.detectedPlate);
          setDetectedConfidence(Math.round(anprResult.confidence || 85));
          setConfirmationModalVisible(true);
        } else {
          Alert.alert("ANPR", "Could not detect a license plate in this image.");
        }
      }
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load photo");
    } finally {
      setProcessing(false);
    }
  }

  // Confirm and submit recognized plate
  async function handleConfirmPlate(plateToSubmit: string) {
    if (!plateToSubmit.trim()) {
      Alert.alert("Required", "Please provide a valid plate number.");
      return;
    }

    setConfirmationModalVisible(false);
    setManualEntryVisible(false);
    setProcessing(true);
    setProcessingMessage("Verifying plate authorization…");

    try {
      const result = await gateApi.scanPlate(
        plateToSubmit.trim().toUpperCase(),
        capturedImageBase64 ? `data:image/jpeg;base64,${capturedImageBase64}` : undefined,
      );

      router.push({
        pathname: "/(gate)/result" as never,
        params: {
          decision: result.decision,
          reason: result.reason ?? "",
          vehicleJson: JSON.stringify(result.vehicle),
          isOffline: "false",
        },
      });

      setPlateInput("");
      setCapturedImageBase64(null);
    } catch (e: any) {
      // Fallback to offline plate verification
      console.log("[GateScanner] Online plate verify failed, trying offline cache:", e?.message);
      try {
        const offlineRes = await offlineGate.verifyPlateOffline(plateToSubmit.trim().toUpperCase());
        const pending = await offlineGate.getPendingCount();
        setPendingOfflineLogs(pending);

        router.push({
          pathname: "/(gate)/result" as never,
          params: {
            decision: offlineRes.decision,
            reason: offlineRes.reason ?? "",
            vehicleJson: JSON.stringify(offlineRes.vehicle),
            isOffline: "true",
          },
        });
      } catch {
        Alert.alert("Lookup Failed", e?.message ?? "Could not verify vehicle plate");
      }
    } finally {
      setProcessing(false);
    }
  }

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#001229]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* ─── Top Header ─── */}
      <View className="px-5 pt-14 pb-3 flex-row items-center justify-between">
        <View>
          <Text className="text-white text-xl font-bold tracking-tight">Gate Authentication</Text>
          <Text className="text-amber-200/70 text-xs mt-0.5">
            {user?.name || "Campus Security Officer"} · Main Gate Barrier
          </Text>
        </View>
        <View className="flex-row gap-2">
          <Pressable
            onPress={() => router.push("/(gate)/log" as never)}
            className="bg-[#002147] border border-[#0d3366] rounded-full px-4 py-2 active:bg-[#001a38]"
          >
            <Text className="text-[#f5c542] text-xs font-bold">📋 Gate Log</Text>
          </Pressable>
          <Pressable
            onPress={signOut}
            className="bg-[#002147] border border-[#0d3366] rounded-full px-3 py-2 active:bg-[#001a38]"
          >
            <Text className="text-gray-300 text-xs font-semibold">⏻</Text>
          </Pressable>
        </View>
      </View>

      {/* ─── Offline Tolerance & Cache Bar ─── */}
      <View className="mx-5 mb-2.5 bg-[#001a38] border border-[#0d3366] rounded-xl px-3.5 py-2 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className={`w-2.5 h-2.5 rounded-full ${syncingOffline ? "bg-amber-400" : "bg-emerald-400"}`} />
          <Text className="text-gray-300 text-xs font-medium">
            Offline Cache: {cachedWhitelistCount} passes
            {pendingOfflineLogs > 0 ? ` · ⚠️ ${pendingOfflineLogs} pending sync` : ""}
          </Text>
        </View>

        <Pressable
          onPress={performCacheSync}
          disabled={syncingOffline}
          className="bg-[#002147] border border-[#0d3366] rounded-lg px-2.5 py-1 active:bg-[#001229]"
        >
          <Text className="text-[#f5c542] text-[11px] font-bold">
            {syncingOffline ? "Syncing…" : "↺ Sync"}
          </Text>
        </Pressable>
      </View>

      {/* ─── Mode Selector (QR Pass vs ANPR Plate) ─── */}
      <View className="flex-row mx-5 bg-[#001a38] border border-[#0d3366] rounded-2xl p-1 mb-3">
        <Pressable
          onPress={() => {
            setMode("qr");
            setScanning(true);
          }}
          className={`flex-1 py-3 rounded-xl items-center ${mode === "qr" ? "bg-[#d4af37]" : ""}`}
        >
          <Text
            className={`font-bold text-xs ${mode === "qr" ? "text-[#001229]" : "text-gray-400"}`}
          >
            📱 QR Pass Scan
          </Text>
        </Pressable>

        <Pressable
          onPress={() => {
            setMode("plate");
            setScanning(true);
          }}
          className={`flex-1 py-3 rounded-xl items-center ${mode === "plate" ? "bg-[#d4af37]" : ""}`}
        >
          <Text
            className={`font-bold text-xs ${mode === "plate" ? "text-[#001229]" : "text-gray-400"}`}
          >
            📷 ANPR Plate Camera
          </Text>
        </Pressable>
      </View>

      {/* ─── Viewfinder Area ─── */}
      <View className="flex-1 mx-5 mb-4 rounded-3xl overflow-hidden bg-black border border-[#0d3366] relative">
        {!permission?.granted ? (
          <View className="flex-1 items-center justify-center p-8 gap-4">
            <Text className="text-5xl mb-2">📷</Text>
            <Text className="text-white text-base font-bold text-center">
              Camera Permission Required
            </Text>
            <Text className="text-gray-400 text-xs text-center leading-relaxed">
              Camera access is required for real-time QR verification and Automatic Number Plate Recognition (ANPR).
            </Text>
            <Pressable
              onPress={requestPermission}
              className="bg-[#d4af37] rounded-xl px-6 py-3 mt-2 active:bg-[#b89628]"
            >
              <Text className="text-[#001229] font-bold text-sm">Grant Permission</Text>
            </Pressable>
          </View>
        ) : (
          <CameraView
            ref={cameraRef}
            style={{ flex: 1 }}
            facing="back"
            enableTorch={torchOn}
            onBarcodeScanned={mode === "qr" && scanning ? handleBarcodeScan : undefined}
            barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
          >
            {/* Viewfinder Overlays */}
            {mode === "qr" ? (
              <View className="flex-1 items-center justify-center">
                <View
                  style={{
                    width: 250,
                    height: 250,
                    borderRadius: 20,
                    borderWidth: 2,
                    borderColor: "#d4af37",
                    backgroundColor: "rgba(0, 0, 0, 0.15)",
                  }}
                />
                <Text className="text-[#f5c542] text-xs font-semibold mt-4 bg-black/60 px-4 py-1.5 rounded-full">
                  Align driver's QR pass inside box
                </Text>
              </View>
            ) : (
              /* ANPR License Plate Target Reticle */
              <View className="flex-1 items-center justify-center">
                {/* Plate Rectangular Target Box (3:1 aspect ratio) */}
                <View
                  style={{
                    width: "84%",
                    height: 110,
                    borderRadius: 14,
                    borderWidth: 2.5,
                    borderColor: "#10b981",
                    backgroundColor: "rgba(16, 185, 129, 0.08)",
                    position: "relative",
                    justifyContent: "center",
                    alignItems: "center",
                  }}
                >
                  {/* Corner Accent Brackets */}
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      left: -2,
                      width: 20,
                      height: 20,
                      borderTopWidth: 4,
                      borderLeftWidth: 4,
                      borderColor: "#d4af37",
                      borderTopLeftRadius: 12,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      top: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderTopWidth: 4,
                      borderRightWidth: 4,
                      borderColor: "#d4af37",
                      borderTopRightRadius: 12,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: -2,
                      left: -2,
                      width: 20,
                      height: 20,
                      borderBottomWidth: 4,
                      borderLeftWidth: 4,
                      borderColor: "#d4af37",
                      borderBottomLeftRadius: 12,
                    }}
                  />
                  <View
                    style={{
                      position: "absolute",
                      bottom: -2,
                      right: -2,
                      width: 20,
                      height: 20,
                      borderBottomWidth: 4,
                      borderRightWidth: 4,
                      borderColor: "#d4af37",
                      borderBottomRightRadius: 12,
                    }}
                  />

                  {/* Center Target Crosshair */}
                  <View className="flex-row items-center gap-2">
                    <Text className="text-[#10b981] text-xs font-mono tracking-widest font-black uppercase">
                      [ LICENSE PLATE ALIGNMENT ]
                    </Text>
                  </View>
                </View>

                <Text className="text-[#f5c542] text-xs font-semibold mt-4 bg-black/60 px-4 py-1.5 rounded-full">
                  Keep plate horizontal & well lit
                </Text>
              </View>
            )}

            {/* Quick Floating Camera Toolbar */}
            <View className="absolute top-4 right-4 flex-row gap-2">
              {/* Torch Toggle */}
              <Pressable
                onPress={() => setTorchOn((prev) => !prev)}
                className={`w-10 h-10 rounded-full items-center justify-center border ${
                  torchOn
                    ? "bg-[#d4af37] border-[#d4af37]"
                    : "bg-black/60 border-white/20"
                }`}
              >
                <Text className="text-base">{torchOn ? "🔦" : "💡"}</Text>
              </Pressable>

              {/* Photo Pick (ANPR mode) */}
              {mode === "plate" && (
                <Pressable
                  onPress={handlePickPhoto}
                  className="w-10 h-10 rounded-full items-center justify-center bg-black/60 border border-white/20"
                >
                  <Text className="text-base">🖼️</Text>
                </Pressable>
              )}
            </View>

            {/* Processing Radar Overlay */}
            {processing && (
              <View className="absolute inset-0 bg-black/75 items-center justify-center p-6 gap-3">
                <ActivityIndicator size="large" color="#d4af37" />
                <Text className="text-white text-base font-bold text-center">
                  {processingMessage}
                </Text>
                <Text className="text-amber-200/70 text-xs text-center">
                  Executing dual-channel vehicle authentication
                </Text>
              </View>
            )}
          </CameraView>
        )}
      </View>

      {/* ─── Bottom Actions for Plate ANPR ─── */}
      {mode === "plate" && (
        <View className="mx-5 mb-5 gap-2.5">
          {/* Main ANPR Trigger Button */}
          <Pressable
            onPress={handleCaptureAndRecognizePlate}
            disabled={!permission?.granted || processing}
            className="bg-[#d4af37] rounded-2xl py-4 items-center justify-center flex-row gap-2 active:bg-[#b89628] shadow-lg shadow-amber-500/20"
          >
            <Text className="text-xl">📸</Text>
            <Text className="text-[#001229] font-black text-base tracking-wide">
              CAPTURE & RECOGNIZE PLATE
            </Text>
          </Pressable>

          {/* Manual Entry Fallback Button */}
          <Pressable
            onPress={() => {
              setPlateInput("");
              setManualEntryVisible(true);
            }}
            disabled={processing}
            className="bg-[#002147] border border-[#0d3366] rounded-xl py-3 items-center active:bg-[#001a38]"
          >
            <Text className="text-gray-300 font-semibold text-xs">
              ⌨️ Enter Plate Number Manually
            </Text>
          </Pressable>
        </View>
      )}

      {/* ─── Modal 1: Confirmation & Inspection of Detected Plate ─── */}
      <Modal
        visible={confirmationModalVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setConfirmationModalVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#001a38] border-t-2 border-[#d4af37] rounded-t-3xl p-6">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-gray-600 rounded-full mb-3" />
              <Text className="text-white text-lg font-bold">ANPR Plate Detection</Text>
              <Text className="text-gray-400 text-xs mt-0.5">
                Verify detected license plate before granting entry
              </Text>
            </View>

            {/* Confidence Badge */}
            <View className="flex-row justify-center mb-4">
              <View className="bg-emerald-950/80 border border-emerald-500/40 rounded-full px-3 py-1 flex-row items-center gap-1.5">
                <Text className="text-emerald-400 text-xs font-bold">
                  ✓ {detectedConfidence}% Recognition Confidence
                </Text>
              </View>
            </View>

            {/* Editable Plate Preview */}
            <View className="bg-[#001229] border border-[#0d3366] rounded-2xl p-4 mb-5 items-center">
              <Text className="text-gray-400 text-xs mb-2">Detected Plate Number</Text>
              <TextInput
                value={detectedPlateText}
                onChangeText={(t) => setDetectedPlateText(t.toUpperCase())}
                autoCapitalize="characters"
                autoCorrect={false}
                className="bg-white text-gray-900 text-center text-3xl font-black tracking-widest rounded-xl px-5 py-3 w-full border-2 border-[#d4af37]"
              />
              <Text className="text-gray-500 text-[11px] mt-2">
                Tap text above to edit if any character was misread
              </Text>
            </View>

            {/* Action buttons */}
            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setConfirmationModalVisible(false)}
                className="flex-1 bg-[#002147] border border-[#0d3366] rounded-xl py-3.5 items-center"
              >
                <Text className="text-gray-300 font-bold text-sm">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => handleConfirmPlate(detectedPlateText)}
                className="flex-1 bg-[#d4af37] rounded-xl py-3.5 items-center active:bg-[#b89628]"
              >
                <Text className="text-[#001229] font-black text-sm">VERIFY & PROCEED →</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Modal 2: Manual Plate Input Sheet ─── */}
      <Modal
        visible={manualEntryVisible}
        transparent
        animationType="slide"
        onRequestClose={() => setManualEntryVisible(false)}
      >
        <View className="flex-1 bg-black/80 justify-end">
          <View className="bg-[#001a38] border-t-2 border-[#d4af37] rounded-t-3xl p-6">
            <View className="items-center mb-4">
              <View className="w-12 h-1.5 bg-gray-600 rounded-full mb-3" />
              <Text className="text-white text-lg font-bold">Manual Plate Lookup</Text>
              <Text className="text-gray-400 text-xs mt-0.5">
                Type vehicle plate number for fallback verification
              </Text>
            </View>

            <TextInput
              placeholder="e.g. ABC 123 XY"
              placeholderTextColor="#64748b"
              value={plateInput}
              onChangeText={(t) => setPlateInput(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              autoFocus
              className="bg-white text-gray-900 text-center text-3xl font-black tracking-widest rounded-2xl px-5 py-4 w-full border-2 border-[#d4af37] mb-5"
            />

            <View className="flex-row gap-3">
              <Pressable
                onPress={() => setManualEntryVisible(false)}
                className="flex-1 bg-[#002147] border border-[#0d3366] rounded-xl py-3.5 items-center"
              >
                <Text className="text-gray-300 font-bold text-sm">Cancel</Text>
              </Pressable>

              <Pressable
                onPress={() => handleConfirmPlate(plateInput)}
                disabled={!plateInput.trim()}
                className="flex-1 bg-[#d4af37] rounded-xl py-3.5 items-center active:bg-[#b89628]"
              >
                <Text className="text-[#001229] font-black text-sm">LOOKUP VEHICLE →</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}
