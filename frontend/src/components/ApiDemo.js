import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ApiDemo.css';

const ApiDemo = () => {
    // Helper function to calculate default date range
    const calculateDefaultDates = () => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 2); // 2 days ago
        
        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before end (9 days ago from today)
        
        const formatDate = (date) => date.toISOString().split('T')[0]; // YYYY-MM-DD
        
        return {
            startDate: formatDate(startDate),
            endDate: formatDate(endDate)
        };
    };

    // Initialize default dates
    const defaultDates = calculateDefaultDates();

    // State management
    const [apiData, setApiData] = useState(null);
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
        
        // Check if range exceeds 730 days (API limitation)
        const diffTime = Math.abs(endDate - startDate);
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        if (diffDays > 730) {
            return "Date range cannot exceed 730 days (API limitation)";
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
            const response = await fetch(`/api/test-data?dateFrom=${startDate}&dateTo=${endDate}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setApiData(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            console.error('Error details:', {
                message: err.message,
                stack: err.stack
            });
            setError('Failed to fetch data. Please try again later.');
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

                if (consumption > 0) { // Only add valid consumption data
                    chartData.push({
                        timestamp: pointDate,
                        date: pointDate.toLocaleDateString('en-GB'),
                        time: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
                        label: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' +
                            pointDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                        consumption: consumption,
                        quality: point['out_Quantity.quality']
                    });
                }
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

                if (consumption > 0) { // Only process valid consumption data
                    if (!dailyData[dayKey]) {
                        dailyData[dayKey] = {
                            date: dayKey,
                            timestamp: new Date(pointDate.getFullYear(), pointDate.getMonth(), pointDate.getDate()),
                            consumptions: []
                        };
                    }
                    dailyData[dayKey].consumptions.push(consumption);
                }
            });
        });

        // Calculate daily ranges
        const rangeData = Object.values(dailyData).map(day => {
            const consumptions = day.consumptions.sort((a, b) => a - b);
            const min = Math.min(...consumptions);
            const max = Math.max(...consumptions);
            const avg = consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length;
            const total = consumptions.reduce((sum, val) => sum + val, 0);

            return {
                date: day.date,
                timestamp: day.timestamp,
                min: min,
                max: max,
                avg: avg,
                total: total,
                count: consumptions.length,
                range: max - min
            };
        }).sort((a, b) => a.timestamp - b.timestamp);

        return rangeData;
    };

    const hourlyData = apiData ? processHourlyData(apiData) : [];
    const dailyRangeData = apiData ? processDailyRangeData(apiData) : [];

    // Custom tooltip for hourly chart
    const HourlyTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip" style={{
                    backgroundColor: 'white',
                    padding: '10px',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ fontWeight: 600, marginBottom: '5px' }}>{data.date}</p>
                    <p style={{ marginBottom: '3px' }}>Time: {data.time}</p>
                    <p style={{ color: '#8884d8', fontWeight: 600 }}>
                        Consumption: {data.consumption.toFixed(3)} kWh
                    </p>
                    {data.quality && <p style={{ fontSize: '12px', color: '#666' }}>Quality: {data.quality}</p>}
                </div>
            );
        }
        return null;
    };

    // Custom tooltip for daily range chart
    const RangeTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip" style={{
                    backgroundColor: 'white',
                    padding: '12px',
                    border: '1px solid #ccc',
                    borderRadius: '6px',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
                }}>
                    <p style={{ fontWeight: 600, marginBottom: '8px', color: '#263238' }}>{data.date}</p>
                    <p style={{ marginBottom: '4px' }}><strong>Min:</strong> {data.min.toFixed(3)} kWh</p>
                    <p style={{ marginBottom: '4px' }}><strong>Max:</strong> {data.max.toFixed(3)} kWh</p>
                    <p style={{ marginBottom: '4px' }}><strong>Average:</strong> {data.avg.toFixed(3)} kWh</p>
                    <p style={{ marginBottom: '4px' }}><strong>Total:</strong> {data.total.toFixed(2)} kWh</p>
                    <p style={{ fontSize: '12px', color: '#666' }}>{data.count} hourly readings</p>
                </div>
            );
        }
        return null;
    };

    return (
        <div className="api-demo">
            <div className="demo-header">
                <h2>📈 Electricity Consumption Analysis</h2>
                <p>Daily consumption ranges and hourly details for the past week</p>
                
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

            {/* Daily Range Chart */}
            <div className="chart-container">
                {dailyRangeData.length > 0 ? (
                    <div style={{
                        width: '100%',
                        padding: '20px 0',
                        marginBottom: '40px'
                    }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#263238' }}>
                            Daily Energy Consumption Range
                        </h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <BarChart
                                data={dailyRangeData}
                                margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    dataKey="date"
                                    angle={-45}
                                    textAnchor="end"
                                    height={80}
                                    fontSize={12}
                                    stroke="#263238"
                                    tick={{ fill: '#263238' }}
                                />
                                <YAxis
                                    label={{ value: 'Consumption (kWh)', angle: -90, position: 'insideLeft', fill: '#263238' }}
                                    fontSize={12}
                                    stroke="#263238"
                                    tick={{ fill: '#263238' }}
                                />
                                <Tooltip content={<RangeTooltip />} />
                                <Legend />
                                <Bar
                                    dataKey="min"
                                    fill="#E3F2FD"
                                    name="Min Consumption"
                                    stackId="range"
                                />
                                <Bar
                                    dataKey="range"
                                    fill="#00E396"
                                    name="Range (Max - Min)"
                                    stackId="range"
                                />
                                <Bar
                                    dataKey="avg"
                                    fill="#FF6B6B"
                                    name="Average Consumption"
                                    opacity={0.8}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="no-data">
                        {loading ? 'Loading range data...' : 'No daily range data available.'}
                    </div>
                )}
            </div>

            {/* Hourly Detail Chart */}
            <div className="chart-container">
                {hourlyData.length > 0 ? (
                    <div style={{
                        width: '100%',
                        padding: '20px 0',
                    }}>
                        <h3 style={{ textAlign: 'center', marginBottom: '20px', color: '#263238' }}>
                            Hourly Electricity Consumption
                        </h3>
                        <ResponsiveContainer width="100%" height={Math.max(hourlyData.length * 25 + 200, 600)}>
                            <BarChart
                                layout="vertical"
                                data={hourlyData}
                                margin={{ top: 20, right: 30, left: 150, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis
                                    type="number"
                                    label={{ value: 'Consumption (kWh)', position: 'insideBottom', offset: -10, fill: '#263238' }}
                                    fontSize={12}
                                    stroke="#263238"
                                    tick={{ fill: '#263238' }}
                                />
                                <YAxis
                                    dataKey="label"
                                    type="category"
                                    width={140}
                                    fontSize={10}
                                    stroke="#263238"
                                    tick={{ fill: '#263238' }}
                                />
                                <Tooltip content={<HourlyTooltip />} />
                                <Legend />
                                <Bar
                                    dataKey="consumption"
                                    fill="#8884d8"
                                    name="Consumption (kWh)"
                                    radius={[0, 4, 4, 0]}
                                />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                ) : (
                    <div className="no-data">
                        {loading ? 'Loading data...' : 'No data available. Click "Refresh Data" to fetch consumption data.'}
                    </div>
                )}
            </div>

            {/* Debug Info */}
            {apiData && (
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

export default ApiDemo;