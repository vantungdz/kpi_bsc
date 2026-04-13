import { ChartJSNodeCanvas } from 'chartjs-node-canvas';

export async function renderKpiPerformancePieChart(
  achievedCount: number,
  notAchievedCount: number,
): Promise<Buffer> {
  const width = 500; // px
  const height = 300; // px
  const chartJSNodeCanvas = new ChartJSNodeCanvas({
    width,
    height,
    backgroundColour: 'white',
  });
  const configuration = {
    type: 'pie' as const, // Fix type error by using 'as const'
    data: {
      labels: ['Target Achieved', 'Target Not Achieved'],
      datasets: [
        {
          data: [achievedCount, notAchievedCount],
          backgroundColor: [
            'rgba(75, 192, 192, 0.7)',
            'rgba(255, 99, 132, 0.7)',
          ],
          borderColor: ['rgba(75, 192, 192, 1)', 'rgba(255, 99, 132, 1)'],
          borderWidth: 2,
        },
      ],
    },
    options: {
      plugins: {
        legend: { position: 'top' as const }, // Fix type for legend.position
        title: { display: true, text: 'KPI Target Achievement Rate' },
      },
    },
  };
  return await chartJSNodeCanvas.renderToBuffer(configuration);
}
