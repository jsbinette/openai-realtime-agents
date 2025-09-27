"use client";
import Script from "next/script";
import { useEffect } from "react";
import Head from "next/head";
import { io } from "socket.io-client";

export default function ControlPage() {
  useEffect(() => {
    document.body.classList.add("control");
    const socket = io("/", { path: "/api/socket" });
    const content = document.getElementById("content") as HTMLTextAreaElement;
    const kind = document.getElementById("kind") as HTMLSelectElement;
    const size = document.getElementById("size") as HTMLSelectElement;
    const ticker = document.getElementById("ticker") as HTMLInputElement;
    const queueEl = document.getElementById("queue") as HTMLOListElement;

    document.getElementById("send")!.onclick = () => {
      socket.emit("push", {
        kind: kind.value,
        content: content.value,
        size: size.value,
        ticker: ticker.value,
      });
    };

    document.getElementById("enqueue")!.onclick = () => {
      const item = {
        kind: kind.value,
        content: content.value,
        size: size.value,
        ticker: ticker.value,
      };
      const li = document.createElement("li");
      li.textContent = `[${item.kind}/${item.size}] ${item.content.slice(0, 80)}`;
      li.dataset.payload = JSON.stringify(item);
      queueEl.appendChild(li);
      content.value = "";
    };

    document.getElementById("play")!.onclick = async () => {
      const items = Array.from(queueEl.children).map((li) =>
        JSON.parse((li as HTMLElement).dataset.payload!)
      );
      for (const it of items) {
        socket.emit("push", it);
        await new Promise((r) => setTimeout(r, 1200));
      }
    };

    document.getElementById("clear")!.onclick = () => {
      socket.emit("push", {
        kind: "text",
        content: "",
        size: "medium",
        ticker: "",
      });
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
          <textarea id="content" className="input" placeholder="Type text, math ($...$), or image URL"></textarea>
          <div className="row" style={{ marginTop: "8px" }}>
            <select id="kind" className="input">
              <option value="text">Text</option>
              <option value="math">Math</option>
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