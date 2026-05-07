USE db_MyFileHub;
GO

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

    CREATE INDEX idx_links_category ON Links(Category);
    CREATE INDEX idx_links_shorturl ON Links(ShortUrl);
    CREATE INDEX idx_links_customslug ON Links(CustomSlug);
    CREATE INDEX idx_links_userid ON Links(UserId);

    PRINT 'Links table created successfully';
END
GO
