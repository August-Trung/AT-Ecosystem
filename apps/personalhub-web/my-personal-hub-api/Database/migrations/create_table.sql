-- Create Database
IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'db_MyFileHub')
BEGIN
    CREATE DATABASE db_MyFileHub;
END
GO

USE db_MyFileHub;
GO

-- ==========================================
-- Create Users Table (for future use)
-- ==========================================
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

-- ==========================================
-- Create Links Table
-- ==========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Links' AND xtype='U')
BEGIN
    CREATE TABLE Links (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Title NVARCHAR(255) NOT NULL,
        ShortUrl NVARCHAR(100) UNIQUE NOT NULL,
        OriginalUrl NVARCHAR(MAX) NOT NULL,
        CustomSlug NVARCHAR(100) UNIQUE,
        Category NVARCHAR(50) NOT NULL,
        Tags NVARCHAR(MAX),
        Description NVARCHAR(MAX),
        Visibility NVARCHAR(20) DEFAULT 'public',
        Visits INT DEFAULT 0,
        UserId INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    -- Create indexes
    CREATE INDEX idx_links_category ON Links(Category);
    CREATE INDEX idx_links_shorturl ON Links(ShortUrl);
    CREATE INDEX idx_links_customslug ON Links(CustomSlug);
    CREATE INDEX idx_links_userid ON Links(UserId);
    
    PRINT 'Links table created successfully';
END
GO

-- ==========================================
-- Create Files Table
-- ==========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Files' AND xtype='U')
BEGIN
    CREATE TABLE Files (
        Id INT PRIMARY KEY IDENTITY(1,1),
        Name NVARCHAR(255) NOT NULL,
        Type NVARCHAR(50) NOT NULL,
        Size NVARCHAR(50) NOT NULL,
        Category NVARCHAR(50) NOT NULL,
        Tags NVARCHAR(MAX),
        Url NVARCHAR(MAX) NOT NULL,
        DriveFileId NVARCHAR(255),
        Description NVARCHAR(MAX),
        Visibility NVARCHAR(20) DEFAULT 'private',
        UserId INT,
        CreatedAt DATETIME DEFAULT GETDATE(),
        UpdatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    -- Create indexes
    CREATE INDEX idx_files_category ON Files(Category);
    CREATE INDEX idx_files_type ON Files(Type);
    CREATE INDEX idx_files_drivefileid ON Files(DriveFileId);
    CREATE INDEX idx_files_userid ON Files(UserId);
    
    PRINT 'Files table created successfully';
END
GO

-- ==========================================
-- Create Activities Log Table (optional)
-- ==========================================
IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='Activities' AND xtype='U')
BEGIN
    CREATE TABLE Activities (
        Id INT PRIMARY KEY IDENTITY(1,1),
        UserId INT,
        Action NVARCHAR(100) NOT NULL,
        EntityType NVARCHAR(50) NOT NULL,
        EntityId INT NOT NULL,
        Details NVARCHAR(MAX),
        IpAddress NVARCHAR(50),
        CreatedAt DATETIME DEFAULT GETDATE(),
        FOREIGN KEY (UserId) REFERENCES Users(Id) ON DELETE SET NULL
    );
    
    CREATE INDEX idx_activities_userid ON Activities(UserId);
    CREATE INDEX idx_activities_entitytype ON Activities(EntityType);
    
    PRINT 'Activities table created successfully';
END
GO

PRINT 'All tables created successfully!';
