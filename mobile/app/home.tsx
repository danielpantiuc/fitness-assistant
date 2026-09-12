import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar, Alert, ActivityIndicator
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useAuth } from '../src/context/AuthContext';
import { classifyVideo } from '../src/api/client';

import SquatIcon from '../assets/icons/squat.svg';
import BenchIcon from '../assets/icons/benchpress.svg';
import DeadliftIcon from '../assets/icons/deadlift.svg';

const EXERCISES = [
    {
        key: 'SQUAT',
        label: 'Squat',
        SvgIcon: SquatIcon,
        description: 'Analyze depth, trunk lean, knee tracking and more.',
        color: '#6366f1',
        colorDim: '#1e1b4b',
        tip: 'Recommended to film from the side',
    },
    {
        key: 'BENCH_PRESS',
        label: 'Bench Press',
        SvgIcon: BenchIcon,
        description: 'Check lockout, range of motion and back arch.',
        color: '#0ea5e9',
        colorDim: '#0c1a2e',
        tip: 'Recommended to film from the side',
    },
    {
        key: 'DEADLIFT',
        label: 'Deadlift',
        SvgIcon: DeadliftIcon,
        description: 'Detect rounded back, hip lockout and bar path.',
        color: '#10b981',
        colorDim: '#052e1c',
        tip: 'Recommended to film from the side',
    },
];

