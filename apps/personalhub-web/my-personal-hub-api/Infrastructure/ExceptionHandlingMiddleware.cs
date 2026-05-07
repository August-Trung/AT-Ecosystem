using System.Text.Json;
using my_personal_hub_api.Models;

namespace my_personal_hub_api.Infrastructure;

public class ExceptionHandlingMiddleware(
    RequestDelegate next,
    ILogger<ExceptionHandlingMiddleware> logger,
    IWebHostEnvironment environment)
{
    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            logger.LogWarning("Request aborted by client. TraceId: {TraceId}", context.TraceIdentifier);
        }
        catch (Exception exception)
        {
            logger.LogError(exception, "Unhandled exception for {Method} {Path}. TraceId: {TraceId}",
                context.Request.Method,
                context.Request.Path,
                context.TraceIdentifier);

            if (context.Response.HasStarted)
            {
                throw;
            }

            context.Response.Clear();
            context.Response.StatusCode = StatusCodes.Status500InternalServerError;
            context.Response.ContentType = "application/json";

            var response = new ApiResponse(
                false,
                "Internal server error",
                new
                {
                    traceId = context.TraceIdentifier,
                    detail = environment.IsDevelopment() ? exception.Message : null
                });

            await context.Response.WriteAsync(JsonSerializer.Serialize(response));
        }
    }
}
