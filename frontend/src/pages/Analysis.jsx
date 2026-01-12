import React, { useState, useEffect } from 'react';
import Chart from 'react-apexcharts';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import CircularProgress from '@mui/material/CircularProgress';
import { useTheme } from '@mui/material/styles';
import { LocalizationProvider } from '@mui/x-date-pickers/LocalizationProvider';
import { AdapterDateFns } from '@mui/x-date-pickers/AdapterDateFns';
import { getCandlestickOptions, getHorizontalBarOptions } from '../utils/chartConfig';
import AnalysisToolbar from '../components/AnalysisToolbar';
import { authFetch } from '../utils/api';
import { useProperty } from '../context/PropertyContext';

const Analysis = () => {
    const theme = useTheme();

    // Helper function to calculate default date range
    const calculateDefaultDates = () => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 2); // 2 days ago
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before
        return { startDate, endDate };
    };

    const defaultDates = calculateDefaultDates();

    // State management
    const [dbData, setDbData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [chartType, setChartType] = useState('candlestick');
    const [comparisonMode, setComparisonMode] = useState('none');

    // Properties state from Context
    const { selectedProperty, selectedMeetingPoint, loading: contextLoading } = useProperty();

    // Re-fetch data when selected meeting point changes
    useEffect(() => {
        if (selectedMeetingPoint) {
            fetchData();
        } else {
            setDbData(null);
        }
    }, [selectedMeetingPoint, startDate, endDate]);

    // Date validation
    const validateDateRange = (start, end) => {
        if (start > end) return "Start date must be before or equal to end date";
        const diffDays = Math.ceil(Math.abs(end - start) / (1000 * 60 * 60 * 24));
        if (diffDays > 730) return "Date range cannot exceed 730 days (API limitation)";
        return null;
    };

    const fetchData = async () => {
        const validationError = validateDateRange(startDate, endDate);
        if (validationError) {
            setError(validationError);
            return;
        }

        if (!selectedMeetingPoint) {
            // setError("Please select a metering point in the header"); // Optional: don't show error, just wait
            return;
        }

        setLoading(true);
        setError(null);
        try {
            const formatDate = (date) => {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                return `${year}-${month}-${day}`;
            };

            const url = `/api/database-demo?dateFrom=${formatDate(startDate)}&dateTo=${formatDate(endDate)}&meteringPointId=${selectedMeetingPoint.id}`;
            const response = await authFetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setDbData(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch data from database. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // ... rest of the component (processing logic and render)
    // (Note: The rest remains the same, but using the new fetchData and AnalysisToolbar props)

    // Process data logic remains same as before...
    const processHourlyData = (data) => {
        const resultItem = data?.result?.[0];
        if (!resultItem?.success || resultItem?.errorCode !== 10000) return [];
        if (!data?.result?.[0]?.MyEnergyData_MarketDocument?.TimeSeries?.[0]) return [];

        const timeSeries = data.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
        const periods = timeSeries.Period || [];
        const chartData = [];

        periods.forEach(period => {
            const points = period.Point || [];
            const periodStart = new Date(period.timeInterval?.start || new Date());

            points.forEach((point) => {
                const pointDate = new Date(periodStart);
                pointDate.setHours(periodStart.getHours() + (parseInt(point.position) - 1));
                const consumption = parseFloat(point['out_Quantity.quantity'] || 0);

                chartData.push({
                    timestamp: pointDate,
                    label: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' +
                        pointDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    consumption: consumption
                });
            });
        });

        return chartData.sort((a, b) => a.timestamp - b.timestamp);
    };

    const processDailyRangeData = (data) => {
        const resultItem = data?.result?.[0];
        if (!resultItem?.success || resultItem?.errorCode !== 10000) return [];
        if (!data?.result?.[0]?.MyEnergyData_MarketDocument?.TimeSeries?.[0]) return [];

        const timeSeries = data.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
        const periods = timeSeries.Period || [];
        const dailyData = {};

        periods.forEach(period => {
            const points = period.Point || [];
            const periodStart = new Date(period.timeInterval?.start || new Date());

            points.forEach((point) => {
                const pointDate = new Date(periodStart);
                pointDate.setHours(periodStart.getHours() + (parseInt(point.position) - 1));
                const dayKey = pointDate.toLocaleDateString('en-GB');
                const consumption = parseFloat(point['out_Quantity.quantity'] || 0);

                if (!dailyData[dayKey]) {
                    dailyData[dayKey] = {
                        date: dayKey,
                        timestamp: new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate()),
                        consumptions: []
                    };
                }
                dailyData[dayKey].consumptions.push(consumption);
            });
        });

        return Object.values(dailyData).map(day => {
            const consumptions = day.consumptions.sort((a, b) => a - b);
            const min = Math.min(...consumptions);
            const max = Math.max(...consumptions);
            const avg = consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length;

            return {
                date: day.date,
                timestamp: day.timestamp,
                min, max, avg,
                allZeros: consumptions.every(c => c === 0),
                hasData: consumptions.reduce((sum, val) => sum + val, 0) > 0
            };
        }).sort((a, b) => a.timestamp - b.timestamp);
    };

    const hourlyData = dbData ? processHourlyData(dbData) : [];
    const dailyRangeData = dbData ? processDailyRangeData(dbData) : [];

    const transformToCandlestickData = (dailyRangeData) => {
        return dailyRangeData.map(day => ({
            x: day.date,
            y: [day.avg, day.max, day.min, day.avg]
        }));
    };

    const transformToBarData = (hourlyData) => {
        return hourlyData.map(hour => ({
            x: hour.label,
            y: hour.consumption
        }));
    };

    const transformToLineData = (hourlyData) => {
        return hourlyData.map(hour => ({
            x: hour.timestamp.getTime(),
            y: hour.consumption
        }));
    };

    return (
        <LocalizationProvider dateAdapter={AdapterDateFns}>
            <Box>
                <Box sx={{ mb: 4 }}>
                    <Typography variant="h4" gutterBottom color="text.primary" sx={{ fontWeight: 'bold' }}>
                        Analysis
                    </Typography>
                    <Typography variant="body1" color="text.secondary">
                        Deep dive into your electricity consumption patterns per property.
                    </Typography>
                </Box>

                <AnalysisToolbar
                    startDate={startDate}
                    endDate={endDate}
                    onStartDateChange={setStartDate}
                    onEndDateChange={setEndDate}
                    onRefresh={fetchData}
                    loading={loading || contextLoading}
                    chartType={chartType}
                    onChartTypeChange={(e) => setChartType(e.target.value)}
                    comparisonMode={comparisonMode}
                    onComparisonModeChange={(e) => setComparisonMode(e.target.value)}
                />

                {error && (
                    <Alert severity="error" sx={{ mb: 3 }} onClose={() => setError(null)}>
                        {error}
                    </Alert>
                )}

                <Grid container spacing={3}>
                    <Grid item xs={12}>
                        <Card variant="outlined" sx={{ borderRadius: 2 }}>
                            <CardContent>
                                <Typography variant="h6" gutterBottom sx={{ fontWeight: 'medium' }}>
                                    {chartType === 'candlestick' ? 'Daily Range (Min/Max/Avg)' :
                                        chartType === 'bar' ? 'Hourly Consumption' :
                                            'Consumption Trend'}
                                </Typography>

                                {loading ? (
                                    <Box sx={{ p: 10, textAlign: 'center' }}>
                                        <CircularProgress size={32} />
                                        <Typography sx={{ mt: 2 }} color="text.secondary">Fetching consumption data...</Typography>
                                    </Box>
                                ) : (!dbData) ? (
                                    <Box sx={{ p: 10, textAlign: 'center', bgcolor: 'action.hover', borderRadius: 2 }}>
                                        <Typography color="text.secondary">Select a property and date range to analyze your consumption.</Typography>
                                    </Box>
                                ) : (
                                    <>
                                        {chartType === 'candlestick' && dailyRangeData.length > 0 && (
                                            <Chart
                                                options={{
                                                    ...getCandlestickOptions(
                                                        dailyRangeData.map(d => d.date),
                                                        dailyRangeData.filter(d => d.allZeros).map(d => d.date),
                                                        theme.palette.mode
                                                    ),
                                                    theme: { mode: theme.palette.mode }
                                                }}
                                                series={[{ data: transformToCandlestickData(dailyRangeData) }]}
                                                type="candlestick"
                                                height={400}
                                            />
                                        )}

                                        {chartType === 'bar' && hourlyData.length > 0 && (
                                            <Chart
                                                options={{
                                                    ...getHorizontalBarOptions(
                                                        hourlyData.map(h => h.label),
                                                        hourlyData.length,
                                                        theme.palette.mode
                                                    ),
                                                    theme: { mode: theme.palette.mode }
                                                }}
                                                series={[{ name: 'Consumption (kWh)', data: transformToBarData(hourlyData) }]}
                                                type="bar"
                                                height={Math.max(hourlyData.length * 25 + 100, 500)}
                                            />
                                        )}

                                        {chartType === 'line' && hourlyData.length > 0 && (
                                            <Chart
                                                options={{
                                                    chart: { type: 'line', toolbar: { show: true } },
                                                    xaxis: { type: 'datetime' },
                                                    stroke: { curve: 'smooth', width: 2 },
                                                    theme: { mode: theme.palette.mode },
                                                    colors: [theme.palette.primary.main]
                                                }}
                                                series={[{ name: 'Consumption (kWh)', data: transformToLineData(hourlyData) }]}
                                                type="line"
                                                height={400}
                                            />
                                        )}
                                    </>
                                )}
                            </CardContent>
                        </Card>
                    </Grid>
                </Grid>
            </Box>
        </LocalizationProvider>
    );
};

export default Analysis;
