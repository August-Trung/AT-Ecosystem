USE db_MyFileHub;
GO

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

    CREATE INDEX idx_files_category ON Files(Category);
    CREATE INDEX idx_files_type ON Files(Type);
    CREATE INDEX idx_files_drivefileid ON Files(DriveFileId);
    CREATE INDEX idx_files_userid ON Files(UserId);

    PRINT 'Files table created successfully';
END
GO
