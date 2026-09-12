import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, FlatList, Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProgressHistory, ProgressHistoryItem } from '../../../src/api/progress';

import SquatIcon from '../../../assets/icons/squat.svg';
import BenchIcon from '../../../assets/icons/benchpress.svg';
import DeadliftIcon from '../../../assets/icons/deadlift.svg';

const EXERCISE_CONFIG = {
    SQUAT: { label: 'Squat', Icon: SquatIcon, color: '#6366f1' },
    BENCH_PRESS: { label: 'Bench Press', Icon: BenchIcon, color: '#0ea5e9' },
    DEADLIFT: { label: 'Deadlift', Icon: DeadliftIcon, color: '#10b981' }
};
const EXERCISES = Object.keys(EXERCISE_CONFIG);

export default function ProgressHistoryScreen() {
    const router = useRouter();
    const [selectedExercise, setSelectedExercise] = useState<string | null>(null);
    const [sessions, setSessions] = useState<ProgressHistoryItem[]>([]);
    const [loading, setLoading] = useState(false);
    const [page, setPage] = useState(0);
    const [hasMore, setHasMore] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        loadHistory();
    }, [selectedExercise]);

    const loadHistory = async () => {
        setLoading(true);
        setError(null);
        setPage(0);
        try {
            const result = await getProgressHistory(selectedExercise || undefined, undefined, undefined, 0, 50);
            setSessions(result.sessions);
            setHasMore(result.page < result.totalPages - 1);
        } catch (err: any) {
            setSessions([]);
            setHasMore(false);
            setError(err?.response?.data?.detail || 'Failed to load history');
        } finally {
            setLoading(false);
        }
    };

    const loadMore = async () => {
        if (!hasMore || loading) return;
        setLoading(true);
        try {
            const nextPage = page + 1;
            const result = await getProgressHistory(selectedExercise || undefined, undefined, undefined, nextPage, 50);
            setSessions(prev => [...prev, ...result.sessions]);
            setPage(nextPage);
            setHasMore(nextPage < result.totalPages - 1);
        } catch (err) {
        } finally {
            setLoading(false);
        }
    };

    const getScoreColor = (score: number | null) => {
        if (!score) return '#64748b';
        if (score >= 80) return '#22c55e';
        if (score >= 50) return '#f59e0b';
        return '#ef4444';
    };

    const renderHistoryItem = ({ item }: { item: ProgressHistoryItem }) => (
        <TouchableOpacity
            style={styles.sessionCard}
            onPress={() => router.push(`/results?videoId=${item.videoId}`)}
            activeOpacity={0.7}
        >
            <View style={styles.sessionHead}>
                <View style={styles.sessionInfo}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                        {(() => {
                            const conf = EXERCISE_CONFIG[item.exerciseType as keyof typeof EXERCISE_CONFIG];
                            if (!conf) return <Text style={styles.sessionExercise}>{item.exerciseType}</Text>;
                            const { Icon, label, color } = conf;
                            return (
                                <>
                                    <Icon width={24} height={24} fill="#6366f1" color="#6366f1" />
                                    <Text style={styles.sessionExercise}>{label}</Text>
                                </>
                            );
                        })()}
                    </View>
                    <Text style={styles.sessionDate}>
                        {new Date(item.analyzedAt).toLocaleDateString()}
                    </Text>
                </View>
                {item.overallScore !== null && (
                    <View style={[styles.scoreCircle, { borderColor: getScoreColor(item.overallScore) }]}>
                        <Text style={[styles.scoreText, { color: getScoreColor(item.overallScore) }]}>
                            {item.overallScore.toFixed(0)}
                        </Text>
                    </View>
                )}
            </View>
            {item.totalReps !== null && (
                <Text style={styles.repCount}>
                    {item.totalReps} reps • {item.status === 'COMPLETED' ? '✓' : '○'} {item.status}
                </Text>
            )}
        </TouchableOpacity>
    );

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 20 }}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                    </TouchableOpacity>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Ionicons name="calendar-outline" size={26} color="#f1f5f9" />
                            <Text style={styles.logo}>History</Text>
                        </View>
                        <Text style={styles.subtitle}>Your past sessions</Text>
                    </View>
                </View>

                {/* Exercise filter chips */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterChips}>
                    <TouchableOpacity
                        style={[styles.chip, !selectedExercise && styles.chipActive]}
                        onPress={() => setSelectedExercise(null)}
                    >
                        <Text style={[styles.chipText, !selectedExercise && styles.chipTextActive]}>All</Text>
                    </TouchableOpacity>
                    {EXERCISES.map((ex) => {
                        const conf = EXERCISE_CONFIG[ex as keyof typeof EXERCISE_CONFIG];
                        const isActive = selectedExercise === ex;
                        return (
                            <TouchableOpacity
                                key={ex}
                                style={[styles.chip, { flexDirection: 'row', alignItems: 'center' }, isActive && styles.chipActive]}
                                onPress={() => setSelectedExercise(ex)}
                            >
                                <conf.Icon width={20} height={20} fill={isActive ? '#f1f5f9' : '#94a3b8'} color={isActive ? '#f1f5f9' : '#94a3b8'} />
                                <Text style={[styles.chipText, isActive && styles.chipTextActive, { marginLeft: 6 }]}>
                                    {conf.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* Sessions list */}
            {loading && sessions.length === 0 ? (
                <View style={styles.centerLoading}>
                    <ActivityIndicator size="large" color="#6366f1" />
                </View>
            ) : error ? (
                <View style={styles.centerEmpty}>
                    <Text style={styles.emptyIcon}>⚠️</Text>
                    <Text style={styles.emptyText}>Could not load history</Text>
                    <Text style={styles.emptySubtext}>{error}</Text>
                    <TouchableOpacity style={styles.retryBtn} onPress={loadHistory}>
                        <Text style={styles.retryText}>Try again</Text>
                    </TouchableOpacity>
                </View>
            ) : sessions.length === 0 ? (
                <View style={styles.centerEmpty}>
                    <Text style={styles.emptyIcon}>📋</Text>
                    <Text style={styles.emptyText}>No history yet</Text>
                    <Text style={styles.emptySubtext}>Please analyze some videos before checking your exercise history.</Text>
                </View>
            ) : (
                <FlatList
                    data={sessions}
                    keyExtractor={(item) => item.videoId}
                    renderItem={renderHistoryItem}
                    contentContainerStyle={styles.listContent}
                    onEndReached={() => loadMore()}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={
                        hasMore && loading ? (
                            <ActivityIndicator size="small" color="#6366f1" style={styles.footerLoader} />
                        ) : null
                    }
                    scrollEnabled
                />
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    header: { paddingHorizontal: 24, paddingTop: 56, paddingBottom: 16 },

    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },

    logo: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },
    subtitle: { color: '#64748b', fontSize: 14 },

    filterChips: { marginBottom: 0 },
    chip: {
        paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20,
        backgroundColor: '#1e293b', marginRight: 10, borderWidth: 1, borderColor: '#334155',
    },
    chipActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    chipText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    chipTextActive: { color: '#f1f5f9' },

    centerLoading: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    centerEmpty: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    emptyIcon: { fontSize: 60, marginBottom: 16 },
    emptyText: { color: '#f1f5f9', fontSize: 18, fontWeight: '700', marginBottom: 4 },
    emptySubtext: { color: '#64748b', fontSize: 13 },
    retryBtn: {
        marginTop: 16,
        backgroundColor: '#6366f1',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 12,
    },
    retryText: { color: '#f1f5f9', fontSize: 14, fontWeight: '700' },

    listContent: { paddingHorizontal: 24, paddingTop: 12, paddingBottom: 40 },

    sessionCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
        marginBottom: 12, borderLeftWidth: 4, borderLeftColor: '#6366f1',
    },

    sessionHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    sessionInfo: { flex: 1 },
    sessionExercise: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
    sessionDate: { color: '#64748b', fontSize: 12 },

    scoreCircle: {
        width: 56, height: 56, borderRadius: 28, borderWidth: 3,
        justifyContent: 'center', alignItems: 'center', marginLeft: 12,
    },
    scoreText: { fontSize: 20, fontWeight: '800' },

    repCount: { color: '#94a3b8', fontSize: 12, marginTop: 8 },
    footerLoader: { marginVertical: 20 },
});
