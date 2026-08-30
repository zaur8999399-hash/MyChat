using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using System.Collections.Concurrent;
using WebPush;
using Microsoft.Extensions.DependencyInjection;

public class ChatHub : Hub
{
    public static readonly ConcurrentDictionary<int, int> OnlineUsers = new();
        public override async Task OnConnectedAsync()
    {
        var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdValue, out int userId))
        {
            OnlineUsers.AddOrUpdate(userId, 1, (_, v) => v + 1);
            await Groups.AddToGroupAsync(Context.ConnectionId, $"user-{userId}");
            await Clients.All.SendAsync("presence", userId, true);
        }
        await base.OnConnectedAsync();
    }

        public override async Task OnDisconnectedAsync(Exception? exception)
    {
        var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (int.TryParse(userIdValue, out int userId))
        {
            await Groups.RemoveFromGroupAsync(Context.ConnectionId, $"user-{userId}");
            var count = OnlineUsers.AddOrUpdate(userId, 0, (_, v) => v - 1);
            if (count <= 0)
            {
                OnlineUsers.TryRemove(userId, out _);
                await Clients.All.SendAsync("presence", userId, false);
            }
        }
        await base.OnDisconnectedAsync(exception);
    }
    private async Task<bool> CanAccessRoom(int roomId, int userId)
{
    var room = await _db.Rooms.FindAsync(roomId);
    if (room == null) return false;

    if (string.IsNullOrEmpty(room.Members)) return true;

    var memberIds = room.Members
        .Split(',', StringSplitOptions.RemoveEmptyEntries)
        .Select(int.Parse)
        .ToList();

    return memberIds.Contains(userId);
}
    private readonly AppDb _db;

    public ChatHub(AppDb db)
    {
        _db = db;
    }

 public async Task JoinRoom(int roomId)
{
    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return;

    if (!await CanAccessRoom(roomId, userId)) return;

    await Groups.AddToGroupAsync(Context.ConnectionId, $"room-{roomId}");
}

    public async Task LeaveRoom(int roomId)
    {
        await Groups.RemoveFromGroupAsync(Context.ConnectionId, RoomName(roomId));
    }
    public async Task Typing(int roomId)
    {
        var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
        if (!int.TryParse(userIdValue, out int userId)) return;
        var user = await _db.Users.FindAsync(userId);
        await Clients.Group(RoomName(roomId)).SendAsync("typing", userId, user?.Name ?? "");
    }
    public async Task SendMessage(int roomId, string text, int? replyToId = null, string? imageUrl = null, string? audioUrl = null, string? videoUrl = null)
{
    // Разрешаем отправку если есть ИЛИ текст, ИЛИ фото, ИЛИ аудио
        if (string.IsNullOrWhiteSpace(text) && string.IsNullOrEmpty(imageUrl) && string.IsNullOrEmpty(audioUrl) && string.IsNullOrEmpty(videoUrl)) return;
    text = (text ?? "").Trim();
    if (text.Length > 1000) text = text[..1000];

    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return;

    var user = await _db.Users.FindAsync(userId);
    if (user == null) return;
    if (!await _db.Rooms.AnyAsync(r => r.Id == roomId)) return;
    if (!await CanAccessRoom(roomId, userId)) return;

    var room = await _db.Rooms.FindAsync(roomId);
            var message = new Message
    {
        RoomId = roomId,
        UserId = userId,
        Text = text,
        ReplyToId = replyToId,
        ExpiresAt = room != null && room.DisappearingSeconds > 0
            ? DateTime.UtcNow.AddSeconds(room.DisappearingSeconds)
            : null,
        ImageUrl = imageUrl,
        AudioUrl = audioUrl,
        VideoUrl = videoUrl
    };

    _db.Messages.Add(message);
    await _db.SaveChangesAsync();

    // Получаем автора ответа для отображения
    string? replyAuthorName = null;
    string? replyText = null;
    if (replyToId != null)
    {
        var reply = await _db.Messages.FindAsync(replyToId.Value);
        if (reply != null)
        {
            var replyAuthor = await _db.Users.FindAsync(reply.UserId);
            replyAuthorName = replyAuthor?.Name;
            replyText = reply.Text;
        }
    }

    await Clients.Group(RoomName(roomId)).SendAsync("receive", new
    {
        message.Id,
        roomId,
        userId,
        name = user.Name,
        avatarUrl = user.AvatarUrl,
        text = message.Text,
        sentAt = message.SentAt,
        isRead = message.IsRead,
        replyToId = message.ReplyToId,
        replyAuthorName,
        replyText,
        expiresAt = message.ExpiresAt,
        imageUrl = message.ImageUrl,
        audioUrl = message.AudioUrl,
        videoUrl = message.VideoUrl
    });

    // Обновляем список чатов у участников личного чата
    if (room != null && !string.IsNullOrEmpty(room.Members))
    {
        foreach (var mid in room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries))
        {
            await Clients.Group($"user-{mid}").SendAsync("roomschanged");
        }
    }

        // ===== PUSH при новом сообщении =====
    string pushBody;
    if (!string.IsNullOrWhiteSpace(message.Text)) pushBody = message.Text;
    else if (message.ImageUrl != null) pushBody = "📷 Фото";
    else if (message.AudioUrl != null) pushBody = "🎤 Голосовое";
    else pushBody = "🎥 Видео-кружок";

    List<int> pushTargets;
    if (room != null && !string.IsNullOrEmpty(room.Members))
    {
        pushTargets = room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(int.Parse).Where(id => id != userId).ToList();
    }
    else pushTargets = new List<int>(); // Общий чат — всем подписанным

    PushSender.Fire(pushTargets, userId, user.Name, pushBody);
}

    public async Task DeleteMessage(int messageId, bool deleteForAll)
{
    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return;

    var message = await _db.Messages.FindAsync(messageId);
    if (message == null) return;

    // Проверка: если удаляем у всех — это должно быть своё сообщение
    if (deleteForAll && message.UserId != userId) return;

    int roomId = message.RoomId;

    _db.Messages.Remove(message);
    await _db.SaveChangesAsync();

    if (deleteForAll)
    {
        // Удалить у всех — рассылаем всем участникам чата
        var room = await _db.Rooms.FindAsync(roomId);
        if (room != null && !string.IsNullOrEmpty(room.Members))
        {
            foreach (var mid in room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries))
            {
                await Clients.Group($"user-{mid}").SendAsync("messagedeleted", messageId, roomId);
            }
        }
        else
        {
            // Общий чат — рассылаем всем
            await Clients.All.SendAsync("messagedeleted", messageId, roomId);
        }
    }
    else
    {
        // Удалили только у себя — рассылаем только себе
        await Clients.Group($"user-{userId}").SendAsync("messagedeleted", messageId, roomId);
    }
}

    private static string RoomName(int roomId)
    {
        return $"room-{roomId}";
    }

    public async Task<object?> StartDirectChat(int targetUserId)
{
    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return null;

    if (userId == targetUserId) return null;

    var rooms = await _db.Rooms.Where(r => !r.IsGroup).ToListAsync();

    foreach (var room in rooms)
    {
        var memberIds = room.Members
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(int.Parse)
            .ToList();

        if (memberIds.Contains(userId) && memberIds.Contains(targetUserId))
        {
            var existingUser = await _db.Users.FindAsync(targetUserId);
            return new { id = room.Id, name = existingUser?.Name ?? "", isGroup = false };
        }
    }

    var targetUser = await _db.Users.FindAsync(targetUserId);
    if (targetUser == null) return null;

    var newRoom = new Room
    {
        Name = targetUser.Name,
        IsGroup = false,
        Members = $"{userId},{targetUserId}",
        CreatedAt = DateTime.Now
    };

    _db.Rooms.Add(newRoom);
    await _db.SaveChangesAsync();

    await Clients.Group($"user-{userId}").SendAsync("roomschanged");
    await Clients.Group($"user-{targetUser.Id}").SendAsync("roomschanged");
    return new { id = newRoom.Id, name = targetUser.Name, isGroup = false };
   }

   public async Task<object?> StartDirectChatByLogin(string login)
{
    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return null;

    var targetUser = await _db.Users
        .FirstOrDefaultAsync(u => u.Login == login);

    if (targetUser == null) return null;
    if (targetUser.Id == userId) return null;

    var rooms = await _db.Rooms.Where(r => !r.IsGroup).ToListAsync();

    foreach (var room in rooms)
    {
        var memberIds = room.Members
            .Split(',', StringSplitOptions.RemoveEmptyEntries)
            .Select(int.Parse)
            .ToList();

        if (memberIds.Contains(userId) && memberIds.Contains(targetUser.Id))
        {
            return new { id = room.Id, name = targetUser.Name, isGroup = false };
        }
    }

    var newRoom = new Room
    {
        Name = targetUser.Name,
        IsGroup = false,
        Members = $"{userId},{targetUser.Id}",
        CreatedAt = DateTime.Now
    };

    _db.Rooms.Add(newRoom);
    await _db.SaveChangesAsync();
    
        await Clients.Group($"user-{userId}").SendAsync("roomschanged");
    await Clients.Group($"user-{targetUser.Id}").SendAsync("roomschanged");

    return new { id = newRoom.Id, name = targetUser.Name, isGroup = false };
}

