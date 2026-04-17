// Motor Test Bench - Complete Dashboard

let canCount = 0;
let serialCount = 0;
let startTime = Date.now();
let messagesThisSecond = 0;
let ws = null;
let rainbowInterval = null;
let rainbowHue = 0;
let currentMode = 'RPM';

// Charts
let chartRpm, chartForce, chartCurrent, chartEsc;

const terminal = document.getElementById('terminal');
const connectBtn = document.getElementById('connectBtn');

// Chart colors
const chartColors = {
    cyan: '#00d9ff',
    green: '#00ff88',
    yellow: '#ffaa00',
    orange: '#ff8800'
};

function formatTime() {
    const d = new Date();
    return d.getHours().toString().padStart(2, '0') + ':' +
           d.getMinutes().toString().padStart(2, '0') + ':' +
           d.getSeconds().toString().padStart(2, '0') + '.' +
           d.getMilliseconds().toString().padStart(3, '0');
}

function addMessage(text, type) {
    const div = document.createElement('div');
    div.className = 'msg msg-' + type;
    const label = type === 'can' ? 'CAN' : 'SERIAL';
    div.innerHTML = '<span class="msg-time">' + formatTime() + '</span>' +
                   '<span class="type-' + type + '">' + label + '</span>' +
                   '<span>' + text + '</span>';
    terminal.appendChild(div);
    terminal.scrollTop = terminal.scrollHeight;

    if (type === 'can') {
        canCount++;
    } else {
        serialCount++;
    }
    messagesThisSecond++;
}

function clearTerminal() {
    terminal.innerHTML = '<div class="init-message">Terminal limpo</div>';
}

// Tab Navigation
function showTab(tabId) {
    document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(el => el.classList.remove('active'));
    document.getElementById('tab-' + tabId).classList.add('active');
    event.target.classList.add('active');
}

// Mode Toggle
function setMode(mode) {
    currentMode = mode;
    
    document.getElementById('mode-rpm').classList.toggle('active', mode === 'RPM');
    document.getElementById('mode-pwm').classList.toggle('active', mode === 'PWM');
    
    document.getElementById('control-rpm').style.display = mode === 'RPM' ? 'block' : 'none';
    document.getElementById('control-pwm').style.display = mode === 'PWM' ? 'block' : 'none';
    
    sendCommand('MODE:' + mode);
}

// Simple Chart Class
class SimpleChart {
    constructor(canvasId, color) {
        this.canvas = document.getElementById(canvasId);
        this.ctx = this.canvas.getContext('2d');
        this.color = color;
        this.data = [];
        this.maxPoints = 50;
        this.minValue = 0;
        this.maxValue = 100;
        this.draw();
    }
    
    addValue(value) {
        this.data.push(parseFloat(value) || 0);
        if (this.data.length > this.maxPoints) {
            this.data.shift();
        }
        this.draw();
    }
    
    setRange(min, max) {
        this.minValue = min;
        this.maxValue = max;
    }
    
    draw() {
        const ctx = this.ctx;
        const w = this.canvas.width;
        const h = this.canvas.height;
        
        ctx.fillStyle = '#0d1117';
        ctx.fillRect(0, 0, w, h);
        
        ctx.strokeStyle = '#2d2d3f';
        ctx.lineWidth = 1;
        for (let i = 0; i <= 4; i++) {
            const y = (h / 4) * i;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(w, y);
            ctx.stroke();
        }
        
        if (this.data.length < 2) return;
        
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        
        const step = w / (this.maxPoints - 1);
        const range = this.maxValue - this.minValue;
        
        for (let i = 0; i < this.data.length; i++) {
            const x = i * step;
            const y = h - ((this.data[i] - this.minValue) / range) * h;
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.stroke();
        
        if (this.data.length > 0) {
            ctx.fillStyle = this.color;
            ctx.font = '12px monospace';
            ctx.fillText(this.data[this.data.length - 1].toFixed(1), 5, 15);
        }
    }
}

function initCharts() {
    chartRpm = new SimpleChart('chart-rpm', chartColors.cyan);
    chartRpm.setRange(0, 3000);
    
    chartForce = new SimpleChart('chart-force', chartColors.green);
    chartForce.setRange(0, 100);
    
    chartCurrent = new SimpleChart('chart-current', chartColors.yellow);
    chartCurrent.setRange(0, 50);
    
    chartEsc = new SimpleChart('chart-esc', chartColors.orange);
    chartEsc.setRange(0, 20);
}

function updateCharts(data) {
    if (chartRpm) chartRpm.addValue(data.rpm || 0);
    if (chartForce) chartForce.addValue(data.force || 0);
    if (chartCurrent) chartCurrent.addValue(data.current || 0);
    if (chartEsc) chartEsc.addValue(data.escTotal || 0);
}

// LED Functions
function updateLEDPreview() {
    const r = document.getElementById('sliderR').value;
    const g = document.getElementById('sliderG').value;
    const b = document.getElementById('sliderB').value;
    document.getElementById('valR').textContent = r;
    document.getElementById('valG').textContent = g;
    document.getElementById('valB').textContent = b;
    document.getElementById('ledPreview').style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
    
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send('LED:' + r + ':' + g + ':' + b);
    }
}

function stopRainbow() {
    if (rainbowInterval) {
        clearInterval(rainbowInterval);
        rainbowInterval = null;
    }
}

function apagarLED() {
    stopRainbow();
    document.getElementById('sliderR').value = 0;
    document.getElementById('sliderG').value = 0;
    document.getElementById('sliderB').value = 0;
    updateLEDPreview();
}

function brancoLED() {
    stopRainbow();
    document.getElementById('sliderR').value = 255;
    document.getElementById('sliderG').value = 255;
    document.getElementById('sliderB').value = 255;
    updateLEDPreview();
}

