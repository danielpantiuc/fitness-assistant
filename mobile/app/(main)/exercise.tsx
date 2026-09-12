import React, { useState, useRef, useEffect } from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    Alert, ScrollView, Modal, Animated,
} from 'react-native';
import { useVideoPlayer, VideoView } from 'expo-video';
import * as ImagePicker from 'expo-image-picker';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { uploadVideo } from '../../src/api/client';
import { Ionicons } from '@expo/vector-icons';
import SquatIcon from '../../assets/icons/squat.svg';
import BenchIcon from '../../assets/icons/benchpress.svg';
import DeadliftIcon from '../../assets/icons/deadlift.svg';


function CircularProgress({ progress, color, size = 200, stroke = 14 }: {
    progress: number; color: string; size?: number; stroke?: number;
}) {
    const half = size / 2;
    const p = Math.min(Math.max(progress, 0), 100);

    const rightRotate = (Math.min(p, 50) / 50) * 180 - 135;
    
    const leftRotate = p > 50 ? ((p - 50) / 50) * 180 - 135 : -135;

    const rightRing: any = {
        position: 'absolute', left: -half,
        width: size, height: size, borderRadius: half, borderWidth: stroke,
        borderTopColor: color, borderRightColor: color,
        borderBottomColor: 'transparent', borderLeftColor: 'transparent',
        transform: [{ rotate: `${rightRotate}deg` }],
    };

    const leftRing: any = {
        position: 'absolute', left: 0,
        width: size, height: size, borderRadius: half, borderWidth: stroke,
        borderBottomColor: color, borderLeftColor: color,
        borderTopColor: 'transparent', borderRightColor: 'transparent',
        transform: [{ rotate: `${leftRotate}deg` }],
    };

    return (
        <View style={{ width: size, height: size }}>
            {/* Background ring */}
            <View style={{
                position: 'absolute', width: size, height: size,
                borderRadius: half, borderWidth: stroke, borderColor: '#1e293b',
            }} />

            {/* Right half clip (0–50%) */}
            <View style={{ position: 'absolute', right: 0, width: half, height: size, overflow: 'hidden' }}>
                <View style={rightRing} />
            </View>

            {/* Left half clip (50–100%) */}
            {p > 50 && (
                <View style={{ position: 'absolute', left: 0, width: half, height: size, overflow: 'hidden' }}>
                    <View style={leftRing} />
                </View>
            )}

            {/* Center percentage */}
            <View style={[StyleSheet.absoluteFillObject, { justifyContent: 'center', alignItems: 'center' }]}>
                <Text style={{ color: '#f1f5f9', fontSize: 40, fontWeight: '700' }}>
                    {Math.round(p)}%
                </Text>
            </View>
        </View>
    );
}


const EXERCISE_META: Record<string, { label: string; color: string; tip: string, Icon: any }> = {
    SQUAT: {
        label: 'Squat', color: '#6366f1',
        tip: 'It is recommended to film from the side. Ensure your full body from head to feet is visible.',
        Icon: SquatIcon,
    },
    BENCH_PRESS: {
        label: 'Bench Press', color: '#0ea5e9',
        tip: 'It is recommended to film from the side. Make sure your arms, torso and hips are all visible.',
        Icon: BenchIcon,
    },
    DEADLIFT: {
        label: 'Deadlift', color: '#10b981',
        tip: 'It is recommended to film from the side. Ensure your full body from feet to shoulders is visible.',
        Icon: DeadliftIcon,
    },
};


