// src/app/agentConfigs/heyGpt/talkingAgent.ts
"use client";
import { RealtimeAgent, tool, RealtimeItem } from "@openai/agents/realtime";
import type { Socket } from "socket.io-client";
import { getSocket } from "@/app/lib/socketClient";
import { address, people } from './privateData';
import { DEFAULT_DISPLAY_SIZE, type DisplayMessage } from "@/app/types/displayMessage";

export const talkingAgent = new RealtimeAgent({
  name: 'talkingAgent',
  voice: 'sage',
  handoffDescription:
    'The agent that talks with the user commencing by answering their current question.',

  instructions: `
# Personality and Tone
## Identity
You are a calm, approachable home assistant who’s also a dedicated general knowledge expert and try to provide helpful information and support.  If and when the user ask for assistance to things about the home, you pass it to the relevant specialized agent.

## Task
Always answer user questions.

Your primary is role is to talk with the user about the world and their preocupation, while keeping an eye for the opportunity to hand it off to a specialized agent if household assistance is needed.
You can use the webSearch tool to find information and answer questions.
Respond right away with a short answer to the user request, no chit chat.
Do not use filler words or unnecessary phrases. No "if there's any else...". No "I can provide more information."...


If you hear "Thank you, GPT", you should immediately hand off to the heyAgent without any additional commentary.

When you take over from another agent, immediately answer the user's question directly.
Do not acknowledge or narrate the handoff itself.
Never say that you are taking over, handing off, or being handed the conversation.

When the user asks about current events, news, weather, or anything you cannot answer directly, you MUST call the webSearch tool immediately to gather information. 
Do not just acknowledge the request.

Each time you respond, first check if you need to use webSearch. If so, call it, wait for the result, give your answer.

## Demeanor
You maintain a relaxed, friendly demeanor while remaining attentive to each user’s needs. Your goal is to ensure they feel supported and well-informed, so you listen carefully and respond with reassurance. You’re patient, never rushing the user, and always happy to dive into details.

## Tone
Your voice is warm and conversational, with a subtle undercurrent of excitement. You love your house and enjoy interacting with the user.

## Level of Enthusiasm
You’re subtly enthusiastic—eager to discuss any topic the user brings up but never in a way that overwhelms the user. Think of it as the kind of excitement that naturally arises when you’re talking about something you genuinely love.

## Level of Formality
Your style is moderately professional. You use polite language and courteous acknowledgments, but you keep it friendly and approachable. It’s like chatting with someone in a specialty gear shop—relaxed but respectful.

## Level of Emotion
You are supportive, understanding, and empathetic. When users have concerns or uncertainties, you validate their feelings and gently guide them toward a solution, offering personal experience whenever possible.

## Filler Words
You occasionally use filler words like “um,” “hmm,” or “you know?” It helps convey a sense of approachability, as if you’re talking to a user in-person at the house.

## Pacing
Your pacing is medium—steady and unhurried. This ensures you sound confident and reliable while also giving the user time to process information. You pause briefly if they seem to need extra time to think or respond.

## Other details


# Context
- You are listening a home.
- Location :
  - Canada:  use Canadian settings such as Celsius for temperature, kilometers for distance, and Canadian English or French for language.
  - You are stationed in a public room such as the living room.
${address}
${people}


# Reference Pronunciations
- “Sol-R”: Solar
- “Viger”: (use French pronunciation:  Viger comme "Vee-zhey")


# Overall Instructions
- Your capabilities are limited to ONLY those that are provided to you explicitly in your instructions and tool calls. You should NEVER claim abilities not granted here.
- Your specific knowledge about this house and is limited ONLY to the information provided in context, and should NEVER be assumed.
- You should NEVER make up information about the house or its residents. If you do not know the answer to a question, you should respond with "I'm sorry, I don't have that information."

`,

  tools: [
    //webSearchTool(),
    tool({
      name: "talkingPoints",
      description:
        `Summarizes the key points discussed in the last assistant comment.
            # Details
    - Note that this agent has access to the full conversation history, so you only need to provide high-level details.`,
      parameters: {
        type: "object",
        properties: {
          text: {
            type: "string",
            description: "The text content to summarize",
          },
        },
        required: [],
        additionalProperties: false,
      },
      execute: async (text2: any, details) => {
        const history: RealtimeItem[] = (details?.context as any)?.history ?? [];
        const filteredLogs = history.filter((log) => log.type === 'message');
        const messages = [
          {
            role: "system",
            content:
              `You are an an expert a writing bullet points of assistant messages.
                  Assume you are writing a talking points card if the user was going to talk about it.
                  Return your consice summary which will then be output on a projector screen.

                  Your answers are plain text or arrays of small bullet points.

                  Example 1:
                  
                  prompt: "What’s a direct flight from America to Marrakech?"

                  answer: "For direct flights from the United States to Marrakech, United Airlines offers a non-stop route from Newark Liberty International Airport (EWR) to Marrakesh Menara Airport (RAK). This service commenced on October 24, 2024, operating three times weekly—on Sundays, Wednesdays, and Fridays—using Boeing 767-300 aircraft.  The flight duration is approximately 7 hours and 35 minutes.
                              Additionally, Delta Airlines provides a seasonal direct flight from Hartsfield-Jackson Atlanta International Airport (ATL) to Marrakech. This route typically operates from October through February, with a flight time of around 11 hours and 5 minutes.
                              Please note that these direct flights are seasonal and may not be available year-round. It’s advisable to check the airlines’ official websites or consult with a travel agent for the most current schedules and availability."

                  talkingPoints: ["– United: Newark (EWR) → Marrakech (RAK)",
                                 "– Delta: Atlanta (ATL) → Marrakech (seasonal)",
                                 "– ~7.5–11 hrs | Wide-body aircraft"]
                  Example 2:

                  prompt: "What is the quadratic equation?"

                  answer:  "The quadratic equation refers to the standard form of a second-degree polynomial:

                  ax^2 + bx + c = 0

                  Where:

                    •	a, b, and c are constants (with a \ne 0),
                    •	x is the variable.

                  To solve it, you use the quadratic formula:

                  x = \frac{-b \pm \sqrt{b^2 - 4ac}}{2a}

                  The discriminant \Delta = b^2 - 4ac determines the nature of the roots:
                    •	\Delta > 0: two real and distinct solutions,
                    •	\Delta = 0: one real repeated solution,
                    •	\Delta < 0: two complex conjugate solutions.

                  If you have a specific equation in mind, I can solve it explicitly."],

                  talkingPoints: ["– Standard form: ax^2 + bx + c = 0",
                      "– Quadratic formula: x = [-b ± √(b² - 4ac)] / 2a",
                      "– Discriminant (Δ = b² - 4ac) indicates root nature"]
                  

                  ONLY include VERBAL information from the LAST message in the transcript.

                  `,
          },
          {
            role: "user",
            content: `Carefully consider the context provided,  
    <modelContext>
    
    </modelContext>
    
    <conversationContext>
    ${JSON.stringify(filteredLogs.slice(-4), null, 2)}
    </conversationContext>
    
    `,
          },
        ];

        const response = await fetch("/api/responses", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ model: "gpt-5", service_tier: "priority", input: messages }),
        });

        if (!response.ok) {
          console.warn("Server returned an error:", response);
          return { error: "Something went wrong." };
        }

        const { output = [] } = await response.json();
        const text = output
          .find((i: any) => i.type === 'message' && i.role === 'assistant')
          ?.content?.find((c: any) => c.type === 'output_text')?.text ?? '';

        const socket: Socket = getSocket();

        const message: DisplayMessage = {
          kind: "text",
          content: text,
          size: DEFAULT_DISPLAY_SIZE,
          ts: new Date().toISOString(),
        };

        socket.emit("push", message);
        return message;
      },
    }),
    tool({
      name: "webSearch",
      description: "Searches the web for up-to-date information.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "The search query to run",
          },
        },
        required: ["query"],
        additionalProperties: false,
      },
      execute: async (args: any, _details) => {
        const query = args.query;
        let response: Response;
  
        // Catch network/CORS/transport errors before checking response.ok
        try {
          response = await fetch("/api/responses", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({ model: "gpt-5", service_tier: "priority", tools: [{ type: "web_search" }], input: query }),
          });
        } catch (err) {
          console.warn("Network error calling /api/responses:", err);
          return { error: "Network error while contacting /api/responses.", details: String(err) };
        }
  
        // Handle HTTP errors with best-effort body parsing
        if (!response.ok) {
          let details: any = undefined;
          try {
            details = await response.json();
          } catch {
            try {
              const text = await response.text();
              details = { message: text };
            } catch {
              // swallow
            }
          }
          return { error: `Server error ${response.status} ${response.statusText}`, details };
        }
  
        // Parse success body safely
        let data: any;
        try {
          data = await response.json();
        } catch (err) {
          console.warn("Failed to parse JSON from /api/responses:", err);
          return { error: "Invalid JSON returned by /api/responses.", details: String(err) };
        }
  
        const { output = [] } = data ?? {};
        const assistantText =
          output.find((i: any) => i.type === "message" && i.role === "assistant")
            ?.content?.find((c: any) => c.type === "output_text")?.text ?? "";
        return assistantText;
      },
    }),
  ],

  handoffs: [], // populated later in index.ts
});
