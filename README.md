# Motor Test Bench Control System

Sistema de monitoramento e controle para bancada de teste de motores via CAN BUS com interface web.

## Características Principais

- **Monitor CAN + Serial em tempo real**
- **Controle de LED RGB via web**
- **Configuração dinâmica de velocidade CAN**
- **Interface responsiva com preview de cores**
- **Estatísticas em tempo real**
- **WebSocket nativo para conexão estável**

## Hardware Necessário

- ESP32-S3 DevKitC-1
- Módulo CAN MCP2551 ou SN65HVD230
- LED NeoPixel (builtin no ESP32-S3)
- Equipamento CAN (ex: AACi-2A)

## Conexões CAN

```
ESP32-S3          Equipamento CAN
---------         --------------
GPIO46 (TX)  -->  CAN_TX
GPIO45 (RX)  -->  CAN_RX
3.3V         -->  VCC (se necessário)
GND          -->  GND
```

## Conexões NeoPixel

```
ESP32-S3          NeoPixel
---------         ---------
GPIO48        -->  DIN (RGB LED)
```

## Bibliotecas Necessárias (Arduino IDE)

1. **ESP Async WebServer** - Instale pelo Library Manager
2. **ESP Async TCP** - Instale pelo Library Manager
3. **Adafruit NeoPixel** - Instale pelo Library Manager
4. **LittleFS** - Já incluído no ESP32 core 2.0.14+

## Instalação

1. Clone ou copie os arquivos para `C:\Users\Conrado\Documents\motor_test_bench\`
2. Abra o projeto no Arduino IDE
3. Configure o ESP32-S3:
   - **Tools > Board**: ESP32S3 Dev Module
   - **Tools > Partition Scheme**: Huge APP (3MB No OTA / 1MB SPIFFS)
4. Carregue o sketch para o ESP32-S3
5. **Carregue os arquivos LittleFS:**
   - Ferramentas > ESP32 LittleFS Data Upload
6. Abra o navegador em `http://192.168.4.1`

## Estrutura do Projeto

```
motor_test_bench/
├── motor_test_bench.ino    # Código principal (Arduino)
├── data/
│   ├── index.html          # Interface web
│   ├── style.css           # Estilos CSS
│   └── app.js              # JavaScript
├── tools/
│   └── LittleFS/
│       └── upload.py       # Script de upload
└── README.md
```

## Configuração WiFi

- **SSID**: ESP32-CAN
- **Senha**: 12345678
- **IP**: 192.168.4.1

## Interface Web

### Monitor CAN + Serial
- Mensagens CAN em verde
- Mensagens Serial em amarelo
- Estatísticas em tempo real
- Botão de limpar terminal

### Controle LED RGB
- 3 sliders (R, G, B) com preview
- Botões: Apagar, Branco, Rainbow
- Atualização em tempo real

### Estatísticas
- **Msgs CAN**: Total de mensagens CAN recebidas
- **Msgs Serial**: Mensagens da porta serial
- **Uptime**: Tempo de execução
- **Msgs/s**: Mensagens por segundo

## Comandos Suportados

```
CONFIG:125000    - Configura CAN para 125 kbps
CONFIG:250000    - Configura CAN para 250 kbps
CONFIG:500000    - Configura CAN para 500 kbps
CONFIG:1000000   - Configura CAN para 1 Mbps
STATUS           - Mostra status completo
HELP             - Lista todos os comandos
```

## Velocidades CAN Suportadas

- 125000 bps
- 250000 bps (padrão)
- 500000 bps
- 1000000 bps

## Uso

1. **Conectar o ESP32** à rede WiFi
2. **Acessar interface** pelo navegador
3. **Clique em "Conectar"** para iniciar o WebSocket
4. **Ajustar LEDs RGB** usando os controles
5. **Monitorar mensagens CAN** em tempo real
6. **Testar diferentes velocidades** usando comando `CONFIG:xxxxx`

## Debug

- Monitor serial: 115200 bps
- Mensagens de status e erro
- Notificação de conexão WebSocket
- Log de comandos recebidos

## Notas

- LED RGB é controlado via NeoPixel (GPIO48)
- CAN Bus usa driver TWAI nativo do ESP32-S3
- Interface usa WebSocket para comunicação em tempo real
- LittleFS é mais moderno e rápido que SPIFFS
- Suporta até 16 mensagens na fila de transmissão e recepção