export default function HomeScreen() {
    const router = useRouter();
    const { userEmail, username } = useAuth();
    const [isClassifying, setIsClassifying] = React.useState(false);

    const handleAutoDetect = async () => {
        try {
            const permissionResult = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permissionResult.granted) {
                Alert.alert('Permission needed', 'Please grant camera roll permissions to select a video.');
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['videos'],
                allowsEditing: true,
                quality: 1,
            });

            if (result.canceled) return;
            const videoUri = result.assets[0].uri;

            setIsClassifying(true);
            const response = await classifyVideo(videoUri);

            if (response.confidence > 0.5 && response.detectedExercise !== 'OTHER') {
                let detectedKey = response.detectedExercise.toUpperCase();
                if (detectedKey === 'BENCH') detectedKey = 'BENCH_PRESS';
                
                const label = detectedKey.replace(/_/g, ' ');
                Alert.alert(
                    'Exercise detected!',
                    `We detected ${label} with ${(response.confidence * 100).toFixed(0)}% confidence.`,
                    [
                        { text: 'Cancel', style: 'cancel' },
                        { text: 'Analyze', onPress: () => router.push(`/exercise?type=${detectedKey}&videoUri=${encodeURIComponent(videoUri)}`) }
                    ]
                );
            } else {
                Alert.alert(
                    'Exercise not recognized',
                    'We could not identify a supported exercise (squat, bench press or deadlift) in this video. Please select the exercise manually.',
                    [{ text: 'OK' }]
                );
            }
        } catch (error: any) {
            const errorMessage = error.response?.data?.detail || error.response?.data?.message || 'Failed to auto-detect exercise. Make sure the backend and AI service are running.';
            Alert.alert('Error', errorMessage);
        } finally {
            setIsClassifying(false);
        }
    };

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.header}>
                    <View>
                        <Text style={styles.logo}>SBD Assist</Text>
                        {userEmail && (
                            <Text style={styles.greeting}>Welcome back, {username || userEmail.split('@')[0]}!</Text>
                        )}
                    </View>
                    <View style={styles.headerButtonGroup}>
                        <TouchableOpacity style={styles.headerBtn} onPress={() => router.push('/progress')}>
                            <Ionicons name="stats-chart-outline" size={20} color="#94a3b8" />
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/profile')}>
                            <Ionicons name="settings-outline" size={22} color="#94a3b8" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* Title */}
                <View style={styles.titleRow}>
                    <View>
                        <Text style={styles.sectionTitle}>Choose Exercise</Text>
                        <Text style={styles.sectionSubtitle}>
                            Select the movement you want to analyze
                        </Text>
                    </View>
                </View>

                {/* Auto Detect Prominent Card */}
                <TouchableOpacity
                    style={styles.autoCard}
                    activeOpacity={0.8}
                    onPress={handleAutoDetect}
                    disabled={isClassifying}
                >
                    <View style={styles.autoCardBody}>
                        <View style={styles.autoEmojiCircle}>
                            <Ionicons name="sparkles" size={28} color="#fff" />
                        </View>
                        <View style={styles.cardText}>
                            <Text style={styles.autoCardLabel}>Auto-Detect</Text>
                            <Text style={styles.autoCardDescription}>Let AI identify your movement</Text>
                            <View style={styles.tipRow}>
                                <Ionicons name="scan" size={12} color="#e2e8f0" />
                                <Text style={styles.autoTipText}>Smart analysis</Text>
                            </View>
                        </View>
                        {isClassifying ? (
                            <ActivityIndicator size="small" color="#fff" />
                        ) : (
                            <View style={styles.autoArrow}>
                                <Text style={styles.autoArrowText}>›</Text>
                            </View>
                        )}
                    </View>
                </TouchableOpacity>

                <View style={styles.dividerRow}>
                    <View style={styles.dividerLine} />
                    <Text style={styles.dividerText}>OR CHOOSE MANUALLY</Text>
                    <View style={styles.dividerLine} />
                </View>

                {/* Exercise cards */}
                {EXERCISES.map((ex) => (
                    <TouchableOpacity
                        key={ex.key}
                        style={[styles.card, { borderColor: ex.color + '55' }]}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/exercise?type=${ex.key}`)}
                    >
                        {/* Colored accent bar */}
                        <View style={[styles.cardAccent, { backgroundColor: ex.color }]} />

                        <View style={styles.cardBody}>
                            <View style={[styles.emojiCircle, { backgroundColor: ex.colorDim }]}>
                                <ex.SvgIcon width={32} height={32} fill={ex.color} />
                            </View>

                            <View style={styles.cardText}>
                                <Text style={styles.cardLabel}>{ex.label}</Text>
                                <Text style={styles.cardDescription}>{ex.description}</Text>
                                <View style={styles.tipRow}>
                                    <Ionicons name="information-circle-outline" size={14} color="#64748b" style={{ marginTop: 1 }} />
                                    <Text style={styles.tipText}>{ex.tip}</Text>
                                </View>
                            </View>

                            <View style={[styles.arrow, { backgroundColor: ex.color + '22' }]}>
                                <Text style={[styles.arrowText, { color: ex.color }]}>›</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                <Text style={styles.footer}>
                    Upload a video or record yourself performing the movement.{'\n'}
                    AI will analyze your form rep by rep.
                </Text>
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 24, paddingTop: 60, paddingBottom: 40 },

    header: {
        flexDirection: 'row', justifyContent: 'space-between',
        alignItems: 'flex-start', marginBottom: 16,
    },
    headerButtonGroup: { flexDirection: 'row', gap: 10, alignItems: 'center' },
    headerBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },
    logo: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginBottom: 2 },
    greeting: { color: '#64748b', fontSize: 13 },
    settingsBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },

    titleRow: { marginBottom: 20 },
    sectionTitle: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', marginBottom: 6 },
    sectionSubtitle: { color: '#64748b', fontSize: 14, lineHeight: 20 },
    
    autoCard: {
        backgroundColor: '#8b5cf6', borderRadius: 20,
        marginBottom: 24, overflow: 'hidden',
        shadowColor: '#8b5cf6', shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3, shadowRadius: 8, elevation: 5,
    },
    autoCardBody: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    autoEmojiCircle: {
        width: 56, height: 56, borderRadius: 16,
        backgroundColor: 'rgba(255, 255, 255, 0.2)',
        justifyContent: 'center', alignItems: 'center',
    },
    autoCardLabel: { color: '#fff', fontSize: 19, fontWeight: '800', marginBottom: 4 },
    autoCardDescription: { color: 'rgba(255, 255, 255, 0.9)', fontSize: 13, lineHeight: 18, marginBottom: 8 },
    autoTipText: { color: 'rgba(255, 255, 255, 0.7)', fontSize: 11, marginLeft: 4 },
    autoArrow: { width: 36, height: 36, borderRadius: 12, backgroundColor: 'rgba(255, 255, 255, 0.2)', justifyContent: 'center', alignItems: 'center' },
    autoArrowText: { color: '#fff', fontSize: 24, fontWeight: '300', marginTop: -2 },

    dividerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 20 },
    dividerLine: { flex: 1, height: 1, backgroundColor: '#334155' },
    dividerText: { color: '#64748b', fontSize: 11, fontWeight: '700', letterSpacing: 1, paddingHorizontal: 12 },

    card: {
        backgroundColor: '#1e293b', borderRadius: 20,
        borderWidth: 1, marginBottom: 16, overflow: 'hidden',
    },
    cardAccent: { height: 3, width: '100%' },
    cardBody: { flexDirection: 'row', alignItems: 'center', padding: 20, gap: 16 },
    emojiCircle: {
        width: 56, height: 56, borderRadius: 16,
        justifyContent: 'center', alignItems: 'center',
    },

    cardText: { flex: 1 },
    cardLabel: { color: '#f1f5f9', fontSize: 19, fontWeight: '700', marginBottom: 4 },
    cardDescription: { color: '#94a3b8', fontSize: 13, lineHeight: 18, marginBottom: 8 },
    tipRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },

    tipText: { color: '#475569', fontSize: 11 },
    arrow: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    arrowText: { fontSize: 24, fontWeight: '300', marginTop: -2 },

    footer: { color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 8, lineHeight: 18 },
});
