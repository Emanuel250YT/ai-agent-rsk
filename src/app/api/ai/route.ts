import { NextResponse } from "next/server";
import { Groq } from "groq-sdk";

const groqClient = new Groq({
  apiKey: process.env.GROQ_API_KEY as string,
});

export async function POST(req: Request) {
  try {
    const {
      type,
      data,
      question,
      address,
      messageHistory = [],
    } = await req.json();

    const prompt = createChatPrompt(data, question, address);

    const limitedHistory = messageHistory.slice(-10);

    const messages = [
      {
        role: "system",
        content: getSystemPrompt(),
      },
    ];

    if (limitedHistory && limitedHistory.length > 0) {
      limitedHistory.forEach((msg: { role: string; content: string }) => {
        messages.push({
          role: msg.role === "bot" ? "assistant" : "user",
          content: typeof msg.content === "string" ? msg.content : "User input",
        });
      });
    }

    messages.push({
      role: "user",
      content: prompt,
    });

    const response = await groqClient.chat.completions.create({
      model: "openai/gpt-oss-120b",
      max_tokens: 2024,
      messages: messages as Parameters<typeof groqClient.chat.completions.create>[0]['messages'],
      temperature: 0.7,
      tools: [
        {
          type: "function",
          function: {
            name: "transfer",
            description:
              "Transfer tokens from the user's wallet to another address",
            parameters: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description: "Recipient wallet address",
                },
                token1: {
                  type: "string",
                  description:
                    "Token symbol to transfer (e.g., TRBTC, DOC, RIF)",
                },
                amount: {
                  type: "number",
                  description: "Amount of tokens to transfer",
                },
              },
              required: ["address", "token1", "amount"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "balance",
            description: "Check token balance for an address",
            parameters: {
              type: "object",
              properties: {
                address: {
                  type: "string",
                  description:
                    "Wallet address to check (defaults to user's wallet if empty)",
                },
                token1: {
                  type: "string",
                  description:
                    "Token symbol to check balance for (e.g., TRBTC, DOC, RIF)",
                },
              },
              required: ["token1"],
            },
          },
        },
        {
          type: "function",
          function: {
            name: "autosave",
            description:
              "Activate an automatic savings rule. Called when the user says they want to save a percentage of their income, e.g. 'ahorra el 10%' or 'save 20% of my income'",
            parameters: {
              type: "object",
              properties: {
                percentage: {
                  type: "number",
                  description:
                    "The percentage of income to automatically save (1–100)",
                },
              },
              required: ["percentage"],
            },
          },
        },
      ],
      tool_choice: "auto",
    });

    const aiMessage = response.choices[0].message;
    const toolCalls = aiMessage.tool_calls;

    // Handle function calls if present
    if (toolCalls && toolCalls.length > 0) {
      const toolCall = toolCalls[0];
      const functionName = toolCall.function.name;
      const functionArgs = JSON.parse(toolCall.function.arguments);

      return NextResponse.json({
        analysis: aiMessage.content || "Processing your request...",
        type,
        functionCall: {
          name: functionName,
          arguments: functionArgs,
        },
      });
    }

    // Regular response without function calls
    return NextResponse.json({
      analysis: aiMessage.content,
      type,
    });
  } catch (error) {
    console.error("AI Analysis Error:", error);
    return NextResponse.json({ error: "Analysis failed" }, { status: 500 });
  }
}

function getSystemPrompt() {
  return `Sos BlitzPay, un asistente financiero personal para DeFi en Rootstock (Bitcoin sidechain).
  Respondés en español rioplatense (Argentina/Uruguay). Sos conciso, amigable y profesional.
  
  ENTORNO: Rootstock TESTNET
  - Token nativo: tRBTC (testnet RBTC)
  - Tokens disponibles: tRBTC, tRIF, tDOC
  - Sin valor real (testnet)
  
  TUS FUNCIONES:
  - "transfer": cuando el usuario quiere enviar tokens. Ej: "mandale 0.01 a juan" → usá transfer
  - "balance": cuando pregunta cuánto tiene. Ej: "cuanto tengo" → usá balance
  - "autosave": cuando quiere ahorrar automáticamente. Ej: "ahorra el 10%" → usá autosave con percentage=10
  
  RESPUESTAS:
  - Máximo 2 oraciones cortas
  - Usá negrita (**texto**) para números y tokens
  - Sin listas largas ni explicaciones técnicas
  - Si el usuario pide enviar/recibir/ahorrar/balance → SIEMPRE usá la función correspondiente
  - Hablá de "tRBTC" no "RBTC" (estamos en testnet)
  
  SÉ ULTRA-BREVE. Escaneable en 3 segundos.`;
}

function createChatPrompt(userContext: unknown, question: string, address: string) {
  return `Wallet del usuario: ${address || "no conectada"}

MENSAJE: "${question}"

Portfolio: ${JSON.stringify(userContext, null, 2)}
Nota: los amounts están en wei, dividir por 10^18 para mostrar el valor real.

Respondé según las instrucciones del sistema. Si corresponde a una función (transfer/balance/autosave), usala directamente.`;
}
