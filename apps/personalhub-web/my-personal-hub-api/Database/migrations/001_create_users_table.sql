IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'db_MyFileHub')
BEGIN
    CREATE DATABASE db_MyFileHub;
END
GO

USE db_MyFileHub;
GO

IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Users' AND xtype='U')
BEGIN
    CREATE TABLE Users (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Username NVARCHAR(100) NOT NULL UNIQUE,
        Email NVARCHAR(255) NOT NULL UNIQUE,
        Password NVARCHAR(255) NOT NULL,
        FullName NVARCHAR(255),
        Role NVARCHAR(50) DEFAULT 'user',
        IsActive BIT DEFAULT 1,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE()
    );

    PRINT 'Users table created successfully';
END
GO
