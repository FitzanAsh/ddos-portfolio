// DOM Elements
const totalRequestsEl = document.getElementById('totalRequests');
const rpsValueEl = document.getElementById('rpsValue');
const rpsBarEl = document.getElementById('rpsBar');
const cpuValueEl = document.getElementById('cpuValue');
const cpuBarEl = document.getElementById('cpuBar');
const concurrentValueEl = document.getElementById('concurrentValue');
const concurrentBarEl = document.getElementById('concurrentBar');
const systemStatusBadge = document.getElementById('systemStatusBadge');
const alertBanner = document.getElementById('alertBanner');
const alertMessage = document.getElementById('alertMessage');
const currentLimitEl = document.getElementById('currentLimit');
const rateLimitInput = document.getElementById('rateLimitInput');

// Common Chart Options
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
        legend: { display: false },
        tooltip: {
            mode: 'index',
            intersect: false,
            backgroundColor: 'rgba(255, 255, 255, 0.9)',
            titleColor: '#2d3436',
            bodyColor: '#2d3436',
            borderColor: '#e9ecef',
            borderWidth: 1
        }
    },
    scales: {
        x: {
            grid: { display: false },
            ticks: { maxTicksLimit: 8 }
        },
        y: {
            beginAtZero: true,
            grid: { color: '#f1f3f5' }
        }
    },
    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
    },
    elements: {
        point: { radius: 0, hoverRadius: 4 }
    }
};

// 1. Traffic Chart (RPS vs Failures)
const trafficCtx = document.getElementById('trafficChartCanvas').getContext('2d');
const trafficChart = new Chart(trafficCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'RPS',
                data: [],
                borderColor: '#00b894',
                backgroundColor: 'rgba(0, 184, 148, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            },
            {
                label: 'Failures/s',
                data: [],
                borderColor: '#d63031',
                backgroundColor: 'rgba(214, 48, 49, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }
        ]
    },
    options: commonOptions
});

// 2. Latency Chart (p50 vs p95)
const latencyCtx = document.getElementById('latencyChartCanvas').getContext('2d');
const latencyChart = new Chart(latencyCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: '50th percentile',
                data: [],
                borderColor: '#fdcb6e',
                backgroundColor: 'rgba(253, 203, 110, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false
            },
            {
                label: '95th percentile',
                data: [],
                borderColor: '#a29bfe',
                backgroundColor: 'rgba(162, 155, 254, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: false
            }
        ]
    },
    options: commonOptions
});

// 3. Users Chart
const usersCtx = document.getElementById('usersChartCanvas').getContext('2d');
const usersChart = new Chart(usersCtx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            {
                label: 'Concurrent Users',
                data: [],
                borderColor: '#0984e3',
                backgroundColor: 'rgba(9, 132, 227, 0.1)',
                borderWidth: 2,
                tension: 0.4,
                fill: true
            }
        ]
    },
    options: commonOptions
});

const maxDataPoints = 60; // 60 minutes = 1 hour history
let lastMinute = -1;  // Track minute changes

function updateCharts(data) {
    const now = new Date();
    const currentMinute = now.getMinutes();

    // Only update chart once per minute (aggregate data)
    if (currentMinute === lastMinute) {
        return; // Skip, same minute
    }
    lastMinute = currentMinute;

    const timeLabel = now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

    // Helper to update a chart
    const pushData = (chart, values) => {
        chart.data.labels.push(timeLabel);
        values.forEach((val, i) => chart.data.datasets[i].data.push(val));

        if (chart.data.labels.length > maxDataPoints) {
            chart.data.labels.shift();
            chart.data.datasets.forEach(ds => ds.data.shift());
        }
        chart.update('none');
    };

    pushData(trafficChart, [data.reqPerSecond, data.failuresPerSecond || 0]);
    pushData(latencyChart, [data.p50Latency || 0, data.p95Latency || 0]);
    pushData(usersChart, [data.concurrentRequests]);
}

function updateStats() {
    fetch('/api/metrics')
        .then(response => response.json())
        .then(data => {
            // Update Text Values
            totalRequestsEl.textContent = data.totalRequests.toLocaleString();
            rpsValueEl.textContent = data.reqPerSecond;
            cpuValueEl.textContent = `${data.simulatedLoad}%`;
            concurrentValueEl.textContent = data.concurrentRequests;

            if (currentLimitEl) {
                currentLimitEl.textContent = data.rateLimitMax || 60;
            }

            // Update Progress Bars
            rpsBarEl.style.width = `${Math.min(data.reqPerSecond, 100)}%`;
            cpuBarEl.style.width = `${data.simulatedLoad}%`;
            concurrentBarEl.style.width = `${Math.min(data.concurrentRequests, 100)}%`;

            // Update Charts
            updateCharts(data);

            // Update Status Badge & Alert
            if (data.simulatedLoad > 85 || data.reqPerSecond > 80) {
                systemStatusBadge.className = 'status-badge danger';
                systemStatusBadge.innerHTML = '<span class="status-dot"></span>Critical Load';

                alertBanner.classList.add('show');
                alertMessage.textContent = 'CRITICAL ALERT: System Under Heavy Load!';
            } else if (data.simulatedLoad > 60 || data.reqPerSecond > 50) {
                systemStatusBadge.className = 'status-badge warning';
                systemStatusBadge.innerHTML = '<span class="status-dot"></span>High Traffic';

                alertBanner.classList.remove('show');
            } else {
                systemStatusBadge.className = 'status-badge normal';
                systemStatusBadge.innerHTML = '<span class="status-dot"></span>System Normal';

                alertBanner.classList.remove('show');
            }
        })
        .catch(err => console.error('Error fetching metrics:', err));
}

function simulateSpike(intensity) {
    let endpoint = '/simulate-spike/start';
    if (intensity === 'high') {
        // For emergency/attack, we might want a different endpoint or just high load
    }

    fetch(endpoint, { method: 'POST' })
        .then(response => response.json())
        .then(data => {
            console.log('Simulation triggered:', data);
        })
        .catch(err => console.error('Error triggering simulation:', err));
}

function updateRateLimit() {
    const limit = rateLimitInput.value;
    fetch('/api/settings/ratelimit', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ limit })
    })
        .then(response => response.json())
        .then(data => {
            alert(data.message);
            updateStats(); // Refresh UI immediately
        })
        .catch(err => {
            console.error('Error updating rate limit:', err);
            alert('Failed to update rate limit');
        });
}

// Navigation Logic
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        const text = item.textContent.trim();

        // Handle "Back to Home" separately
        if (text === 'Back to Home') return;

        e.preventDefault();

        // Update Active State
        document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
        item.classList.add('active');

        // Update View
        const pageTitle = document.getElementById('pageTitle');
        const dashboardView = document.getElementById('view-dashboard');
        const settingsView = document.getElementById('view-settings');

        if (text === 'Dashboard' || text === 'Traffic Analysis') {
            pageTitle.textContent = 'Dashboard Overview';
            dashboardView.style.display = 'block';
            settingsView.style.display = 'none';
        } else if (text === 'Settings') {
            pageTitle.textContent = 'System Settings';
            dashboardView.style.display = 'none';
            settingsView.style.display = 'block';
        }
    });
});

// Initial update
updateStats();

// Poll every second
setInterval(updateStats, 1000);
