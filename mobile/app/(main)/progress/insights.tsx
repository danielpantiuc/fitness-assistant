import React, { useEffect, useState } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProgressInsights, ProgressInsightResponse } from '../../../src/api/progress';

const EXERCISES = ['SQUAT', 'BENCH_PRESS', 'DEADLIFT'];
const EXERCISE_LABELS: Record<string, string> = {
    SQUAT: 'Squat',
    BENCH_PRESS: 'Bench Press',
    DEADLIFT: 'Deadlift',
};
const EXERCISE_EMOJI: Record<string, string> = {
    SQUAT: '🏋️',
    BENCH_PRESS: '💪',
    DEADLIFT: '🔥',
};

const TREND_CFG = {
    improving:        { color: '#22c55e', label: '📈 Improving',    bg: '#22c55e14' },
    declining:        { color: '#ef4444', label: '📉 Declining',    bg: '#ef444414' },
    stable:           { color: '#f59e0b', label: '⟶ Stable',       bg: '#f59e0b14' },
    early_stage:      { color: '#6366f1', label: '🆕 Early Stage',  bg: '#6366f114' },
    insufficient_data:{ color: '#64748b', label: '— No Data Yet',  bg: '#64748b14' },
} as const;

function errorBarColor(pct: number) {
    if (pct >= 60) return '#ef4444';
    if (pct >= 35) return '#f59e0b';
    return '#22c55e';
}

