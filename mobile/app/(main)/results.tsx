import React, { useEffect, useState } from 'react';
import {
    View, Text, StyleSheet, ScrollView,
    ActivityIndicator, TouchableOpacity,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { getAnalysisResult, getToken, BASE_URL } from '../../src/api/client';
import { useVideoPlayer, VideoView } from 'expo-video';
import { Ionicons } from '@expo/vector-icons';

interface RepDetail {
    repNumber: number;
    score: number;
    errors: string[];
    exerciseMetrics?: Record<string, number | null>;
}

interface AnalysisResult {
    videoId: string;
    exerciseType?: string;
    status: string;
    totalReps: number;
    overallScore: number;
    feedback: string[];
    repDetails: RepDetail[];
}

export default function ResultsScreen() {
    const { videoId } = useLocalSearchParams<{ videoId: string }>();
    const router = useRouter();

    const [result, setResult] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        getToken().then(setToken);
    }, []);

    useEffect(() => {
        if (!videoId) return;
        const fetchData = async () => {
            try {
                const res = await getAnalysisResult(videoId);
                setResult(res);
            } catch (err: any) {
                setError(err.response?.data?.detail || 'Failed to load results');
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [videoId]);

    const player = useVideoPlayer(token ? {
        uri: `${BASE_URL}/videos/${videoId}/stream-annotated`,
        headers: { Authorization: `Bearer ${token}` }
    } : null, player => {
        player.loop = true;
        player.muted = true;
        player.play();
    });

    if (loading) return (
        <View style={styles.center}>
            <ActivityIndicator size="large" color="#6366f1" />
            <Text style={styles.loadingText}>Loading results...</Text>
        </View>
    );

    if (error) return (
        <View style={styles.center}>
            <Text style={styles.errorText}>{error}</Text>
        </View>
    );

    if (!result) return null;

    const scoreColor = result.overallScore >= 80 ? '#22c55e' : result.overallScore >= 50 ? '#f59e0b' : '#ef4444';

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={styles.headerRow}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                </TouchableOpacity>
                <Text style={styles.pageTitle}>Analysis Report</Text>
            </View>

            {/* Annotated Video Player */}
            {token && (
                <View style={styles.videoContainer}>
                    <VideoView
                        player={player}
                        allowsPictureInPicture
                        contentFit="contain"
                        style={styles.videoPlayer}
                    />
                </View>
            )}

            {/* Summary card */}
            <View style={styles.summaryCard}>
                <View style={styles.scoreCircle}>
                    <Text style={[styles.scoreNumber, { color: scoreColor }]}>{result.overallScore}</Text>
                    <Text style={styles.scoreLabel}>/ 100</Text>
                </View>
                <View style={styles.summaryDivider} />
                <View style={styles.summaryDetails}>
                    <Text style={styles.statValue}>{result.totalReps}</Text>
                    <Text style={styles.statLabel}>Total Reps</Text>
                </View>
            </View>

            {/* Feedback */}
            {result.feedback && result.feedback.length > 0 && (
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>FEEDBACK</Text>
                    {result.feedback.map((item, index) => (
                        <Text key={index} style={styles.feedbackItem}>• {item}</Text>
                    ))}
                </View>
            )}

            {/* Per-rep breakdown */}
            <Text style={styles.sectionTitle}>Rep Breakdown</Text>
            {result.repDetails.map((rep) => (
                <View key={rep.repNumber} style={styles.repCard}>
                    <View style={styles.repHeader}>
                        <Text style={styles.repTitle}>Rep #{rep.repNumber}</Text>
                        <Text style={[styles.repScore, { color: rep.score >= 80 ? '#22c55e' : rep.score >= 50 ? '#f59e0b' : '#ef4444' }]}>
                            {rep.score}/100
                        </Text>
                    </View>

                    <View style={styles.metricsGrid}>
                        {(() => {
                            const allMetrics = {
                                ...(rep.exerciseMetrics || {})
                            };

                            const uniqueMetrics = new Map();
                            Object.entries(allMetrics).forEach(([key, val]) => {
                                if (val == null) return;
                                
                                const label = key
                                    .replace(/([A-Z])/g, ' $1') // camelCase to spaces
                                    .replace(/_/g, ' ')         // snake_case to spaces
                                    .trim()
                                    .toLowerCase();
                                const formattedLabel = label.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                                
                                uniqueMetrics.set(formattedLabel, { key, val, finalLabel: formattedLabel });
                            });

                            return Array.from(uniqueMetrics.values()).map(({ key, val, finalLabel: lbl }) => {
                                
                            let formattedVal = typeof val === 'number' ? val.toFixed(1) : String(val);
                            const keyLower = key.toLowerCase();
                            if (keyLower.includes('angle') || keyLower.includes('lean') || keyLower.includes('tilt') || keyLower.includes('diff') || keyLower.includes('valgus')) {
                                formattedVal += '°';
                            } else if (keyLower.includes('frames')) {
                                formattedVal += 'f';
                            }

                            return (
                                <View key={key} style={styles.metricItem}>
                                    <Text style={styles.metricLabel}>{lbl}</Text>
                                    <Text style={styles.metricValue}>{formattedVal}</Text>
                                </View>
                            );
                            });
                        })()}
                    </View>

                    {/* Errors */}
                    {rep.errors.map((err, i) => (
                        <Text key={i} style={styles.repError}>• {err}</Text>
                    ))}
                    {rep.errors.length === 0 && (
                        <Text style={styles.repGood}>• No issues detected</Text>
                    )}
                </View>
            ))}
        </ScrollView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 24, paddingTop: 56, paddingBottom: 100 },
    center: { flex: 1, backgroundColor: '#0f172a', justifyContent: 'center', alignItems: 'center' },
    loadingText: { color: '#94a3b8', marginTop: 12 },
    errorText: { color: '#ef4444', fontSize: 16 },
    headerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
    pageTitle: { color: '#f1f5f9', fontSize: 24, fontWeight: '800' },
    summaryCard: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 20,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'space-evenly', marginBottom: 24,
    },
    scoreCircle: { alignItems: 'center' },
    scoreNumber: { fontSize: 48, fontWeight: '800' },
    scoreLabel: { color: '#64748b', fontSize: 13, marginTop: -4 },
    summaryDivider: { width: 1, height: 50, backgroundColor: '#334155' },
    summaryDetails: { alignItems: 'center', justifyContent: 'center' },
    statValue: { color: '#f1f5f9', fontSize: 40, fontWeight: '800' },
    statLabel: { color: '#64748b', fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: 2 },
    section: { marginBottom: 24 },
    sectionTitle: { color: '#94a3b8', fontSize: 12, fontWeight: '700', letterSpacing: 1, marginBottom: 10, textTransform: 'uppercase' },
    feedbackItem: { color: '#cbd5e1', fontSize: 14, marginBottom: 6, lineHeight: 20 },
    repCard: { backgroundColor: '#1e293b', borderRadius: 12, padding: 12, paddingBottom: 10, marginBottom: 12 },
    repHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 },
    repTitle: { color: '#f1f5f9', fontWeight: '700', fontSize: 16 },
    repScore: { fontWeight: '700', fontSize: 16 },

    backBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        width: 40, height: 40, backgroundColor: '#334155', borderRadius: 20,
    },
    metricsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 4 },
    metricItem: {
        backgroundColor: '#0f172a', borderRadius: 8, paddingHorizontal: 4,
        paddingVertical: 8, width: '31%', alignItems: 'center', justifyContent: 'center',
    },
    metricLabel: { color: '#64748b', fontSize: 9, textTransform: 'uppercase', letterSpacing: 0.2, marginBottom: 4, textAlign: 'center' },
    metricValue: { color: '#e2e8f0', fontSize: 14, fontWeight: '700' },

    repError: { color: '#fca5a5', fontSize: 13 },
    repGood: { color: '#86efac', fontSize: 13 },
    videoContainer: { height: 350, width: '100%', marginBottom: 24, backgroundColor: '#000', borderRadius: 16, overflow: 'hidden' },
    videoPlayer: { flex: 1, width: '100%', height: '100%' },
});
