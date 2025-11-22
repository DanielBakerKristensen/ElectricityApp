import { 
  chartColors, 
  getBaseChartOptions, 
  getCandlestickOptions, 
  getHorizontalBarOptions 
} from './chartConfig';

describe('chartConfig', () => {
  describe('chartColors', () => {
    test('contains all required color properties', () => {
      expect(chartColors).toHaveProperty('primary');
      expect(chartColors).toHaveProperty('success');
      expect(chartColors).toHaveProperty('danger');
      expect(chartColors).toHaveProperty('light');
      expect(chartColors).toHaveProperty('text');
      expect(chartColors).toHaveProperty('grid');
    });

    test('all color values are valid hex codes', () => {
      const hexColorRegex = /^#[0-9A-Fa-f]{6}$/;
      
      expect(chartColors.primary).toMatch(hexColorRegex);
      expect(chartColors.success).toMatch(hexColorRegex);
      expect(chartColors.danger).toMatch(hexColorRegex);
      expect(chartColors.light).toMatch(hexColorRegex);
      expect(chartColors.text).toMatch(hexColorRegex);
      expect(chartColors.grid).toMatch(hexColorRegex);
    });

    test('color values match expected theme colors', () => {
      expect(chartColors.primary).toBe('#8884d8');
      expect(chartColors.success).toBe('#00E396');
      expect(chartColors.danger).toBe('#FF6B6B');
      expect(chartColors.light).toBe('#E3F2FD');
      expect(chartColors.text).toBe('#263238');
      expect(chartColors.grid).toBe('#e0e0e0');
    });
  });

  describe('getBaseChartOptions', () => {
    test('returns valid configuration object', () => {
      const options = getBaseChartOptions();
      
      expect(options).toBeDefined();
      expect(options).toHaveProperty('chart');
      expect(options).toHaveProperty('grid');
      expect(options).toHaveProperty('theme');
    });

    test('includes toolbar configuration', () => {
      const options = getBaseChartOptions();
      
      expect(options.chart.toolbar).toBeDefined();
      expect(options.chart.toolbar.show).toBe(true);
      expect(options.chart.toolbar.tools).toHaveProperty('download');
      expect(options.chart.toolbar.tools).toHaveProperty('zoom');
      expect(options.chart.toolbar.tools).toHaveProperty('pan');
      expect(options.chart.toolbar.tools).toHaveProperty('reset');
    });

    test('includes grid configuration with correct colors', () => {
      const options = getBaseChartOptions();
      
      expect(options.grid.borderColor).toBe(chartColors.grid);
      expect(options.grid.strokeDashArray).toBe(3);
    });

    test('includes font family configuration', () => {
      const options = getBaseChartOptions();
      
      expect(options.chart.fontFamily).toBe('Roboto, Arial, sans-serif');
    });
  });

  describe('getCandlestickOptions', () => {
    const mockCategories = ['01/01/2025', '02/01/2025', '03/01/2025'];

    test('returns valid configuration object', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options).toBeDefined();
      expect(options).toHaveProperty('chart');
      expect(options).toHaveProperty('title');
      expect(options).toHaveProperty('xaxis');
      expect(options).toHaveProperty('yaxis');
      expect(options).toHaveProperty('tooltip');
      expect(options).toHaveProperty('plotOptions');
    });

    test('sets correct chart type and height', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.chart.type).toBe('candlestick');
      expect(options.chart.height).toBe(400);
    });

    test('includes categories in xaxis configuration', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.xaxis.categories).toEqual(mockCategories);
      expect(options.xaxis.type).toBe('category');
    });

    test('configures xaxis labels with rotation', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.xaxis.labels.rotate).toBe(-45);
      expect(options.xaxis.labels.rotateAlways).toBe(true);
    });

    test('includes yaxis title for consumption', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.yaxis.title.text).toBe('Consumption (kWh)');
    });

    test('includes chart title', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.title.text).toBe('Daily Energy Consumption Range');
      expect(options.title.align).toBe('left');
    });

    test('configures candlestick colors', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.plotOptions.candlestick.colors.upward).toBe(chartColors.success);
      expect(options.plotOptions.candlestick.colors.downward).toBe(chartColors.danger);
    });

    test('includes custom tooltip formatter', () => {
      const options = getCandlestickOptions(mockCategories);
      
      expect(options.tooltip.custom).toBeDefined();
      expect(typeof options.tooltip.custom).toBe('function');
    });

    test('handles empty categories array', () => {
      const options = getCandlestickOptions([]);
      
      expect(options).toBeDefined();
      expect(options.xaxis.categories).toEqual([]);
      expect(options.chart.type).toBe('candlestick');
    });

    test('handles undefined categories', () => {
      const options = getCandlestickOptions(undefined);
      
      expect(options).toBeDefined();
      expect(options.xaxis.categories).toBeUndefined();
    });
  });

  describe('getHorizontalBarOptions', () => {
    const mockCategories = ['00:00 1 Jan', '01:00 1 Jan', '02:00 1 Jan'];
    const mockDataLength = 10;

    test('returns valid configuration object', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options).toBeDefined();
      expect(options).toHaveProperty('chart');
      expect(options).toHaveProperty('title');
      expect(options).toHaveProperty('xaxis');
      expect(options).toHaveProperty('yaxis');
      expect(options).toHaveProperty('tooltip');
      expect(options).toHaveProperty('plotOptions');
    });

    test('sets correct chart type', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.chart.type).toBe('bar');
    });

    test('calculates dynamic height based on data length', () => {
      const smallDataLength = 5;
      const largeDataLength = 50;
      
      const smallOptions = getHorizontalBarOptions(mockCategories, smallDataLength);
      const largeOptions = getHorizontalBarOptions(mockCategories, largeDataLength);
      
      // Minimum height is 600
      expect(smallOptions.chart.height).toBe(600);
      
      // Large data should exceed minimum: 50 * 25 + 200 = 1450
      expect(largeOptions.chart.height).toBe(1450);
    });

    test('enforces minimum height of 600px', () => {
      const options = getHorizontalBarOptions(mockCategories, 0);
      
      expect(options.chart.height).toBe(600);
    });

    test('configures horizontal bar orientation', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.plotOptions.bar.horizontal).toBe(true);
    });

    test('includes border radius configuration', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.plotOptions.bar.borderRadius).toBe(4);
      expect(options.plotOptions.bar.borderRadiusApplication).toBe('end');
    });

    test('includes categories in xaxis configuration', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.xaxis.categories).toEqual(mockCategories);
    });

    test('includes xaxis title for consumption', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.xaxis.title.text).toBe('Consumption (kWh)');
    });

    test('includes chart title', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.title.text).toBe('Hourly Electricity Consumption');
      expect(options.title.align).toBe('left');
    });

    test('configures bar color to primary', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.colors).toEqual([chartColors.primary]);
    });

    test('includes tooltip formatter', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.tooltip.y.formatter).toBeDefined();
      expect(typeof options.tooltip.y.formatter).toBe('function');
    });

    test('tooltip formatter formats values correctly', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      const formatter = options.tooltip.y.formatter;
      
      expect(formatter(1.234567)).toBe('1.235 kWh');
      expect(formatter(10)).toBe('10.000 kWh');
      expect(formatter(0.5)).toBe('0.500 kWh');
    });

    test('disables data labels', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.dataLabels.enabled).toBe(false);
    });

    test('configures toolbar with download only', () => {
      const options = getHorizontalBarOptions(mockCategories, mockDataLength);
      
      expect(options.chart.toolbar.show).toBe(true);
      expect(options.chart.toolbar.tools.download).toBe(true);
      expect(options.chart.toolbar.tools.zoom).toBe(false);
      expect(options.chart.toolbar.tools.pan).toBe(false);
      expect(options.chart.toolbar.tools.reset).toBe(false);
    });

    test('handles empty categories array', () => {
      const options = getHorizontalBarOptions([], 0);
      
      expect(options).toBeDefined();
      expect(options.xaxis.categories).toEqual([]);
      expect(options.chart.height).toBe(600);
    });

    test('handles zero data length', () => {
      const options = getHorizontalBarOptions(mockCategories, 0);
      
      expect(options).toBeDefined();
      expect(options.chart.height).toBe(600);
    });

    test('handles negative data length', () => {
      const options = getHorizontalBarOptions(mockCategories, -5);
      
      expect(options).toBeDefined();
      // -5 * 25 + 200 = 75, but minimum is 600
      expect(options.chart.height).toBe(600);
    });

    test('handles undefined categories', () => {
      const options = getHorizontalBarOptions(undefined, mockDataLength);
      
      expect(options).toBeDefined();
      expect(options.xaxis.categories).toBeUndefined();
    });
  });
});
