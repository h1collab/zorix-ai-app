const { app, BrowserWindow, ipcMain } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1180,
    height: 780,
    minWidth: 920,
    minHeight: 620,
    title: "Zorix AI 3 Beta",
    backgroundColor: "#07111f",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    }
  });

  win.loadFile("src/index.html");
}

ipcMain.on("zorix-chat-stream", async (event, payload) => {
  const { requestId, apiKey, apiUrl, model, messages } = payload;

  try {
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "Accept": "text/event-stream"
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages
      })
    });

    if (!res.ok) {
      const text = await res.text();
      event.sender.send("zorix-chat-error", {
        requestId,
        error: `HTTP ${res.status}: ${text}`
      });
      return;
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const parts = buffer.split("\n\n");
      buffer = parts.pop() || "";

      for (const part of parts) {
        const lines = part.split("\n");
        for (const line of lines) {
          if (!line.startsWith("data:")) continue;

          const raw = line.replace(/^data:\s*/, "").trim();
          if (!raw || raw === "[DONE]") continue;

          let token = raw;

          try {
            const json = JSON.parse(raw);
            token =
              json.delta ||
              json.content ||
              json.reply ||
              json.message ||
              json.choices?.[0]?.delta?.content ||
              json.choices?.[0]?.message?.content ||
              "";
          } catch {}

          if (token) {
            event.sender.send("zorix-chat-token", {
              requestId,
              token
            });
          }
        }
      }
    }

    event.sender.send("zorix-chat-done", { requestId });

  } catch (err) {
    event.sender.send("zorix-chat-error", {
      requestId,
      error: err.message
    });
  }
});

app.whenReady().then(createWindow);
