"use client";

// Minimal browser shim for the OpenAI client shape used by @openai/agents-openai
// It forwards Responses API calls to our Next.js server proxy at /api/responses

export function createBrowserOpenAIClient() {
  const doPost = async (payload: any) => {
    const res = await fetch("/api/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {}),
    });
    if (!res.ok) {
      let details: any = undefined;
      try {
        details = await res.json();
      } catch {
        try {
          const text = await res.text();
          details = { message: text };
        } catch {
          /* ignore */
        }
      }
      const err = new Error(`Server error ${res.status} ${res.statusText}`);
      (err as any).details = details;
      throw err;
    }
    return res.json();
  };

  return {
    responses: {
      create: async (body: any) => doPost(body),
      parse: async (body: any) => doPost(body),
    },
  } as const;
}

