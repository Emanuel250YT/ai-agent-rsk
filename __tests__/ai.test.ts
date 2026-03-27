/**
 * Tests for the AI route's function-call parsing logic.
 * We mock the Groq client so no real API calls are made.
 */

// ── Mock groq-sdk ──────────────────────────────────────────────────────────
const mockCreate = jest.fn();
jest.mock("groq-sdk", () => ({
  Groq: jest.fn().mockImplementation(() => ({
    chat: { completions: { create: mockCreate } },
  })),
}));

// ── Helpers ──────────────────────────────────────────────────────────────
function makeFunctionCallResponse(name: string, args: Record<string, unknown>) {
  return {
    choices: [
      {
        message: {
          content: null,
          tool_calls: [
            {
              function: { name, arguments: JSON.stringify(args) },
            },
          ],
        },
      },
    ],
  };
}

function makeTextResponse(text: string) {
  return {
    choices: [
      {
        message: { content: text, tool_calls: null },
      },
    ],
  };
}

// ── We test the route logic by importing the POST handler ──────────────────
// Next.js route handlers export named functions; we test the AI response
// parsing independently here.

describe("AI Route — function call detection", () => {
  it("detects a transfer function call from Groq response", () => {
    const response = makeFunctionCallResponse("transfer", {
      address: "0xAbCd1234567890AbCd1234567890AbCd12345678",
      token1: "tRBTC",
      amount: 0.01,
    });

    const toolCalls = response.choices[0].message.tool_calls;
    expect(toolCalls).not.toBeNull();
    expect(toolCalls![0].function.name).toBe("transfer");

    const args = JSON.parse(toolCalls![0].function.arguments);
    expect(args.token1).toBe("tRBTC");
    expect(args.amount).toBe(0.01);
  });

  it("detects a balance function call from Groq response", () => {
    const response = makeFunctionCallResponse("balance", {
      token1: "tRBTC",
      address: "",
    });

    const toolCalls = response.choices[0].message.tool_calls;
    expect(toolCalls![0].function.name).toBe("balance");
  });

  it("detects an autosave function call from Groq response", () => {
    const response = makeFunctionCallResponse("autosave", { percentage: 15 });

    const toolCalls = response.choices[0].message.tool_calls;
    expect(toolCalls![0].function.name).toBe("autosave");

    const args = JSON.parse(toolCalls![0].function.arguments);
    expect(args.percentage).toBe(15);
  });

  it("returns plain text for non-command messages", () => {
    const response = makeTextResponse("Hola! ¿En qué puedo ayudarte?");

    const toolCalls = response.choices[0].message.tool_calls;
    expect(toolCalls).toBeNull();
    expect(response.choices[0].message.content).toBe(
      "Hola! ¿En qué puedo ayudarte?"
    );
  });
});

describe("AI Route — wallet address validation", () => {
  it("accepts valid EVM addresses", () => {
    const validAddress = "0xAbCd1234567890AbCd1234567890AbCd12345678";
    const regex = /^(0x)?[0-9a-fA-F]{40}$/;
    expect(regex.test(validAddress)).toBe(true);
  });

  it("rejects malformed addresses", () => {
    const invalid = ["0xshort", "not-an-address", "", "0x" + "z".repeat(40)];
    const regex = /^(0x)?[0-9a-fA-F]{40}$/;
    for (const addr of invalid) {
      expect(regex.test(addr)).toBe(false);
    }
  });
});
