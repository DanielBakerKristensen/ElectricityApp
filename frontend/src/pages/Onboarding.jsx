import React from 'react';
import { useNavigate } from 'react-router-dom';
import PropertyWizard from '../components/PropertyWizard';

const Onboarding = () => {
    const navigate = useNavigate();

    const handleComplete = () => {
        // Redirect to dashboard after successful setup
        navigate('/', { replace: true });
    };

    const handleSkip = () => {
        // Go to settings if user wants to set up manually
        navigate('/settings');
    };

    return <PropertyWizard onComplete={handleComplete} onSkip={handleSkip} />;
};

export default Onboarding;
