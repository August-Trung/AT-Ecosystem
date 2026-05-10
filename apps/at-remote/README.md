# AT Remote

AT Remote là app Android-first để điều khiển ATAssistant qua WiFi nội bộ.

## Chạy Với ATAssistant

Chạy một bản desktop duy nhất:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-assistant"
.\run.ps1
```

Trong ATAssistant, bật `Kết nối điện thoại`. Không cần chạy thêm Vite/dev server cho bản Android đã cài.

Trên điện thoại:

1. Cài APK hoặc mở URL LAN đang hiện trong ATAssistant nếu muốn dùng bản web.
2. Bấm `Tìm máy tính trong WiFi`; app sẽ tự dò máy đang bật ATAssistant.
3. Quét QR hoặc nhập mã kết nối nếu cần.
4. Chọn `Cho phép` trong cửa sổ `Kết nối điện thoại` trên desktop.

QR dùng deep link `atremote://pair?...` để mở thẳng app Android nếu đã cài. URL HTTP bên dưới QR vẫn dùng được cho PWA/browser khi `apps/at-remote` đã được build.

## Dùng Từ Xa Qua Tailscale

Tailscale là cách dùng từ xa khuyến nghị cho bản này vì không cần mở port router.

1. Cài Tailscale trên máy tính và điện thoại.
2. Đăng nhập cùng một tailnet.
3. Mở ATAssistant, bật `Kết nối điện thoại`.
4. Trong cửa sổ kết nối, dùng dòng `Tailscale: http://100.x.x.x:8765`.
5. Trên điện thoại, quét QR hoặc nhập đúng địa chỉ Tailscale và mã kết nối.

Nếu app không thấy máy tính khi bấm `Tìm máy tính`, hãy nhập địa chỉ Tailscale đang hiện trong ATAssistant. Tailscale không dùng quét subnet như WiFi, nên app sẽ thử đúng địa chỉ đã lưu/đang nhập trước rồi mới quét WiFi.

## Web/PWA Development

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm install
npm run dev -- --host 0.0.0.0
```

Nếu mở bằng Vite LAN URL, app vẫn tự suy luận ATAssistant ở cổng `8765` trên cùng máy.

Build web để ATAssistant serve trực tiếp:

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm run build
```

`dist/` là output build và không commit.

## Android Debug

```powershell
cd "D:\Study\Projects\AT Ecosystem\apps\at-remote"
npm run android:sync
npm run android:build
```

Nếu terminal đang dùng Java cũ:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:PATH="$env:JAVA_HOME\bin;$env:ANDROID_HOME\platform-tools;$env:PATH"
npm run android:build
```

Debug APK nằm ở:

```text
apps/at-remote/android/app/build/outputs/apk/debug/app-debug.apk
```

## Android Release Ký APK

Không commit keystore hoặc password. Dùng biến môi trường:

```powershell
$env:JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
$env:ANDROID_HOME="$env:LOCALAPPDATA\Android\Sdk"
$env:ANDROID_SDK_ROOT=$env:ANDROID_HOME
$env:AT_REMOTE_KEYSTORE="D:\Secrets\at-remote-release.jks"
$env:AT_REMOTE_KEYSTORE_PASSWORD="..."
$env:AT_REMOTE_KEY_ALIAS="atremote"
$env:AT_REMOTE_KEY_PASSWORD="..."
npm run android:release
```

Hoặc tạo file local `apps/at-remote/android/signing.properties`:

```properties
storeFile=D:\\Secrets\\at-remote-release.jks
storePassword=...
keyAlias=atremote
keyPassword=...
```

`signing.properties`, `*.jks`, `*.keystore` đã được ignore.

Release APK nằm ở:

```text
apps/at-remote/android/app/build/outputs/apk/release/app-release.apk
```

## Tệp Và Quyền

Tệp gửi từ điện thoại lên desktop được lưu theo từng thiết bị trong thư mục dữ liệu ATAssistant:

```text
%LOCALAPPDATA%\AT Ecosystem\ATAssistant\mobile_uploads\<device-id>\
```

Trong AT Remote có màn `Tệp đã gửi` để xem, tải về điện thoại, chia sẻ, xóa, hoặc yêu cầu desktop mở thư mục.

Quyền được quản lý trong cửa sổ `Kết nối điện thoại` trên ATAssistant theo nhóm:

- `Tệp`
- `Điều khiển ứng dụng`
- `Nguồn máy`
- `Trình duyệt`

Mặc định `Nguồn máy` tắt để tránh lệnh nguy hiểm. App mobile chỉ hiển thị trạng thái quyền; desktop là nơi quyết định quyền.
