import { Stack } from "expo-router";

export default function GateLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
        contentStyle: { backgroundColor: "#001633" },
      }}
    />
  );
}
