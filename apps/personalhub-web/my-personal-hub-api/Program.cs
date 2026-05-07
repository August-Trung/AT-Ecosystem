using System.Text.Json;
using System.Threading.RateLimiting;
using Microsoft.AspNetCore.DataProtection;
using Microsoft.AspNetCore.Diagnostics.HealthChecks;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.Extensions.Diagnostics.HealthChecks;
using Microsoft.Extensions.FileProviders;
using Microsoft.OpenApi.Models;
using my_personal_hub_api.Infrastructure;
using my_personal_hub_api.Models;
using my_personal_hub_api.Services;

var builder = WebApplication.CreateBuilder(args);
var dataProtectionKeysPath = builder.Configuration["Security:DataProtectionKeysPath"] ?? "Storage\\DataProtectionKeys";

builder.Services.AddControllers();
builder.Services.AddCors(options =>
{
    options.AddPolicy("Frontend", policy =>
    {
        if (builder.Environment.IsDevelopment())
        {
            policy.AllowAnyOrigin()
                  .AllowAnyHeader()
                  .AllowAnyMethod();
            return;
        }

        policy.WithOrigins(builder.Configuration.GetSection("Cors:Origins").Get<string[]>() ?? ["http://localhost:3000"])
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});
builder.Services.AddRouting(options => options.LowercaseUrls = true);
builder.Services.AddHttpClient();
builder.Services.AddDataProtection()
    .PersistKeysToFileSystem(new DirectoryInfo(Path.Combine(builder.Environment.ContentRootPath, dataProtectionKeysPath)));
builder.Services.AddAuthorization();
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "My Personal Hub API",
        Version = "v1",
        Description = "ASP.NET Web API for My Personal Hub backed by SQL Server stored procedures."
    });

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        In = ParameterLocation.Header,
        Description = "Bearer access token",
        Name = "Authorization",
        Type = SecuritySchemeType.Http,
        Scheme = "bearer",
        BearerFormat = "JWT"
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            Array.Empty<string>()
        }
    });
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.ContentType = "application/json";
        var payload = new ApiResponse(false, "Too many requests", new
        {
            traceId = context.HttpContext.TraceIdentifier
        });

        await context.HttpContext.Response.WriteAsync(JsonSerializer.Serialize(payload), cancellationToken);
    };

    options.AddPolicy("auth", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientKey(httpContext),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("writes", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientKey(httpContext),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 60,
                Window = TimeSpan.FromMinutes(1),
                QueueLimit = 0
            }));

    options.AddPolicy("uploads", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            GetClientKey(httpContext),
            _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = 10,
                Window = TimeSpan.FromMinutes(5),
                QueueLimit = 0
            }));
});
builder.Services.AddHealthChecks()
    .AddCheck<SqlServerHealthCheck>("sql-server", failureStatus: HealthStatus.Unhealthy, tags: ["ready"])
    .AddCheck<FileStorageHealthCheck>("file-storage", failureStatus: HealthStatus.Unhealthy, tags: ["ready"]);
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.KnownNetworks.Clear();
    options.KnownProxies.Clear();
});
builder.Services.AddSingleton<StoredProcedureExecutor>();
builder.Services.AddSingleton<TokenService>();
builder.Services.AddSingleton<PasswordHasherService>();
builder.Services.AddSingleton<PhoneOtpService>();
builder.Services.AddSingleton<OAuthStateService>();
builder.Services.AddSingleton<ExternalAuthService>();
builder.Services.AddSingleton<FileStorageService>();
builder.Services.AddSingleton<GoogleDriveService>();
builder.Services.AddSingleton<AuditLogService>();
builder.Services.AddSingleton<SqlServerHealthCheck>();
builder.Services.AddSingleton<FileStorageHealthCheck>();

var app = builder.Build();

var fileStorage = app.Services.GetRequiredService<FileStorageService>();
fileStorage.EnsureCreated();

if (builder.Configuration.GetValue<bool>("Security:ForwardedHeadersEnabled"))
{
    app.UseForwardedHeaders();
}

app.UseMiddleware<CorrelationIdMiddleware>();
app.UseMiddleware<RequestLoggingMiddleware>();
app.UseMiddleware<ExceptionHandlingMiddleware>();

if (!app.Environment.IsDevelopment() && builder.Configuration.GetValue<bool>("Security:EnableHsts"))
{
    app.UseHsts();
}

if (builder.Configuration.GetValue<bool>("Security:EnforceHttps"))
{
    app.UseHttpsRedirection();
}

if (app.Environment.IsDevelopment() || builder.Configuration.GetValue<bool>("Security:ExposeSwagger"))
{
    app.UseSwagger();
    app.UseSwaggerUI();
}

app.UseCors("Frontend");
app.UseRateLimiter();
app.UseMiddleware<TokenAuthenticationMiddleware>();
app.UseStaticFiles(new StaticFileOptions
{
    FileProvider = new PhysicalFileProvider(fileStorage.RootPath),
    RequestPath = "/uploads"
});
app.UseAuthorization();

app.MapHealthChecks("/health/live", new HealthCheckOptions
{
    Predicate = _ => false,
    ResponseWriter = WriteHealthResponseAsync
});
app.MapHealthChecks("/health/ready", new HealthCheckOptions
{
    Predicate = registration => registration.Tags.Contains("ready"),
    ResponseWriter = WriteHealthResponseAsync
});
app.MapControllers();
app.Run();

static string GetClientKey(HttpContext context)
    => context.Connection.RemoteIpAddress?.ToString()
       ?? context.Request.Headers.Host.ToString()
       ?? "unknown";

static Task WriteHealthResponseAsync(HttpContext context, HealthReport report)
{
    context.Response.ContentType = "application/json";

    var payload = new
    {
        status = report.Status.ToString(),
        totalDuration = report.TotalDuration.TotalMilliseconds,
        entries = report.Entries.ToDictionary(
            entry => entry.Key,
            entry => new
            {
                status = entry.Value.Status.ToString(),
                description = entry.Value.Description,
                duration = entry.Value.Duration.TotalMilliseconds
            })
    };

    return context.Response.WriteAsync(JsonSerializer.Serialize(payload));
}