function rainbowLED() {
    stopRainbow();
    rainbowInterval = setInterval(() => {
        rainbowHue = (rainbowHue + 2) % 360;
        const r = Math.abs(128 - Math.abs(Math.abs(Math.abs(rainbowHue) - 256) - 128)) * 2;
        const g = Math.abs(128 - Math.abs(Math.abs(Math.abs(rainbowHue + 85) - 256) - 128)) * 2;
        const b = Math.abs(128 - Math.abs(Math.abs(Math.abs(rainbowHue + 171) - 256) - 128)) * 2;
        document.getElementById('sliderR').value = r;
        document.getElementById('sliderG').value = g;
        document.getElementById('sliderB').value = b;
        document.getElementById('valR').textContent = r;
        document.getElementById('valG').textContent = g;
        document.getElementById('valB').textContent = b;
        document.getElementById('ledPreview').style.background = 'rgb(' + r + ',' + g + ',' + b + ')';
        
        if (ws && ws.readyState === WebSocket.OPEN) {
            ws.send('LED:' + r + ':' + g + ':' + b);
        }
    }, 30);
}

function sendCommand(cmd) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(cmd);
    }
}

function updateMetrics(data) {
    if (data.rpm !== undefined) {
        document.getElementById('val-rpm').textContent = Math.round(data.rpm);
    }
    if (data.force !== undefined) {
        document.getElementById('val-force').textContent = data.force.toFixed(2);
    }
    if (data.current !== undefined) {
        document.getElementById('val-current').textContent = data.current.toFixed(2);
    }
    if (data.voltage !== undefined) {
        document.getElementById('val-voltage').textContent = data.voltage.toFixed(2);
    }
    if (data.esc1 !== undefined) {
        document.getElementById('esc1-current').textContent = data.esc1.toFixed(2) + ' A';
    }
    if (data.esc2 !== undefined) {
        document.getElementById('esc2-current').textContent = data.esc2.toFixed(2) + ' A';
    }
    if (data.esc1Temp !== undefined) {
        document.getElementById('esc1-temp').textContent = data.esc1Temp;
    }
    if (data.esc2Temp !== undefined) {
        document.getElementById('esc2-temp').textContent = data.esc2Temp;
    }
    
    updateCharts(data);
}

function connectWs() {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close();
        return;
    }
    
    ws = new WebSocket('ws://' + window.location.host + '/ws');

    ws.onopen = function() {
        document.getElementById('connectionStatus').textContent = 'Conectado';
        document.getElementById('statusDot').className = 'status-dot connected';
        connectBtn.textContent = 'Desconectar';
        connectBtn.className = 'btn-connect connected';
        
        addMessage('Motor Test Bench Conectado!', 'serial');
        addMessage('Sistema pronto', 'serial');
        
        initCharts();
    };

    ws.onclose = function() {
        stopRainbow();
        document.getElementById('connectionStatus').textContent = 'Desconectado';
        document.getElementById('statusDot').className = 'status-dot disconnected';
        connectBtn.textContent = 'Conectar';
        connectBtn.className = 'btn-connect';
    };

    ws.onerror = function(err) {
        addMessage('Erro de conexao!', 'error');
    };

    ws.onmessage = function(event) {
        const data = event.data;
        
        if (data.startsWith('{')) {
            try {
                const json = JSON.parse(data);
                updateMetrics(json);
                return;
            } catch(e) {}
        }
        
        const lines = data.split('\n');
        lines.forEach(line => {
            if (line.trim()) {
                if (line.startsWith('CAN:')) {
                    addMessage(line.substring(4), 'can');
                } else {
                    addMessage(line, 'serial');
                }
            }
        });
    };
}

// Event Listeners
document.getElementById('sliderR').addEventListener('input', updateLEDPreview);
document.getElementById('sliderG').addEventListener('input', updateLEDPreview);
document.getElementById('sliderB').addEventListener('input', updateLEDPreview);

// RPM Manual
document.getElementById('ctrl-rpm').addEventListener('input', function() {
    document.getElementById('val-rpm-manual').textContent = this.value;
    sendCommand('RPM:' + this.value);
});

// PWM Manual
document.getElementById('ctrl-pwm').addEventListener('input', function() {
    document.getElementById('val-pwm').textContent = this.value + '%';
    sendCommand('PWM:' + this.value);
});

// Preset Speed
document.getElementById('ctrl-preset-speed').addEventListener('change', function() {
    sendCommand('PRESET:' + this.value);
});

// Switches
['sw-esc-log1', 'sw-esc-log2', 'sw-esc-pwr1', 'sw-esc-pwr2'].forEach(function(id) {
    document.getElementById(id).addEventListener('change', function() {
        const state = this.checked ? 'ON' : 'OFF';
        sendCommand(id.toUpperCase() + ':' + state);
    });
});

// Control Buttons
document.getElementById('btn-start').addEventListener('click', function() {
    sendCommand('CMD:START');
    addMessage('START command sent', 'serial');
});

document.getElementById('btn-stop').addEventListener('click', function() {
    sendCommand('CMD:STOP');
    addMessage('STOP command sent', 'serial');
});

document.getElementById('btn-emergency').addEventListener('click', function() {
    sendCommand('CMD:EMERGENCY');
    addMessage('EMERGENCY!', 'error');
});

// Update uptime
setInterval(() => {
    const s = Math.floor((Date.now() - startTime) / 1000);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    document.getElementById('uptime').textContent = 
        h + ':' + m.toString().padStart(2, '0') + ':' + sec.toString().padStart(2, '0');
}, 1000);

// Update CPS
setInterval(() => {
    document.getElementById('cps').textContent = messagesThisSecond;
    messagesThisSecond = 0;
}, 1000);