export default function ExerciseScreen() {
    const router = useRouter();
    const { type, videoUri: preloadedUri } = useLocalSearchParams<{ type: string; videoUri?: string }>();
    const exerciseType = (type ?? 'SQUAT').toUpperCase();
    const meta = EXERCISE_META[exerciseType] ?? EXERCISE_META['SQUAT'];

    const [videoUri, setVideoUri] = useState<string | null>(
        preloadedUri ? decodeURIComponent(preloadedUri) : null
    );
    const [uploading, setUploading] = useState(false);
    const [progress, setProgress] = useState(0);
    const progressInterval = useRef<ReturnType<typeof setInterval> | null>(null);
    const fadeAnim = useRef(new Animated.Value(0)).current;
    const abortControllerRef = useRef<AbortController | null>(null);

    const player = useVideoPlayer(videoUri, player => {
        player.loop = false;
    });

    const startProgress = () => {
        setProgress(0);
        Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
        let current = 0;
        progressInterval.current = setInterval(() => {
            current += Math.random() * 2.5 + 0.5; // random increment 0.5-3%
            if (current >= 90) {
                current = 90;
                clearInterval(progressInterval.current!);
            }
            setProgress(Math.min(current, 90));
        }, 400);
    };

    const finishProgress = () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
        setProgress(100);
        setTimeout(() => {
            Animated.timing(fadeAnim, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
                setUploading(false);
                setProgress(0);
            });
        }, 600);
    };

    useEffect(() => () => {
        if (progressInterval.current) clearInterval(progressInterval.current);
    }, []);


    const pickVideo = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your media library.'); return; }
        const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['videos'], quality: 1 });
        if (!result.canceled) setVideoUri(result.assets[0].uri);
    };

    const recordVideo = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') { Alert.alert('Permission needed', 'Please allow access to your camera.'); return; }
        try {
            const result = await ImagePicker.launchCameraAsync({ mediaTypes: ['videos'], quality: 1, videoMaxDuration: 120 });
            if (!result.canceled) setVideoUri(result.assets[0].uri);
        } catch (error) {
            Alert.alert('Camera Unavailable', 'The camera cannot be used on this device (e.g. simulator). Please choose a video from the library instead.');
        }
    };

    const handleUpload = async () => {
        if (!videoUri) return Alert.alert('No video', 'Please select or record a video first.');
        setUploading(true);
        startProgress();
        const controller = new AbortController();
        abortControllerRef.current = controller;
        try {
            const result = await uploadVideo(videoUri, exerciseType, controller.signal);
            finishProgress();
            setTimeout(() => {
                Alert.alert('Analysis complete!', 'Tap to view your results.', [
                    { text: 'View Results', onPress: () => router.push(`/results?videoId=${result.videoId}`) },
                ]);
            }, 700);
        } catch (err: any) {
            if (err.name === 'CanceledError' || err.name === 'AbortError' || err.code === 'ERR_CANCELED') return;
            if (progressInterval.current) clearInterval(progressInterval.current);
            Animated.timing(fadeAnim, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
                setUploading(false);
                setProgress(0);
            });
            Alert.alert('Upload failed', err.response?.data?.detail || err.message);
        }
    };

    const handleCancel = () => {
        abortControllerRef.current?.abort();
        if (progressInterval.current) clearInterval(progressInterval.current);
        Animated.timing(fadeAnim, { toValue: 0, duration: 250, useNativeDriver: true }).start(() => {
            setUploading(false);
            setProgress(0);
        });
    };


    return (
        <View style={{ flex: 1 }}>
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                        <Ionicons name="arrow-back" size={24} color="#f8fafc" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>AI Assistant</Text>
                </View>

                <View style={styles.titleRow}>
                    <View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                            <meta.Icon width={34} height={34} fill="#fff" />
                            <Text style={styles.title}>{meta.label}</Text>
                        </View>
                        <Text style={styles.subtitle}>Form Analysis</Text>
                    </View>
                </View>

                <View style={[styles.divider, { backgroundColor: meta.color }]} />

                <View style={styles.tipBox}>
                    <Ionicons name="information-circle-outline" size={18} color="#64748b" style={{ marginTop: 1 }} />
                    <Text style={styles.tipText}>{meta.tip}</Text>
                </View>

                <Text style={styles.sectionLabel}>VIDEO</Text>

                {videoUri ? (
                    <View style={styles.previewContainer}>
                        <VideoView player={player} style={styles.videoPreview}
                            allowsPictureInPicture contentFit="contain" />
                        <TouchableOpacity style={styles.clearBtn} onPress={() => setVideoUri(null)}>
                            <Text style={styles.clearBtnText}>✕ Remove video</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <View style={styles.videoBtnRow}>
                        <TouchableOpacity style={styles.videoPicker} onPress={pickVideo}>
                            <Ionicons name="folder-open-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                            <Text style={styles.videoBtnLabel}>Choose from{'\n'}library</Text>
                        </TouchableOpacity>
                        <TouchableOpacity style={styles.videoPicker} onPress={recordVideo}>
                            <Ionicons name="videocam-outline" size={32} color="#94a3b8" style={{ marginBottom: 8 }} />
                            <Text style={styles.videoBtnLabel}>Record{'\n'}now</Text>
                        </TouchableOpacity>
                    </View>
                )}

                <TouchableOpacity
                    style={[styles.uploadBtn, { backgroundColor: meta.color }, (!videoUri || uploading) && styles.uploadBtnDisabled]}
                    onPress={handleUpload}
                    disabled={!videoUri || uploading}
                >
                    <Text style={styles.uploadBtnText}>Analyze Form</Text>
                </TouchableOpacity>

            </ScrollView>

            {/* ── Loading Overlay ── */}
            <Modal visible={uploading} transparent animationType="none" statusBarTranslucent>
                <Animated.View style={[styles.overlay, { opacity: fadeAnim }]}>
                    <CircularProgress progress={progress} color={meta.color} size={200} stroke={14} />
                    <Text style={styles.loadingTitle}>Analyzing Form</Text>
                    <Text style={styles.loadingSubtitle}>AI is processing your video…{'\n'}This may take up to 2 minutes.</Text>
                    <TouchableOpacity style={styles.cancelBtn} onPress={handleCancel}>
                        <Text style={styles.cancelBtnText}>✕  Cancel</Text>
                    </TouchableOpacity>
                </Animated.View>
            </Modal>
        </View>
    );
}


