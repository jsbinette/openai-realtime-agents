"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Agent, Runner, OpenAIProvider, setDefaultModelProvider } from "@openai/agents";
import { createBrowserOpenAIClient } from "@/app/lib/openaiClientShim";

import { useTranscript } from "@/app/contexts/TranscriptContext";
import { useEvent } from "@/app/contexts/EventContext";

type RunModeStatus = "IDLE" | "RUNNING" | "READY";

export interface RunsSessionCallbacks {
  onAgentHandoff?: (agentName: string) => void;
}

export interface RunsConnectOptions {
  initialAgents: Agent[]; // first element is the root agent
  extraContext?: Record<string, any>;
}

/**
 * Hook to manage non-realtime Agents using the Agents SDK Runner ("runs").
 * Keeps a lightweight text-only conversation history and mirrors messages
 * into the TranscriptContext, similar to the realtime flow.
 */
export function useRunsSession(callbacks: RunsSessionCallbacks = {}) {
  const runnerRef = useRef<Runner | null>(null);
  const agentsRef = useRef<Agent[] | null>(null);
  const contextRef = useRef<Record<string, any>>({});

  // Simple conversation history we send to the model each run
  const historyRef = useRef<
    { role: "user" | "assistant"; content: string }[]
  >([]);

  const [status, setStatus] = useState<RunModeStatus>("IDLE");

  const {
    addTranscriptMessage,
    updateTranscriptMessage,
    updateTranscriptItem,
    addTranscriptBreadcrumb,
  } = useTranscript();

  const { logClientEvent, logServerEvent } = useEvent();

  const ensureRunner = useCallback(() => {
    if (!runnerRef.current) {
      // Route model calls through our server proxy to avoid exposing API keys in the browser
      try {
        // Avoid constructing an OpenAI client in the browser; provide a thin shim instead.
        setDefaultModelProvider(
          new OpenAIProvider({ openAIClient: createBrowserOpenAIClient() as any })
        );
      } catch (e) {
        // If already set, ignore
      }

      runnerRef.current = new Runner({
        model: "gpt-5",
        tracingDisabled: true,
      });

      // Tool lifecycle breadcrumbs
      runnerRef.current.on("agent_tool_start", (runCtx, agent, tool) => {
        addTranscriptBreadcrumb(`function call: ${tool.name}`);
      });
      runnerRef.current.on(
        "agent_tool_end",
        (runCtx, agent, tool, result: any) => {
          addTranscriptBreadcrumb(
            `function call result: ${tool.name}`,
            safeParse(result)
          );
        },
      );

      // Handoffs between agents
      runnerRef.current.on("agent_handoff", (_ctx, fromAgent, toAgent) => {
        addTranscriptBreadcrumb(`Agent handoff → ${toAgent.name}`);
        callbacks.onAgentHandoff?.(toAgent.name);
      });

      // Basic run tracing
      runnerRef.current.on("agent_start", (_ctx, agent) => {
        logServerEvent({ type: "agent_start", agent: agent.name });
      });
      runnerRef.current.on("agent_end", (_ctx, agent, output) => {
        logServerEvent({ type: "agent_end", agent: agent.name, output });
      });
    }
  }, [callbacks, addTranscriptBreadcrumb, logServerEvent]);

  const connect = useCallback(async ({
    initialAgents,
    extraContext,
  }: RunsConnectOptions) => {
    agentsRef.current = initialAgents;
    contextRef.current = {
      // Pass transcript helpers in the run context like the realtime agent
      addTranscriptBreadcrumb,
      updateTranscriptItem,
      ...extraContext,
    };
    ensureRunner();
    setStatus("READY");
  }, [addTranscriptBreadcrumb, updateTranscriptItem, ensureRunner]);

  const disconnect = useCallback(() => {
    // Clear everything for a fresh start
    runnerRef.current = null;
    agentsRef.current = null;
    contextRef.current = {};
    historyRef.current = [];
    setStatus("IDLE");
  }, []);

  const sendUserText = useCallback(async (text: string) => {
    if (!agentsRef.current?.length) throw new Error("RunsSession not ready");
    if (!runnerRef.current) ensureRunner();
    setStatus("RUNNING");

    const rootAgent = agentsRef.current[0];

    // Mirror user message into transcript
    const userId = uuidv4().slice(0, 32);
    addTranscriptMessage(userId, "user", text); //JSB add a third param true to make it hidden
    updateTranscriptItem(userId, { status: "DONE" });

    // Track assistant placeholder to update later
    const assistantId = uuidv4().slice(0, 32);
    addTranscriptMessage(assistantId, "assistant", ""); //JSB add a third param true to make it hidden

    // Append to our simple conversation history
    historyRef.current.push({ role: "user", content: text });

    try {
      // Build a simple text transcript as context for the run.
      const recent = historyRef.current.slice(-6);
      const prompt = recent
        .map((m) => (m.role === "user" ? `User: ${m.content}` : `Assistant: ${m.content}`))
        .join("\n\n");

      const result = await runnerRef.current!.run(rootAgent, prompt, {
        context: contextRef.current,
        maxTurns: 10,
      });

      const finalText = String(result.finalOutput ?? "");
      updateTranscriptMessage(assistantId, finalText, false);
      updateTranscriptItem(assistantId, { status: "DONE" });

      if (finalText) {
        historyRef.current.push({ role: "assistant", content: finalText });
      }
    } catch (err: any) {
      const msg = typeof err?.message === "string" ? err.message : String(err);
      updateTranscriptMessage(
        assistantId,
        `Sorry, I hit an error: ${msg}`,
        false,
      );
      updateTranscriptItem(assistantId, { status: "DONE" });
      // Log to Events pane as a server event for better visibility
      logServerEvent({ type: 'runs_error', message: msg });
    } finally {
      setStatus("READY");
    }
  }, [addTranscriptMessage, updateTranscriptItem, updateTranscriptMessage, ensureRunner, logClientEvent]);

  const interrupt = useCallback(() => {
    // No-op for non-realtime runs; included for API parity
  }, []);

  return useMemo(
    () => ({
      status,
      connect,
      disconnect,
      sendUserText,
      interrupt,
    }),
    [status, connect, disconnect, sendUserText, interrupt],
  );
}

function safeParse(data: any) {
  try {
    if (typeof data === "string") return JSON.parse(data);
    return data;
  } catch {
    return data;
  }
}
