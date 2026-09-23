import { Tabs } from "expo-router";
import { Text } from "react-native";

function TabIcon({ emoji, focused }: { emoji: string; focused: boolean }) {
  return (
    <Text
      style={{ fontSize: 22, opacity: focused ? 1 : 0.5 }}
    >
      {emoji}
    </Text>
  );
}

export default function DriverLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarStyle: {
          backgroundColor: "#111827",
          borderTopColor: "#1f2937",
          paddingBottom: 6,
          paddingTop: 6,
          height: 62,
        },
        tabBarActiveTintColor: "#10b981",
        tabBarInactiveTintColor: "#6b7280",
        tabBarLabelStyle: { fontSize: 11, fontWeight: "600" },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vehicles/index"
        options={{
          title: "My Vehicles",
          tabBarIcon: ({ focused }) => <TabIcon emoji="🚗" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="pass/index"
        options={{
          title: "QR Pass",
          tabBarIcon: ({ focused }) => <TabIcon emoji="📱" focused={focused} />,
        }}
      />
      <Tabs.Screen
        name="vehicles/register"
        options={{ href: null }} // hidden from tab bar, accessed via button
      />
    </Tabs>
  );
}
