// Chart configuration utility for ApexCharts
// Provides consistent styling and configuration across all charts

// Base theme colors matching Material-UI
export const chartColors = {
  primary: '#8884d8',
  success: '#00E396',
  danger: '#FF6B6B',
  light: '#E3F2FD',
  text: '#263238',
  grid: '#e0e0e0'
};

// Common base chart options
export const getBaseChartOptions = () => {
  return {
    chart: {
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: true,
          pan: true,
          reset: true
        }
      },
      fontFamily: 'Roboto, Arial, sans-serif'
    },
    grid: {
      borderColor: chartColors.grid,
      strokeDashArray: 3
    },
    theme: {
      mode: 'light'
    }
  };
};

// Candlestick-specific chart options
export const getCandlestickOptions = (categories, zeroDataDates = []) => {
  const baseOptions = getBaseChartOptions();
  
  // Create array of colors for x-axis labels (red for zero-data days)
  const labelColors = categories.map(date => 
    zeroDataDates.includes(date) ? '#FF6B6B' : chartColors.text
  );
  
  return {
    ...baseOptions,
    chart: {
      ...baseOptions.chart,
      type: 'candlestick',
      height: 400
    },
    title: {
      text: 'Daily Energy Consumption Range',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
        color: chartColors.text
      }
    },
    xaxis: {
      type: 'category',
      categories: categories,
      labels: {
        rotate: -45,
        rotateAlways: true,
        style: {
          fontSize: '12px',
          colors: labelColors
        }
      }
    },
    yaxis: {
      title: {
        text: 'Consumption (kWh)',
        style: {
          fontSize: '12px',
          color: chartColors.text
        }
      },
      labels: {
        style: {
          fontSize: '12px',
          colors: chartColors.text
        }
      }
    },
    tooltip: {
      custom: function({ seriesIndex, dataPointIndex, w }) {
        const data = w.globals.initialSeries[seriesIndex].data[dataPointIndex];
        return `
          <div style="padding: 10px; background: white; border: 1px solid ${chartColors.grid}; border-radius: 4px;">
            <div style="margin-bottom: 5px; font-weight: 600;">Date: ${data.x}</div>
            <div style="color: ${chartColors.success};">High: ${data.y[1].toFixed(3)} kWh</div>
            <div style="color: ${chartColors.danger};">Low: ${data.y[2].toFixed(3)} kWh</div>
            <div style="color: ${chartColors.primary};">Average: ${data.y[0].toFixed(3)} kWh</div>
          </div>
        `;
      }
    },
    plotOptions: {
      candlestick: {
        colors: {
          upward: chartColors.success,
          downward: chartColors.danger
        }
      }
    }
  };
};

// Horizontal bar chart options
export const getHorizontalBarOptions = (categories, dataLength) => {
  const baseOptions = getBaseChartOptions();
  const dynamicHeight = Math.max(dataLength * 25 + 200, 600);
  
  return {
    ...baseOptions,
    chart: {
      ...baseOptions.chart,
      type: 'bar',
      height: dynamicHeight,
      toolbar: {
        show: true,
        tools: {
          download: true,
          zoom: false,
          pan: false,
          reset: false
        }
      }
    },
    plotOptions: {
      bar: {
        horizontal: true,
        borderRadius: 4,
        borderRadiusApplication: 'end',
        barHeight: '70%',
        colors: {
          backgroundBarColors: [],
          backgroundBarOpacity: 1
        }
      }
    },
    dataLabels: {
      enabled: false
    },
    title: {
      text: 'Hourly Electricity Consumption',
      align: 'left',
      style: {
        fontSize: '16px',
        fontWeight: 600,
        color: chartColors.text
      }
    },
    xaxis: {
      categories: categories,
      title: {
        text: 'Consumption (kWh)',
        style: {
          fontSize: '12px',
          color: chartColors.text
        }
      },
      labels: {
        style: {
          fontSize: '12px',
          colors: chartColors.text
        }
      }
    },
    yaxis: {
      labels: {
        style: {
          fontSize: '10px',
          colors: chartColors.text
        }
      }
    },
    tooltip: {
      y: {
        formatter: function(value) {
          return value.toFixed(3) + ' kWh';
        }
      }
    },
    colors: [chartColors.primary]
  };
};
