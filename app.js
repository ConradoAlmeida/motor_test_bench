const ctx = document.getElementById('telemetryChart').getContext('2d');
const telemetryChart = new Chart(ctx, {
    type: 'line',
    data: {
        labels: [],
        datasets: [
            { label: 'RPM', borderColor: '#0d6efd', data: [], tension: 0.3, borderWidth: 2, pointRadius: 0 },
            { label: 'Força (N)', borderColor: '#198754', data: [], tension: 0.3, borderWidth: 2, pointRadius: 0 },
            { label: 'Corrente (A)', borderColor: '#ffc107', data: [], tension: 0.3, borderWidth: 2, pointRadius: 0 }
        ]
    },
    options: { responsive: true, maintainAspectRatio: false, scales: { x: { display: false }, y: { grid: { color: '#e9ecef' } } }, plugins: { legend: { position: 'bottom' } } }
});

let socket;
function connect() {
    socket = new WebSocket(`ws://${window.location.hostname}/ws`);
    socket.onopen = () => {
        document.getElementById('status-dot').style.background = '#198754';
        document.getElementById('connection-status').textContent = "Conectado ao ESP32";
    };
    socket.onclose = () => {
        document.getElementById('status-dot').style.background = '#dc3545';
        document.getElementById('connection-status').textContent = "Desconectado";
        setTimeout(connect, 2000);
    };
    socket.onmessage = (e) => updateDashboard(JSON.parse(e.data));
}

function updateDashboard(data) {
    ['running', 'standby', 'error'].forEach(s => {
        const el = document.getElementById(`led-${s}`);
        if (el) el.className = 'led' + (data.status === s ? ` ${s}` : '');
    });

    if (data.sd !== undefined) {
        document.getElementById('sd-status').textContent = data.sd.active ? "WRITING..." : "IDLE";
        document.getElementById('sd-status').className = data.sd.active ? "text-success" : "text-warning";
        document.getElementById('sd-progress').style.width = data.sd.percent + "%";
        document.getElementById('sd-usage').textContent = data.sd.percent + "% Used";
    }

    if (data.rpm !== undefined) document.getElementById('val-rpm').textContent = data.rpm;
    if (data.force !== undefined) document.getElementById('val-force').textContent = data.force.toFixed(2);
    if (data.current !== undefined) document.getElementById('val-current').textContent = data.current.toFixed(2);
    if (data.voltage !== undefined) document.getElementById('val-voltage').textContent = data.voltage.toFixed(2);

    const time = new Date().toLocaleTimeString();
    telemetryChart.data.labels.push(time);
    telemetryChart.data.datasets[0].data.push(data.rpm);
    telemetryChart.data.datasets[1].data.push(data.force);
    telemetryChart.data.datasets[2].data.push(data.current);
    if (telemetryChart.data.labels.length > 40) { telemetryChart.data.labels.shift(); telemetryChart.data.datasets.forEach(ds => ds.data.shift()); }
    telemetryChart.update('none');

    if (data.can_msg) {
        const log = document.getElementById('can-log');
        const entry = document.createElement('div');
        entry.className = "mb-1 border-bottom border-dark pb-1";
        entry.innerHTML = `<span class="text-secondary">[${new Date().toLocaleTimeString()}]</span> <span class="text-info">ID:0x${data.can_msg.id}</span><br><small>${data.can_msg.data}</small>`;
        log.prepend(entry);
        if (log.childNodes.length > 30) log.lastChild.remove();
    }
}

document.getElementById('ctrl-pwm').oninput = (e) => {
    const val = e.target.value;
    document.getElementById('val-pwm-display').textContent = val;
    if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'set_pwm', value: parseInt(val) }));
};

document.getElementById('ctrl-preset-speed').onchange = (e) => {
    const val = e.target.value;
    if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'set_rpm_preset', value: parseInt(val) }));
};

['sw-esc-log1', 'sw-esc-log2', 'sw-esc-pwr1', 'sw-esc-pwr2'].forEach(id => {
    document.getElementById(id).onchange = (e) => {
        if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'switch_toggle', name: id, state: e.target.checked }));
    };
});

document.getElementById('btn-start').onclick = () => { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'motor_cmd', cmd: 'start' })); };
document.getElementById('btn-stop').onclick = () => { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'motor_cmd', cmd: 'stop' })); };
document.getElementById('btn-emergency').onclick = () => { if (socket && socket.readyState === 1) socket.send(JSON.stringify({ type: 'motor_cmd', cmd: 'emergency' })); };

connect();