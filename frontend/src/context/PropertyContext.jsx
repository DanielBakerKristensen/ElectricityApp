import React, { createContext, useState, useContext, useEffect } from 'react';
import { authFetch } from '../utils/api';
import { useAuth } from './AuthContext';

const PropertyContext = createContext(null);

export const PropertyProvider = ({ children }) => {
    const { user } = useAuth();
    const [properties, setProperties] = useState([]);
    const [selectedProperty, setSelectedProperty] = useState(null);
    const [selectedMeetingPoint, setSelectedMeetingPoint] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (user) {
            fetchProperties();
        } else {
            // Reset state on logout
            setProperties([]);
            setSelectedProperty(null);
            setSelectedMeetingPoint(null);
            setLoading(false);
        }
    }, [user]);

    const fetchProperties = async () => {
        setLoading(true);
        try {
            const response = await authFetch('/api/settings/properties');
            if (response.ok) {
                const data = await response.json();
                setProperties(data);

                // Default selection logic
                if (data.length > 0) {
                    let defaultProp = null;
                    let defaultMp = null;

                    // 1. Try user's saved default (if available in user object)
                    if (user?.defaultPropertyId) {
                        defaultProp = data.find(p => p.id === user.defaultPropertyId);
                    }

                    // 2. Fallback to first property
                    if (!defaultProp) {
                        defaultProp = data[0];
                    }

                    setSelectedProperty(defaultProp);

                    // Handle Meeting Point selection
                    if (defaultProp?.meteringPoints?.length > 0) {
                        // 1. Try user's saved default MP
                        if (user?.defaultMeetingPointId) {
                            defaultMp = defaultProp.meteringPoints.find(mp => mp.id === user.defaultMeetingPointId);
                        }

                        // 2. Fallback to first MP of the selected property
                        if (!defaultMp) {
                            defaultMp = defaultProp.meteringPoints[0];
                        }

                        setSelectedMeetingPoint(defaultMp);
                    } else {
                        setSelectedMeetingPoint(null);
                    }
                }
            }
        } catch (err) {
            console.error('Failed to fetch properties:', err);
        } finally {
            setLoading(false);
        }
    };

    const handlePropertyChange = (propertyId) => {
        const prop = properties.find(p => p.id === Number(propertyId));
        setSelectedProperty(prop);

        // Reset or select default meeting point for new property
        if (prop?.meteringPoints?.length > 0) {
            // If the new property happens to contain the *currently* selected MP (unlikely unless shared), keep it. 
            // Otherwise default to first.
            // Actually, safe bet is just default to first unless we implement complex "remember last used per property" logic.
            setSelectedMeetingPoint(prop.meteringPoints[0]);
        } else {
            setSelectedMeetingPoint(null);
        }
    };

    const handleMeetingPointChange = (mpId) => {
        // Find MP in current property.
        // Assuming MP IDs are unique globally or we only look in current property.
        const mp = selectedProperty?.meteringPoints?.find(m => m.id === mpId);
        if (mp) {
            setSelectedMeetingPoint(mp);
        }
    };

    const saveAsDefault = async () => {
        if (!selectedProperty) return;
        try {
            await authFetch('/api/auth/profile', {
                method: 'PUT',
                body: JSON.stringify({
                    defaultPropertyId: selectedProperty.id,
                    defaultMeetingPointId: selectedMeetingPoint?.id
                })
            });
            // Update local user context if needed, but PropertyContext logic relies on local state mainly.
            // Ideally we should update AuthContext user object too? 
            // Yes, let's verify session to refresh user object in AuthContext?
            // Or just fire and forget if PropertyContext doesn't read user object after initial load.
        } catch (err) {
            console.error('Failed to save default:', err);
        }
    };

    return (
        <PropertyContext.Provider value={{
            properties,
            selectedProperty,
            selectedMeetingPoint,
            setSelectedProperty: handlePropertyChange,
            setSelectedMeetingPoint: handleMeetingPointChange,
            saveAsDefault,
            loading
        }}>
            {children}
        </PropertyContext.Provider>
    );
};

export const useProperty = () => useContext(PropertyContext);
