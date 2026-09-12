import React, { useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, Alert, TextInput, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../../src/context/AuthContext';
import { changeName, changePassword } from '../../src/api/client';

export default function ProfileScreen() {
    const router = useRouter();
    const { signOut, userEmail, username, setUsername } = useAuth();

    const [showNameForm, setShowNameForm] = useState(false);
    const [newName, setNewName] = useState(''); 
    const [nameLoading, setNameLoading] = useState(false);

    const [showPasswordForm, setShowPasswordForm] = useState(false);
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');

    const [showCurrentPassword, setShowCurrentPassword] = useState(false);
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const [passwordLoading, setPasswordLoading] = useState(false);

    const handleChangeName = async () => {
        if (!newName.trim() || newName.trim().length < 2) {
            return Alert.alert('Invalid username', 'Username must be at least 2 characters.');
        }
        setNameLoading(true);
        try {
            await changeName(newName.trim());
            setUsername(newName.trim()); 
            Alert.alert('Success', 'Your username has been updated.');
            setShowNameForm(false);
            setNewName('');
        } catch (err: any) {
            Alert.alert('Error', err.response?.data?.detail || 'Could not update username.');
        } finally {
            setNameLoading(false);
        }
    };

    const handleChangePassword = async () => {
        if (!currentPassword || !newPassword || !confirmPassword) {
            return Alert.alert('Missing fields', 'Please fill in all password fields.');
        }
        if (newPassword !== confirmPassword) {
            return Alert.alert('Mismatch', 'New passwords do not match.');
        }
        setPasswordLoading(true);
        try {
            await changePassword(currentPassword, newPassword);
            Alert.alert('Success', 'Password changed. Please log in again.', [
                { text: 'OK', onPress: handleSignOut },
            ]);
        } catch (err: any) {
            const msg = err.response?.data?.detail || err.response?.data?.message || 'Could not change password.';
            Alert.alert('Error', msg);
        } finally {
            setPasswordLoading(false);
        }
    };

    const handleSignOut = () => signOut();

    const confirmSignOut = () => {
        Alert.alert('Sign out', 'Are you sure you want to sign out?', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Sign out', style: 'destructive', onPress: handleSignOut },
        ]);
    };

    return (
        <View style={styles.container}>
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

                {/* Header */}
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 28 }}>
                    <TouchableOpacity style={[styles.backBtn, { marginBottom: 0 }]} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                    </TouchableOpacity>
                    <Text style={{ color: '#f1f5f9', fontSize: 22, fontWeight: '800', marginLeft: 16 }}>
                        Profile Settings
                    </Text>
                </View>

                {/* Profile card */}
                <View style={styles.profileCard}>
                    <View style={styles.avatarContainer}>
                        <View style={styles.avatarCircle}>
                            <Text style={styles.avatarLetter}>
                                {username ? username[0].toUpperCase() : userEmail ? userEmail[0].toUpperCase() : '?'}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.profileTextContainer}>
                        <Text style={styles.profileName}>{username ?? 'User'}</Text>
                        <Text style={styles.profileEmail}>{userEmail}</Text>
                    </View>
                </View>

                {/* ── Change Name ─────────────────────────────── */}
                <Text style={styles.sectionTitle}>ACCOUNT</Text>
                <View style={styles.sectionCard}>

                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => { setShowNameForm(!showNameForm); setShowPasswordForm(false); }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.rowIcon, { backgroundColor: 'rgba(99, 102, 241, 0.15)' }]}>
                            <Ionicons name="person-outline" size={18} color="#818cf8" />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowLabel}>Change Username</Text>
                            <Text style={styles.rowSublabel}>Update your display username</Text>
                        </View>
                        <Ionicons name={showNameForm ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {showNameForm && (
                        <View style={styles.inlineForm}>
                            <TextInput
                                style={styles.input}
                                placeholder="New username"
                                placeholderTextColor="#475569"
                                value={newName}
                                onChangeText={setNewName}
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={[styles.formBtn, nameLoading && styles.formBtnDisabled]}
                                onPress={handleChangeName}
                                disabled={nameLoading}
                            >
                                {nameLoading
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.formBtnText}>Save name</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    )}

                    <View style={styles.separator} />

                    {/* ── Change Password ─────────────────────────── */}
                    <TouchableOpacity
                        style={styles.row}
                        onPress={() => { setShowPasswordForm(!showPasswordForm); setShowNameForm(false); }}
                        activeOpacity={0.7}
                    >
                        <View style={[styles.rowIcon, { backgroundColor: 'rgba(14, 165, 233, 0.15)' }]}>
                            <Ionicons name="lock-closed-outline" size={18} color="#38bdf8" />
                        </View>
                        <View style={styles.rowText}>
                            <Text style={styles.rowLabel}>Change Password</Text>
                            <Text style={styles.rowSublabel}>Update your account password</Text>
                        </View>
                        <Ionicons name={showPasswordForm ? 'chevron-up' : 'chevron-down'} size={20} color="#94a3b8" />
                    </TouchableOpacity>

                    {showPasswordForm && (
                        <View style={styles.inlineForm}>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Current password"
                                    placeholderTextColor="#475569"
                                    value={currentPassword}
                                    onChangeText={setCurrentPassword}
                                    secureTextEntry={!showCurrentPassword}
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPressIn={() => setShowCurrentPassword(true)}
                                    onPressOut={() => setShowCurrentPassword(false)}
                                >
                                    <Ionicons name={showCurrentPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="New password"
                                    placeholderTextColor="#475569"
                                    value={newPassword}
                                    onChangeText={setNewPassword}
                                    secureTextEntry={!showNewPassword}
                                />
                                <TouchableOpacity
                                    style={styles.eyeIcon}
                                    onPressIn={() => setShowNewPassword(true)}
                                    onPressOut={() => setShowNewPassword(false)}
                                >
                                    <Ionicons name={showNewPassword ? "eye" : "eye-off"} size={20} color="#94a3b8" />
                                </TouchableOpacity>
                            </View>
                            <View style={styles.passwordContainer}>
                                <TextInput
                                    style={styles.passwordInput}
                                    placeholder="Confirm new password"
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
                            <TouchableOpacity
                                style={[styles.formBtn, { backgroundColor: '#0ea5e9' }, passwordLoading && styles.formBtnDisabled]}
                                onPress={handleChangePassword}
                                disabled={passwordLoading}
                            >
                                {passwordLoading
                                    ? <ActivityIndicator color="#fff" size="small" />
                                    : <Text style={styles.formBtnText}>Change password</Text>
                                }
                            </TouchableOpacity>
                        </View>
                    )}
                </View>

                {/* ── Sign Out ─────────────────────────────────── */}
                <Text style={[styles.sectionTitle, { marginTop: 24 }]}>SESSION</Text>
                <View style={styles.sectionCard}>
                    <TouchableOpacity style={styles.row} onPress={confirmSignOut} activeOpacity={0.7}>
                        <View style={[styles.rowIcon, { backgroundColor: 'rgba(239, 68, 68, 0.12)' }]}>
                            <Ionicons name="log-out-outline" size={20} color="#ef4444" />
                        </View>
                        <View style={[styles.rowText, { justifyContent: 'center' }]}>
                            <Text style={[styles.rowLabel, { color: '#ef4444', fontWeight: '700' }]}>Sign Out</Text>
                        </View>
                    </TouchableOpacity>
                </View>

                <Text style={styles.versionText}>SBD Assist • AI-powered Form Analysis</Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 24, paddingTop: 56, paddingBottom: 48 },

    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#334155',
        padding: 8,
        borderRadius: 20,
        marginBottom: 28,
        alignSelf: 'flex-start',
    },

    profileCard: {
        flexDirection: 'row', alignItems: 'center', gap: 16,
        backgroundColor: '#1e293b', borderRadius: 20, padding: 20,
        marginBottom: 28, borderWidth: 1, borderColor: '#334155',
    },
    avatarContainer: {
        position: 'relative',
    },
    avatarCircle: {
        width: 56, height: 56, borderRadius: 28,
        backgroundColor: '#6366f1', justifyContent: 'center', alignItems: 'center',
        borderWidth: 2, borderColor: 'rgba(99, 102, 241, 0.4)',
    },
    avatarLetter: { color: '#fff', fontSize: 24, fontWeight: '800' },
    profileTextContainer: { flex: 1, gap: 4, justifyContent: 'center' },
    profileName: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },
    profileEmail: { color: '#94a3b8', fontSize: 14, fontWeight: '500' },

    sectionTitle: {
        color: '#475569', fontSize: 11, fontWeight: '700',
        letterSpacing: 1.2, marginBottom: 8, paddingHorizontal: 4,
    },
    sectionCard: {
        backgroundColor: '#1e293b', borderRadius: 16,
        borderWidth: 1, borderColor: '#334155', overflow: 'hidden',
    },

    row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
    rowIcon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
    rowText: { flex: 1 },
    rowLabel: { color: '#f1f5f9', fontSize: 15, fontWeight: '600' },
    rowSublabel: { color: '#64748b', fontSize: 12, marginTop: 1 },
    separator: { height: 1, backgroundColor: '#0f172a', marginHorizontal: 16 },

    inlineForm: { paddingHorizontal: 16, paddingBottom: 16, gap: 10 },
    input: {
        backgroundColor: '#0f172a', color: '#f1f5f9', borderRadius: 10,
        padding: 13, fontSize: 14, borderWidth: 1, borderColor: '#334155',
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
        fontSize: 14,
    },
    eyeIcon: {
        padding: 13,
    },
    formBtn: {
        backgroundColor: '#6366f1', borderRadius: 10,
        padding: 13, alignItems: 'center',
    },
    formBtnDisabled: { backgroundColor: '#334155' },
    formBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    versionText: { color: 'rgba(148, 163, 184, 0.4)', fontSize: 12, textAlign: 'center', marginTop: 24 },
});
