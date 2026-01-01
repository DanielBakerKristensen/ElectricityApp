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
        startDate.setDate(startDate.getDate() - 7); // 7 days before
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

    const defaultDates = calculateDefaultDates();

    // State management
    const [apiData, setApiData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [startDate, setStartDate] = useState(defaultDates.startDate);
    const [endDate, setEndDate] = useState(defaultDates.endDate);
    const [dateError, setDateError] = useState(null);

    // Config state
    const [properties, setProperties] = useState([]);
    const [selectedPropertyId, setSelectedPropertyId] = useState('');
    const [selectedMpId, setSelectedMpId] = useState('');

    // Fetch properties on mount
    React.useEffect(() => {
        const fetchProperties = async () => {
            try {
                const response = await fetch('/api/settings/properties');
                if (response.ok) {
                    const data = await response.json();
                    setProperties(data);
                    if (data.length > 0) {
                        setSelectedPropertyId(data[0].id);
                        if (data[0].meteringPoints?.length > 0) {
                            setSelectedMpId(data[0].meteringPoints[0].id);
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to fetch properties:', err);
            }
        };
        fetchProperties();
    }, []);

    const handlePropertyChange = (e) => {
        const propId = e.target.value;
        setSelectedPropertyId(propId);
        const prop = properties.find(p => p.id === parseInt(propId));
        if (prop?.meteringPoints?.length > 0) {
            setSelectedMpId(prop.meteringPoints[0].id);
        } else {
            setSelectedMpId('');
        }
    };

    const validateDateRange = (start, end) => {
        const startDate = new Date(start);
        const endDate = new Date(end);
        if (startDate > endDate) return "Start date must be before or equal to end date";
        const diffDays = Math.ceil(Math.abs(endDate - startDate) / (1000 * 60 * 60 * 24));
        if (diffDays > 730) return "Date range cannot exceed 730 days";
        return null;
    };

    const fetchData = async () => {
        const validationError = validateDateRange(startDate, endDate);
        if (validationError) {
            setDateError(validationError);
            return;
        }

        setLoading(true);
        setError(null);
        setDateError(null);
        try {
            let url = `/api/test-data?dateFrom=${startDate}&dateTo=${endDate}`;
            if (selectedMpId) {
                url += `&meteringPointId=${selectedMpId}`;
            } else if (selectedPropertyId) {
                url += `&propertyId=${selectedPropertyId}`;
            }

            const response = await fetch(url);
            if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
            const data = await response.json();
            setApiData(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch data from Eloverblik API. Verify your refresh token.');
        } finally {
            setLoading(false);
        }
    };

    // ... processHourlyData and processDailyRangeData stay mostly the same ...
    const processHourlyData = (data) => {
        const resultItem = data?.result?.[0];
        if (!resultItem?.success || resultItem?.errorCode !== 10000) return [];
        const timeSeries = resultItem.MyEnergyData_MarketDocument?.TimeSeries?.[0];
        if (!timeSeries) return [];

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
        const timeSeries = resultItem.MyEnergyData_MarketDocument?.TimeSeries?.[0];
        if (!timeSeries) return [];

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
            return {
                date: day.date,
                timestamp: day.timestamp,
                min: Math.min(...consumptions),
                max: Math.max(...consumptions),
                avg: consumptions.reduce((sum, val) => sum + val, 0) / consumptions.length
            };
        }).sort((a, b) => a.timestamp - b.timestamp);
    };

    const hourlyData = apiData ? processHourlyData(apiData) : [];
    const dailyRangeData = apiData ? processDailyRangeData(apiData) : [];

    const transformToCandlestickData = (dailyRangeData) => {
        return dailyRangeData.map(day => ({
            x: day.date,
            y: [day.avg, day.max, day.min, day.avg]
        }));
    };

    const transformToBarData = (hourlyData) => {
        return hourlyData.map(hour => hour.consumption);
    };

    const selectedProperty = properties.find(p => p.id === parseInt(selectedPropertyId));
    const availableMps = selectedProperty?.meteringPoints || [];

    return (
        <div className="api-demo">
            <div className="demo-header">
                <h2>📈 Eloverblik API Fetcher</h2>
                <p>Pull live data from Eloverblik for your properties</p>

                <div className="date-picker-container">
                    <div className="config-group" style={{ display: 'flex', gap: '15px', marginBottom: '15px', flexWrap: 'wrap' }}>
                        <div className="config-selector" style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Property (Refresh Token)</label>
                            <select
                                value={selectedPropertyId}
                                onChange={handlePropertyChange}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                            >
                                <option value="">Select Property</option>
                                {properties.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </select>
                        </div>

                        <div className="config-selector" style={{ flex: 1, minWidth: '200px' }}>
                            <label style={{ display: 'block', marginBottom: '5px' }}>Metering Point</label>
                            <select
                                value={selectedMpId}
                                onChange={(e) => setSelectedMpId(e.target.value)}
                                disabled={!selectedPropertyId}
                                style={{ padding: '8px', borderRadius: '4px', border: '1px solid #ccc', width: '100%' }}
                            >
                                {availableMps.map(mp => (
                                    <option key={mp.id} value={mp.id}>{mp.name} ({mp.meteringPointId})</option>
                                ))}
                                {availableMps.length === 0 && <option value="">No meters found</option>}
                            </select>
                        </div>
                    </div>

                    <div style={{ display: 'flex', gap: '15px', flexWrap: 'wrap' }}>
                        <div className="date-input-group">
                            <label>Start Date</label>
                            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
                        </div>
                        <div className="date-input-group">
                            <label>End Date</label>
                            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
                        </div>
                    </div>
                </div>

                {dateError && <div className="date-error" style={{ color: 'red', marginTop: '10px' }}>{dateError}</div>}

                <button onClick={fetchData} disabled={loading || !selectedPropertyId} className="fetch-button">
                    {loading ? '⏳ Fetching...' : '🚀 Fetch Live Data'}
                </button>
            </div>

            {error && <div className="error-message" style={{ background: '#ffeeee', p: '15px', color: 'red', borderRadius: '4px', mt: '10px' }}>{error}</div>}

            <div className="chart-container">
                {dailyRangeData.length > 0 ? (
                    <div className="chart-wrapper">
                        <Chart
                            options={getCandlestickOptions(dailyRangeData.map(d => d.date))}
                            series={[{ data: transformToCandlestickData(dailyRangeData) }]}
                            type="candlestick" height={400}
                        />
                    </div>
                ) : <div className="no-data">No data fetched yet. Select property and dates.</div>}
            </div>

            <div className="chart-container">
                {hourlyData.length > 0 && (
                    <div className="chart-wrapper-hourly">
                        <Chart
                            options={getHorizontalBarOptions(hourlyData.map(h => h.label), hourlyData.length)}
                            series={[{ name: 'Consumption (kWh)', data: transformToBarData(hourlyData) }]}
                            type="bar" height={Math.max(hourlyData.length * 25 + 200, 600)}
                        />
                    </div>
                )}
            </div>
        </div>
    );
};

export default ApiDemo;