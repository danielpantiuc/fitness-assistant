import { Stack } from 'expo-router';
import { AuthProvider } from '../src/context/AuthContext';

export default function RootLayout() {
    return (
        <AuthProvider>
            <Stack screenOptions={{ headerShown: false }}>
                <Stack.Screen name="(auth)/index" options={{ gestureEnabled: false }} />
                <Stack.Screen name="home" options={{ gestureEnabled: false }} />
            </Stack>
        </AuthProvider>
    );
}
