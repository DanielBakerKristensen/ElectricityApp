import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import './ApiDemo.css';

const ApiDemo = () => {
    const [apiData, setApiData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            // Calculate date range (9 days ago to 2 days ago)
            const endDate = new Date();
            endDate.setDate(endDate.getDate() - 2); // 2 days ago
            const startDate = new Date(endDate);
            startDate.setDate(startDate.getDate() - 7); // 7 days before that

            const formatDate = (date) => date.toISOString().split('T')[0];

            console.log('Fetching data from', formatDate(startDate), 'to', formatDate(endDate));

            const response = await fetch(`/api/test-data?dateFrom=${formatDate(startDate)}&dateTo=${formatDate(endDate)}`);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            setApiData(data);
        } catch (err) {
            console.error('Error fetching data:', err);
            setError('Failed to fetch data. Please try again later.');
        } finally {
            setLoading(false);
        }
    };

    // Process data for the chart
    const processChartData = (data) => {
        if (!data?.result?.[0]?.MyEnergyData_MarketDocument?.TimeSeries?.[0]) {
            return [];
        }

        const timeSeries = data.result[0].MyEnergyData_MarketDocument.TimeSeries[0];
        const periods = timeSeries.Period || [];
        const chartData = [];

        // Process all periods and points
        periods.forEach(period => {
            const points = period.Point || [];
            const periodStart = new Date(period.timeInterval.start);

            points.forEach((point, index) => {
                const pointDate = new Date(periodStart);
                pointDate.setHours(periodStart.getHours() + (point.position - 1));

                chartData.push({
                    timestamp: pointDate,
                    date: pointDate.toLocaleDateString('en-GB'),
                    time: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }),
                    label: pointDate.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false }) + ' ' + 
                           pointDate.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }),
                    consumption: parseFloat(point['out_Quantity.quantity']),
                    quality: point['out_Quantity.quality']
                });
            });
        });

        // Sort by timestamp
        return chartData.sort((a, b) => a.timestamp - b.timestamp);
    };

    // Format Y-axis tick (show consumption value)
    const formatYAxis = (tickItem) => {
        return tickItem.toFixed(1) + ' kWh';
    };

    // Custom tooltip
    const CustomTooltip = ({ active, payload, label }) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="custom-tooltip">
                    <p className="tooltip-date">{data.date}</p>
                    <p className="tooltip-time">{data.time}</p>
                    <p className="tooltip-consumption">
                        <strong>Consumption:</strong> {data.consumption.toFixed(3)} kWh
                    </p>
                </div>
            );
        }
        return null;
    };

    const chartData = apiData ? processChartData(apiData) : [];

    return (
        <div className="api-demo">
            <div className="demo-header">
                <h2>📈 Electricity Consumption</h2>
                <p>Hourly consumption data for the past week</p>
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

            <div className="chart-container">
                {chartData.length > 0 ? (
                    <div style={{ 
                        width: '100%',
                        padding: '20px 0',
                    }}>
                        <ResponsiveContainer width="100%" height={Math.max(chartData.length * 30 + 100, 600)}>
                                    <BarChart
                                        layout="vertical"
                                        data={chartData}
                                        margin={{ top: 20, right: 5, left: 0, bottom: 50 }}
                                        barSize={20}
                                        maxBarSize={30}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" />
                                        <XAxis 
                                            type="number"
                                            domain={[0, 'dataMax + 1']}
                                            ticks={Array.from({length: Math.ceil(Math.max(...chartData.map(d => d.consumption)) + 1)}, (_, i) => i)}
                                            tickFormatter={(value) => Math.round(value)}
                                            label={{ value: 'Consumption (kWh)', position: 'insideBottom', offset: -30 }}
                                        />
                                        <YAxis 
                                            dataKey="label"
                                            type="category"
                                            width={150}
                                            tick={{ fontSize: 12 }}
                                            interval={0}
                                            padding={{ left: 0 }}
                                        />
                                        <Tooltip content={<CustomTooltip />} />
                                        <Legend />
                                        <Bar 
                                            dataKey="consumption" 
                                            name="Consumption (kWh)" 
                                            fill="#8884d8"
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
        </div>
    );
};

export default ApiDemo;
