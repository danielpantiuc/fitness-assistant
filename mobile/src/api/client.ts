import axios from 'axios';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const debuggerHost = Constants.expoConfig?.hostUri;
const localIp = debuggerHost?.split(':')[0];

export const BASE_URL = __DEV__ && localIp 
    ? `http://${localIp}:8080/api/v1`
    : 'http://localhost:8080/api/v1';

const api = axios.create({ baseURL: BASE_URL });

api.interceptors.request.use(async (config) => {
    const isAuthRequest = config.url && config.url.startsWith('/auth');
    if (!isAuthRequest) {
        const token = await SecureStore.getItemAsync('jwt_token');
        if (token) config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});


export async function register(email: string, password: string, username: string) {
    const { data } = await api.post('/auth/register', { email, password, username });
    await SecureStore.setItemAsync('jwt_token', data.token);
    return data;
}

export async function login(email: string, password: string) {
    const { data } = await api.post('/auth/login', { email, password });
    await SecureStore.setItemAsync('jwt_token', data.token);
    return data;
}

export async function logout() {
    await SecureStore.deleteItemAsync('jwt_token');
}

export async function getToken() {
    return SecureStore.getItemAsync('jwt_token');
}


export async function uploadVideo(fileUri: string, exerciseType: string, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: 'video.mp4',
        type: 'video/mp4',
    } as any);
    formData.append('exerciseType', exerciseType);

    const { data } = await api.post('/videos', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 120000,
        signal,
    });
    return data;
}

export async function classifyVideo(fileUri: string, signal?: AbortSignal) {
    const formData = new FormData();
    formData.append('file', {
        uri: fileUri,
        name: 'video.mp4',
        type: 'video/mp4',
    } as any);

    const { data } = await api.post('/videos/classify', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 60000,
        signal,
    });
    return data as { detectedExercise: string; confidence: number; framesAnalyzed: number };
}

export async function getAnalysisResult(videoId: string) {
    const { data } = await api.get(`/videos/${videoId}/result`);
    return data;
}


export async function getProfile() {
    const { data } = await api.get('/users/me');
    return data as { email: string; username: string };
}

export async function changeName(username: string) {
    const { data } = await api.patch('/users/me/name', { username });
    return data as { email: string; username: string };
}

export async function changePassword(currentPassword: string, newPassword: string) {
    await api.patch('/users/me/password', { currentPassword, newPassword });
}

export async function logoutRemote() {
    await api.post('/users/me/logout');
}
