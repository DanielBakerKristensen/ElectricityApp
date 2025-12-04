import React, { useState } from 'react';
import Chart from 'react-apexcharts';
import { getCandlestickOptions, getHorizontalBarOptions } from '../utils/chartConfig';
import './ApiDemo.css';

const ApiDemo = () => {
    // Helper function to calculate default date range
    const calculateDefaultDates = () => {
        const endDate = new Date();
        endDate.setDate(endDate.getDate() - 2); // 2 days ago

        const startDate = new Date(endDate);
        startDate.setDate(startDate.getDate() - 7); // 7 days before end (9 days ago from today)

        // Format using local date to avoid timezone issues
        const formatDate = (date) => {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        };

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

    // Config state
    const [tokens, setTokens] = useState([]);
    const [meteringPoints, setMeteringPoints] = useState([]);
    const [selectedTokenId, setSelectedTokenId] = useState('');
    const [selectedMpId, setSelectedMpId] = useState('');

    // Fetch configs on mount
    React.useEffect(() => {
        const fetchConfigs = async () => {
            try {
                const [tokensRes, mpsRes] = await Promise.all([
                    fetch('/api/settings/tokens'),
                    fetch('/api/settings/metering-points')
                ]);

                if (tokensRes.ok && mpsRes.ok) {
                    const tokensData = await tokensRes.json();
                    const mpsData = await mpsRes.json();

                    setTokens(tokensData);
                    setMeteringPoints(mpsData);

                    // Select defaults if available
                    if (tokensData.length > 0) setSelectedTokenId(tokensData[0].id);
                    if (mpsData.length > 0) setSelectedMpId(mpsData[0].id);
                }
            } catch (err) {
                console.error('Failed to fetch settings:', err);
            }
        };
        fetchConfigs();
    }, []);

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
            // Build URL with separate token and metering point IDs
            let url = `/api/test-data?dateFrom=${startDate}&dateTo=${endDate}`;

            if (selectedTokenId) {
                url += `&tokenId=${selectedTokenId}`;
            }
            if (selectedMpId) {
                url += `&meteringPointId=${selectedMpId}`;
            }

            const response = await fetch(url);
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

    // Data transformation functions for ApexCharts
    const transformToCandlestickData = (dailyRangeData) => {
        return dailyRangeData.map(day => ({
            x: day.date,
            y: [
                day.avg,  // open (using avg as both open and close)
                day.max,  // high
                day.min,  // low
                day.avg   // close
            ]
        }));
    };

    const transformToBarData = (hourlyData) => {
        return hourlyData.map(hour => hour.consumption);
    };

    return (
        <div className="api-demo">
            <div className="demo-header">
                <h2>📈 Electricity Consumption Analysis</h2>
                <p>Daily consumption ranges and hourly details for the past week</p>

                <div className="date-picker-container">
                    <div className="config-group" style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        {/* Token Selector */}
                        <div className="config-selector" style={{ flex: 1, minWidth: '200px' }}>
                            <label htmlFor="token-select" style={{ display: 'block', marginBottom: '5px' }}>Refresh Token</label>
                            <select
                                id="token-select"
                                value={selectedTokenId}
                                onChange={(e) => setSelectedTokenId(e.target.value)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    width: '100%'
                                }}
                            >
                                <option value="">Default (.env)</option>
                                {tokens.map(token => (
                                    <option key={token.id} value={token.id}>
                                        {token.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Metering Point Selector */}
                        <div className="config-selector" style={{ flex: 1, minWidth: '200px' }}>
                            <label htmlFor="mp-select" style={{ display: 'block', marginBottom: '5px' }}>Metering Point</label>
                            <select
                                id="mp-select"
                                value={selectedMpId}
                                onChange={(e) => setSelectedMpId(e.target.value)}
                                style={{
                                    padding: '8px',
                                    borderRadius: '4px',
                                    border: '1px solid #ccc',
                                    width: '100%'
                                }}
                            >
                                <option value="">Default (.env)</option>
                                {meteringPoints.map(mp => (
                                    <option key={mp.id} value={mp.id}>
                                        {mp.name} ({mp.meteringPointId})
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    <div className="date-input-group">
                        <label htmlFor="start-date">Start Date</label>
                        <input
                            type="date"
                            id="start-date"
                            value={startDate}
                            onChange={handleStartDateChange}
                            max={new Date().toISOString().split('T')[0]}
                        />
                    </div>
                    <div className="date-input-group">
                        <label htmlFor="end-date">End Date</label>
                        <input
                            type="date"
                            id="end-date"
                            value={endDate}
                            onChange={handleEndDateChange}
                            min={startDate}
                            max={new Date().toISOString().split('T')[0]}
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
                    <div className="chart-wrapper">
                        <Chart
                            options={getCandlestickOptions(dailyRangeData.map(d => d.date))}
                            series={[{
                                data: transformToCandlestickData(dailyRangeData)
                            }]}
                            type="candlestick"
                            height={400}
                        />
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
                    <div className="chart-wrapper-hourly">
                        <Chart
                            options={getHorizontalBarOptions(hourlyData.map(h => h.label), hourlyData.length)}
                            series={[{
                                name: 'Consumption (kWh)',
                                data: transformToBarData(hourlyData)
                            }]}
                            type="bar"
                            height={Math.max(hourlyData.length * 25 + 200, 600)}
                        />
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