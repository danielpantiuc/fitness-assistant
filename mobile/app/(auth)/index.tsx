import React, { useState } from 'react';
import {
    View, Text, TextInput, TouchableOpacity,
    StyleSheet, ActivityIndicator, Alert,
    KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import { login, register, getProfile } from '../../src/api/client';
import { useAuth } from '../../src/context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import LogoIcon from '../../assets/icons/logo.svg';

export default function LoginScreen() {
    const router = useRouter();
    const { signIn } = useAuth();

    const [isRegister, setIsRegister] = useState(false);

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const [username, setUsername] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [loading, setLoading] = useState(false);

    const resetForm = () => {
        setEmail('');
        setPassword('');
        setUsername('');
        setConfirmPassword('');
    };

    const handleSubmit = async () => {
        if (!email || !password) {
            return Alert.alert('Error', 'Email and password are required.');
        }

        if (isRegister) {
            if (!username.trim() || username.trim().length < 2) {
                return Alert.alert('Error', 'Username must be at least 2 characters.');
            }
            if (password.length < 6) {
                return Alert.alert('Error', 'Password must be at least 6 characters.');
            }
            if (password !== confirmPassword) {
                return Alert.alert('Passwords do not match', 'Please make sure both passwords are identical.');
            }
        }

        setLoading(true);
        try {
            if (isRegister) {
                await register(email.trim(), password, username.trim());
                await login(email.trim(), password);
                signIn(email.trim(), username.trim());
            } else {
                await login(email.trim(), password);
                const profile = await getProfile();
                signIn(profile.email, profile.username);
            }
            router.replace('/home');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || err.response?.data?.message || 'Something went wrong');
        } finally {
            setLoading(false);
        }
    };

    const toggleMode = () => {
        setIsRegister(!isRegister);
        resetForm();
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.card}>
                    {/* Logo */}
                    <View style={{ alignItems: 'center', marginBottom: 16, marginTop: 4 }}>
                        <LogoIcon width={96} height={96} />
                    </View>
                    <Text style={styles.appName}>SBD Assist</Text>
                    <Text style={styles.tagline}>AI-powered form analysis</Text>

                    <View style={styles.divider} />

                    <Text style={styles.title}>
                        {isRegister ? 'Create Account' : 'Sign In'}
                    </Text>

                    {/* Username — register only */}
                    {isRegister && (
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Username</Text>
                            <TextInput
                                style={styles.input}
                                placeholder=""
                                placeholderTextColor="#475569"
                                value={username}
                                onChangeText={setUsername}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                        </View>
                    )}

                    {/* Email */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Email</Text>
                        <TextInput
                            style={styles.input}
                            placeholder=""
                            placeholderTextColor="#475569"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                            autoCorrect={false}
                        />
                    </View>

                    {/* Password */}
                    <View style={styles.fieldGroup}>
                        <Text style={styles.label}>Password</Text>
                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder=""
                                placeholderTextColor="#475569"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                            />
                            <TouchableOpacity
                                style={styles.eyeIcon}
                                onPressIn={() => setShowPassword(true)}
                                onPressOut={() => setShowPassword(false)}
                            >
                                <Ionicons name={showPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                            </TouchableOpacity>
                        </View>
                    </View>

                    {/* Confirm password — register only */}
                    {isRegister && (
                        <View style={styles.fieldGroup}>
                            <Text style={styles.label}>Confirm Password</Text>
                            <View style={[
                                styles.passwordContainer,
                                confirmPassword.length > 0 && password !== confirmPassword ? styles.inputError : null
                            ]}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder=""
                                    placeholderTextColor="#475569"
                                    value={confirmPassword}
                                    onChangeText={setConfirmPassword}
                                    secureTextEntry={!showConfirmPassword}
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPressIn={() => setShowConfirmPassword(true)}
                                    onPressOut={() => setShowConfirmPassword(false)}
                                >
                                    <Ionicons name={showConfirmPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            {confirmPassword.length > 0 && password !== confirmPassword && (
                                <Text style={styles.errorHint}>Passwords do not match</Text>
                            )}
                        </View>
                    )}

                    {/* Submit */}
                    <TouchableOpacity
                        style={[styles.button, loading && styles.buttonDisabled]}
                        onPress={handleSubmit}
                        disabled={loading}
                    >
                        {loading
                            ? <ActivityIndicator color="#fff" />
                            : <Text style={styles.buttonText}>
                                {isRegister ? 'Create Account' : 'Sign In'}
                            </Text>
                        }
                    </TouchableOpacity>

                    {/* Toggle */}
                    <TouchableOpacity onPress={toggleMode} style={styles.toggleRow}>
                        <Text style={styles.toggle}>
                            {isRegister
                                ? 'Already have an account? '
                                : "Don't have an account? "}
                            <Text style={styles.toggleHighlight}>
                                {isRegister ? 'Sign In' : 'Register'}
                            </Text>
                        </Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    scrollContent: { flexGrow: 1, justifyContent: 'center', padding: 24 },

    card: {
        backgroundColor: '#1e293b', borderRadius: 24,
        padding: 28, borderWidth: 1, borderColor: '#334155',
    },

    appName: { color: '#6366f1', fontSize: 24, fontWeight: '800', textAlign: 'center' },
    tagline: { color: '#64748b', fontSize: 13, textAlign: 'center', marginBottom: 24 },

    divider: { height: 1, backgroundColor: '#334155', marginBottom: 24 },

    title: { color: '#f1f5f9', fontSize: 20, fontWeight: '700', marginBottom: 20 },

    fieldGroup: { marginBottom: 14 },
    label: { color: '#94a3b8', fontSize: 12, fontWeight: '600', marginBottom: 6, letterSpacing: 0.5 },
    input: {
        backgroundColor: '#0f172a', color: '#f1f5f9', borderRadius: 10,
        padding: 13, fontSize: 15, borderWidth: 1, borderColor: '#334155',
    },
    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#0f172a',
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#334155',
    },
    passwordInput: {
        flex: 1,
        color: '#f1f5f9',
        padding: 13,
        fontSize: 15,
    },
    eyeIcon: {
        padding: 13,
    },
    inputError: { borderColor: '#ef4444' },
    errorHint: { color: '#ef4444', fontSize: 12, marginTop: 4 },

    button: {
        backgroundColor: '#6366f1', borderRadius: 12,
        padding: 15, alignItems: 'center', marginTop: 8,
    },
    buttonDisabled: { backgroundColor: '#334155' },
    buttonText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    toggleRow: { marginTop: 20, alignItems: 'center' },
    toggle: { color: '#64748b', fontSize: 13 },
    toggleHighlight: { color: '#818cf8', fontWeight: '700' },
});
