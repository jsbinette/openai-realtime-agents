"use client";
import { useEffect } from "react";
import Head from "next/head";
import { io } from "socket.io-client";
import {
  DEFAULT_DISPLAY_SIZE,
  type DisplayMessage,
  type DisplaySize,
  type ListItem,
} from "@/app/types/displayMessage";

type ListItemObject = Exclude<ListItem, string>;

const LIST_VARIANTS: Array<NonNullable<ListItemObject["variant"]>> = [
  "default",
  "info",
  "success",
  "warning",
  "danger",
];

const isDisplaySize = (value: string): value is DisplaySize =>
  ["tiny", "small", "medium", "large", "huge"].includes(value);

const isListVariant = (value: string): value is NonNullable<ListItemObject["variant"]> =>
  LIST_VARIANTS.includes(value as NonNullable<ListItemObject["variant"]>);

const sanitizeListItems = (value: unknown): ListItem[] => {
  if (!Array.isArray(value)) return [];
  const result: ListItem[] = [];

  value.forEach((entry) => {
    if (typeof entry === "string") {
      result.push(entry.trim());
      return;
    }

    if (entry && typeof entry === "object") {
      const maybe = entry as Record<string, unknown>;
      const title = typeof maybe.title === "string" ? maybe.title.trim() : null;
      if (!title) return;

      const item: ListItemObject = { title };
      if (typeof maybe.subtitle === "string" && maybe.subtitle.trim()) {
        item.subtitle = maybe.subtitle.trim();
      }

      if (typeof maybe.variant === "string" && isListVariant(maybe.variant)) {
        item.variant = maybe.variant;
      }

      result.push(item);
    }
  });

  return result;
};

const parseListInput = (raw: string): ListItem[] => {
  const trimmed = raw.trim();
  if (!trimmed) return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      const items = sanitizeListItems(parsed);
      if (items.length) return items;
    } else if (parsed && typeof parsed === "object") {
      const maybeItems = (parsed as Record<string, unknown>).items;
      const items = sanitizeListItems(maybeItems);
      if (items.length) return items;
    }
  } catch {
    // ignore JSON errors and fall back to line parsing
  }

  const lines = trimmed
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  const fallback: ListItem[] = [];
  lines.forEach((line) => {
    const segments = line.split("|").map((segment) => segment.trim()).filter(Boolean);
    if (!segments.length) return;
    if (segments.length === 1) {
      fallback.push(segments[0]);
      return;
    }

    const [title, subtitle, variantCandidate] = segments;
    const item: ListItemObject = { title };
    if (subtitle) item.subtitle = subtitle;
    if (variantCandidate && isListVariant(variantCandidate)) {
      item.variant = variantCandidate;
    }
    fallback.push(item);
  });

  return fallback;
};

const truncate = (value: string, length = 80) =>
  value.length > length ? `${value.slice(0, length - 3)}...` : value;

const describeListItem = (item: ListItem): string =>
  typeof item === "string" ? item : item.title;

const summarizeMessage = (message: DisplayMessage): string => {
  switch (message.kind) {
    case "text":
      return truncate(message.content);
    case "math":
      return truncate(message.formula);
    case "list":
      if (!message.items.length) return "Empty list";
      const first = describeListItem(message.items[0]);
      return message.items.length > 1
        ? `${truncate(first)} (+${message.items.length - 1})`
        : truncate(first);
    case "image":
      return truncate(message.url, 60);
    case "background":
      return "Background update";
    default:
      return "";
  }
};