public async Task<object> LoadRooms()
{
    var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return new object[] { };

    var rooms = await _db.Rooms.ToListAsync();
    var result = new List<object>();

    foreach (var room in rooms)
    {
        bool show = false;
        string displayName = room.Name;

        if (string.IsNullOrEmpty(room.Members))
        {
            show = true;
        }
        else
        {
            var memberIds = room.Members
                .Split(',', StringSplitOptions.RemoveEmptyEntries)
                .Select(int.Parse)
                .ToList();

            if (memberIds.Contains(userId))
            {
                show = true;

                if (!room.IsGroup)
                {
                    var otherId = memberIds.First(id => id != userId);
                    var otherUser = await _db.Users.FindAsync(otherId);
                    displayName = otherUser?.Name ?? "Чат";
                }
            }
        }

        if (show)
        {
            result.Add(new { id = room.Id, name = displayName, isGroup = room.IsGroup });
        }
    }

    return result;
}
}

public static class PushSender
{
    public static IServiceProvider Provider = null!;
    public static string VapidPublic = "";
    public static string VapidPrivate = "";

    public static void Fire(List<int> userIds, int excludeUserId, string title, string body)
    {
        _ = Task.Run(async () =>
        {
            try
            {
                using var scope = Provider.CreateScope();
                var db = scope.ServiceProvider.GetRequiredService<AppDb>();
                List<PushSubscription> subs;
                if (userIds.Count > 0)
                    subs = await db.Set<PushSubscription>().Where(s => userIds.Contains(s.UserId) && s.UserId != excludeUserId).ToListAsync();
                else
                    subs = await db.Set<PushSubscription>().Where(s => s.UserId != excludeUserId).ToListAsync();

                var client = new WebPushClient();
                var payload = System.Text.Json.JsonSerializer.Serialize(new { title, body, tag = "dove-" + title });
                foreach (var s in subs)
                {
                    try
                    {
                       var sub = new WebPush.PushSubscription
                       {
                           Endpoint = s.Endpoint,
                           P256DH = s.P256dh,
                           Auth = s.Auth
                       };
                        await client.SendNotificationAsync(sub, payload, new VapidDetails("mailto:admin@doveapp.ru", VapidPublic, VapidPrivate));
                    }
                    catch { db.Set<PushSubscription>().Remove(s); }
                }
                await db.SaveChangesAsync();
            }
            catch { }
        });
    }
}