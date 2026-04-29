import 'react-native-gesture-handler';
import { useState, useEffect, useRef } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { subscribeToAuth } from './src/firebase/authService';
import { auth } from './src/firebase/config';
import {
  subscribeToIncomingCalls,
  cleanupStaleCalls,
} from './src/livekit/signaling';
import { colors } from './src/theme';

import AuthScreen from './src/screens/AuthScreen';
import MainScreen from './src/screens/MainScreen';
import ChatScreen from './src/screens/ChatScreen';
import ContactsScreen from './src/screens/ContactsScreen';
import VoiceCallScreen from './src/screens/VoiceCallScreen';
import VideoCallScreen from './src/screens/VideoCallScreen';
import IncomingCallScreen from './src/screens/IncomingCallScreen';

const Stack = createNativeStackNavigator();
const navigationRef = { current: null };

export default function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const handledCallId = useRef(null);

  useEffect(() => {
    const unsubscribe = subscribeToAuth((u) => {
      setUser(u);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Глобальный слушатель входящих звонков
  useEffect(() => {
    if (!user) return;

    // Чистим зависшие исходящие звонки при старте
    cleanupStaleCalls(user.uid).catch(() => {});

    const unsubCalls = subscribeToIncomingCalls(user.uid, (call) => {
      if (!call) return;
      // Не показывать одно и то же дважды
      if (handledCallId.current === call.id) return;
      handledCallId.current = call.id;

      // Показать экран входящего
      if (navigationRef.current) {
        navigationRef.current.navigate('IncomingCall', {
          callId: call.id,
          fromUid: call.from,
          fromName: call.fromName,
          type: call.type,
        });
      }
    });

    return unsubCalls;
  }, [user]);

  if (loading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.bg,
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <NavigationContainer
        ref={(r) => (navigationRef.current = r)}
        theme={{
          dark: true,
          colors: {
            primary: colors.accent,
            background: colors.bg,
            card: colors.bg,
            text: colors.text,
            border: colors.border,
            notification: colors.danger,
          },
        }}
      >
        <StatusBar style="light" />
        <Stack.Navigator
          screenOptions={{
            headerShown: false,
            animation: 'slide_from_right',
            contentStyle: { backgroundColor: colors.bg },
          }}
        >
          {user ? (
            <>
              <Stack.Screen name="Main" component={MainScreen} />
              <Stack.Screen name="Chat" component={ChatScreen} />
              <Stack.Screen name="Contacts" component={ContactsScreen} />
              <Stack.Screen
                name="VoiceCall"
                component={VoiceCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
              />
              <Stack.Screen
                name="VideoCall"
                component={VideoCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
              />
              <Stack.Screen
                name="IncomingCall"
                component={IncomingCallScreen}
                options={{ animation: 'slide_from_bottom', gestureEnabled: false }}
              />
            </>
          ) : (
            <Stack.Screen
              name="Auth"
              component={AuthScreen}
              options={{ animation: 'fade' }}
            />
          )}
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}
