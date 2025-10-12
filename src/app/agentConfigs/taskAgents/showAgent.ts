import { Agent, tool } from "@openai/agents";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/app/lib/socketClient";
import {
  DEFAULT_DISPLAY_SIZE,
  type DisplayMessage,
  type ListItem,
  type DisplaySize,
} from "@/app/types/displayMessage";

type ListItemObject = Exclude<ListItem, string>;

export const showAgent = new Agent({
  name: 'showAgent',
  handoffDescription:
    'The agent that manages the graphical display for the user.  It shows salient points made, images from a url, math formulas, etc.',

  instructions: `
# Personality and Tone
## Identity
You are the agent that manages the graphical display for the conversation.

## Task
Your role is to show pertinent information to the user in a graphical format.  This includes:
- Be a visual aid to the assistant if it helps the user understand.
- Displaying images from URLs when you are prompted to do so by the handoff agent.
- Rendering math formulas when you are prompted to do so by the handoff agent.

## Behavior
- You should show only the factual information contained, not the whole summary.
    For example, if the assistant says "Here is a picture of a cat: [URL]", you should show only the image from the URL, not the text.
    If the assistant says "Today's weather is sunny with a high of 75°F", you should show only "Sunny, High: 75°F", not the whole sentence.
- You are meant to be a simple visual aid.


You use showText for paragraphs, showList for structured bullet lists, showImage, and showMath tools to accomplish this.
Always send the "size" and "ticker" fields with each tool call (use "medium" and an empty string if you do not need to change them). When calling showList, also provide a "subtitle" (use null when you don't need one) and set "variant" to one of the supported values (use "default" when no special styling is needed).
These tools will add breadcrumbs to the transcript so you know what is currently being shown to the user.

Whether or not you use the tool, you hand it off to the talking agent after you show something.
`,

  tools: [
    tool({
      name: "showText",
      description: "Display a paragraph of text on the projector screen.",
      parameters: {
        type: "object",
        properties: {
          content: {
            type: "string",
            description: "Paragraph or short block of text to render.",
          },
          size: {
            type: "string",
            description: "Relative text size.",
            enum: ["tiny", "small", "medium", "large", "huge"],
          },
          ticker: {
            type: "string",
            description: "Optional ticker text to scroll at the bottom of the display.",
          },
        },
        required: ["content", "size", "ticker"],
        additionalProperties: false,
      },
      execute: async (args: any) => {
        const socket: Socket = getSocket();
        const { content, size, ticker } = args as {
          content: string;
          size?: DisplaySize;
          ticker?: string;
        };

        if (typeof content !== "string") {
          throw new Error("showText requires a content string.");
        }

        const normalizedSize: DisplaySize =
          typeof size === "string" ? (size as DisplaySize) : DEFAULT_DISPLAY_SIZE;
        const normalizedTicker =
          typeof ticker === "string" && ticker.trim() !== "" ? ticker : undefined;

        const message: DisplayMessage = {
          kind: "text",
          content,
          size: normalizedSize,
          ticker: normalizedTicker,
          ts: new Date().toISOString(),
        };

        socket.emit("push", message);
        return message;
      },
    }),
    tool({
      name: "showList",
      description: "Display an ordered set of talking points for the user.",
      parameters: {
        type: "object",
        properties: {
          items: {
            type: "array",
            description: "Talking points to display as a list.",
            items: {
              anyOf: [
                { type: "string" },
                {
                  type: "object",
                  properties: {
                    title: { type: "string" },
                    subtitle: { type: ["string", "null"] },
                    variant: {
                      type: "string",
                      enum: ["default", "info", "success", "warning", "danger"],
                    },
                  },
                  required: ["title", "subtitle", "variant"],
                  additionalProperties: false,
                },
              ],
            },
          },
          size: {
            type: "string",
            description: "Relative text size.",
            enum: ["tiny", "small", "medium", "large", "huge"],
          },
          ticker: {
            type: "string",
            description: "Optional ticker text to scroll at the bottom of the display.",
          },
        },
        required: ["items", "size", "ticker"],
        additionalProperties: false,
      },
      execute: async (args: any) => {
        const socket: Socket = getSocket();
        const { items, size, ticker } = args as {
          items: Array<
            | ListItem
            | {
                title: string;
                subtitle: string | null;
                variant: ListItemObject["variant"] | null;
              }
          >;
          size?: DisplaySize;
          ticker?: string;
        };

        if (!Array.isArray(items)) {
          throw new Error("showList requires an array of items.");
        }

        const normalizedItems: ListItem[] = items.map((entry) => {
          if (typeof entry === "string") {
            return entry;
          }

          const normalized: ListItemObject = {
            title: entry.title,
          };

          if (typeof entry.subtitle === "string" && entry.subtitle.trim() !== "") {
            normalized.subtitle = entry.subtitle.trim();
          }

          if (
            typeof entry.variant === "string" &&
            ["default", "info", "success", "warning", "danger"].includes(entry.variant)
          ) {
            if (entry.variant !== "default") {
              normalized.variant = entry.variant as NonNullable<ListItemObject["variant"]>;
            }
          }

          return normalized;
        });

        const normalizedSize: DisplaySize =
          typeof size === "string" ? (size as DisplaySize) : DEFAULT_DISPLAY_SIZE;
        const normalizedTicker =
          typeof ticker === "string" && ticker.trim() !== "" ? ticker : undefined;

        const message: DisplayMessage = {
          kind: "list",
          items: normalizedItems,
          size: normalizedSize,
          ticker: normalizedTicker,
          ts: new Date().toISOString(),
        };

        socket.emit("push", message);
        return message;
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
      execute: async (args: any) => {
        const socket: Socket = getSocket();
        const url = args.url as string;

        const message: DisplayMessage = {
          kind: "image",
          url,
          ts: new Date().toISOString(),
        };

        socket.emit("push", message);
        return message;
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
      execute: async (args: any) => {
        const socket: Socket = getSocket();
        const formula = args.formula as string;

        const message: DisplayMessage = {
          kind: "math",
          formula,
          size: DEFAULT_DISPLAY_SIZE,
          ts: new Date().toISOString(),
        };

        socket.emit("push", message);
        return message;
      },
    })
  ],

  handoffs: [], // populated later in index.ts
});
