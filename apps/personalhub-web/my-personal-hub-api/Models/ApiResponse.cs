namespace my_personal_hub_api.Models;

public record ApiResponse(bool Success, string Message, object? Data = null, object? Pagination = null);

public record CurrentUserContext(int Id, string Email, string Role);
