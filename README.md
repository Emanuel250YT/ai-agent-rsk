[![OpenSSF Scorecard](https://api.scorecard.dev/projects/github.com/rsksmart/ai-agent-rsk/badge)](https://scorecard.dev/viewer/?uri=github.com/rsksmart/ai-agent-rsk)
[![CodeQL](https://github.com/rsksmart/rskj/workflows/CodeQL/badge.svg)](https://github.com/rsksmart/ai-agent-rsk/actions?query=workflow%3ACodeQL)

# BlitzPay - DeFi Chat on Bitcoin (Rootstock)

> Pagos, ahorro automatico e IA conversacional sobre Rootstock - sin friccion para LATAM.

**Prototipo para hackathon. No usar en produccion sin auditoria adicional.**

BlitzPay combina un chat tipo WhatsApp con un agente de IA (Groq) para que cualquier usuario pueda enviar pagos en tRBTC, activar auto-ahorro DeFi y consultar balances usando lenguaje natural.

## Demo rapida

```
Usuario: "mandale 0.01 tRBTC a 0xABC..."
  -> IA interpreta -> ejecuta transaccion en Rootstock -> muestra TX hash

Usuario: "ahorra el 10%"
  -> IA activa regla -> banner verde en UI -> contrato BlitzSavings en Rootstock

Usuario: "cuanto tengo"
  -> IA llama balance -> muestra saldo en pantalla
```

## Stack

| Capa       | Tecnologia                          |
|------------|-------------------------------------|
| Frontend   | Next.js 15, TailwindCSS, shadcn/ui  |
| Wallet     | Reown AppKit + wagmi                |
| IA         | Groq (llama3-70b-8192)              |
| Blockchain | Rootstock Testnet (chain 31)        |
| Contrato   | BlitzSavings.sol (Solidity ^0.8)    |
| WhatsApp   | WAHA webhook (/api/webhook/waha)    |

## Setup

### 1. Instalar

```bash
npm install
```

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

| Variable | Descripcion |
|---|---|
| NEXT_PUBLIC_PROJECT_ID | Reown Cloud project ID |
| NEXT_PUBLIC_RPC_TESTNET | RPC Rootstock Testnet (ej: https://public-node.testnet.rsk.co) |
| GROQ_API_KEY | API key de console.groq.com |
| NEXT_PUBLIC_BLITZ_SAVINGS_ADDRESS | Contrato desplegado (opcional) |
| WAHA_WEBHOOK_SECRET | Secreto WAHA (opcional) |

### 3. Correr

```bash
npm run dev
# -> http://localhost:3000
```

## Tests

```bash
npm test
```

Cubre: AutoSave logic, AI function call parser, wallet validation.

## API Endpoints

### POST /api/ai

```json
{ "question": "mandale 0.01 a 0xABC...", "address": "0xUSER...", "messageHistory": [] }
Response: { "functionCall": { "name": "transfer", "arguments": { ... } } }
```

### POST /api/webhook/waha

Recibe mensajes WhatsApp. Comandos: /send 0.01, /balance, /save 10%, texto libre (-> IA).

## Contrato BlitzSavings

contracts/BlitzSavings.sol - vault DeFi en Rootstock.

Funciones: deposit(), withdraw(amount), getBalance(user), setSavingsRule(%), getSavingsRule(user), depositFor(user)

Testnet faucet: https://faucet.rootstock.io

## Demo Hackathon

```bash
# Terminal 1
npm run dev

# Terminal 2 - simula flujo completo
npx tsx scripts/seed.ts
```

Flujo: Login -> Balance -> Enviar pago -> Activar auto-ahorro -> Botones rapidos

## Arquitectura

```
src/app/page.tsx                <- Chat UI (WhatsApp-like)
src/app/api/ai/route.ts         <- Groq + function calling
src/app/api/webhook/waha/       <- WAHA WhatsApp webhook
src/lib/autosave.ts             <- Logica auto-ahorro (pura)
contracts/BlitzSavings.sol      <- Vault DeFi Solidity
__tests__/                      <- Unit + integration tests
scripts/seed.ts                 <- Demo seed
```

## Licencia

MIT
