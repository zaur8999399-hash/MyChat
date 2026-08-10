public class User
{
    public int Id { get; set; }

    public string Login { get; set; } = string.Empty;

    public string Name { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public string? AvatarUrl { get; set; }
}

public class Room
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;
    public bool IsGroup { get; set; } = true;
    public string Members { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Message
{
    public int Id { get; set; }

    public int RoomId { get; set; }

    public Room? Room { get; set; }

    public int UserId { get; set; }

    public User? User { get; set; }

    public string Text { get; set; } = string.Empty;

    public DateTime SentAt { get; set; } = DateTime.UtcNow;
}

public record RegisterDto(string Login, string Name, string Password);

public record LoginDto(string Login, string Password);

public record CreateRoomDto(string Name);