IF NOT EXISTS (SELECT * FROM sys.databases WHERE name = 'db_MyFileHub')
BEGIN
    CREATE DATABASE db_MyFileHub;
END
GO

USE db_MyFileHub;
GO

CREATE OR ALTER PROCEDURE sp_Users_GetAll
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Id, Username, Email, FullName, Role, IsActive, CreatedAt, UpdatedAt
    FROM Users
    ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_GetById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Users
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_GetByEmail
    @Email NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Users
    WHERE Email = @Email;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_Create
    @Username NVARCHAR(100),
    @Email NVARCHAR(255),
    @Password NVARCHAR(255),
    @FullName NVARCHAR(255) = NULL,
    @Role NVARCHAR(50) = 'user',
    @IsActive BIT = 1
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Users (Username, Email, Password, FullName, Role, IsActive)
    OUTPUT INSERTED.*
    VALUES (@Username, @Email, @Password, @FullName, @Role, @IsActive);
END
GO

CREATE OR ALTER PROCEDURE sp_Users_Update
    @Id INT,
    @Username NVARCHAR(100) = NULL,
    @Email NVARCHAR(255) = NULL,
    @Password NVARCHAR(255) = NULL,
    @FullName NVARCHAR(255) = NULL,
    @Role NVARCHAR(50) = NULL,
    @IsActive BIT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Users
    SET Username = COALESCE(@Username, Username),
        Email = COALESCE(@Email, Email),
        Password = COALESCE(@Password, Password),
        FullName = COALESCE(@FullName, FullName),
        Role = COALESCE(@Role, Role),
        IsActive = COALESCE(@IsActive, IsActive),
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_Delete
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM Users
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetAll
    @Category NVARCHAR(50) = NULL,
    @Search NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Links
    WHERE (@Category IS NULL OR Category = @Category)
      AND (
            @Search IS NULL
            OR Title LIKE '%' + @Search + '%'
            OR ShortUrl LIKE '%' + @Search + '%'
          )
    ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Links
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetByShortUrl
    @ShortUrl NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Links
    WHERE ShortUrl = @ShortUrl;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetByCustomSlug
    @CustomSlug NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Links
    WHERE CustomSlug = @CustomSlug;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_Create
    @Title NVARCHAR(255),
    @ShortUrl NVARCHAR(255),
    @OriginalUrl NVARCHAR(MAX),
    @CustomSlug NVARCHAR(100) = NULL,
    @Category NVARCHAR(50),
    @Tags NVARCHAR(MAX) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Visibility NVARCHAR(20) = 'public',
    @UserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Links (
        Title,
        ShortUrl,
        OriginalUrl,
        CustomSlug,
        Category,
        Tags,
        Description,
        Visibility,
        UserId,
        Visits
    )
    OUTPUT INSERTED.*
    VALUES (
        @Title,
        @ShortUrl,
        @OriginalUrl,
        @CustomSlug,
        @Category,
        @Tags,
        @Description,
        @Visibility,
        @UserId,
        0
    );
END
GO

CREATE OR ALTER PROCEDURE sp_Links_Update
    @Id INT,
    @Title NVARCHAR(255) = NULL,
    @ShortUrl NVARCHAR(255) = NULL,
    @OriginalUrl NVARCHAR(MAX) = NULL,
    @Category NVARCHAR(50) = NULL,
    @Tags NVARCHAR(MAX) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Visibility NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Links
    SET Title = COALESCE(@Title, Title),
        ShortUrl = COALESCE(@ShortUrl, ShortUrl),
        OriginalUrl = COALESCE(@OriginalUrl, OriginalUrl),
        Category = COALESCE(@Category, Category),
        Tags = COALESCE(@Tags, Tags),
        Description = COALESCE(@Description, Description),
        Visibility = COALESCE(@Visibility, Visibility),
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_IncrementVisits
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Links
    SET Visits = Visits + 1,
        UpdatedAt = GETDATE()
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_Delete
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM Links
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetStatsByCategory
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Category, COUNT(*) AS Count, SUM(Visits) AS TotalVisits
    FROM Links
    GROUP BY Category
    ORDER BY Category;
