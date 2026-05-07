USE db_MyFileHub;
GO

SET ANSI_NULLS ON;
GO

SET QUOTED_IDENTIFIER ON;
GO

IF COL_LENGTH('Users', 'PhoneNumber') IS NULL
BEGIN
    ALTER TABLE Users ADD PhoneNumber NVARCHAR(30) NULL;
END
GO

IF COL_LENGTH('Users', 'AuthProvider') IS NULL
BEGIN
    ALTER TABLE Users ADD AuthProvider NVARCHAR(50) NOT NULL CONSTRAINT DF_Users_AuthProvider DEFAULT 'local';
END
GO

IF COL_LENGTH('Users', 'ProviderUserId') IS NULL
BEGIN
    ALTER TABLE Users ADD ProviderUserId NVARCHAR(255) NULL;
END
GO

IF COL_LENGTH('Users', 'AvatarUrl') IS NULL
BEGIN
    ALTER TABLE Users ADD AvatarUrl NVARCHAR(500) NULL;
END
GO

IF COL_LENGTH('Users', 'PhoneVerifiedAt') IS NULL
BEGIN
    ALTER TABLE Users ADD PhoneVerifiedAt DATETIME NULL;
END
GO

IF COL_LENGTH('Users', 'OtpCode') IS NULL
BEGIN
    ALTER TABLE Users ADD OtpCode NVARCHAR(10) NULL;
END
GO

IF COL_LENGTH('Users', 'OtpExpiresAt') IS NULL
BEGIN
    ALTER TABLE Users ADD OtpExpiresAt DATETIME NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_PhoneNumber' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE UNIQUE INDEX UX_Users_PhoneNumber ON Users(PhoneNumber) WHERE PhoneNumber IS NOT NULL;
END
GO

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'UX_Users_Provider' AND object_id = OBJECT_ID('Users'))
BEGIN
    CREATE UNIQUE INDEX UX_Users_Provider ON Users(AuthProvider, ProviderUserId) WHERE ProviderUserId IS NOT NULL;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_GetAll
AS
BEGIN
    SET NOCOUNT ON;

    SELECT Id, Username, Email, FullName, Role, IsActive, PhoneNumber, AuthProvider, ProviderUserId, AvatarUrl, PhoneVerifiedAt, CreatedAt, UpdatedAt
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

CREATE OR ALTER PROCEDURE sp_Users_GetByPhone
    @PhoneNumber NVARCHAR(30)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Users
    WHERE PhoneNumber = @PhoneNumber;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_GetByProvider
    @AuthProvider NVARCHAR(50),
    @ProviderUserId NVARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON;

    SELECT *
    FROM Users
    WHERE AuthProvider = @AuthProvider
      AND ProviderUserId = @ProviderUserId;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_Create
    @Username NVARCHAR(100),
    @Email NVARCHAR(255),
    @Password NVARCHAR(255),
    @FullName NVARCHAR(255) = NULL,
    @Role NVARCHAR(50) = 'user',
    @IsActive BIT = 1,
    @PhoneNumber NVARCHAR(30) = NULL,
    @AuthProvider NVARCHAR(50) = 'local',
    @ProviderUserId NVARCHAR(255) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL,
    @PhoneVerifiedAt DATETIME = NULL
AS
BEGIN
    SET NOCOUNT ON;

    INSERT INTO Users (Username, Email, Password, FullName, Role, IsActive, PhoneNumber, AuthProvider, ProviderUserId, AvatarUrl, PhoneVerifiedAt)
    OUTPUT INSERTED.*
    VALUES (@Username, @Email, @Password, @FullName, @Role, @IsActive, @PhoneNumber, @AuthProvider, @ProviderUserId, @AvatarUrl, @PhoneVerifiedAt);
END
GO

CREATE OR ALTER PROCEDURE sp_Users_Update
    @Id INT,
    @Username NVARCHAR(100) = NULL,
    @Email NVARCHAR(255) = NULL,
    @Password NVARCHAR(255) = NULL,
    @FullName NVARCHAR(255) = NULL,
    @Role NVARCHAR(50) = NULL,
    @IsActive BIT = NULL,
    @PhoneNumber NVARCHAR(30) = NULL,
    @AuthProvider NVARCHAR(50) = NULL,
    @ProviderUserId NVARCHAR(255) = NULL,
    @AvatarUrl NVARCHAR(500) = NULL,
    @PhoneVerifiedAt DATETIME = NULL
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
        PhoneNumber = COALESCE(@PhoneNumber, PhoneNumber),
        AuthProvider = COALESCE(@AuthProvider, AuthProvider),
        ProviderUserId = COALESCE(@ProviderUserId, ProviderUserId),
        AvatarUrl = COALESCE(@AvatarUrl, AvatarUrl),
        PhoneVerifiedAt = COALESCE(@PhoneVerifiedAt, PhoneVerifiedAt),
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_SetOtp
    @Id INT,
    @OtpCode NVARCHAR(10),
    @OtpExpiresAt DATETIME
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Users
    SET OtpCode = @OtpCode,
        OtpExpiresAt = @OtpExpiresAt,
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO

CREATE OR ALTER PROCEDURE sp_Users_VerifyPhone
    @Id INT
AS
BEGIN
    SET NOCOUNT ON;

    UPDATE Users
    SET PhoneVerifiedAt = GETDATE(),
        OtpCode = NULL,
        OtpExpiresAt = NULL,
        UpdatedAt = GETDATE()
    OUTPUT INSERTED.*
    WHERE Id = @Id;
END
GO
