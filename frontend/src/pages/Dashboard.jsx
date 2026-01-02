import React, { useState, useEffect } from 'react';
import Grid from '@mui/material/Grid';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import CircularProgress from '@mui/material/CircularProgress';
import Tooltip from '@mui/material/Tooltip';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import SavingsIcon from '@mui/icons-material/Savings';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import CloudSyncIcon from '@mui/icons-material/CloudSync';
import { useNavigate } from 'react-router-dom';

const HealthCard = ({ title, status, subtitle, icon, loading }) => {
    const getStatusColor = () => {
        if (loading) return '#9e9e9e';
        switch (status?.toLowerCase()) {
            case 'up':
            case 'ok':
            case 'success':
                return '#4caf50';
            case 'degraded':
            case 'warning':
            case 'partial':
                return '#ff9800';
            case 'down':
            case 'error':
            case 'failed':
                return '#f44336';
            default:
                return '#9e9e9e';
        }
    };

    const getStatusIcon = () => {
        if (loading) return <CircularProgress size={20} color="inherit" />;
        switch (status?.toLowerCase()) {
            case 'up':
            case 'ok':
            case 'success':
                return <CheckCircleIcon />;
            case 'degraded':
            case 'warning':
            case 'partial':
                return <WarningIcon />;
            case 'down':
            case 'error':
            case 'failed':
                return <ErrorIcon />;
            default:
                return null;
        }
    };

    const color = getStatusColor();

    return (
        <Card sx={{ height: '100%', position: 'relative', overflow: 'hidden' }}>
            <Box sx={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', bgcolor: color }} />
            <CardContent>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
                    <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}15`, color: color, display: 'flex' }}>
                        {icon}
                    </Box>
                    <Box sx={{ color: color, display: 'flex' }}>
                        {getStatusIcon()}
                    </Box>
                </Box>
                <Typography variant="h5" component="div" sx={{ fontWeight: 'bold', mb: 0.5 }}>
                    {loading ? '---' : (status?.toUpperCase() || 'UNKNOWN')}
                </Typography>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom sx={{ fontWeight: 'bold' }}>
                    {title}
                </Typography>
                <Typography variant="body2" sx={{ color: 'text.secondary', mt: 1, minHeight: '3em' }}>
                    {loading ? 'Fetching status...' : subtitle}
                </Typography>
            </CardContent>
        </Card>
    );
};

const Dashboard = () => {
    const navigate = useNavigate();
    const [health, setHealth] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHealth = async () => {
            try {
                const response = await fetch('/api/health');
                const data = await response.json();
                setHealth(data);
            } catch (err) {
                console.error('Failed to fetch health:', err);
            } finally {
                setLoading(false);
            }
        };

        fetchHealth();
        const interval = setInterval(fetchHealth, 30000); // Poll every 30s
        return () => clearInterval(interval);
    }, []);

    const getSyncSubtitle = () => {
        if (!health?.sync) return 'No sync data available';
        if (!health.sync.lastRun) return 'Never synced';

        const lastRun = new Date(health.sync.lastRun);
        const now = new Date();
        const diffHrs = Math.abs(now - lastRun) / 36e5;

        let timeStr = lastRun.toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

        if (diffHrs > 48) return `Last sync was ${timeStr} (Outdated)`;
        if (diffHrs > 24) return `Last sync was ${timeStr} (Delayed)`;
        return `Last sync: ${timeStr} (${health.sync.recordsSynced || 0} records)`;
    };

    const getSyncStatus = () => {
        if (!health?.sync?.lastRun) return 'warning';
        if (health.sync.lastStatus === 'error') return 'error';

        const lastRun = new Date(health.sync.lastRun);
        const now = new Date();
        const diffHrs = Math.abs(now - lastRun) / 36e5;

        if (diffHrs > 48) return 'error';
        if (diffHrs > 24) return 'warning';
        return 'success';
    };

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    System health and performance overview.
                </Typography>
            </Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <HealthCard
                        title="API BACKEND"
                        status={health?.components?.api?.status || (loading ? null : 'error')}
                        subtitle={health?.environment ? `Environment: ${health.environment}` : 'Service unreachable'}
                        icon={<ElectricBoltIcon />}
                        loading={loading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <HealthCard
                        title="DATABASE"
                        status={health?.components?.database?.status || (loading ? null : 'error')}
                        subtitle={health?.components?.database?.status === 'up' ? 'PostgreSQL Connection Active' : 'Database Connection Failed'}
                        icon={<StorageIcon />}
                        loading={loading}
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <HealthCard
                        title="DATA SYNC"
                        status={getSyncStatus()}
                        subtitle={getSyncSubtitle()}
                        icon={<CloudSyncIcon />}
                        loading={loading}
                    />
                </Grid>
            </Grid>

            <Card sx={{ p: 3, backgroundImage: 'linear-gradient(45deg, #132F4C 30%, #0A1929 90%)', borderRadius: 3 }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold', color: 'primary.light' }}>
                            Deep Dive Analysis
                        </Typography>
                        <Typography variant="body1" sx={{ color: 'rgba(255,255,255,0.7)', mb: 3 }}>
                            Explore your historical consumption data with detailed charts and filtering options.
                            Identify trends and optimize your usage across all your properties.
                        </Typography>
                        <Button
                            variant="contained"
                            size="large"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => navigate('/analysis')}
                            sx={{ borderRadius: 2, px: 4 }}
                        >
                            Go to Analysis
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <TrendingUpIcon sx={{ fontSize: 140, color: 'primary.main', opacity: 0.2 }} />
                    </Grid>
                </Grid>
            </Card>
        </Box>
    );
};

export default Dashboard;
