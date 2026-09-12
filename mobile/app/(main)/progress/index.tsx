import React from 'react';
import {
    View, Text, TouchableOpacity, StyleSheet,
    ScrollView, StatusBar,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';

const PROGRESS_SECTIONS = [
    {
        key: 'history',
        label: 'Exercise History',
        icon: 'calendar-outline',
        description: 'View all your past sessions',
        color: '#6366f1',
    },
    {
        key: 'trends',
        label: 'Performance Trends',
        icon: 'trending-up-outline',
        description: 'Track your improvement over time',
        color: '#0ea5e9',
    },
];

export default function ProgressIndexScreen() {
    const router = useRouter();

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" />
            <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

                {/* Header */}
                <View style={styles.header}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
                        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                            <Ionicons name="arrow-back" size={24} color="#f1f5f9" />
                        </TouchableOpacity>
                        <View>
                            <Text style={styles.logo}>Your Progress</Text>
                            <Text style={styles.subtitle}>Track, analyze, improve</Text>
                        </View>
                    </View>
                    <TouchableOpacity style={styles.settingsBtn} onPress={() => router.push('/profile')}>
                        <Ionicons name="settings-outline" size={22} color="#94a3b8" />
                    </TouchableOpacity>
                </View>

                {/* Intro */}
                <Text style={styles.intro}>
                    View your workout history, monitor performance trends, and get AI-powered insights to help you improve.
                </Text>

                {/* Cards */}
                {PROGRESS_SECTIONS.map((section) => (
                    <TouchableOpacity
                        key={section.key}
                        style={[styles.card, { borderColor: section.color + '55' }]}
                        activeOpacity={0.8}
                        onPress={() => router.push(`/progress/${section.key}`)}
                    >
                        <View style={[styles.cardAccent, { backgroundColor: section.color }]} />

                        <View style={styles.cardBody}>
                            <View style={[styles.emojiCircle, { backgroundColor: section.color + '22' }]}>
                                <Ionicons name={section.icon as any} size={28} color={section.color} />
                            </View>

                            <View style={styles.cardText}>
                                <Text style={styles.cardLabel}>{section.label}</Text>
                                <Text style={styles.cardDescription}>{section.description}</Text>
                            </View>

                            <View style={[styles.arrow, { backgroundColor: section.color + '22' }]}>
                                <Text style={[styles.arrowText, { color: section.color }]}>›</Text>
                            </View>
                        </View>
                    </TouchableOpacity>
                ))}

                <Text style={styles.footer}>
                    Analyze your form, monitor your stats, and stay motivated on your fitness journey.
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
        alignItems: 'flex-start', marginBottom: 32,
    },
    logo: { fontSize: 26, fontWeight: '800', color: '#f1f5f9', marginBottom: 2 },
    subtitle: { color: '#64748b', fontSize: 13 },
    settingsBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },
    backBtn: {
        width: 40, height: 40, borderRadius: 20,
        backgroundColor: '#1e293b', borderWidth: 1, borderColor: '#334155',
        justifyContent: 'center', alignItems: 'center',
    },

    intro: { color: '#94a3b8', fontSize: 14, lineHeight: 20, marginBottom: 28 },

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
    cardDescription: { color: '#94a3b8', fontSize: 13, lineHeight: 18 },
    arrow: { width: 36, height: 36, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
    arrowText: { fontSize: 24, fontWeight: '300', marginTop: -2 },

    footer: { color: '#334155', fontSize: 12, textAlign: 'center', marginTop: 24, lineHeight: 18 },
});
