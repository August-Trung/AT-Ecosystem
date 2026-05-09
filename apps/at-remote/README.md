# AT Remote

AT Remote is the mobile-first companion app for controlling ATAssistant over a local WiFi network.

## Run For Development

Terminal 1:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-assistant"
.\run.ps1 remote
```

Terminal 2:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm install
npm run dev -- --host 0.0.0.0
```

Open the Vite LAN URL on Android. The app defaults to `http://<same-host>:8765` for ATAssistant.

## Build And Serve From ATAssistant

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm install
npm run build
```

Then start ATAssistant and enable `Kết nối điện thoại`, or run:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-assistant"
.\run.ps1 remote
```

The bridge prints a LAN URL and pairing code. On Android, open the LAN URL, enter the code if it is not prefilled, then approve the pending phone in ATAssistant.

`dist/` is generated output and must not be committed.
