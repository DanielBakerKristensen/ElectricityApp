import React, { createContext, useState, useContext, useEffect } from 'react';
import { authFetch } from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const verifySession = async () => {
            try {
                const response = await fetch('/api/auth/verify');
                if (response.ok) {
                    const data = await response.json();
                    setUser(data.user);
                }
            } catch (err) {
                console.error('Session verification failed:', err);
            } finally {
                setLoading(false);
            }
        };

        verifySession();
    }, []);

    const login = async (email, password) => {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (response.ok) {
            const data = await response.json();
            setUser(data.user);
            return { success: true, user: data.user };
        } else {
            const data = await response.json();
            return { success: false, error: data.error || 'Login failed' };
        }
    };

    const register = async ({ email, password, name }) => {
        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password, name }),
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                return { success: true, user: data.user };
            } else {
                const data = await response.json();
                return { success: false, error: data.error || 'Registration failed' };
            }
        } catch (error) {
            return { success: false, error: error.message || 'Network error' };
        }
    };

    const updateProfile = async (updates) => {
        try {
            const response = await fetch('/api/auth/profile', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
            });

            if (response.ok) {
                const data = await response.json();
                setUser(data.user);
                return { success: true, user: data.user };
            } else {
                const data = await response.json();
                return { success: false, error: data.error || 'Update failed' };
            }
        } catch (error) {
            return { success: false, error: error.message || 'Network error' };
        }
    };

    const checkOnboardingStatus = async () => {
        try {
            const response = await fetch('/api/auth/onboarding-status');
            if (response.ok) {
                const data = await response.json();
                return data.onboarding_completed;
            }
            return null;
        } catch (error) {
            return null;
        }
    };

    const logout = async () => {
        await fetch('/api/auth/logout', { method: 'POST' });
        setUser(null);
    };

    return (
        <AuthContext.Provider value={{ user, loading, login, register, updateProfile, checkOnboardingStatus, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
