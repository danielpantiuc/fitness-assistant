import React, { createContext, useContext, useState, useEffect } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { getToken, logout as apiLogout } from '../api/client';

interface AuthContextType {
    isAuthenticated: boolean;
    isLoading: boolean;
    userEmail: string | null;
    username: string | null;
    signIn: (email: string, username: string) => void;
    setUsername: (username: string) => void;
    signOut: () => Promise<void>;
}

const AUTH_EMAIL_KEY    = 'user_email';
const AUTH_USERNAME_KEY = 'user_username';

const AuthContext = createContext<AuthContextType>({} as AuthContextType);

export function AuthProvider({ children }: { children: React.ReactNode }) {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [userEmail, setUserEmail] = useState<string | null>(null);
    const [username, setUsernameState] = useState<string | null>(null);
    const router = useRouter();

    useEffect(() => {
        Promise.all([
            getToken(),
            SecureStore.getItemAsync(AUTH_EMAIL_KEY),
            SecureStore.getItemAsync(AUTH_USERNAME_KEY),
        ]).then(([token, email, uname]) => {
            setIsAuthenticated(!!token);
            setUserEmail(email);
            setUsernameState(uname);
            setIsLoading(false);
        });
    }, []);

    const signIn = (email: string, uname: string) => {
        setIsAuthenticated(true);
        setUserEmail(email);
        setUsernameState(uname);
        SecureStore.setItemAsync(AUTH_EMAIL_KEY, email);
        SecureStore.setItemAsync(AUTH_USERNAME_KEY, uname);
    };

    const setUsername = (uname: string) => {
        setUsernameState(uname);
        SecureStore.setItemAsync(AUTH_USERNAME_KEY, uname);
    };

    const signOut = async () => {
        await apiLogout();
        await SecureStore.deleteItemAsync(AUTH_EMAIL_KEY);
        await SecureStore.deleteItemAsync(AUTH_USERNAME_KEY);
        setIsAuthenticated(false);
        setUserEmail(null);
        setUsernameState(null);
        if (router.canDismiss()) {
            router.dismissAll();
        }
        router.replace('/(auth)');
    };

    return (
        <AuthContext.Provider value={{ isAuthenticated, isLoading, userEmail, username, signIn, setUsername, signOut }}>
            {children}
        </AuthContext.Provider>
    );
}

export const useAuth = () => useContext(AuthContext);
