const { app, BrowserWindow } = require("electron");

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 760,
    title: "Zorix AI"
  });

  win.loadFile("src/index.html");
}

app.whenReady().then(createWindow);
