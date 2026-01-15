import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import FormControl from '@mui/material/FormControl';
import InputLabel from '@mui/material/InputLabel';
import Select from '@mui/material/Select';
import MenuItem from '@mui/material/MenuItem';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import CircularProgress from '@mui/material/CircularProgress';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import TrendingDownIcon from '@mui/icons-material/TrendingDown';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import RefreshIcon from '@mui/icons-material/Refresh';
import { authFetch } from '../utils/api';
import { useProperty } from '../context/PropertyContext';

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
    const [basePeriod, setBasePeriod] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30);
        return date;
    });
    const [comparisonData, setComparisonData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const { selectedMeetingPoint, loading: contextLoading } = useProperty();

    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleCompare = async () => {
        if (!selectedMeetingPoint) {
            setError('Please select a metering point');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const dateFrom = formatDate(basePeriod);
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 2);
            const dateTo = formatDate(endDate);

            let endpoint = '';
            if (comparisonType === 'year_over_year') {
                endpoint = `/api/analytics/year-over-year?dateFrom=${dateFrom}&dateTo=${dateTo}&meteringPointId=${selectedMeetingPoint.id}`;
            } else if (comparisonType === 'month_over_month') {
                endpoint = `/api/analytics/month-over-month?dateFrom=${dateFrom}&dateTo=${dateTo}&meteringPointId=${selectedMeetingPoint.id}`;
            }

            console.log('Compare feature - Sending request:', {
                endpoint,
                selectedMeetingPoint: {
                    id: selectedMeetingPoint.id,
                    meteringPointId: selectedMeetingPoint.meteringPointId,
                    name: selectedMeetingPoint.name
                }
            });

            const response = await authFetch(endpoint);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.error || 'Failed to fetch comparison data');
            }

            setComparisonData(data);
        } catch (err) {
            console.error('Error fetching comparison data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Auto-fetch when metering point changes
    useEffect(() => {
        if (selectedMeetingPoint) {
            handleCompare();
        }
    }, [selectedMeetingPoint]);

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

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

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
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                                onClick={handleCompare}
                                disabled={loading || contextLoading}
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
                                    current={Math.round(comparisonData.summary.current_total * 100) / 100}
                                    previous={Math.round(comparisonData.summary.previous_total * 100) / 100}
                                    change={`${comparisonData.summary.average_percentage_change > 0 ? '+' : ''}${comparisonData.summary.average_percentage_change}%`}
                                    trend={comparisonData.summary.average_percentage_change < 0 ? 'improvement' : 'increase'}
                                    unit=" kWh"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Average Daily"
                                    current={(comparisonData.summary.current_total / comparisonData.summary.total_records).toFixed(2)}
                                    previous={(comparisonData.summary.previous_total / comparisonData.summary.total_records).toFixed(2)}
                                    change={`${comparisonData.summary.average_percentage_change > 0 ? '+' : ''}${comparisonData.summary.average_percentage_change}%`}
                                    trend={comparisonData.summary.average_percentage_change < 0 ? 'improvement' : 'increase'}
                                    unit=" kWh"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Records Compared"
                                    current={comparisonData.summary.records_with_comparison}
                                    previous={comparisonData.summary.total_records}
                                    change={`${Math.round((comparisonData.summary.records_with_comparison / comparisonData.summary.total_records) * 100)}%`}
                                    trend="normal"
                                />
                            </Grid>
                            <Grid item xs={12} sm={6} md={3}>
                                <ComparisonCard
                                    title="Comparison Type"
                                    current={comparisonType === 'year_over_year' ? 'YoY' : 'MoM'}
                                    previous={comparisonType === 'year_over_year' ? 'Year' : 'Month'}
                                    change="Active"
                                    trend="normal"
                                />
                            </Grid>
                        </Grid>

                        <Card>
                            <CardContent>
                                <Typography variant="h6" gutterBottom>
                                    Detailed Comparison Data
                                </Typography>
                                <Box sx={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '2px solid #e0e0e0' }}>
                                                <th style={{ padding: '12px', textAlign: 'left' }}>Date</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>Current (kWh)</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>Previous (kWh)</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>Difference</th>
                                                <th style={{ padding: '12px', textAlign: 'right' }}>% Change</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {comparisonData.data.slice(0, 10).map((row, idx) => (
                                                <tr key={idx} style={{ borderBottom: '1px solid #f0f0f0' }}>
                                                    <td style={{ padding: '12px' }}>{row.date}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>{row.current_consumption.toFixed(2)}</td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        {row.previous_consumption !== null ? row.previous_consumption.toFixed(2) : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        {row.absolute_difference !== null ? row.absolute_difference.toFixed(2) : 'N/A'}
                                                    </td>
                                                    <td style={{ padding: '12px', textAlign: 'right' }}>
                                                        {row.percentage_change !== null ? `${row.percentage_change > 0 ? '+' : ''}${row.percentage_change.toFixed(2)}%` : 'N/A'}
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </Box>
                                {comparisonData.data.length > 10 && (
                                    <Typography variant="caption" sx={{ mt: 2, display: 'block', color: 'text.secondary' }}>
                                        Showing 10 of {comparisonData.data.length} records
                                    </Typography>
                                )}
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