const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#0f172a' },
    content: { padding: 24, paddingTop: 56, paddingBottom: 40 },

    header: { flexDirection: 'row', alignItems: 'center', marginBottom: 24, gap: 16 },
    headerTitle: { color: '#f8fafc', fontSize: 18, fontWeight: '700' },

    backBtn: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        padding: 8, backgroundColor: '#334155', borderRadius: 20,
    },

    titleRow: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 16 },
    title: { color: '#f1f5f9', fontSize: 28, fontWeight: '800' },
    subtitle: { color: '#64748b', fontSize: 14, marginTop: 2 },

    divider: { height: 3, borderRadius: 2, marginBottom: 20 },

    tipBox: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, backgroundColor: '#1e293b', borderRadius: 12, padding: 14, marginBottom: 28 },
    tipText: { color: '#94a3b8', fontSize: 13, lineHeight: 20, flex: 1 },

    sectionLabel: { color: '#475569', fontSize: 11, fontWeight: '700', letterSpacing: 1.2, marginBottom: 10, textTransform: 'uppercase' },

    videoBtnRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 20 },
    videoPicker: { width: '48%', backgroundColor: '#1e293b', borderRadius: 12, padding: 20, alignItems: 'center', borderWidth: 2, borderColor: '#334155', borderStyle: 'dashed' },
    videoBtnLabel: { color: '#94a3b8', fontSize: 12, fontWeight: '600', textAlign: 'center' },

    previewContainer: { marginBottom: 20 },
    videoPreview: { width: '100%', height: 220, borderRadius: 12, backgroundColor: '#000' },
    clearBtn: { alignSelf: 'center', marginTop: 10, paddingHorizontal: 16, paddingVertical: 6, borderRadius: 8, backgroundColor: '#1e293b' },
    clearBtnText: { color: '#ef4444', fontSize: 13, fontWeight: '600' },

    uploadBtn: { padding: 18, borderRadius: 16, alignItems: 'center', marginTop: 'auto' },
    uploadBtnDisabled: { opacity: 0.4 },
    uploadBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },

    overlay: {
        flex: 1, backgroundColor: 'rgba(10, 15, 28, 0.97)',
        justifyContent: 'center', alignItems: 'center', gap: 28,
    },
    loadingTitle: { color: '#f1f5f9', fontSize: 22, fontWeight: '700', textAlign: 'center' },
    loadingSubtitle: { color: '#64748b', fontSize: 14, textAlign: 'center', lineHeight: 22 },

    cancelBtn: {
        marginTop: 8,
        paddingHorizontal: 36, paddingVertical: 13,
        borderRadius: 50,
        borderWidth: 1.5, borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
    },
    cancelBtnText: { color: '#ef4444', fontSize: 15, fontWeight: '700', letterSpacing: 0.3 },
});
