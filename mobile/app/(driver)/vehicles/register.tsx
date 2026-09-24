import {
  vehiclesApi,
  type VehicleCategory,
  type RegisterVehicleData,
} from "@/lib/api";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import * as ImagePicker from "expo-image-picker";

// ─── Types ────────────────────────────────────────────────────────────────────

type DocumentType = "id" | "proof_of_ownership" | "other";

interface DocPhoto {
  type: DocumentType;
  uri: string;
  base64?: string;
}

const CATEGORIES: { value: VehicleCategory; label: string; emoji: string }[] = [
  { value: "staff", label: "Staff", emoji: "👔" },
  { value: "student", label: "Student", emoji: "🎓" },
  { value: "visitor", label: "Visitor", emoji: "🤝" },
  { value: "commercial", label: "Along Bus", emoji: "🚌" },
];

const DOC_TYPES: { value: DocumentType; label: string; hint: string }[] = [
  {
    value: "id",
    label: "Government-issued ID",
    hint: "NIN slip, driver's licence, passport",
  },
  {
    value: "proof_of_ownership",
    label: "Proof of Ownership",
    hint: "Vehicle registration doc / roadworthiness cert",
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function StepIndicator({ current, total }: { current: number; total: number }) {
  return (
    <View className="flex-row items-center gap-2 mb-6">
      {Array.from({ length: total }).map((_, i) => (
        <View
          key={i}
          className={`h-1.5 rounded-full flex-1 ${i < current ? "bg-[#d4af37]" : i === current ? "bg-[#f5c542]" : "bg-[#0d3366]"}`}
        />
      ))}
    </View>
  );
}

function FieldLabel({ children }: { children: string }) {
  return (
    <Text className="text-gray-400 text-sm font-medium mb-2">{children}</Text>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  autoCapitalize = "none",
  keyboardType = "default",
}: {
  label: string;
  value: string;
  onChangeText: (v: string) => void;
  placeholder?: string;
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  keyboardType?: "default" | "phone-pad";
}) {
  return (
    <View className="mb-4">
      <FieldLabel>{label}</FieldLabel>
      <TextInput
        className="bg-[#001633] text-white rounded-xl px-4 py-3.5 text-base border border-[#0d3366]"
        placeholder={placeholder}
        placeholderTextColor="#64748b"
        value={value}
        onChangeText={onChangeText}
        autoCapitalize={autoCapitalize}
        keyboardType={keyboardType}
      />
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function RegisterVehicleScreen() {
  const router = useRouter();
  const [step, setStep] = useState(0); // 0=vehicle 1=owner 2=docs 3=review

  // Step 0 — Vehicle
  const [plateNumber, setPlateNumber] = useState("");
  const [category, setCategory] = useState<VehicleCategory>("staff");
  const [make, setMake] = useState("");
  const [model, setModel] = useState("");
  const [color, setColor] = useState("");

  // Step 1 — Owner
  const [ownerName, setOwnerName] = useState("");
  const [ownerContact, setOwnerContact] = useState("");

  // Step 2 — Docs
  const [docs, setDocs] = useState<DocPhoto[]>([]);

  const [loading, setLoading] = useState(false);

  // ─── Navigation ─────────────────────────────────────────────────────────────

  function validateStep() {
    if (step === 0 && !plateNumber.trim()) {
      Alert.alert("Required", "Please enter the plate number");
      return false;
    }
    if (step === 1 && (!ownerName.trim() || !ownerContact.trim())) {
      Alert.alert("Required", "Please fill in owner name and contact");
      return false;
    }
    return true;
  }

  function nextStep() {
    if (!validateStep()) return;
    setStep((s) => Math.min(s + 1, 3));
  }

  // ─── Photo picker ────────────────────────────────────────────────────────────

  async function pickPhoto(type: DocumentType) {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission needed", "Please allow photo library access");
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 0.6,
      base64: true,
    });
    if (!result.canceled && result.assets[0]) {
      const asset = result.assets[0];
      setDocs((prev) => [
        ...prev.filter((d) => d.type !== type),
        { type, uri: asset.uri, base64: asset.base64 ?? undefined },
      ]);
    }
  }

  // ─── Submit ──────────────────────────────────────────────────────────────────

  async function handleSubmit() {
    setLoading(true);
    try {
      const payload: RegisterVehicleData = {
        plateNumber: plateNumber.toUpperCase().trim(),
        category,
        make: make.trim() || undefined,
        model: model.trim() || undefined,
        color: color.trim() || undefined,
        ownerName: ownerName.trim(),
        ownerContact: ownerContact.trim(),
        documents: docs.map((d) => ({
          type: d.type,
          fileUrl: d.base64 ? `data:image/jpeg;base64,${d.base64}` : d.uri,
        })),
      };
      await vehiclesApi.register(payload);
      Alert.alert(
        "Registration Submitted! 🎉",
        "Your vehicle has been submitted for review. You will be notified once approved.",
        [{ text: "OK", onPress: () => router.replace("/(driver)/" as never) }],
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Failed to register vehicle");
    } finally {
      setLoading(false);
    }
  }

  // ─── Render steps ────────────────────────────────────────────────────────────

  const STEP_TITLES = [
    "Vehicle Details",
    "Owner Information",
    "Supporting Photos",
    "Review & Submit",
  ];

  return (
    <KeyboardAvoidingView
      className="flex-1 bg-[#001633]"
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      {/* Top bar */}
      <View className="px-5 pt-14 pb-3 flex-row items-center gap-4">
        <Pressable
          onPress={() => (step === 0 ? router.back() : setStep((s) => s - 1))}
          className="w-9 h-9 rounded-full bg-[#002147] border border-[#0d3366] items-center justify-center"
        >
          <Text className="text-white text-lg">←</Text>
        </Pressable>
        <View className="flex-1">
          <Text className="text-white font-bold text-lg">
            {STEP_TITLES[step]}
          </Text>
          <Text className="text-amber-200/70 text-xs">
            Step {step + 1} of {STEP_TITLES.length}
          </Text>
        </View>
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="px-5 pb-16"
        keyboardShouldPersistTaps="handled"
      >
        <StepIndicator current={step} total={STEP_TITLES.length} />

        {/* STEP 0 — Vehicle */}
        {step === 0 && (
          <View>
            <Field
              label="Plate Number *"
              value={plateNumber}
              onChangeText={setPlateNumber}
              placeholder="e.g. ABC 123 XY"
              autoCapitalize="characters"
            />

            <View className="mb-4">
              <FieldLabel>Vehicle Category *</FieldLabel>
              <View className="flex-row flex-wrap gap-3">
                {CATEGORIES.map((cat) => (
                  <TouchableOpacity
                    key={cat.value}
                    onPress={() => setCategory(cat.value)}
                    className={`flex-row items-center gap-2 px-4 py-3 rounded-xl border-2 ${
                      category === cat.value
                        ? "border-[#d4af37] bg-[#002147]"
                        : "border-[#0d3366] bg-[#001a38]"
                    }`}
                  >
                    <Text>{cat.emoji}</Text>
                    <Text
                      className={`font-semibold text-sm ${
                        category === cat.value
                          ? "text-[#f5c542]"
                          : "text-gray-300"
                      }`}
                    >
                      {cat.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <Field
              label="Make (optional)"
              value={make}
              onChangeText={setMake}
              placeholder="e.g. Toyota"
              autoCapitalize="words"
            />
            <Field
              label="Model (optional)"
              value={model}
              onChangeText={setModel}
              placeholder="e.g. Camry"
              autoCapitalize="words"
            />
            <Field
              label="Color (optional)"
              value={color}
              onChangeText={setColor}
              placeholder="e.g. White"
              autoCapitalize="words"
            />
          </View>
        )}

        {/* STEP 1 — Owner */}
        {step === 1 && (
          <View>
            <Field
              label="Full Name *"
              value={ownerName}
              onChangeText={setOwnerName}
              placeholder="Name as on ID"
              autoCapitalize="words"
            />
            <Field
              label="Phone Number *"
              value={ownerContact}
              onChangeText={setOwnerContact}
              placeholder="+234 800 000 0000"
              keyboardType="phone-pad"
            />
          </View>
        )}

        {/* STEP 2 — Documents */}
        {step === 2 && (
          <View>
            <Text className="text-gray-300 text-sm mb-5">
              Please provide photos of the following documents. This helps us
              verify your registration.
            </Text>
            {DOC_TYPES.map((dt) => {
              const picked = docs.find((d) => d.type === dt.value);
              return (
                <View
                  key={dt.value}
                  className="bg-[#002147] border border-[#0d3366] rounded-2xl p-4 mb-4"
                >
                  <Text className="text-white font-semibold text-sm mb-1">
                    {dt.label}
                  </Text>
                  <Text className="text-gray-400 text-xs mb-3">{dt.hint}</Text>
                  {picked ? (
                    <View>
                      <Image
                        source={{ uri: picked.uri }}
                        className="w-full h-44 rounded-xl"
                        resizeMode="cover"
                      />
                      <Pressable
                        onPress={() => pickPhoto(dt.value)}
                        className="mt-2 py-2 items-center"
                      >
                        <Text className="text-[#f5c542] text-sm">Retake</Text>
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable
                      onPress={() => pickPhoto(dt.value)}
                      className="border-2 border-dashed border-[#d4af37]/35 rounded-xl h-32 items-center justify-center bg-[#001a38]"
                    >
                      <Text className="text-3xl mb-1">📷</Text>
                      <Text className="text-gray-400 text-sm">
                        Tap to choose photo
                      </Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* STEP 3 — Review */}
        {step === 3 && (
          <View>
            <Text className="text-gray-300 text-sm mb-5">
              Please review your details before submitting.
            </Text>

            {/* Vehicle summary */}
            <View className="bg-[#002147] border border-[#0d3366] rounded-2xl p-4 mb-4">
              <Text className="text-[#f5c542] text-xs font-semibold uppercase mb-3">
                Vehicle
              </Text>
              <SummaryRow label="Plate" value={plateNumber.toUpperCase()} />
              <SummaryRow label="Category" value={category} />
              {make && <SummaryRow label="Make" value={make} />}
              {model && <SummaryRow label="Model" value={model} />}
              {color && <SummaryRow label="Color" value={color} />}
            </View>

            <View className="bg-[#002147] border border-[#0d3366] rounded-2xl p-4 mb-4">
              <Text className="text-[#f5c542] text-xs font-semibold uppercase mb-3">
                Owner
              </Text>
              <SummaryRow label="Name" value={ownerName} />
              <SummaryRow label="Contact" value={ownerContact} />
            </View>

            <View className="bg-[#002147] border border-[#0d3366] rounded-2xl p-4 mb-6">
              <Text className="text-[#f5c542] text-xs font-semibold uppercase mb-3">
                Documents
              </Text>
              {docs.length === 0 ? (
                <Text className="text-gray-500 text-sm">
                  No documents uploaded
                </Text>
              ) : (
                docs.map((d) => (
                  <Text
                    key={d.type}
                    className="text-gray-300 text-sm capitalize mb-1"
                  >
                    ✓ {d.type.replace(/_/g, " ")}
                  </Text>
                ))
              )}
            </View>

            <Pressable
              onPress={handleSubmit}
              disabled={loading}
              className="bg-[#d4af37] rounded-2xl py-4 items-center active:bg-[#b89628]"
            >
              {loading ? (
                <ActivityIndicator color="#001633" />
              ) : (
                <Text className="text-[#001633] font-bold text-base">
                  Submit Registration
                </Text>
              )}
            </Pressable>
          </View>
        )}

        {/* Next button (not on review step) */}
        {step < 3 && (
          <Pressable
            onPress={nextStep}
            className="bg-[#d4af37] rounded-2xl py-4 items-center mt-6 active:bg-[#b89628]"
          >
            <Text className="text-[#001633] font-bold text-base">Continue →</Text>
          </Pressable>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between mb-2">
      <Text className="text-gray-500 text-sm">{label}</Text>
      <Text className="text-white text-sm capitalize font-medium">{value}</Text>
    </View>
  );
}
