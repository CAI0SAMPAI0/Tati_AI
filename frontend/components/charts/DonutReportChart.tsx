'use client';

import React from 'react';
import Chart from 'react-apexcharts';

// Definição estrita dos tipos das propriedades do gráfico
export interface DonutChartProps {
  data: number[];
  labels: string[];
}

export const DonutReportChart: React.FC<DonutChartProps> = ({ data, labels }) => {
  
  // Configurações do ApexCharts com tipagem estrita implicitamente resolvida
  const chartOptions = {
    chart: {
      type: 'donut' as const,
    },
    // 🔥 CORREÇÃO DAS CORES: Defina a paleta exata aqui
    colors: ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b'], 
    labels: labels,
    legend: {
      position: 'bottom' as const,
      labels: {
        colors: '#374151', // Cor do texto das legendas (ex: gray-700)
      }
    },
    dataLabels: {
      enabled: true,
    },
    plotOptions: {
      pie: {
        donut: {
          size: '65%'
        }
      }
    }
  };

  return (
    <div className="w-full h-full min-h-[300px]">
      <Chart
        options={chartOptions}
        series={data}
        type="donut"
        width="100%"
        height="100%"
      />
    </div>
  );
};
