USE MyFileHub;
GO

-- ==========================================
-- Insert Sample Links
-- ==========================================
IF NOT EXISTS (SELECT * FROM Links WHERE ShortUrl = 'myhub.me/gamehub')
BEGIN
    INSERT INTO Links (Title, ShortUrl, OriginalUrl, CustomSlug, Category, Tags, Description, Visibility, Visits)
    VALUES 
    ('GameHub', 'myhub.me/gamehub', 'https://example.com/gamehub', 'gamehub', 'Web', '["Demo", "Game"]', 'Demo game hub website', 'public', 120),
    ('Tester Docs', 'myhub.me/tester-docs', 'https://drive.google.com/testdocs', 'tester-docs', 'Tester', '["Documentation"]', 'Testing documentation', 'public', 45),
    ('Love Page', 'myhub.me/love', 'https://example.com/love', 'love', 'Web', '["Demo"]', 'Love themed website', 'public', 89),
    ('IT Support Guide', 'myhub.me/it-guide', 'https://docs.google.com/it-support', 'it-guide', 'IT Support', '["Guide", "Documentation"]', 'IT support documentation', 'public', 67),
    ('Test Cases Excel', 'myhub.me/testcases', 'https://drive.google.com/testcases', 'testcases', 'Tester', '["Testcase", "Excel"]', 'Test cases spreadsheet', 'public', 34),
    ('Portfolio Site', 'myhub.me/portfolio', 'https://example.com/portfolio', 'portfolio', 'Web', '["Demo", "Portfolio"]', 'Personal portfolio website', 'public', 156),
    ('Video Tutorial', 'myhub.me/video-tutorial', 'https://drive.google.com/video', 'video-tutorial', 'Media', '["Video", "Tutorial"]', 'Video tutorial series', 'public', 92),
    ('Setup Guide PDF', 'myhub.me/setup', 'https://drive.google.com/setup', 'setup', 'IT Support', '["Guide", "PDF"]', 'System setup guide', 'public', 78);
    
    PRINT 'Sample links inserted successfully';
END
GO

-- ==========================================
-- Insert Sample Files
-- ==========================================
IF NOT EXISTS (SELECT * FROM Files WHERE Name = 'Hướng dẫn cài đặt.pdf')
BEGIN
    INSERT INTO Files (Name, Type, Size, Category, Tags, Url, DriveFileId, Description)
    VALUES 
    ('Hướng dẫn cài đặt.pdf', 'pdf', '2.5 MB', 'IT Support', '["Guide"]', 'https://drive.google.com/file/d/abc123', 'abc123', 'Hướng dẫn cài đặt hệ thống'),
    ('Testcase_Login.xlsx', 'excel', '1.2 MB', 'Tester', '["Testcase"]', 'https://drive.google.com/file/d/def456', 'def456', 'Test cases cho login module'),
    ('Presentation.pptx', 'ppt', '5.8 MB', 'IT Support', '["Documentation", "Presentation"]', 'https://drive.google.com/file/d/ghi789', 'ghi789', 'IT support presentation'),
    ('Bug_Report.docx', 'word', '850 KB', 'Tester', '["Report"]', 'https://drive.google.com/file/d/jkl012', 'jkl012', 'Bug report document'),
    ('Banner.jpg', 'image', '3.2 MB', 'Media', '["Design", "Banner"]', 'https://drive.google.com/file/d/mno345', 'mno345', 'Website banner design'),
    ('Tutorial.mp4', 'video', '45.6 MB', 'Media', '["Video", "Tutorial"]', 'https://drive.google.com/file/d/pqr678', 'pqr678', 'Video tutorial'),
    ('User_Manual.pdf', 'pdf', '4.3 MB', 'IT Support', '["Guide", "Manual"]', 'https://drive.google.com/file/d/stu901', 'stu901', 'User manual document'),
    ('Testcase_Payment.xlsx', 'excel', '2.1 MB', 'Tester', '["Testcase", "Payment"]', 'https://drive.google.com/file/d/vwx234', 'vwx234', 'Payment module test cases'),
    ('Logo_Design.png', 'image', '1.5 MB', 'Media', '["Design", "Logo"]', 'https://drive.google.com/file/d/yz567', 'yz567', 'Logo design files'),
    ('Demo_Video.mp4', 'video', '78.9 MB', 'Media', '["Video", "Demo"]', 'https://drive.google.com/file/d/abc890', 'abc890', 'Product demo video');
    
    PRINT 'Sample files inserted successfully';
END
GO

PRINT 'All sample data inserted successfully!';