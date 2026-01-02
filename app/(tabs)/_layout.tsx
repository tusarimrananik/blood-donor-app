import { Tabs } from 'expo-router';
import React from 'react';
import { Text } from 'react-native';

export default function TabLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }}>
      <Tabs.Screen
        name="index"
        options={{ title: 'Find', tabBarIcon: () => <Text>🔎</Text> }}
      />
      <Tabs.Screen
        name="donor"
        options={{ title: 'Donor', tabBarIcon: () => <Text>🩸</Text> }}
      />
      <Tabs.Screen
        name="requests"
        options={{ title: 'Requests', tabBarIcon: () => <Text>📩</Text> }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: () => <Text>👤</Text> }}
      />
    </Tabs>
  );
}
