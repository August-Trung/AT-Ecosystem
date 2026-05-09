# AT Remote

AT Remote is the Android-first companion app for controlling ATAssistant over a local WiFi network.

The first native shell uses Capacitor. The same React interface is available as a PWA for quick LAN testing, and the Android project lives in `android/`.

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

## Android

Sync the Android project:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm run android:sync
```

Open in Android Studio:

```powershell
npm run android:open
```

Build a debug APK when JDK 17 and Android SDK are installed:

```powershell
npm run android:build
```

If Windows still points to Java 8, use Android Studio's bundled JDK for the current terminal:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
npm run android:build
```

The debug APK is generated under `android/app/build/outputs/apk/debug/` and is not committed.
