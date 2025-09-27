import { Agent, tool } from '@openai/agents';
import type { Socket } from "socket.io-client";
import { getSocket } from "@/app/lib/socketClient";

export const showAgent = new Agent({
  name: 'showAgent',
  handoffDescription:
    'The agent that manages the graphical display for the user.  It shows summary of points made, images from a url, math formulas, etc.',

  instructions: `
# Personality and Tone
## Identity
You are the agent tht manages the graphical display for the conversation.

## Task
Your role is to show pertinent information to the user in a graphical format.  This includes:
- Summarizing key points just made by the assistant if it helps the user understand.
- Displaying images from URLs when you are prompted to do so by the handoff agent.
- Rendering math formulas when you are prompted to do so by the handoff agent.

You use showText, showImage, and showMath tools to accomplish this.
These tools will add breadcrumbs to the transcript so you know what is currently being shown to the user.

Whether or not you use the tool, you hand it off to the talking agent after you show something.
`,

  tools: [
    tool({
      name: "showText",
      description: "This function is responsible for displaying text content.",
      parameters: {
        type: "object",
        properties: {
          text: {
            description: "An array of strings to show.",
            type: "array",
            items: { type: "string" },
          },
        },
        required: ["text"],
        additionalProperties: false,
      },
      execute: async (args: any, details) => {
        const text = args.text;
        console.log("showText called with:", text);
        // describe the shape of your payload
        interface PushMessage {
          kind: "text" | "math";
          content: string;
          size: "small" | "medium" | "large";
          ticker: string;
          ts?: string;
        }

        const socket: Socket = getSocket();

        // emit a message
        const msg: PushMessage = {
          kind: "text",
          content: text,
          size: "medium",
          ticker: "",
          ts: new Date().toISOString()
        };

        socket.emit("push", msg);
        return text;
      },
    }),
    tool({
      name: "showImage",
      description: "This function is responsible for displaying an image from a URL.",
      parameters: {
        type: "object",
        properties: {
          url: {
            type: "string",
            description: "The URL of the image to show.",
          },
        },
        required: ["url"],
        additionalProperties: false,
      },
      execute: async (args: any, details) => {
        const url = args.url;
        return url;
      },
    }),
    tool({
      name: "showMath",
      description: "This function is responsible for displaying a math formula.",
      parameters: {
        type: "object",
        properties: {
          formula: {
            type: "string",
            description: "The LaTeX formula to show.",
          },
        },
        required: ["formula"],
        additionalProperties: false,
      },
      execute: async (args: any, details) => {
        const formula = args.formula;
// describe the shape of your payload
        interface PushMessage {
          kind: "text" | "math";
          content: string;
          size: "small" | "medium" | "large";
          ticker: string;
          ts?: string;
        }

        const socket: Socket = getSocket();

        // emit a message
        const msg: PushMessage = {
          kind: "math",
          content: formula,
          size: "medium",
          ticker: "",
          ts: new Date().toISOString()
        };

        socket.emit("push", msg);
        return formula;
      },
    })
  ],

  handoffs: [], // populated later in index.ts
});
