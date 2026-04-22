function renderChart(data) {
    const ctx = document.getElementById('activity-chart');
    if (!ctx) return;
    
    let labels, values, label;
    if (data.period === 'weekly') {
        labels = data.days_of_week;
        values = data.messages_by_day;
        label = 'Mensagens por dia';
    } else {
        labels = ['Semana 1', 'Semana 2', 'Semana 3', 'Semana 4'];
        values = data.messages_by_week;
        label = 'Mensagens por semana';
    }
    
    if (activityChart) {
        activityChart.data.labels = labels;
        activityChart.data.datasets[0].data = values;
        activityChart.data.datasets[0].label = label;
        activityChart.update();
    } else {
        activityChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{
                    label: label,
                    data: values,
                    backgroundColor: 'rgba(124, 58, 237, 0.6)',
                    borderColor: 'rgba(124, 58, 237, 1)',
                    borderWidth: 2,
                    borderRadius: 8,
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: { duration: 1000, easing: 'easeOutQuart' },
                plugins: {
                    legend: { display: false },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: { color: 'var(--text-muted)' },
                        grid: { color: 'var(--border)' }
                    },
                    x: {
                        ticks: { color: 'var(--text-muted)' },
                        grid: { display: false }
                    }
                }
            }
        });
    }
}