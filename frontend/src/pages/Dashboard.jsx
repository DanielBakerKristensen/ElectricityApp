import React from 'react';
import { Grid, Card, CardContent, Typography, Box, Button } from '@mui/material';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import SavingsIcon from '@mui/icons-material/Savings';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { useNavigate } from 'react-router-dom';

const SummaryCard = ({ title, value, subtitle, icon, color, onClick }) => (
    <Card
        sx={{
            height: '100%',
            cursor: onClick ? 'pointer' : 'default',
            transition: 'transform 0.2s',
            '&:hover': onClick ? { transform: 'translateY(-4px)' } : {}
        }}
        onClick={onClick}
    >
        <CardContent>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2 }}>
                <Box sx={{ p: 1, borderRadius: 2, bgcolor: `${color}20`, color: color }}>
                    {icon}
                </Box>
            </Box>
            <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                {value}
            </Typography>
            <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                {title}
            </Typography>
            <Typography variant="body2" sx={{ color: 'text.secondary', mt: 2 }}>
                {subtitle}
            </Typography>
        </CardContent>
    </Card>
);

const Dashboard = () => {
    const navigate = useNavigate();

    return (
        <Box>
            <Box sx={{ mb: 4 }}>
                <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                    Dashboard
                </Typography>
                <Typography variant="body1" color="text.secondary">
                    Welcome back! Here's an overview of your electricity consumption.
                </Typography>
            </Box>

            <Grid container spacing={3} sx={{ mb: 4 }}>
                <Grid item xs={12} sm={6} md={4}>
                    <SummaryCard
                        title="Average Daily Usage"
                        value="12.5 kWh"
                        subtitle="Based on last 30 days"
                        icon={<ElectricBoltIcon />}
                        color="#00E5FF"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <SummaryCard
                        title="Peak Consumption"
                        value="4.2 kWh"
                        subtitle="Highest hourly usage this week"
                        icon={<TrendingUpIcon />}
                        color="#FF4081"
                    />
                </Grid>
                <Grid item xs={12} sm={6} md={4}>
                    <SummaryCard
                        title="Estimated Cost"
                        value="~450 DKK"
                        subtitle="Projected for this month"
                        icon={<SavingsIcon />}
                        color="#00E676"
                    />
                </Grid>
            </Grid>

            <Card sx={{ p: 3, backgroundImage: 'linear-gradient(45deg, #132F4C 30%, #0A1929 90%)' }}>
                <Grid container spacing={3} alignItems="center">
                    <Grid item xs={12} md={8}>
                        <Typography variant="h5" gutterBottom sx={{ fontWeight: 'bold' }}>
                            Deep Dive Analysis
                        </Typography>
                        <Typography variant="body1" color="text.secondary" paragraph>
                            Explore your historical consumption data with detailed charts and filtering options.
                            Identify trends and optimize your usage.
                        </Typography>
                        <Button
                            variant="contained"
                            endIcon={<ArrowForwardIcon />}
                            onClick={() => navigate('/analysis')}
                        >
                            Go to Analysis
                        </Button>
                    </Grid>
                    <Grid item xs={12} md={4} sx={{ display: 'flex', justifyContent: 'center' }}>
                        <ElectricBoltIcon sx={{ fontSize: 120, opacity: 0.1 }} />
                    </Grid>
                </Grid>
            </Card>
        </Box>
    );
};

export default Dashboard;
