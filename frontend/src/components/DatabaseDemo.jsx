import React, { useState } from 'react';
import Chart from 'react-apexcharts';
import { getCandlestickOptions, getHorizontalBarOptions } from '../utils/chartConfig';
import './DatabaseDemo.css';

const DatabaseDemo = () => {
    // Helper function to calculate default date range
    const calculateDefaultDates = () => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 7); // 7 days ago (to avoid future dates with no data)
        
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before end (14 days ago from today)
        
        const formatDate = (date) => date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
        };
    };

    // Initialize default dates
    const defaultDates = calculateDefaultDates();

    // State management
    const [dbData, setDbData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [dateError, setDateError] = useState(null);

    // Date validation function
    const validateDateRange = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        
        // Check if start is after end
        if (startDate > endDate) {
            return "Start date must be before or equal to end date";
        }
        
        return null; // No error
    };

    // Date change handlers
    const handleStartDateChange = (event) => {
        setStartDate(event.target.value);
        setDateError(null); // Clear error when user changes dates
    };

    const handleEndDateChange = (event) => {
        setEndDate(event.target.value);
        setDateError(null); // Clear error when user changes dates
    };

    // Helper function to format dates in readable format
    const formatDisplayDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', { 
            year: 'numeric', 
            month: 'short', 
            day: 'numeric' 
        });
    };

    const fetchData = async () => {
        // Validate date range before making API call
        const validationError = validateDateRange(startDate, endDate);
        if (validationError) {
            setDateError(validationError);
            return; // Return early without making API call
        }

        setLoading(true);
        setError(null);
        setDateError(null); // Clear any previous date errors
        try {
            // Use startDate and endDate state values in the API call
            const response = await fetch(`/api/database-demo?dateFrom=${startDate}&dateTo=${endDate}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setDbData(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            console.error('Error details:', {
                message: err.message,
                stack: err.stack
            });
            setError('Failed to fetch data from database. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Process data for hourly chart
    const processHourlyData = (data) => {
        // Check if the API response is successful
        // The success/errorCode fields are at the root of each result item
        const resultItem = data?.result?.[0];
        if (!resultItem?.success || resultItem?.errorCode !== 10000) {
            return [];
        }

        if (!data?.result?.[0]?.MyEnergyData_MarketDocument?.TimeSeries?.[0]) {
            return [];
        }

        const timeSeries = data.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
        const periods = timeSeries.Period || [];
        const chartData = [];

        // Process all periods and points
        periods.forEach(period => {
            const points = period.Point || [];
            // Use the timeInterval from the period itself
            const periodStart = new Date(period.timeInterval?.start || new Date());

            points.forEach((point) => {
                const pointDate = new Date(periodStart);
                pointDate.setHours(periodStart.getHours() + (parseInt(point.position) - 1));

                const consumption = parseFloat(point['out_Quantity.quantity'] || 0);

                // Include all data points, even zeros
                chartData.push({
                    timestamp: pointDate,
                    date: pointDate.toLocaleDateString('en-GB'),
                    time: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    label: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' +
                        pointDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    consumption: consumption,
                    quality: point['out_Quantity.quality']
                });
            });
        });

        // Sort by timestamp
        return chartData.sort((a, b) => a.timestamp - b.timestamp);
    };

    // Process data for daily range chart
    const processDailyRangeData = (data) => {
        // Check if the API response is successful
        // The success/errorCode fields are at the root of each result item
        const resultItem = data?.result?.[0];
        if (!resultItem?.success || resultItem?.errorCode !== 10000) {
            return [];
        }

        if (!data?.result?.[0]?.MyEnergyData_MarketDocument?.TimeSeries?.[0]) {
            return [];
        }

        const timeSeries = data.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
        const periods = timeSeries.Period || [];
        const dailyData = {};

        // Group data by day
        periods.forEach(period => {
            const points = period.Point || [];
            // Use the timeInterval from the period itself
            const periodStart = new Date(period.timeInterval?.start || new Date());

            points.forEach((point) => {
                const pointDate = new Date(periodStart);
                pointDate.setHours(periodStart.getHours() + (parseInt(point.position) - 1));

                const dayKey = pointDate.toLocaleDateString('en-GB');
                const consumption = parseFloat(point['out_Quantity.quantity'] || 0);

                // Include all consumption data, even zeros
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

        // Calculate daily ranges
        const rangeData = Object.values(dailyData).map(day => {
            const consumptions = day.consumptions.sort((a, b) => a - b);
            const min = Math.min(...consumptions);
            const max = Math.max(...consumptions);
            const avg = consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length;
            const total = consumptions.reduce((sum, val) => sum + val, 0);
            
            // Detect suspicious data (all zeros or total is zero)
            const hasData = total > 0;
            const allZeros = consumptions.every(c => c === 0);

            return {
                date: day.date,
                timestamp: day.timestamp,
                min: min,
                max: max,
                avg: avg,
                hasData: hasData,
                allZeros: allZeros,
                total: total,
                count: consumptions.length,
                range: max - min
            };
        }).sort((a, b) => a.timestamp - b.timestamp);

        return rangeData;
    };

    // Data transformation functions for ApexCharts
    const transformToCandlestickData = (dailyRangeData) => {
        return dailyRangeData.map(day => ({
            x: day.date,
            y: [
                day.avg,  // open (we'll use avg as both open and close)
                day.max,  // high
                day.min,  // low
                day.avg   // close
            ]
        }));
    };

    const transformToBarData = (hourlyData) => {
        return hourlyData.map(hour => ({
            x: hour.label,
            y: hour.consumption
        }));
    };

    const hourlyData = dbData ? processHourlyData(dbData) : [];
    const dailyRangeData = dbData ? processDailyRangeData(dbData) : [];



    return (
        <div className="database-demo">
            <div className="demo-header">
                <h2>🗄️ Database Demo - Stored Consumption Data</h2>
                <p>View electricity consumption data from the local PostgreSQL database</p>
                
                <div className="date-picker-container">
                    <div className="date-input-group">
                        <label htmlFor="start-date">Start Date</label>
                        <input 
                            type="date" 
                            id="start-date"
                            value={startDate}
                            onChange={handleStartDateChange}
                        />
                    </div>
                    <div className="date-input-group">
                        <label htmlFor="end-date">End Date</label>
                        <input 
                            type="date" 
                            id="end-date"
                            value={endDate}
                            onChange={handleEndDateChange}
                        />
                    </div>
                </div>
                
                {dateError && <div className="date-error">{dateError}</div>}
                
                <div className="date-range-display">
                    Showing data from {formatDisplayDate(startDate)} to {formatDisplayDate(endDate)}
                </div>
                
                <button
                    onClick={fetchData}
                    disabled={loading}
                    className="fetch-button"
                >
                    {loading ? '⏳ Loading...' : '🔄 Refresh Data'}
                </button>
            </div>

            {error && (
                <div className="error-message">
                    <h3>❌ Error</h3>
                    <p>{error}</p>
                </div>
            )}

            {/* Data Quality Warning */}
            {dailyRangeData.length > 0 && (() => {
                const daysWithZeros = dailyRangeData.filter(day => day.allZeros);
                const daysWithoutData = dailyRangeData.filter(day => !day.hasData);
                
                if (daysWithZeros.length > 0 || daysWithoutData.length > 0) {
                    return (
                        <div className="warning-message" style={{
                            backgroundColor: '#fff3cd',
                            border: '1px solid #ffc107',
                            borderRadius: '4px',
                            padding: '15px',
                            margin: '20px 0',
                            color: '#856404'
                        }}>
                            <h3 style={{ margin: '0 0 10px 0' }}>⚠️ Data Quality Warning</h3>
                            {daysWithZeros.length > 0 && (
                                <p style={{ margin: '5px 0' }}>
                                    <strong>{daysWithZeros.length} day(s) with zero consumption detected:</strong>
                                    <br />
                                    {daysWithZeros.map(d => d.date).join(', ')}
                                    <br />
                                    <em>This usually means data is not yet available from Eloverblik API. Data typically becomes available 1-2 days after consumption.</em>
                                </p>
                            )}
                        </div>
                    );
                }
                return null;
            })()}

            {/* Daily Range Chart */}
            <div className="chart-container">
                {dailyRangeData.length > 0 ? (
                    <div className="chart-wrapper">
                        <Chart
                            options={getCandlestickOptions(
                                dailyRangeData.map(d => d.date),
                                dailyRangeData.filter(d => d.allZeros).map(d => d.date)
                            )}
                            series={[{ data: transformToCandlestickData(dailyRangeData) }]}
                            type="candlestick"
                            height={400}
                        />
                    </div>
                ) : (
                    <div className="no-data">
                        {loading ? 'Loading range data...' : dbData ? 'No data available for the selected date range.' : 'No data available. Click "Refresh Data" to fetch consumption data from the database.'}
                    </div>
                )}
            </div>

            {/* Hourly Detail Chart */}
            <div className="chart-container">
                {hourlyData.length > 0 ? (
                    <div className="chart-wrapper-hourly">
                        <Chart
                            options={getHorizontalBarOptions(hourlyData.map(h => h.label), hourlyData.length)}
                            series={[{ name: 'Consumption (kWh)', data: transformToBarData(hourlyData) }]}
                            type="bar"
                            height={Math.max(hourlyData.length * 25 + 200, 600)}
                        />
                    </div>
                ) : (
                    <div className="no-data">
                        {loading ? 'Loading data...' : dbData ? 'No data available for the selected date range.' : 'No data available. Click "Refresh Data" to fetch consumption data from the database.'}
                    </div>
                )}
            </div>

            {/* Debug Info */}
            {dbData && (
                <div className="debug-info">
                    <strong>Debug Info:</strong><br />
                    Hourly data points: {hourlyData.length}<br />
                    Daily range data points: {dailyRangeData.length}<br />
                    {dailyRangeData.length > 0 && (
                        <>Sample daily data: {JSON.stringify(dailyRangeData[0], null, 2)}</>
                    )}
                </div>
            )}
        </div>
    );
};

export default DatabaseDemo;
