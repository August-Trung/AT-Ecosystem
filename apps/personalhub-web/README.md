# My Personal Hub

Workspace production hiện tại gồm:

- `my-personal-hub`: frontend Vue 3 + Vite
- `my-personal-hub-api`: backend ASP.NET Web API
- `my-personal-hub-api.Tests`: unit test cho backend

Kiến trúc hiện tại:

- Frontend gọi trực tiếp ASP.NET API
- Backend dùng SQL Server `db_MyFileHub`
- Toàn bộ truy cập dữ liệu đi qua stored procedures
- File upload được lưu trên Google Drive

## Trạng thái

Dự án đã ở trạng thái dùng được end-to-end:

- xác thực người dùng
- quản lý link ngắn
- quản lý file
- upload, download, delete file qua Google Drive
- dashboard và thống kê
- health check, Swagger, logging, rate limiting

## Chạy local

Frontend:

```bash
cd my-personal-hub
npm install
npm run dev
```

Backend:

```bash
cd my-personal-hub-api
dotnet run --launch-profile http
```

Mặc định:

- Frontend: `http://localhost:3000`
- Backend: `http://localhost:5000`

## Lưu ý bảo mật

- Không commit `credentials.json`
- Không commit `appsettings.Local.json`
- Không commit token Google Drive trong `Storage/GoogleDriveToken`