END
GO

CREATE OR ALTER PROCEDURE sp_Links_GetTop
    @Limit INT = 10
AS
BEGIN
    SET NOCOUNT ON;

    SELECT TOP (@Limit) *
    FROM Links
    ORDER BY Visits DESC, CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_GetAll
    @Category NVARCHAR(50) = NULL,
    @Type NVARCHAR(50) = NULL,
    @Search NVARCHAR(255) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Files
    WHERE (@Category IS NULL OR Category = @Category)
      AND (@Type IS NULL OR Type = @Type)
      AND (@Search IS NULL OR Name LIKE '%' + @Search + '%')
    ORDER BY CreatedAt DESC;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_GetById
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Files
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_GetByDriveFileId
    @DriveFileId NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Files
    WHERE DriveFileId = @DriveFileId;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_Create
    @Name NVARCHAR(255),
    @Type NVARCHAR(50),
    @Size NVARCHAR(50),
    @Category NVARCHAR(50),
    @Tags NVARCHAR(MAX) = NULL,
    @Url NVARCHAR(MAX),
    @DriveFileId NVARCHAR(255) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Visibility NVARCHAR(20) = 'private',
    @UserId INT = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Files (
        Name,
        Type,
        Size,
        Category,
        Tags,
        Url,
        DriveFileId,
        Description,
        Visibility,
        UserId
    )
    OUTPUT INSERTED.*
    VALUES (
        @Name,
        @Type,
        @Size,
        @Category,
        @Tags,
        @Url,
        @DriveFileId,
        @Description,
        @Visibility,
        @UserId
    );
END
GO

CREATE OR ALTER PROCEDURE sp_Files_Update
    @Id INT,
    @Name NVARCHAR(255) = NULL,
    @Category NVARCHAR(50) = NULL,
    @Tags NVARCHAR(MAX) = NULL,
    @Description NVARCHAR(MAX) = NULL,
    @Visibility NVARCHAR(20) = NULL
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Files
    SET Name = COALESCE(@Name, Name),
        Category = COALESCE(@Category, Category),
        Tags = COALESCE(@Tags, Tags),
        Description = COALESCE(@Description, Description),
        Visibility = COALESCE(@Visibility, Visibility),
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_Delete
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    DELETE FROM Files
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Files_GetStatsByCategory
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Category, COUNT(*) AS Count, Type
    FROM Files
    GROUP BY Category, Type
    ORDER BY Category, Type;
END
GO

CREATE OR ALTER PROCEDURE sp_Statistics_GetOverview
AS
BEGIN
    SET NOCOUNT ON;

    SELECT
        (SELECT COUNT(*) FROM Links) AS TotalLinks,
        (SELECT ISNULL(SUM(Visits), 0) FROM Links) AS TotalVisits,
        (SELECT COUNT(*) FROM Files) AS TotalFiles;
END
GO

CREATE OR ALTER PROCEDURE sp_Statistics_GetRecentActivities
    @Limit INT = 20
AS
BEGIN
    SET NOCOUNT ON;

    WITH CombinedActivities AS (
        SELECT TOP (@Limit)
            Id,
            Title,
            CAST('link' AS NVARCHAR(20)) AS Type,
            CreatedAt
        FROM Links
        ORDER BY CreatedAt DESC
    ),
    RecentFiles AS (
        SELECT TOP (@Limit)
            Id,
            Name AS Title,
            CAST('file' AS NVARCHAR(20)) AS Type,
            CreatedAt
        FROM Files
        ORDER BY CreatedAt DESC
    )
    SELECT TOP (@Limit) *
    FROM (
        SELECT * FROM CombinedActivities
        UNION ALL
        SELECT * FROM RecentFiles
    ) AS Activities
    ORDER BY CreatedAt DESC;
END
GO