export default function ProgressInsightsScreen() {
    const router = useRouter();
    const [selectedExercise, setSelectedExercise] = useState('SQUAT');
    const [insights, setInsights] = useState<ProgressInsightResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { loadInsights(); }, [selectedExercise]);

    const loadInsights = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getProgressInsights(selectedExercise);
            setInsights(result);
        } catch (err: any) {
            setInsights(null);
            setError(err?.response?.data?.message || err?.message || 'Failed to load insights');
        } finally {
            setLoading(false);
        }
    };

    const trendKey = (insights?.overallTrend ?? 'insufficient_data') as keyof typeof TREND_CFG;
    const tc = TREND_CFG[trendKey] ?? TREND_CFG.insufficient_data;

    return (
        <View style={s.container}>
            <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>

                <View style={s.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity style={s.backBtn} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                        </TouchableOpacity>
                        <View>
                            <Text style={s.title}>AI Insights</Text>
                            <Text style={s.subtitle}>Personalized feedback</Text>
                        </View>
                    </View>
                </View>

                {/* Exercise selector */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={s.tabRow}>
                    {EXERCISES.map((ex) => (
                        <TouchableOpacity
                            key={ex}
                            style={[s.tab, selectedExercise === ex && s.tabActive]}
                            onPress={() => setSelectedExercise(ex)}
                        >
                            <Text style={s.tabEmoji}>{EXERCISE_EMOJI[ex]}</Text>
                            <Text style={[s.tabText, selectedExercise === ex && s.tabTextActive]}>
                                {EXERCISE_LABELS[ex]}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </ScrollView>

                {/* States */}
                {loading ? (
                    <View style={s.centerBox}>
                        <ActivityIndicator size="large" color="#6366f1" />
                        <Text style={s.centerSub}>Generating insights…</Text>
                    </View>
                ) : error ? (
                    <View style={s.centerBox}>
                        <Text style={s.bigEmoji}>⚠️</Text>
                        <Text style={s.centerTitle}>Could not load insights</Text>
                        <Text style={s.centerSub}>{error}</Text>
                        <TouchableOpacity style={s.retryBtn} onPress={loadInsights}>
                            <Text style={s.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : !insights ? null : (
                    <>
                        {/* Overview card */}
                        <View style={[s.overviewCard, { borderColor: tc.color + '44', backgroundColor: tc.bg }]}>
                            <View style={s.overviewTop}>
                                <View>
                                    <Text style={s.overviewExercise}>{EXERCISE_LABELS[selectedExercise]}</Text>
                                    <Text style={[s.overviewTrend, { color: tc.color }]}>{tc.label}</Text>
                                </View>
                                <View style={[s.sessionsBadge, { backgroundColor: tc.color + '22' }]}>
                                    <Text style={[s.sessionsNum, { color: tc.color }]}>{insights.totalSessions}</Text>
                                    <Text style={[s.sessionsLabel, { color: tc.color }]}>sessions</Text>
                                </View>
                            </View>

                            {/* Progress to next milestone */}
                            {insights.totalSessions < 10 && (
                                <View style={s.milestoneWrap}>
                                    <View style={s.milestoneBar}>
                                        <View
                                            style={[
                                                s.milestoneFill,
                                                {
                                                    width: `${Math.min(100, (insights.totalSessions / 10) * 100)}%`,
                                                    backgroundColor: tc.color,
                                                },
                                            ]}
                                        />
                                    </View>
                                    <Text style={s.milestoneText}>
                                        {10 - insights.totalSessions} more sessions to unlock full trend analysis
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Key Insights */}
                        <Text style={s.sectionTitle}>💡 Key Insights</Text>
                        {insights.insights.length > 0 ? (
                            insights.insights.map((insight, idx) => (
                                <View key={idx} style={s.insightCard}>
                                    <View style={s.insightAccent} />
                                    <Text style={s.insightText}>{insight}</Text>
                                </View>
                            ))
                        ) : (
                            <View style={s.emptyCard}>
                                <Text style={s.emptyEmoji}>🤔</Text>
                                <Text style={s.emptyText}>No insights yet</Text>
                                <Text style={s.emptySub}>Complete more sessions to get personalised feedback.</Text>
                            </View>
                        )}

                        {/* Top Errors */}
                        {insights.topErrors.length > 0 && (
                            <>
                                <Text style={[s.sectionTitle, { marginTop: 8 }]}>⚠️ Most Common Errors</Text>
                                {insights.topErrors.map((err, idx) => {
                                    const barColor = errorBarColor(err.percentageOfSessions);
                                    return (
                                        <View key={idx} style={s.errorCard}>
                                            <View style={s.errorTop}>
                                                <Text style={s.errorRank}>#{idx + 1}</Text>
                                                <Text style={s.errorName} numberOfLines={2}>{err.error}</Text>
                                                <Text style={[s.errorPct, { color: barColor }]}>
                                                    {err.percentageOfSessions.toFixed(0)}%
                                                </Text>
                                            </View>
                                            <View style={s.errorBarBg}>
                                                <View
                                                    style={[
                                                        s.errorBarFill,
                                                        {
                                                            width: `${Math.min(100, err.percentageOfSessions)}%`,
                                                            backgroundColor: barColor,
                                                        },
                                                    ]}
                                                />
                                            </View>
                                            <Text style={s.errorOccurrences}>
                                                Occurred {err.occurrences} time{err.occurrences !== 1 ? 's' : ''} across your sessions
                                            </Text>
                                        </View>
                                    );
                                })}
                            </>
                        )}

                        {/* Encouragement banner */}
                        {insights.totalSessions < 5 && (
                            <View style={s.encourageCard}>
                                <Text style={s.encourageEmoji}>🎯</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.encourageTitle}>Keep Going!</Text>
                                    <Text style={s.encourageText}>
                                        More sessions = better insights. You're {insights.totalSessions}/5 of the way there.
                                    </Text>
                                </View>
                            </View>
                        )}

                        {/* Perfect score celebration */}
                        {insights.overallTrend === 'improving' && (
                            <View style={s.winCard}>
                                <Text style={s.winEmoji}>🏆</Text>
                                <View style={{ flex: 1 }}>
                                    <Text style={s.winTitle}>You're Improving!</Text>
                                    <Text style={s.winText}>
                                        Your {EXERCISE_LABELS[selectedExercise]} form is getting better. Keep up the great work!
                                    </Text>
                                </View>
                            </View>
                        )}
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const s = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 24, paddingTop: 56, paddingBottom: 48 },

    header: { marginBottom: 24 },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },
    title: { color: '#f1f5f9', fontSize: 28, fontWeight: '800', marginBottom: 4 },
    subtitle: { color: '#64748b', fontSize: 13 },

    tabRow: { marginBottom: 24 },
    tab: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 14, paddingVertical: 10, borderRadius: 14,
        backgroundColor: '#1e293b', marginRight: 10, borderWidth: 1, borderColor: '#334155',
    },
    tabActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
    tabEmoji: { fontSize: 15 },
    tabText: { color: '#94a3b8', fontSize: 13, fontWeight: '600' },
    tabTextActive: { color: '#fff' },

    centerBox: { alignItems: 'center', paddingVertical: 56, gap: 10 },
    bigEmoji: { fontSize: 52, marginBottom: 4 },
    centerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
    centerSub: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 12, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    overviewCard: {
        borderRadius: 16, padding: 20, marginBottom: 28,
        borderWidth: 1.5,
    },
    overviewTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
    overviewExercise: { color: '#94a3b8', fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginBottom: 4 },
    overviewTrend: { fontSize: 20, fontWeight: '800' },
    sessionsBadge: { borderRadius: 12, padding: 12, alignItems: 'center', minWidth: 64 },
    sessionsNum: { fontSize: 24, fontWeight: '800' },
    sessionsLabel: { fontSize: 11, fontWeight: '600' },
    milestoneWrap: { marginTop: 16 },
    milestoneBar: {
        height: 6, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 6,
    },
    milestoneFill: { height: '100%', borderRadius: 3 },
    milestoneText: { color: '#64748b', fontSize: 11 },

    sectionTitle: { color: '#f1f5f9', fontSize: 16, fontWeight: '700', marginBottom: 12 },

    insightCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
        marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'flex-start',
        borderWidth: 1, borderColor: '#334155',
    },
    insightAccent: { width: 3, borderRadius: 2, backgroundColor: '#6366f1', alignSelf: 'stretch', minHeight: 20 },
    insightText: { color: '#cbd5e1', fontSize: 14, lineHeight: 22, flex: 1 },

    emptyCard: { backgroundColor: '#1e293b', borderRadius: 14, padding: 24, alignItems: 'center', gap: 6 },
    emptyEmoji: { fontSize: 36 },
    emptyText: { color: '#f1f5f9', fontSize: 16, fontWeight: '700' },
    emptySub: { color: '#64748b', fontSize: 13, textAlign: 'center' },

    errorCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
        marginBottom: 10, borderWidth: 1, borderColor: '#334155',
    },
    errorTop: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
    errorRank: { color: '#475569', fontSize: 12, fontWeight: '700', width: 20 },
    errorName: { color: '#f1f5f9', fontSize: 14, fontWeight: '600', flex: 1, lineHeight: 20 },
    errorPct: { fontSize: 16, fontWeight: '800', marginLeft: 4 },
    errorBarBg: { height: 5, backgroundColor: '#334155', borderRadius: 3, overflow: 'hidden', marginBottom: 8 },
    errorBarFill: { height: '100%', borderRadius: 3 },
    errorOccurrences: { color: '#64748b', fontSize: 11 },

    encourageCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginTop: 20,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderWidth: 1, borderColor: '#6366f144',
    },
    encourageEmoji: { fontSize: 32 },
    encourageTitle: { color: '#f1f5f9', fontSize: 15, fontWeight: '700', marginBottom: 2 },
    encourageText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },

    winCard: {
        backgroundColor: '#1e293b', borderRadius: 14, padding: 16, marginTop: 12,
        flexDirection: 'row', alignItems: 'center', gap: 14,
        borderWidth: 1, borderColor: '#22c55e44',
    },
    winEmoji: { fontSize: 32 },
    winTitle: { color: '#22c55e', fontSize: 15, fontWeight: '700', marginBottom: 2 },
    winText: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
});
