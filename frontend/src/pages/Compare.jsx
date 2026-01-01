import React, { useState } from 'react';
import {
    Box,
    Card,
    CardContent,
    Grid,
    Typography,
    FormControl,
    InputLabel,
    Select,
    MenuItem,
    Button,
    Alert,
    Stack,
    Chip
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import RefreshIcon from '@mui/icons-material/Refresh';

const ComparisonCard = ({ title, current, previous, change, trend, unit = '' }) => {
    const isImprovement = trend === 'improvement';
    const isIncrease = change.startsWith('+');
    
    return (
        <Card sx={{ height: '100%' }}>
            <CardContent>
                <Typography variant="subtitle2" color="text.secondary" gutterBottom>
                    {title}
                </Typography>
                <Typography variant="h4" component="div" sx={{ fontWeight: 'bold', mb: 1 }}>
                    {current}{unit}
                </Typography>
                <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
                    vs {previous}{unit}
                </Typography>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                    <Chip
                        icon={isIncrease ? <TrendingUpIcon /> : <TrendingDownIcon />}
                        label={change}
                        color={isImprovement ? 'success' : isIncrease ? 'error' : 'success'}
                        size="small"
                    />
                </Box>
            </CardContent>
        </Card>
    );
};

const Compare = () => {
    const [comparisonType, setComparisonType] = useState('year_over_year');
    const [basePeriod, setBasePeriod] = useState(new Date());
    const [comparisonData, setComparisonData] = useState(null);
    const [loading, setLoading] = useState(false);

    const handleCompare = async () => {
        setLoading(true);
        // TODO: Implement comparison logic
        setTimeout(() => {
            setComparisonData({
                totalConsumption: { current: '245', previous: '267', change: '-8.2%' },
                averageDaily: { current: '12.3', previous: '13.4', change: '-8.2%' },
                peakUsage: { current: '4.2', previous: '3.8', change: '+10.5%' },
                efficiencyScore: { current: '87', previous: '82', change: '+6.1%' }
            });
            setLoading(false);
        }, 1500);
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Consumption Comparison
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Compare your electricity consumption across different time periods to identify trends and improvements.
                    </Typography>
                </Box>

                <Alert severity="info" sx={{ mb: 3 }}>
                    Comparison features are in development. This page will enable period-over-period analysis of your consumption data.
                </Alert>

                {/* Comparison Controls */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Comparison Settings
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                            <FormControl size="small" sx={{ minWidth: 200 }}>
                                <InputLabel>Comparison Type</InputLabel>
                                <Select
                                    value={comparisonType}
                                    label="Comparison Type"
                                    onChange={(e) => setComparisonType(e.target.value)}
                                >
                                    <MenuItem value="year_over_year">Year over Year</MenuItem>
                                    <MenuItem value="month_over_month">Month over Month</MenuItem>
                                    <MenuItem value="week_over_week">Week over Week</MenuItem>
                                    <MenuItem value="custom">Custom Period</MenuItem>
                                </Select>
                            </FormControl>

                            <DatePicker
                                label="Base Period"
                                value={basePeriod}
                                onChange={setBasePeriod}
                                maxDate={new Date()}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { size: 'small' } }}
                            />

                            <Button
                                variant="contained"
                                startIcon={<RefreshIcon />}
                                onClick={handleCompare}
                                disabled={loading}
                            >
                                {loading ? 'Comparing...' : 'Compare Periods'}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>

                {/* Comparison Results */}
                {comparisonData ? (
                    <>
                        <Grid container spacing={3} sx={{ mb: 4 }}>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Total Consumption"
                                    current={comparisonData.totalConsumption.current}
                                    previous={comparisonData.totalConsumption.previous}
                                    change={comparisonData.totalConsumption.change}
                                    trend="improvement"
                                    unit=" kWh"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Average Daily"
                                    current={comparisonData.averageDaily.current}
                                    previous={comparisonData.averageDaily.previous}
                                    change={comparisonData.averageDaily.change}
                                    trend="improvement"
                                    unit=" kWh"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Peak Usage"
                                    current={comparisonData.peakUsage.current}
                                    previous={comparisonData.peakUsage.previous}
                                    change={comparisonData.peakUsage.change}
                                    trend="increase"
                                    unit=" kWh"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Efficiency Score"
                                    current={comparisonData.efficiencyScore.current}
                                    previous={comparisonData.efficiencyScore.previous}
                                    change={comparisonData.efficiencyScore.change}
                                    trend="improvement"
                                />
                            </Grid>
                        </Grid>

                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Period Comparison Chart
                                </Typography>
                                <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                    <CompareArrowsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                    <Typography variant="h6" gutterBottom>
                                        Comparison Chart Coming Soon
                                    </Typography>
                                    <Typography variant="body2">
                                        This will show side-by-side charts comparing the selected periods with detailed breakdowns.
                                    </Typography>
                                </Box>
                            </CardContent>
                        </Card>
                    </>
                ) : (
                    <Card>
                        <CardContent>
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <CompareArrowsIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                <Typography variant="h6" gutterBottom>
                                    No Comparison Data
                                </Typography>
                                <Typography variant="body2">
                                    Select your comparison settings and click "Compare Periods" to analyze your consumption trends.
                                </Typography>
                            </Box>
                        </CardContent>
                    </Card>
                )}
            </Box>
        </LocalizationProvider>
    );
};

export default Compare;