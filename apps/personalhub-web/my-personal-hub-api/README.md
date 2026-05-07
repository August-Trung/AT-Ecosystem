# My Personal Hub API

Backend chính của hệ thống My Personal Hub, xây bằng ASP.NET Web API.

## Stack

- .NET 9
- SQL Server `db_MyFileHub`
- Stored procedures
- Google Drive API
- ODBC Driver for SQL Server

## Tính năng đã sẵn sàng

- Authentication và profile
- CRUD link ngắn
- CRUD file
- Upload file lên Google Drive
- Download và delete file từ Google Drive
- Dashboard và statistics
- Health checks
- Swagger
- Rate limiting
- Centralized exception handling
- Audit logging

## Cấu hình cần có

Không commit secret thật. Dùng `appsettings.Local.json` hoặc environment variables để override.

Cần cấu hình tối thiểu:

- `ConnectionStrings__SqlServer`
- `Cors__Origins__0`
- `ShortUrl__Domain`
- `GoogleDrive__CredentialsPath`
- `GoogleDrive__TokenPath`
- `GoogleDrive__FolderId`

Ví dụ:

```powershell
$env:ConnectionStrings__SqlServer="Driver={ODBC Driver 17 for SQL Server};Server=YOUR_SQL_SERVER;Database=db_MyFileHub;Trusted_Connection=Yes;Encrypt=No;TrustServerCertificate=Yes;"
```

## Chạy local

```bash
dotnet run --launch-profile http
```

API mặc định chạy tại `http://localhost:5000`.

## Google Drive

API hiện dùng OAuth desktop credentials:

- `credentials.json`
- token lưu tại `Storage/GoogleDriveToken`

Endpoints hỗ trợ:

- `GET /api/files/google-drive/status`
- `POST /api/files/google-drive/authorize`

## Database

Nếu cần dựng lại DB, chạy:

1. `Database/migrations/001_create_users_table.sql`
2. `Database/migrations/002_create_links_table.sql`
3. `Database/migrations/003_create_files_table.sql`
4. `Database/migrations/004_create_stored_procedures.sql`

Hoặc dùng:

```powershell
.\Scripts\Run-Migrations.ps1 -ServerInstance "YOUR_SQL_SERVER"
```

## Vận hành

Publish:

```powershell
.\Scripts\Publish-Api.ps1
```

Backup database:

```powershell
.\Scripts\Backup-Database.ps1 -ServerInstance "YOUR_SQL_SERVER"
```

Dọn file local cũ:

```powershell
.\Scripts\Cleanup-OrphanedUploads.ps1 -RetentionDays 30
```
