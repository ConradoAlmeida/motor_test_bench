# Motor Test Bench UI

Interface web para monitoramento e controle de bancada de testes de motor com ESP32-S3 via WebSocket.

## Visao Geral

Este projeto entrega um dashboard frontend com:

- Indicadores de estado da maquina (Running, Standby, Error/Fault)
- KPIs em tempo real: RPM, Forca, Corrente e Tensao
- Grafico de telemetria em tempo real (Chart.js)
- Monitor de mensagens CAN-BUS
- Controle manual de PWM
- Presets de velocidade (RPM)
- Chaves de logica e potencia para ESCs
- Comandos de START, STOP e EMERGENCY

## Estrutura do Projeto

```text
frontend/
	index.html   # Estrutura da interface
	style.css    # Estilos da aplicacao
	app.js       # Logica de telemetria, WebSocket e controles
	README.md
```

## Requisitos

- Navegador moderno (Chrome, Edge ou Firefox)
- Backend/dispositivo que exponha WebSocket em:

```text
ws://<host>/ws
```

Observacao: o frontend usa automaticamente o host da pagina atual (`window.location.hostname`).

## Como Executar

Como este projeto e estatico, voce pode abrir de duas formas:

1. Abrir direto no navegador

- Abra o arquivo `index.html` no navegador.

2. Servidor HTTP local (recomendado)

```bash
python3 -m http.server 8080
```

Depois acesse:

```text
http://localhost:8080
```

## Fluxo de Conexao

- Ao carregar a pagina, o frontend tenta conectar em `ws://<hostname>/ws`.
- Se a conexao cair, o reconnect e automatico a cada 2 segundos.
- O status visual muda entre `Conectado ao ESP32` e `Desconectado`.

## Contrato de Dados (WebSocket)

### Mensagens recebidas pelo frontend

Payload esperado (exemplo):

```json
{
	"status": "running",
	"sd": { "active": true, "percent": 42 },
	"rpm": 1200,
	"force": 8.31,
	"current": 12.7,
	"voltage": 24.1,
	"can_msg": {
		"id": "1A0",
		"data": "11 22 33 44 55 66 77 88"
	}
}
```

Campos usados:

- `status`: `running`, `standby` ou `error`
- `sd.active`: define texto de status do SD (`WRITING...` ou `IDLE`)
- `sd.percent`: uso do SD em porcentagem
- `rpm`, `force`, `current`, `voltage`: atualizam cards e grafico
- `can_msg`: adiciona linha no monitor CAN-BUS

### Mensagens enviadas pelo frontend

1. PWM manual

```json
{ "type": "set_pwm", "value": 120 }
```

2. Preset de RPM

```json
{ "type": "set_rpm_preset", "value": 1000 }
```

3. Toggle de chave

```json
{ "type": "switch_toggle", "name": "sw-esc-pwr1", "state": true }
```

4. Comando de motor

```json
{ "type": "motor_cmd", "cmd": "start" }
```

Comandos validos em `cmd`: `start`, `stop`, `emergency`.

## Dependencias via CDN

O projeto usa bibliotecas carregadas diretamente no HTML:

- Bootstrap 5
- Bootstrap Icons
- Google Fonts (Inter)
- Chart.js

Nao ha `package.json` neste frontend atualmente.

## Notas de Desenvolvimento

- O grafico mantem janela de 40 pontos e remove os mais antigos automaticamente.
- O log CAN mantem no maximo 30 mensagens visiveis.
- Os dados de `force`, `current` e `voltage` sao formatados com 2 casas decimais.

## Melhorias Sugeridas

- Adicionar validacao defensiva para payloads incompletos ou invalidos.
- Externalizar configuracao da URL WebSocket (env/config).
- Adicionar testes de interface (ex.: Playwright).
- Criar modo demo com gerador de telemetria local.
