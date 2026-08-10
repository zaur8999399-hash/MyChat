using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

public class ChatHub : Hub
{

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

    public async Task SendMessage(int roomId, string text)
    {
        if (string.IsNullOrWhiteSpace(text))
        {
            return;
        }

        text = text.Trim();

        if (text.Length > 1000)
        {
            text = text[..1000];
        }

        var userIdValue = Context.User?.FindFirstValue(ClaimTypes.NameIdentifier);

        if (!int.TryParse(userIdValue, out int userId))
        {
            return;
        }

        var user = await _db.Users.FindAsync(userId);

        if (user == null)
        {
            return;
        }

        var roomExists = await _db.Rooms.AnyAsync(r => r.Id == roomId);

        if (!roomExists)
        {
            return;
        }

        if (!await CanAccessRoom(roomId, userId))
        {
            return;
        }

        var message = new Message
        {
            RoomId = roomId,
            UserId = userId,
            Text = text
        };

        _db.Messages.Add(message);
        await _db.SaveChangesAsync();

        await Clients.Group(RoomName(roomId)).SendAsync("receive", new
        {
            message.Id,
            roomId,
            userId,
            name = user.Name,
            avatarUrl = user.AvatarUrl,
            text = message.Text,
            sentAt = message.SentAt
        });
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