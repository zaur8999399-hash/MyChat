public class User
{
    public int Id { get; set; }
    public string Login { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string Status { get; set; } = "";
    public DateTime? LastLoginDate { get; set; }
    public int Streak { get; set; } = 0;
    public int BestStreak { get; set; } = 0;
}

public class Room
{
    public int Id { get; set; }
    public int DisappearingSeconds { get; set; } = 0;
    public string Name { get; set; } = string.Empty;
    public bool IsGroup { get; set; } = true;
    public string Members { get; set; } = "";
    public bool IsPrivate { get; set; } = false;
    public string Description { get; set; } = "";
    public string Roles { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int? PinnedMessageId { get; set; }
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
    public DateTime? EditedAt { get; set; }
    public DateTime? ExpiresAt { get; set; }
    public bool IsRead { get; set; } = false;
    public int? ReplyToId { get; set; }
    public int? ForwardedFromId { get; set; }
    public string? ForwardedFromName { get; set; }
    public string? ImageUrl { get; set; }
    public string? AudioUrl { get; set; }
    public string? VideoUrl { get; set; }   // ← ВОТ ОНО! Добавлено!
}

public class Post
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Text { get; set; } = string.Empty;
    public string? ImageUrl { get; set; }
    public string Emoji1 { get; set; } = "❤️";
    public string Emoji2 { get; set; } = "🔥";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Comment
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public Post? Post { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Text { get; set; } = string.Empty;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PostReaction
{
    public int Id { get; set; }
    public int PostId { get; set; }
    public int UserId { get; set; }
    public string Emoji { get; set; } = string.Empty;
}
public class Friendship
{
    public int Id { get; set; }
    public int UserId { get; set; }       // кто отправил заявку
    public int FriendId { get; set; }     // кому отправил
    public string Status { get; set; } = "pending";  // pending / accepted
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public record DisappearingDto(int Seconds);
public record ForwardMessageDto(int RoomId);
public record FriendRequestDto(string Login);
public record CreatePostDto(string Text, string Emoji1, string Emoji2, string? ImageUrl);
public record ReactDto(string Emoji);
public record CreateCommentDto(string Text);
public record RegisterDto(string Login, string Name, string Password);
public record LoginDto(string Login, string Password);
public record CreateRoomDto(string Name);
public record CreateGroupDto(string Name, string Description, bool IsPrivate);
public record InviteDto(string Login);
public record SetRoleDto(int UserId, string Role);
public record PinDto(int MessageId);
public record EditedMessageDto(string Text);
public class Poll
{
    public int Id { get; set; }
    public int RoomId { get; set; }
    public string Question { get; set; } = "";
    public int CreatedById { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PollOption
{
    public int Id { get; set; }
    public int PollId { get; set; }
    public string Text { get; set; } = "";
}

public class PollVote
{
    public int Id { get; set; }
    public int PollId { get; set; }
    public int OptionId { get; set; }
    public int UserId { get; set; }
}

public record CreatePollDto(string Question, List<string> Options);
public record VoteDto(int OptionId);

public class MessageReaction
{
    public int Id { get; set; }
    public int MessageId { get; set; }
    public int UserId { get; set; }
    public string Emoji { get; set; } = "";
}

public record ReactMessageDto(string Emoji);

public class Follow
{
    public int Id { get; set; }
    public int FollowerId { get; set; }   // кто подписан
    public int TargetId { get; set; }     // на кого подписан
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class Story
{
    public double TextX { get; set; } = 50;
    public double TextY { get; set; } = 50;
    public int Id { get; set; }
    public int UserId { get; set; }
    public User? User { get; set; }
    public string Text { get; set; } = "";
    public string? ImageUrl { get; set; }
    public string BgColor { get; set; } = "#5b7cfa";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}

public class PushSubscription
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string Endpoint { get; set; } = "";
    public string P256dh { get; set; } = "";
    public string Auth { get; set; } = "";
}
public record PushSubscribeDto(
    [property: System.Text.Json.Serialization.JsonPropertyName("endpoint")] string Endpoint,
    [property: System.Text.Json.Serialization.JsonPropertyName("p256dh")] string P256dh,
    [property: System.Text.Json.Serialization.JsonPropertyName("auth")] string Auth
);
public record CreateStoryDto(string Text, string? ImageUrl, string? BgColor, double? TextX, double? TextY);