export default function ControlPage() {
  useEffect(() => {
    document.body.classList.add("control");
    const socket = io("/", { path: "/api/socket" });
    const content = document.getElementById("content") as HTMLTextAreaElement;
    const kind = document.getElementById("kind") as HTMLSelectElement;
    const size = document.getElementById("size") as HTMLSelectElement;
    const ticker = document.getElementById("ticker") as HTMLInputElement;
    const queueEl = document.getElementById("queue") as HTMLOListElement;

    const buildMessage = (): DisplayMessage | null => {
      const rawKind = kind.value;
      const rawContent = content.value;
      const maybeTicker = ticker.value.trim();
      const tickerValue = maybeTicker ? maybeTicker : undefined;
      const resolvedSize = isDisplaySize(size.value) ? size.value : DEFAULT_DISPLAY_SIZE;
      const timestamp = new Date().toISOString();

      switch (rawKind) {
        case "text":
          return {
            kind: "text",
            content: rawContent,
            size: resolvedSize,
            ticker: tickerValue,
            ts: timestamp,
          };
        case "math":
          return {
            kind: "math",
            formula: rawContent,
            size: resolvedSize,
            ticker: tickerValue,
            ts: timestamp,
          };
        case "list":
          return {
            kind: "list",
            items: parseListInput(rawContent),
            size: resolvedSize,
            ticker: tickerValue,
            ts: timestamp,
          };
        case "image":
          return {
            kind: "image",
            url: rawContent.trim(),
            ticker: tickerValue,
            ts: timestamp,
          };
        default:
          return null;
      }
    };

    const appendToQueue = (message: DisplayMessage) => {
      const li = document.createElement("li");
      li.textContent = `[${message.kind}] ${summarizeMessage(message)}`;
      li.dataset.payload = JSON.stringify(message);
      queueEl.appendChild(li);
    };

    document.getElementById("send")!.onclick = () => {
      const message = buildMessage();
      if (!message) return;
      socket.emit("push", message);
    };

    document.getElementById("enqueue")!.onclick = () => {
      const message = buildMessage();
      if (!message) return;
      appendToQueue(message);
      content.value = "";
    };

    document.getElementById("play")!.onclick = async () => {
      const items = Array.from(queueEl.children).map((li) =>
        JSON.parse((li as HTMLElement).dataset.payload!) as DisplayMessage
      );
      for (const it of items) {
        socket.emit("push", it);
        await new Promise((r) => setTimeout(r, 1200));
      }
    };

    document.getElementById("clear")!.onclick = () => {
      const message: DisplayMessage = {
        kind: "text",
        content: "",
        size: DEFAULT_DISPLAY_SIZE,
        ticker: "",
        ts: new Date().toISOString(),
      };
      socket.emit("push", message);
    };
    return () => {
      document.body.classList.remove("control");
    };
  }, []);

  return (
    <>
      <Head>
        <title>Projector Control</title>
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&display=swap"
          rel="stylesheet"
        />
        <link rel="stylesheet" href="/static/styles.css" />
      </Head>
      <header className="projector">
        <h1>Projector Control</h1>
        <div className="row">
          <button className="btn" id="clear">Clear</button>
          <button className="btn" id="bgDark">Dark</button>
          <button className="btn" id="bgLight">Light</button>
        </div>
      </header>
      <main className="projector">
        <section className="card">
          <label className="small">Content</label>
          <textarea
            id="content"
            className="input"
            placeholder="Type text, math ($...$), image URL, or list items (one per line or JSON)"
          ></textarea>
          <div className="row" style={{ marginTop: "8px" }}>
            <select id="kind" className="input">
              <option value="text">Text</option>
              <option value="math">Math</option>
              <option value="list">List</option>
              <option value="image">Image URL</option>
            </select>
            <select id="size" className="input" defaultValue="medium">
              <option value="small">Small</option>
              <option value="medium">Medium</option>
              <option value="large">Large</option>
              <option value="huge">Huge</option>
            </select>
            <input type="text" id="ticker" className="input" placeholder="Optional ticker" />
            <button className="btn" id="send">Send</button>
            <button className="btn" id="enqueue">Enqueue</button>
            <button className="btn" id="play">Play Queue</button>
          </div>
        </section>
        <section className="card">
          <label className="small">Queue</label>
          <ol className="queue" id="queue"></ol>
        </section>
      </main>
    </>
  );
}
