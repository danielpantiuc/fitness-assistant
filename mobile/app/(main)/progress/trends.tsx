import React, { useEffect, useState, useRef } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, ActivityIndicator, Dimensions, PanResponder,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getProgressTrends, ProgressTrendResponse, ScorePoint } from '../../../src/api/progress';

import SquatIcon from '../../../assets/icons/squat.svg';
import BenchIcon from '../../../assets/icons/benchpress.svg';
import DeadliftIcon from '../../../assets/icons/deadlift.svg';

const EXERCISE_CONFIG = {
    SQUAT: { label: 'Squat', Icon: SquatIcon, color: '#6366f1' },
    BENCH_PRESS: { label: 'Bench Press', Icon: BenchIcon, color: '#0ea5e9' },
    DEADLIFT: { label: 'Deadlift', Icon: DeadliftIcon, color: '#10b981' }
};
const EXERCISES = Object.keys(EXERCISE_CONFIG);

const SCREEN_W = Dimensions.get('window').width;
const CHART_H = 160;
const Y_AXIS_W = 28;

function LineChart({ points }: { points: ScorePoint[] }) {
    const [zoom, setZoom] = useState(1);
    const zoomRef = useRef(1);
    zoomRef.current = zoom;

    const initialDistance = useRef<number | null>(null);
    const initialZoom = useRef<number>(1);

    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
            onMoveShouldSetPanResponder: (e) => e.nativeEvent.touches.length === 2,
            onPanResponderGrant: (e) => {
                const touches = e.nativeEvent.touches;
                if (touches.length === 2) {
                    const dx = touches[0].pageX - touches[1].pageX;
                    const dy = touches[0].pageY - touches[1].pageY;
                    initialDistance.current = Math.sqrt(dx * dx + dy * dy);
                    initialZoom.current = zoomRef.current;
                }
            },
            onPanResponderMove: (e) => {
                const touches = e.nativeEvent.touches;
                if (touches.length === 2 && initialDistance.current != null) {
                    const dx = touches[0].pageX - touches[1].pageX;
                    const dy = touches[0].pageY - touches[1].pageY;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    const scale = distance / initialDistance.current;
                    const newZoom = Math.min(Math.max(1, initialZoom.current * scale), 10);
                    setZoom(newZoom);
                }
            },
            onPanResponderRelease: () => {
                initialDistance.current = null;
            },
            onPanResponderTerminate: () => {
                initialDistance.current = null;
            }
        })
    ).current;

    const baseChartW = SCREEN_W - 48 - Y_AXIS_W; // 48 = card horizontal padding

    if (points.length === 0) return null;

    if (points.length === 1) {
        const s = points[0].score;
        const dotColor = s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
        return (
            <View style={{ height: CHART_H + 32, alignItems: 'center', justifyContent: 'center' }}>
                <View style={[lcStyles.dot, { backgroundColor: dotColor, width: 14, height: 14, borderRadius: 7 }]} />
            </View>
        );
    }

    const scores = points.map(p => p.score);
    const rawMin = Math.min(...scores);
    const rawMax = Math.max(...scores);
    const minS = Math.max(0, rawMin - 10);
    const maxS = Math.min(100, rawMax + 10);
    const range = maxS - minS || 1;

    const dotMargin = 20;
    const chartW = Math.max(baseChartW, baseChartW * zoom);
    const usableW = chartW - dotMargin;
    
    const usableH = CHART_H - 32;
    const toX = (i: number) => (i / (points.length - 1)) * usableW + (dotMargin / 2);
    const toY = (s: number) => 16 + usableH - ((s - minS) / range) * usableH;

    const dotColor = (s: number) => s >= 75 ? '#22c55e' : s >= 50 ? '#f59e0b' : '#ef4444';
    const segColor = (a: number, b: number) => b >= a ? '#22c55e' : '#ef4444';

    const yLabels = [maxS, (maxS + minS) / 2, minS];

    return (
        <View style={{ marginTop: 4, position: 'relative' }} {...panResponder.panHandlers}>
            <View style={{ flexDirection: 'row', height: CHART_H + 20 }}>
                <View style={{ width: Y_AXIS_W, height: CHART_H, paddingVertical: 0 }}>
                    {yLabels.map((v, i) => (
                        <Text key={i} style={[lcStyles.yLabel, { position: 'absolute', top: 16 + (i * 0.5) * usableH - 7, left: 0 }]}>
                            {Math.round(v)}
                        </Text>
                    ))}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} bounces={false}>
                    <View style={{ width: chartW, height: CHART_H + 20, position: 'relative' }}>
                        {[0, 0.5, 1].map((pct, i) => (
                            <View key={i} style={[lcStyles.gridLine, { top: 16 + pct * usableH }]} />
                        ))}

                        {scores.map((score, i) => {
                            if (i === scores.length - 1) return null;
                            const x1 = toX(i); const y1 = toY(score);
                            const x2 = toX(i + 1); const y2 = toY(scores[i + 1]);
                            const dx = x2 - x1; const dy = y2 - y1;
                            const len = Math.sqrt(dx * dx + dy * dy);
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            return (
                                <View
                                    key={i}
                                    style={{
                                        position: 'absolute',
                                        left: x1,
                                        top: y1 - 1.25,
                                        width: len,
                                        height: 2.5,
                                        backgroundColor: segColor(score, scores[i + 1]),
                                        borderRadius: 2,
                                        transformOrigin: 'left center',
                                        transform: [{ rotate: `${angle}deg` }],
                                    }}
                                />
                            );
                        })}

                        {points.map((pt, i) => {
                            const x = toX(i);
                            const y = toY(pt.score);
                            const isLast = i === points.length - 1;
                            const dc = dotColor(pt.score);
                            const dotSize = isLast ? 13 : 9;
                            return (
                                <View key={i}>
                                    <View style={[
                                        lcStyles.dot,
                                        {
                                            left: x - dotSize / 2,
                                            top: y - dotSize / 2,
                                            width: dotSize,
                                            height: dotSize,
                                            borderRadius: dotSize / 2,
                                            backgroundColor: dc,
                                            borderWidth: isLast ? 2 : 1,
                                            borderColor: isLast ? '#f1f5f9' : dc,
                                        },
                                    ]} />
                                </View>
                            );
                        })}

                        {points.map((pt, i) => {
                            const x = toX(i);
                            const step = Math.ceil(points.length / (3 * zoom));
                            const isFirst = i === 0;
                            const isLast = i === points.length - 1;
                            const showDate = isFirst || isLast || (i % step === 0);
                            if (!showDate) return null;
                            return (
                                <Text key={`date-${i}`} style={[
                                    lcStyles.xLabel, 
                                    { position: 'absolute', left: x - 20, top: CHART_H, width: 40, textAlign: 'center' }
                                ]}>
                                    {new Date(pt.timestamp).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}
                                </Text>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>
        </View>
    );
}

function fmtDate(ts: string) {
    return new Date(ts).toLocaleDateString('en-GB', { month: 'short', day: 'numeric' });
}

const lcStyles = StyleSheet.create({
    yLabel: { color: '#475569', fontSize: 10, textAlign: 'right', paddingRight: 4 },
    gridLine: {
        position: 'absolute', left: 0, right: 0, height: 1,
        backgroundColor: '#1e3a5f', opacity: 0.6,
    },
    dot: { position: 'absolute' },
    dotLabel: { position: 'absolute', fontSize: 10, fontWeight: '700', width: 28, textAlign: 'center' },
    xLabel: { color: '#475569', fontSize: 10 },
});

const TREND_CFG = {
    improving:        { color: '#22c55e', label: 'Improving',    bg: '#22c55e14' },
    declining:        { color: '#ef4444', label: 'Declining',    bg: '#ef444414' },
    stable:           { color: '#f59e0b', label: 'Stable',       bg: '#f59e0b14' },
    early_stage:      { color: '#6366f1', label: 'Early Stage',  bg: '#6366f114' },
    insufficient_data:{ color: '#64748b', label: 'No Data Yet',  bg: '#64748b14' },
} as const;

export default function ProgressTrendsScreen() {
    const router = useRouter();
    const [selectedExercise, setSelectedExercise] = useState('SQUAT');
    const [trend, setTrend] = useState<ProgressTrendResponse | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => { loadTrends(); }, [selectedExercise]);

    const loadTrends = async () => {
        setLoading(true);
        setError(null);
        try {
            const result = await getProgressTrends(selectedExercise);
            setTrend(result);
        } catch (err: any) {
            setTrend(null);
            setError(err?.response?.data?.message || err?.message || 'Failed to load trends');
        } finally {
            setLoading(false);
        }
    };

    const trendKey = (trend?.trend ?? 'insufficient_data') as keyof typeof TREND_CFG;
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
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                <Ionicons name="trending-up-outline" size={26} color="#f1f5f9" />
                                <Text style={s.title}>Trends</Text>
                            </View>
                            <Text style={s.subtitle}>Performance over time</Text>
                        </View>
                    </View>
                </View>

                {/* Exercise selector */}
                <View style={s.tabRow}>
                    {EXERCISES.map((ex) => {
                        const conf = EXERCISE_CONFIG[ex as keyof typeof EXERCISE_CONFIG];
                        const isActive = selectedExercise === ex;
                        return (
                            <TouchableOpacity
                                key={ex}
                                style={[s.tab, isActive && s.tabActive]}
                                onPress={() => setSelectedExercise(ex)}
                            >
                                <conf.Icon width={16} height={16} fill={isActive ? '#f1f5f9' : '#94a3b8'} color={isActive ? '#f1f5f9' : '#94a3b8'} />
                                <Text style={[s.tabText, isActive && s.tabTextActive, { marginLeft: 2 }]} numberOfLines={1} adjustsFontSizeToFit>
                                    {conf.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {/* States */}
                {loading ? (
                    <View style={s.centerBox}>
                        <ActivityIndicator size="large" color="#6366f1" />
                        <Text style={s.centerSub}>Loading trends…</Text>
                    </View>
                ) : error ? (
                    <View style={s.centerBox}>
                        <Text style={s.bigEmoji}>⚠️</Text>
                        <Text style={s.centerTitle}>Could not load trends</Text>
                        <Text style={s.centerSub}>{error}</Text>
                        <TouchableOpacity style={s.retryBtn} onPress={loadTrends}>
                            <Text style={s.retryText}>Try Again</Text>
                        </TouchableOpacity>
                    </View>
                ) : !trend || trend.totalSessions === 0 ? (
                    <View style={s.centerBox}>
                        {(() => {
                            const conf = EXERCISE_CONFIG[selectedExercise as keyof typeof EXERCISE_CONFIG];
                            return <conf.Icon width={48} height={48} fill={conf.color} color={conf.color} style={{ marginBottom: 4 }} />;
                        })()}
                        <Text style={s.centerTitle}>No sessions yet</Text>
                        <Text style={s.centerSub}>
                            Analyze a {EXERCISE_CONFIG[selectedExercise as keyof typeof EXERCISE_CONFIG].label} video to start tracking progress.
                        </Text>
                    </View>
                ) : (
                    <>
                        {/* KPI cards */}
                        <View style={s.kpiRow}>
                            <View style={s.kpiCard}>
                                <Text style={s.kpiValue}>{trend.bestScore?.toFixed(0) ?? '—'}</Text>
                                <Text style={s.kpiLabel}>Best Score</Text>
                            </View>
                            <View style={[s.kpiCard, s.kpiMid]}>
                                <Text style={s.kpiValue}>{trend.averageScore?.toFixed(0) ?? '—'}</Text>
                                <Text style={s.kpiLabel}>Avg Score</Text>
                            </View>
                            <View style={s.kpiCard}>
                                <Text style={s.kpiValue}>{trend.totalSessions}</Text>
                                <Text style={s.kpiLabel}>Sessions</Text>
                            </View>
                        </View>

                        {/* Trend badge */}
                        <View style={[s.trendBadge, { backgroundColor: tc.bg, borderColor: tc.color + '40' }]}>
                            <Text style={[s.trendLabel, { color: tc.color }]}>{tc.label}</Text>
                            {trend.scoreDelta != null && (
                                <Text style={s.trendDelta}>
                                    {trend.scoreDelta > 0 ? '+' : ''}{trend.scoreDelta.toFixed(1)} pts · last 5 vs first 5 sessions
                                </Text>
                            )}
                            {trend.consistency != null && (
                                <Text style={s.trendSub}>
                                    Consistency: ±{trend.consistency.toFixed(1)} pts variance
                                </Text>
                            )}
                        </View>

                        {/* Score line chart */}
                        {trend.scorePoints.length > 0 && (
                            <View style={s.chartCard}>
                                <Text style={s.chartTitle}>Score History</Text>
                                <LineChart points={trend.scorePoints} />
                                <View style={s.legendRow}>
                                    {[
                                        { color: '#22c55e', label: 'Good ≥75' },
                                        { color: '#f59e0b', label: 'Fair 50–74' },
                                        { color: '#ef4444', label: '<50' },
                                    ].map(l => (
                                        <View key={l.label} style={s.legendItem}>
                                            <View style={[s.legendDot, { backgroundColor: l.color }]} />
                                            <Text style={s.legendText}>{l.label}</Text>
                                        </View>
                                    ))}
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
    subtitle: { color: '#64748b', fontSize: 13, marginBottom: 24 },

    tabRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
    tab: {
        flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4,
        paddingHorizontal: 2, paddingVertical: 12, borderRadius: 14,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
    },
    tabActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },

    tabText: { color: '#94a3b8', fontSize: 12, fontWeight: '600' },
    tabTextActive: { color: '#fff' },

    centerBox: { alignItems: 'center', paddingVertical: 56, gap: 10 },
    bigEmoji: { fontSize: 52, marginBottom: 4 },
    centerTitle: { color: '#f1f5f9', fontSize: 18, fontWeight: '700' },
    centerSub: { color: '#64748b', fontSize: 13, textAlign: 'center', lineHeight: 20 },
    retryBtn: { marginTop: 12, backgroundColor: '#6366f1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 12 },
    retryText: { color: '#fff', fontWeight: '700', fontSize: 14 },

    kpiRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
    kpiCard: {
        flex: 1, backgroundColor: '#1e293b', borderRadius: 14, padding: 16,
        alignItems: 'center', borderWidth: 1, borderColor: '#334155',
    },
    kpiMid: { borderColor: '#6366f155' },
    kpiValue: { color: '#f1f5f9', fontSize: 26, fontWeight: '800', marginBottom: 2 },
    kpiLabel: { color: '#64748b', fontSize: 11, fontWeight: '600' },

    trendBadge: { borderRadius: 14, padding: 16, marginBottom: 20, borderWidth: 1 },
    trendLabel: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
    trendDelta: { color: '#cbd5e1', fontSize: 13, marginBottom: 2 },
    trendSub: { color: '#94a3b8', fontSize: 12 },

    chartCard: {
        backgroundColor: '#1e293b', borderRadius: 16, padding: 16,
        marginBottom: 16, borderWidth: 1, borderColor: '#334155',
    },
    chartTitle: { color: '#f1f5f9', fontSize: 14, fontWeight: '700', marginBottom: 12 },

    legendRow: { flexDirection: 'row', justifyContent: 'center', gap: 16, marginTop: 10 },
    legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
    legendDot: { width: 8, height: 8, borderRadius: 4 },
    legendText: { color: '#64748b', fontSize: 11 },

    repChart: { flexDirection: 'row', alignItems: 'flex-end', height: 96, gap: 4, marginTop: 4 },
    repBarWrap: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' },
    repBarVal: { color: '#64748b', fontSize: 9, marginBottom: 3 },
    repBar: { width: '70%', backgroundColor: '#6366f1', borderRadius: 4, opacity: 0.85 },
});
