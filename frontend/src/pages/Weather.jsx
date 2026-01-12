import React, { useState, useEffect } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import Stack from '@mui/material/Stack';
import Chip from '@mui/material/Chip';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import Chart from 'react-apexcharts';
import { useTheme } from '@mui/material/styles';
import CloudIcon from '@mui/icons-material/Cloud';
import ThermostatIcon from '@mui/icons-material/Thermostat';
import WaterDropIcon from '@mui/icons-material/WaterDrop';
import TrendingUpIcon from '@mui/icons-material/TrendingUp';
import RefreshIcon from '@mui/icons-material/Refresh';
import ElectricBoltIcon from '@mui/icons-material/ElectricBolt';
import { authFetch } from '../utils/api';
import { useProperty } from '../context/PropertyContext';

const WeatherSummaryCard = ({ title, value, subtitle, icon, color, trend }) => (
    <Card sx={{ height: '100%' }}>
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
            {trend && (
                <Typography variant="caption" sx={{ color: color, mt: 1, display: 'block' }}>
                    {trend}
                </Typography>
            )}
        </CardContent>
    </Card>
);

const Weather = () => {
    const theme = useTheme();
    const [loading, setLoading] = useState(false);
    const [weatherData, setWeatherData] = useState(null);
    const [correlationData, setCorrelationData] = useState(null);
    const [error, setError] = useState(null);

    const { selectedMeetingPoint } = useProperty();

    // Date range state
    const [startDate, setStartDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 30); // Default to last 30 days
        return date;
    });
    const [endDate, setEndDate] = useState(() => {
        const date = new Date();
        date.setDate(date.getDate() - 2); // 2 days ago (data availability)
        return date;
    });

    // Format date for API
    const formatDate = (date) => {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    // Fetch weather and consumption data
    const fetchWeatherData = async () => {
        if (!selectedMeetingPoint) {
            setError("Please select a metering point");
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const dateFrom = formatDate(startDate);
            const dateTo = formatDate(endDate);

            // Fetch consumption-temperature data
            const dataResponse = await authFetch(
                `/api/weather/consumption-temperature?dateFrom=${dateFrom}&dateTo=${dateTo}&meteringPointId=${selectedMeetingPoint.id}`
            );

            if (!dataResponse.ok) {
                throw new Error(`HTTP error! status: ${dataResponse.status}`);
            }

            const dataResult = await dataResponse.json();

            if (!dataResult.success) {
                throw new Error(dataResult.error || 'Failed to fetch weather data');
            }

            setWeatherData(dataResult);

            // Fetch correlation analysis
            const correlationResponse = await authFetch(
                `/api/weather/correlation?dateFrom=${dateFrom}&dateTo=${dateTo}&meteringPointId=${selectedMeetingPoint.id}`
            );

            if (correlationResponse.ok) {
                const correlationResult = await correlationResponse.json();
                if (correlationResult.success) {
                    setCorrelationData(correlationResult.correlation);
                }
            }

        } catch (err) {
            console.error('Error fetching weather data:', err);
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    // Load data on component mount or context change
    useEffect(() => {
        if (selectedMeetingPoint) {
            fetchWeatherData();
        }
    }, [selectedMeetingPoint]);

    // Prepare chart data
    const prepareChartData = () => {
        if (!weatherData?.data) return { series: [], categories: [] };

        const categories = [];
        const consumptionData = [];
        const temperatureData = [];
        const precipitationData = [];

        weatherData.data.forEach(record => {
            categories.push(record.date);
            consumptionData.push(record.daily_consumption || 0);
            temperatureData.push(record.avg_temperature || null);
            precipitationData.push(record.total_precipitation || 0);
        });

        return {
            series: [
                {
                    name: 'Daily Consumption',
                    type: 'column',
                    yAxisIndex: 0,
                    data: consumptionData
                },
                {
                    name: 'Average Temperature',
                    type: 'line',
                    yAxisIndex: 1,
                    data: temperatureData
                },
                {
                    name: 'Precipitation',
                    type: 'area',
                    yAxisIndex: 2,
                    data: precipitationData
                }
            ],
            categories
        };
    };

    const chartData = prepareChartData();

    // Chart options
    const chartOptions = {
        chart: {
            type: 'line',
            height: 400,
            toolbar: { show: true },
            zoom: { enabled: true }
        },
        colors: [theme.palette.primary.main, theme.palette.error.main, theme.palette.info.main],
        dataLabels: { enabled: false },
        stroke: {
            width: [0, 2, 1],
            curve: 'smooth'
        },
        fill: {
            opacity: [0.8, 1, 0.3],
            type: ['solid', 'solid', 'gradient']
        },
        xaxis: {
            categories: chartData.categories,
            type: 'datetime',
            labels: {
                format: 'dd MMM'
            }
        },
        yaxis: [
            {
                title: { text: 'Consumption (kWh)' },
                labels: { formatter: (val) => (val !== null && val !== undefined) ? Number(val).toFixed(1) : '' }
            },
            {
                opposite: true,
                title: { text: 'Temperature (°C)' },
                labels: { formatter: (val) => (val !== null && val !== undefined) ? Number(val).toFixed(1) + '°C' : '' }
            },
            {
                opposite: true,
                show: false,
                title: { text: 'Precipitation (mm)' },
                labels: { formatter: (val) => (val !== null && val !== undefined) ? Number(val).toFixed(1) + 'mm' : '' }
            }
        ],
        tooltip: {
            shared: true,
            intersect: false,
            y: {
                formatter: function (val, { seriesIndex }) {
                    if (val === null || val === undefined) return '--';
                    const numVal = Number(val);
                    if (seriesIndex === 0) return numVal.toFixed(2) + ' kWh';
                    if (seriesIndex === 1) return numVal.toFixed(1) + '°C';
                    if (seriesIndex === 2) return numVal.toFixed(1) + 'mm';
                    return numVal.toString();
                }
            }
        },
        legend: {
            position: 'top',
            horizontalAlign: 'left'
        },
        theme: { mode: theme.palette.mode }
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom sx={{ fontWeight: 'bold' }}>
                        Weather Analysis
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Analyze how weather conditions correlate with your electricity consumption patterns.
                    </Typography>
                </Box>

                {/* Date Range Controls */}
                <Card sx={{ mb: 3 }}>
                    <CardContent>
                        <Typography variant="h6" gutterBottom>
                            Date Range Selection
                        </Typography>
                        <Stack direction={{ xs: 'column', md: 'row' }} spacing={2} alignItems="center">
                            <DatePicker
                                label="Start Date"
                                value={startDate}
                                onChange={setStartDate}
                                maxDate={new Date()}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { size: 'small' } }}
                            />
                            <DatePicker
                                label="End Date"
                                value={endDate}
                                onChange={setEndDate}
                                minDate={startDate}
                                maxDate={new Date()}
                                format="dd/MM/yyyy"
                                slotProps={{ textField: { size: 'small' } }}
                            />
                            <Button
                                variant="contained"
                                startIcon={loading ? <CircularProgress size={20} color="inherit" /> : <RefreshIcon />}
                                onClick={fetchWeatherData}
                                disabled={loading}
                            >
                                {loading ? 'Loading...' : 'Update Data'}
                            </Button>
                        </Stack>
                    </CardContent>
                </Card>

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }}>
                        {error}
                    </Alert>
                )}

                {/* Summary Cards */}
                {weatherData?.summary && (
                    <Grid container spacing={3} sx={{ mb: 4 }}>
                        <Grid item xs={12} sm={6} md={3}>
                            <WeatherSummaryCard
                                title="Total Consumption"
                                value={`${weatherData.summary.totalConsumption} kWh`}
                                subtitle={`Over ${weatherData.summary.totalRecords} days`}
                                icon={<ElectricBoltIcon />}
                                color="#00E5FF"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <WeatherSummaryCard
                                title="Average Temperature"
                                value={weatherData.summary.avgTemperature ? `${weatherData.summary.avgTemperature}°C` : '--°C'}
                                subtitle="Daily average temperature"
                                icon={<ThermostatIcon />}
                                color="#FF5722"
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <WeatherSummaryCard
                                title="Correlation Score"
                                value={(correlationData?.coefficient !== undefined && correlationData?.coefficient !== null) ? Number(correlationData.coefficient).toFixed(3) : '--'}
                                subtitle={correlationData?.strength || 'No correlation data'}
                                icon={<TrendingUpIcon />}
                                color="#2196F3"
                                trend={correlationData?.description}
                            />
                        </Grid>
                        <Grid item xs={12} sm={6} md={3}>
                            <WeatherSummaryCard
                                title="Data Completeness"
                                value={`${weatherData.summary.completeRecords}/${weatherData.summary.totalRecords}`}
                                subtitle="Days with both consumption & weather"
                                icon={<CloudIcon />}
                                color="#4CAF50"
                                trend={`${Math.round((weatherData.summary.completeRecords / weatherData.summary.totalRecords) * 100)}% complete`}
                            />
                        </Grid>
                    </Grid>
                )}

                {/* Main Chart */}
                <Card>
                    <CardContent>
                        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                            <Typography variant="h6">Daily Consumption vs Weather</Typography>
                            {weatherData?.summary && (
                                <Stack direction="row" spacing={1}>
                                    <Chip
                                        label={`${weatherData.summary.totalRecords} days`}
                                        size="small"
                                        variant="outlined"
                                    />
                                    <Chip
                                        label={`${weatherData.summary.completeRecords} complete`}
                                        size="small"
                                        color="success"
                                        variant="outlined"
                                    />
                                </Stack>
                            )}
                        </Box>

                        {loading ? (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <CircularProgress sx={{ mb: 2 }} />
                                <Typography variant="h6" gutterBottom>
                                    Loading Weather Data...
                                </Typography>
                                <Typography variant="body2">
                                    Fetching consumption and temperature data for analysis.
                                </Typography>
                            </Box>
                        ) : !weatherData?.data || weatherData.data.length === 0 ? (
                            <Box sx={{ p: 4, textAlign: 'center', color: 'text.secondary' }}>
                                <CloudIcon sx={{ fontSize: 64, mb: 2, opacity: 0.3 }} />
                                <Typography variant="h6" gutterBottom>
                                    No Weather Data Available
                                </Typography>
                                <Typography variant="body2">
                                    Select a date range and click "Update Data" to load weather and consumption information.
                                </Typography>
                            </Box>
                        ) : (
                            <Chart
                                options={chartOptions}
                                series={chartData.series}
                                type="line"
                                height={400}
                            />
                        )}
                    </CardContent>
                </Card>

                {/* Correlation Analysis */}
                {correlationData && (
                    <Card sx={{ mt: 3 }}>
                        <CardContent>
                            <Typography variant="h6" gutterBottom>
                                Correlation Analysis
                            </Typography>
                            <Grid container spacing={2}>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Temperature-Consumption Correlation
                                    </Typography>
                                    <Typography variant="h5" color="primary" gutterBottom>
                                        {(correlationData.coefficient !== undefined && correlationData.coefficient !== null) ? Number(correlationData.coefficient).toFixed(3) : 'N/A'}
                                    </Typography>
                                    <Chip
                                        label={correlationData.strength}
                                        color={
                                            correlationData.strength === 'Strong' ? 'success' :
                                                correlationData.strength === 'Moderate' ? 'warning' : 'default'
                                        }
                                        size="small"
                                    />
                                </Grid>
                                <Grid item xs={12} md={6}>
                                    <Typography variant="body2" color="text.secondary" gutterBottom>
                                        Analysis
                                    </Typography>
                                    <Typography variant="body2">
                                        {correlationData.description}
                                    </Typography>
                                    <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                                        Based on {correlationData.sampleSize} days of data
                                    </Typography>
                                </Grid>
                            </Grid>
                        </CardContent>
                    </Card>
                )}
            </Box>
        </LocalizationProvider>
    );
};

export default Weather;