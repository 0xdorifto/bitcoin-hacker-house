import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import * as dotenv from "dotenv";
import { createWalletClient, http, publicActions } from "viem";
import { mnemonicToAccount } from "viem/accounts";
import { rootstockTestnet } from "viem/chains";
import { RSK_RPC_URL } from "./lib/constants.js";
import { rskMcpTools, toolToHandler } from "./tools/index.js";
import { version } from "./version.js";

async function main() {
  dotenv.config();
  const seedPhrase = process.env.SEED_PHRASE;

  if (!seedPhrase) {
    console.error(
      "Please set SEED_PHRASE environment variable in your .env file"
    );
    process.exit(1);
  }

  const viemClient = createWalletClient({
    account: mnemonicToAccount(seedPhrase),
    chain: rootstockTestnet,
    transport: http(RSK_RPC_URL),
  }).extend(publicActions);

  const server = new Server(
    {
      name: "Rootstock MCP Server",
      version,
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error("Received ListToolsRequest");
    return {
      tools: rskMcpTools,
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    try {
      const tool = toolToHandler[request.params.name];
      if (!tool) {
        throw new Error(`Tool ${request.params.name} not found`);
      }

      const result = await tool(viemClient, request.params.arguments);

      return {
        content: [
          {
            type: "text",
            text: JSON.stringify(result),
          },
        ],
      };
    } catch (error) {
      throw new Error(`Tool ${request.params.name} failed: ${error}`);
    }
  });

  const transport = new StdioServerTransport();
  console.error("Connecting server to transport...");
  await server.connect(transport);
  console.error("Rootstock MCP Server running on stdio");
}

main().catch((error) => {
  console.error("Fatal error in main():", error);
  process.exit(1);
});
