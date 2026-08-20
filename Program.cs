using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.SignalR;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddSignalR();

builder.Services.AddDbContext<AppDb>(options =>
    options.UseSqlite("Data Source=chat.db"));

builder.Services.AddSingleton<IPasswordHasher<User>, PasswordHasher<User>>();

builder.Services.AddAuthentication(CookieAuthenticationDefaults.AuthenticationScheme)
    .AddCookie(options =>
    {
        options.LoginPath = "/";
        options.Cookie.HttpOnly = true;
        options.Cookie.SameSite = SameSiteMode.Lax;
        options.Cookie.SecurePolicy = CookieSecurePolicy.SameAsRequest;
    });

builder.Services.AddAuthorization();

var app = builder.Build();

Directory.CreateDirectory(
    Path.Combine(app.Environment.WebRootPath ??
        Path.Combine(app.Environment.ContentRootPath, "wwwroot"), "avatars"));

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDb>();

    db.Database.EnsureCreated();

    if (!db.Rooms.Any())
    {
        db.Rooms.Add(new Room { Name = "Общий" });
        db.SaveChanges();
    }

    db.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS MessageReactions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    MessageId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    Emoji TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Posts (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    Text TEXT NOT NULL,
    Emoji1 TEXT NOT NULL,
    Emoji2 TEXT NOT NULL,
    CreatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS Comments (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PostId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    Text TEXT NOT NULL,
    CreatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PostReactions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PostId INTEGER NOT NULL,
    UserId INTEGER NOT NULL,
    Emoji TEXT NOT NULL
);");

db.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS Friendships (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    UserId INTEGER NOT NULL,
    FriendId INTEGER NOT NULL,
    Status TEXT NOT NULL DEFAULT 'pending',
    CreatedAt TEXT NOT NULL
);");

db.Database.ExecuteSqlRaw(@"
CREATE TABLE IF NOT EXISTS Polls (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    RoomId INTEGER NOT NULL,
    Question TEXT NOT NULL,
    CreatedById INTEGER NOT NULL,
    CreatedAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PollOptions (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PollId INTEGER NOT NULL,
    Text TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS PollVotes (
    Id INTEGER PRIMARY KEY AUTOINCREMENT,
    PollId INTEGER NOT NULL,
    OptionId INTEGER NOT NULL,
    UserId INTEGER NOT NULL
);");
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN ForwardedFromId INTEGER;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN ForwardedFromName TEXT;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Posts ADD COLUMN ImageUrl Text;"); } catch{}
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN IsRead INTEGER NOT NULL DEFAULT 0;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN ReplyToId INTEGER;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rooms ADD COLUMN IsPrivate INTEGER NOT NULL DEFAULT 0;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rooms ADD COLUMN Description TEXT NOT NULL DEFAULT '';"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rooms ADD COLUMN Roles TEXT NOT NULL DEFAULT '';"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Rooms ADD COLUMN PinnedMessageId INTEGER;"); } catch { }
    try { db.Database.ExecuteSqlRaw("ALTER TABLE Messages ADD COLUMN EditedAt TEXT;"); } catch { }
}

async Task SignInUser(HttpContext context, User user)
{
    var claims = new List<Claim>
    {
        new(ClaimTypes.NameIdentifier, user.Id.ToString()),
        new(ClaimTypes.Name, user.Name),
        new("login", user.Login)
    };

    var identity = new ClaimsIdentity(
        claims,
        CookieAuthenticationDefaults.AuthenticationScheme);

    var principal = new ClaimsPrincipal(identity);

    await context.SignInAsync(
        CookieAuthenticationDefaults.AuthenticationScheme,
        principal,
        new AuthenticationProperties { IsPersistent = true });
}
static List<int> ParseMembers(string members) =>
    string.IsNullOrEmpty(members)
        ? new List<int>()
        : members.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();

static string GetRole(string roles, int userId)
{
    if (string.IsNullOrEmpty(roles)) return "";
    foreach (var part in roles.Split(',', StringSplitOptions.RemoveEmptyEntries))
    {
        var kv = part.Split(':');
        if (kv.Length == 2 && kv[0] == userId.ToString()) return kv[1];
    }
    return "";
}

static string SetRoleInString(string roles, int userId, string role)
{
    var parts = string.IsNullOrEmpty(roles)
        ? new List<string>()
        : roles.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
    parts.RemoveAll(p => p.StartsWith(userId + ":"));
    parts.Add($"{userId}:{role}");
    return string.Join(",", parts);
}

static string RemoveRoleInString(string roles, int userId)
{
    var parts = string.IsNullOrEmpty(roles)
        ? new List<string>()
        : roles.Split(',', StringSplitOptions.RemoveEmptyEntries).ToList();
    parts.RemoveAll(p => p.StartsWith(userId + ":"));
    return string.Join(",", parts);
}
app.UseDefaultFiles();
app.UseStaticFiles();

app.UseAuthentication();
app.UseAuthorization();

app.MapPost("/api/register", async (
    RegisterDto dto,
    AppDb db,
    IPasswordHasher<User> hasher,
    HttpContext context) =>
{
    var login = dto.Login?.Trim();
    var name = dto.Name?.Trim();
    var password = dto.Password;

    if (string.IsNullOrWhiteSpace(login) || login.Length < 3)
        return Results.BadRequest(new { error = "Логин минимум 3 символа." });

    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest(new { error = "Введите имя." });

    if (string.IsNullOrWhiteSpace(password) || password.Length < 6)
        return Results.BadRequest(new { error = "Пароль минимум 6 символов." });

    if (await db.Users.AnyAsync(u => u.Login == login))
        return Results.BadRequest(new { error = "Такой логин уже занят." });

    var user = new User { Login = login, Name = name };
    user.PasswordHash = hasher.HashPassword(user, password);

    db.Users.Add(user);
    await db.SaveChangesAsync();

    await SignInUser(context, user);

    return Results.Ok(new { id = user.Id, name = user.Name, avatarUrl = user.AvatarUrl });
});

app.MapPost("/api/login", async (
    LoginDto dto,
    AppDb db,
    IPasswordHasher<User> hasher,
    HttpContext context) =>
    {
    var login = dto.Login?.Trim();

    if (string.IsNullOrWhiteSpace(login) || string.IsNullOrWhiteSpace(dto.Password))
        return Results.BadRequest(new { error = "Введите логин и пароль." });

    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);

    if (user == null)
        return Results.BadRequest(new { error = "Неверный логин или пароль." });

    if (hasher.VerifyHashedPassword(user, user.PasswordHash, dto.Password)
        == PasswordVerificationResult.Failed)
        return Results.BadRequest(new { error = "Неверный логин или пароль." });

    await SignInUser(context, user);

    return Results.Ok(new { id = user.Id, name = user.Name, avatarUrl = user.AvatarUrl });
});

app.MapPost("/api/logout", async (HttpContext context) =>
{
    await context.SignOutAsync(CookieAuthenticationDefaults.AuthenticationScheme);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.MapGet("/api/me", async (ClaimsPrincipal principal, AppDb db) =>
{
    var login = principal.FindFirstValue("login");
    if (string.IsNullOrEmpty(login)) return Results.Unauthorized();

    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.Unauthorized();

    return Results.Ok(new {
        id = user.Id,
        login = user.Login,
        name = user.Name,
        avatarUrl = user.AvatarUrl,
        status = user.Status ?? ""
    });
}).RequireAuthorization();

app.MapPost("/api/status", async (ClaimsPrincipal principal, AppDb db, HttpContext ctx) =>
{
    var login = principal.FindFirstValue("login");
    if (string.IsNullOrEmpty(login)) return Results.Unauthorized();

    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.Unauthorized();

    using var reader = new StreamReader(ctx.Request.Body);
    var body = await reader.ReadToEndAsync();
    var data = System.Text.Json.JsonSerializer.Deserialize<Dictionary<string, string>>(body);

    if (data != null && data.ContainsKey("status"))
    {
        user.Status = data["status"] ?? "";
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { ok = true, status = user.Status });
}).RequireAuthorization();

app.MapPost("/api/postimage", async (HttpContext ctx) =>
{
    var form = await ctx.Request.ReadFormAsync();
    var file = form.Files.GetFile("image");
    if (file == null) return Results.BadRequest(new { error = "Нет файла" });

    var ext = Path.GetExtension(file.FileName).ToLower();
    if (ext != ".png" && ext != ".jpg" && ext != ".jpeg" && ext != ".webp" && ext != ".gif")
        return Results.BadRequest(new { error = "Можно только картинки (png, jpg, webp, gif)" });

    if (file.Length > 5 * 1024 * 1024)
        return Results.BadRequest(new { error = "Файл слишком большой (максимум 5 МБ)" });

    var dir = Path.Combine(Directory.GetCurrentDirectory(), "wwwroot", "posts");
    Directory.CreateDirectory(dir);

    var name = $"post_{DateTime.Now.Ticks}{ext}";
    var path = Path.Combine(dir, name);

    using (var stream = new FileStream(path, FileMode.Create))
    {
        await file.CopyToAsync(stream);
    }

    return Results.Ok(new { imageUrl = "/posts/" + name });
}).RequireAuthorization();

app.MapPost("/api/avatar", async (HttpContext context, AppDb db) =>
{
    var idValue = context.User.FindFirstValue(ClaimTypes.NameIdentifier);

    if (!int.TryParse(idValue, out int userId))
        return Results.Unauthorized();

    if (!context.Request.HasFormContentType)
        return Results.BadRequest(new { error = "Нужно отправить файл." });

    var form = await context.Request.ReadFormAsync();
    var file = form.Files.GetFile("avatar");

    if (file == null || file.Length == 0)
        return Results.BadRequest(new { error = "Файл не найден." });

    if (file.Length > 2 * 1024 * 1024)
        return Results.BadRequest(new { error = "Файл слишком большой (максимум 2 МБ)." });

    var ext = Path.GetExtension(file.FileName).ToLowerInvariant();

    if (ext != ".jpg" && ext != ".jpeg" && ext != ".png")
        return Results.BadRequest(new { error = "Можно загрузить только JPG или PNG." });

    var user = await db.Users.FindAsync(userId);

    if (user == null)
        return Results.Unauthorized();

    var uploads = Path.Combine(
        app.Environment.WebRootPath ??
        Path.Combine(app.Environment.ContentRootPath, "wwwroot"),
        "avatars");

    Directory.CreateDirectory(uploads);

    foreach (var old in Directory.GetFiles(uploads, $"{userId}.*"))
    {
        File.Delete(old);
    }

    var fileName = $"{userId}{ext}";
    var filePath = Path.Combine(uploads, fileName);

    await using (var stream = new FileStream(filePath, FileMode.Create))
    {
        await file.CopyToAsync(stream);
    }

    user.AvatarUrl = $"/avatars/{fileName}?v={DateTimeOffset.UtcNow.ToUnixTimeSeconds()}";
    await db.SaveChangesAsync();

    return Results.Ok(new { avatarUrl = user.AvatarUrl });
}).RequireAuthorization();

app.MapGet("/api/rooms", async (AppDb db, HttpContext ctx) =>
{
    var userIdValue = ctx.User.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return Results.Unauthorized();

    var allRooms = await db.Rooms.OrderBy(r => r.Id).ToListAsync();
    var result = new List<object>();

        foreach (var room in allRooms)
    {
        // В разделе "Чаты" показываем ТОЛЬКО:
        // 1. Общий чат (Members пустой)
        // 2. Личные сообщения (IsGroup = false)
        // Созданные группы (IsGroup = true + Members не пустой) — НЕ показываются здесь
        if (!string.IsNullOrEmpty(room.Members) && room.IsGroup)
            continue;

        bool show = false;
        string displayName = room.Name;
        string? otherAvatar = null;
        int? otherUserId = null;

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
                var otherId = memberIds.First(id => id != userId);
                var otherUser = await db.Users.FindAsync(otherId);
                displayName = otherUser?.Name ?? "Чат";
                otherAvatar = otherUser?.AvatarUrl;
                otherUserId = otherId;
            }
        }

        if (show)
        {
            result.Add(new { id = room.Id, name = displayName, avatarUrl = otherAvatar, otherUserId, isGroup = room.IsGroup });
        }
    }

    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/rooms", async (CreateRoomDto dto, AppDb db, IHubContext<ChatHub> hub) =>
{
    var name = dto.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest(new { error = "Введите название чата." });

    if (name.Length > 50)
        name = name[..50];

    var room = new Room { Name = name };

    db.Rooms.Add(room);
    await db.SaveChangesAsync();
    await hub.Clients.All.SendAsync("roomschanged");
    return Results.Ok(new { room.Id, room.Name });
}).RequireAuthorization();
app.MapGet("/api/rooms/{id:int}/messages", async (int id, AppDb db, ClaimsPrincipal principal) =>
{
    if (!await db.Rooms.AnyAsync(r => r.Id == id))
        return Results.NotFound();

    var myId = 0;
    var idv = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (int.TryParse(idv, out int uid)) myId = uid;

    var messages = await db.Messages
        .Where(m => m.RoomId == id)
        .OrderBy(m => m.Id)
        .Include(m => m.User)
        .ToListAsync();

    var msgIds = messages.Select(m => m.Id).ToList();
    var reactions = await db.MessageReactions.Where(r => msgIds.Contains(r.MessageId)).ToListAsync();

    var result = messages.Select(m => new
    {
        m.Id, m.RoomId, m.UserId,
        Name = m.User!.Name,
        AvatarUrl = m.User.AvatarUrl,
        m.Text, m.SentAt, m.IsRead, m.ReplyToId,m.EditedAt,m.ForwardedFromId, m.ForwardedFromName,
        reactions = reactions.Where(r => r.MessageId == m.Id)
            .GroupBy(r => r.Emoji)
            .Select(g => new { emoji = g.Key, count = g.Count(), mine = g.Any(x => x.UserId == myId) })
            .ToList()
    });

    return Results.Ok(result);
}).RequireAuthorization();

app.MapGet("/api/messages/{id:int}", async (int id, AppDb db) =>
{
    var m = await db.Messages.FindAsync(id);
    if (m == null) return Results.NotFound(new { error = "Сообщение не найдено" });
    var author = await db.Users.FindAsync(m.UserId);
    return Results.Ok(new { id = m.Id, text = m.Text, authorName = author?.Name ?? "" });
}).RequireAuthorization();

// Отметить сообщения прочитанными
app.MapPost("/api/rooms/{id:int}/read", async (int id, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var room = await db.Rooms.FindAsync(id);
    if (room == null) return Results.NotFound(new { error = "Чат не найден" });

    var unread = await db.Messages
        .Where(m => m.RoomId == id && m.UserId != userId && !m.IsRead)
        .ToListAsync();

    if (unread.Count > 0)
    {
        foreach (var m in unread) m.IsRead = true;
        await db.SaveChangesAsync();

        // Получаем всех участников чата
        var memberIds = string.IsNullOrEmpty(room.Members)
            ? new List<int>()
            : room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();

        // Рассылаем уведомление ВСЕМ участникам через их персональные группы
        foreach (var memberId in memberIds)
        {
            await hub.Clients.Group($"user-{memberId}").SendAsync("messagesread", id, userId);
        }
    }

    return Results.Ok(new { ok = true });
}).RequireAuthorization();
// ===== ПОСТЫ =====
app.MapPost("/api/posts", async (ClaimsPrincipal principal, AppDb db, CreatePostDto dto) =>
{
    var login = principal.FindFirstValue("login");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(dto.Text) && string.IsNullOrEmpty(dto.ImageUrl))
        return Results.BadRequest(new { error = "Пост пустой" });

    var post = new Post
    {
        UserId = user.Id,
        Text = (dto.Text ?? "").Trim(),
        ImageUrl = dto.ImageUrl,
        Emoji1 = string.IsNullOrEmpty(dto.Emoji1) ? "❤️" : dto.Emoji1,
        Emoji2 = string.IsNullOrEmpty(dto.Emoji2) ? "🔥" : dto.Emoji2
    };

    db.Posts.Add(post);
    await db.SaveChangesAsync();

    return Results.Ok(new { id = post.Id });
}).RequireAuthorization();

app.MapGet("/api/posts", async (ClaimsPrincipal principal, AppDb db) =>
{
    var login = principal.FindFirstValue("login");
    var me = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    var myId = me?.Id ?? 0;

    var posts = await db.Posts.OrderByDescending(p => p.CreatedAt).Take(50).ToListAsync();
    var result = new List<object>();

    foreach (var post in posts)
    {
        var author = await db.Users.FindAsync(post.UserId);
        var reactions = await db.PostReactions.Where(r => r.PostId == post.Id).ToListAsync();
        var commentsCount = await db.Comments.CountAsync(c => c.PostId == post.Id);

        result.Add(new
        {
            id = post.Id,
            authorId = post.UserId,
            authorName = author?.Name ?? "Неизвестный",
            authorAvatar = author?.AvatarUrl,
            text = post.Text,
            imageUrl = post.ImageUrl,
            emoji1 = post.Emoji1,
            emoji2 = post.Emoji2,
            count1 = reactions.Count(r => r.Emoji == post.Emoji1),
            count2 = reactions.Count(r => r.Emoji == post.Emoji2),
            myReaction = reactions.FirstOrDefault(r => r.UserId == myId)?.Emoji ?? "",
            comments = commentsCount,
            createdAt = post.CreatedAt
        });
    }

    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/posts/{id:int}/react", async (int id, ClaimsPrincipal principal, AppDb db, ReactDto dto) =>
{
    var login = principal.FindFirstValue("login");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.Unauthorized();

    var post = await db.Posts.FindAsync(id);
    if (post == null) return Results.NotFound(new { error = "Пост не найден" });

    if (dto.Emoji != post.Emoji1 && dto.Emoji != post.Emoji2)
        return Results.BadRequest(new { error = "Недопустимый эмодзи" });

    var existing = await db.PostReactions
        .FirstOrDefaultAsync(r => r.PostId == id && r.UserId == user.Id);

    if (existing != null && existing.Emoji == dto.Emoji)
    {
        db.PostReactions.Remove(existing); // нажал тот же — снял реакцию
    }
    else if (existing != null)
    {
        existing.Emoji = dto.Emoji; // нажал другой — заменил
    }
    else
    {
        db.PostReactions.Add(new PostReaction { PostId = id, UserId = user.Id, Emoji = dto.Emoji });
    }

    await db.SaveChangesAsync();
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.MapGet("/api/posts/{id:int}/comments", async (int id, AppDb db) =>
{
    var comments = await db.Comments
        .Where(c => c.PostId == id)
        .OrderBy(c => c.CreatedAt)
        .ToListAsync();

    var result = new List<object>();
    foreach (var c in comments)
    {
        var author = await db.Users.FindAsync(c.UserId);
        result.Add(new
        {
            id = c.Id,
            userId = c.UserId,
            name = author?.Name ?? "Неизвестный",
            avatarUrl = author?.AvatarUrl,
            text = c.Text,
            createdAt = c.CreatedAt
        });
    }
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/posts/{id:int}/comments", async (int id, ClaimsPrincipal principal, AppDb db, CreateCommentDto dto) =>
{
    var login = principal.FindFirstValue("login");
    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.Unauthorized();

    if (string.IsNullOrWhiteSpace(dto.Text))
        return Results.BadRequest(new { error = "Пустой комментарий" });

    var comment = new Comment { PostId = id, UserId = user.Id, Text = dto.Text.Trim() };
    db.Comments.Add(comment);
    await db.SaveChangesAsync();

    return Results.Ok(new
    {
        id = comment.Id,
        userId = user.Id,
        name = user.Name,
        avatarUrl = user.AvatarUrl,
        text = comment.Text,
        createdAt = comment.CreatedAt
    });
}).RequireAuthorization();

// ===== ЧУЖОЙ ПРОФИЛЬ =====
app.MapGet("/api/user/{id:int}/profile", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var user = await db.Users.FindAsync(id);
    if (user == null) return Results.NotFound(new { error = "Пользователь не найден" });

    var login = principal.FindFirstValue("login");
    var me = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    var myId = me?.Id ?? 0;

    var posts = await db.Posts.Where(p => p.UserId == id)
        .OrderByDescending(p => p.CreatedAt).Take(30).ToListAsync();

    var resultPosts = new List<object>();
    foreach (var post in posts)
    {
        var reactions = await db.PostReactions.Where(r => r.PostId == post.Id).ToListAsync();
        var commentsCount = await db.Comments.CountAsync(c => c.PostId == post.Id);
        resultPosts.Add(new
        {
            id = post.Id,
            text = post.Text,
            imageUrl = post.ImageUrl,
            emoji1 = post.Emoji1,
            emoji2 = post.Emoji2,
            count1 = reactions.Count(r => r.Emoji == post.Emoji1),
            count2 = reactions.Count(r => r.Emoji == post.Emoji2),
            myReaction = reactions.FirstOrDefault(r => r.UserId == myId)?.Emoji ?? "",
            comments = commentsCount
        });
    }

       var friendsCount = await db.Set<Friendship>()
        .CountAsync(f => f.Status == "accepted" && (f.UserId == id || f.FriendId == id));

    return Results.Ok(new
    {
        id = user.Id,
        name = user.Name,
        login = user.Login,
        avatarUrl = user.AvatarUrl,
        status = user.Status ?? "",
        postsCount = resultPosts.Count,
        friendsCount,
        posts = resultPosts
    });
}).RequireAuthorization();

// ===== ГРУППЫ =====

app.MapGet("/api/groups", async (ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var groups = await db.Rooms.Where(r => r.IsGroup).OrderByDescending(r => r.CreatedAt).ToListAsync();
    var result = new List<object>();

    foreach (var g in groups)
    {
        var memberIds = ParseMembers(g.Members);
        var isMember = memberIds.Contains(userId);
        if (!isMember && g.IsPrivate) continue; // приватные скрыты от чужих

        result.Add(new
        {
            id = g.Id,
            name = g.Name,
            description = g.Description,
            isPrivate = g.IsPrivate,
            isMember,
            myRole = GetRole(g.Roles, userId),
            membersCount = memberIds.Count
        });
    }

    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/groups", async (ClaimsPrincipal principal, AppDb db, CreateGroupDto dto) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var name = dto.Name?.Trim();
    if (string.IsNullOrWhiteSpace(name)) return Results.BadRequest(new { error = "Введите название группы" });
    if (name.Length > 50) name = name[..50];

    var group = new Room
    {
        Name = name,
        IsGroup = true,
        Members = userId.ToString(),
        IsPrivate = dto.IsPrivate,
        Description = (dto.Description ?? "").Trim(),
        Roles = $"{userId}:admin" // создатель — админ
    };

    db.Rooms.Add(group);
    await db.SaveChangesAsync();

    return Results.Ok(new { id = group.Id });
}).RequireAuthorization();

app.MapPost("/api/groups/{id:int}/join", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });
    if (group.IsPrivate) return Results.BadRequest(new { error = "Это приватная группа — вход только по приглашению" });

    var members = ParseMembers(group.Members);
    if (!members.Contains(userId))
    {
        members.Add(userId);
        group.Members = string.Join(",", members);
        group.Roles = SetRoleInString(group.Roles, userId, "user");
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.MapGet("/api/groups/{id:int}", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    var memberIds = ParseMembers(group.Members);
    if (!memberIds.Contains(userId) && group.IsPrivate)
        return Results.BadRequest(new { error = "Приватная группа" });

    var members = new List<object>();
    foreach (var mid in memberIds)
    {
        var u = await db.Users.FindAsync(mid);
        if (u == null) continue;
        members.Add(new { id = mid, name = u.Name, login = u.Login, avatarUrl = u.AvatarUrl, role = GetRole(group.Roles, mid) });
    }

        object? pinned = null;
    if (group.PinnedMessageId != null)
    {
        var pm = await db.Messages.FindAsync(group.PinnedMessageId);
        if (pm != null)
        {
            var author = await db.Users.FindAsync(pm.UserId);
            pinned = new { id = pm.Id, name = author?.Name ?? "", text = pm.Text };
        }
    }

    return Results.Ok(new
    {
        id = group.Id,
        name = group.Name,
        description = group.Description,
        isPrivate = group.IsPrivate,
        isMember = memberIds.Contains(userId),
        myRole = GetRole(group.Roles, userId),
        pinned,
        members
    });
}).RequireAuthorization();

// Приглашение в группу (админ/модер)
app.MapPost("/api/groups/{id:int}/invite", async (int id, ClaimsPrincipal principal, AppDb db, InviteDto dto, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    var myRole = GetRole(group.Roles, userId);
    if (myRole != "admin" && myRole != "moder")
        return Results.BadRequest(new { error = "Приглашать могут только админ и модератор" });

    var target = await db.Users.FirstOrDefaultAsync(u => u.Login == (dto.Login ?? "").Trim());
    if (target == null) return Results.NotFound(new { error = "Пользователь не найден" });

    var members = ParseMembers(group.Members);
    if (members.Contains(target.Id)) return Results.BadRequest(new { error = "Он уже в группе" });

    members.Add(target.Id);
    group.Members = string.Join(",", members);
    group.Roles = SetRoleInString(group.Roles, target.Id, "user");
    await db.SaveChangesAsync();

    await hub.Clients.Group($"user-{target.Id}").SendAsync("roomschanged");

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Кик из группы
app.MapPost("/api/groups/{id:int}/kick/{userId:int}", async (int id, int userId, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int myId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    var myRole = GetRole(group.Roles, myId);
    var targetRole = GetRole(group.Roles, userId);

    bool canKick = (myRole == "admin" && targetRole != "admin") || (myRole == "moder" && targetRole == "user");
    if (!canKick) return Results.BadRequest(new { error = "Недостаточно прав" });

    var members = ParseMembers(group.Members);
    members.Remove(userId);
    group.Members = string.Join(",", members);
    group.Roles = RemoveRoleInString(group.Roles, userId);
    await db.SaveChangesAsync();

    await hub.Clients.Group($"user-{userId}").SendAsync("roomschanged");

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Назначение роли (только админ)
app.MapPost("/api/groups/{id:int}/role", async (int id, ClaimsPrincipal principal, AppDb db, SetRoleDto dto) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int myId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    if (GetRole(group.Roles, myId) != "admin")
        return Results.BadRequest(new { error = "Роли назначает только админ" });

    if (dto.UserId == myId)
        return Results.BadRequest(new { error = "Нельзя менять свою роль" });

    if (GetRole(group.Roles, dto.UserId) == "admin")
        return Results.BadRequest(new { error = "Нельзя менять роль админа" });

    if (dto.Role != "moder" && dto.Role != "user")
        return Results.BadRequest(new { error = "Недопустимая роль" });

    group.Roles = SetRoleInString(group.Roles, dto.UserId, dto.Role);
    await db.SaveChangesAsync();

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Закреп / откреп сообщения (админ и модер)
app.MapPost("/api/groups/{id:int}/pin", async (int id, ClaimsPrincipal principal, AppDb db, PinDto dto, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int myId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    var myRole = GetRole(group.Roles, myId);
    if (myRole != "admin" && myRole != "moder")
        return Results.BadRequest(new { error = "Закреплять могут только админ и модератор" });

    if (dto.MessageId != 0)
    {
        var msg = await db.Messages.FindAsync(dto.MessageId);
        if (msg == null || msg.RoomId != id) return Results.BadRequest(new { error = "Сообщение не найдено" });
        group.PinnedMessageId = dto.MessageId;
    }
    else
    {
        group.PinnedMessageId = null;
    }

    await db.SaveChangesAsync();
    await hub.Clients.Group($"room-{id}").SendAsync("pinned", id);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Очистить чат (для всех)
app.MapPost("/api/rooms/{id:int}/clear", async (int id, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var room = await db.Rooms.FindAsync(id);
    if (room == null) return Results.NotFound(new { error = "Чат не найден" });

    var memberIds = ParseMembers(room.Members);
    if (!string.IsNullOrEmpty(room.Members) && !memberIds.Contains(userId))
        return Results.BadRequest(new { error = "Вы не участник этого чата" });

    var messages = await db.Messages.Where(m => m.RoomId == id).ToListAsync();
    db.Messages.RemoveRange(messages);
    await db.SaveChangesAsync();

    await hub.Clients.Group($"room-{id}").SendAsync("cleared", id);

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Создание/открытие личного чата через REST (надёжнее чем invoke)
app.MapPost("/api/direct/{targetId:int}", async (int targetId, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub) =>
{
    var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return Results.Unauthorized();
    if (userId == targetId) return Results.BadRequest(new { error = "Нельзя создать чат с собой" });

    var targetUser = await db.Users.FindAsync(targetId);
    if (targetUser == null) return Results.NotFound(new { error = "Пользователь не найден" });

    var rooms = await db.Rooms.Where(r => !r.IsGroup).ToListAsync();
    foreach (var room in rooms)
    {
        var memberIds = room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
        if (memberIds.Contains(userId) && memberIds.Contains(targetId))
        {
            return Results.Ok(new { id = room.Id, name = targetUser.Name });
        }
    }

    var newRoom = new Room
    {
        Name = targetUser.Name,
        IsGroup = false,
        Members = $"{userId},{targetId}",
        CreatedAt = DateTime.Now
    };
    db.Rooms.Add(newRoom);
    await db.SaveChangesAsync();

    await hub.Clients.Group($"user-{userId}").SendAsync("roomschanged");
    await hub.Clients.Group($"user-{targetUser.Id}").SendAsync("roomschanged");
    return Results.Ok(new { id = newRoom.Id, name = targetUser.Name });
}).RequireAuthorization();

// Покинуть группу
app.MapPost("/api/groups/{id:int}/leave", async (int id, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var group = await db.Rooms.FindAsync(id);
    if (group == null || !group.IsGroup) return Results.NotFound(new { error = "Группа не найдена" });

    var members = ParseMembers(group.Members);
    if (!members.Contains(userId))
        return Results.BadRequest(new { error = "Вы не состоите в этой группе" });

    members.Remove(userId);
    group.Members = string.Join(",", members);
    group.Roles = RemoveRoleInString(group.Roles, userId);
    await db.SaveChangesAsync();

    await hub.Clients.Group($"user-{userId}").SendAsync("roomschanged");

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// ===== ДРУЗЬЯ =====

// Список друзей
app.MapGet("/api/friends", async (ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var friendships = await db.Set<Friendship>()
        .Where(f => f.Status == "accepted" && (f.UserId == userId || f.FriendId == userId))
        .ToListAsync();

    var result = new List<object>();
    foreach (var f in friendships)
    {
        var friendId = f.UserId == userId ? f.FriendId : f.UserId;
        var friend = await db.Users.FindAsync(friendId);
        if (friend == null) continue;
        result.Add(new
        {
            id = friend.Id,
            name = friend.Name,
            login = friend.Login,
            avatarUrl = friend.AvatarUrl,
            status = friend.Status ?? ""
        });
    }

    return Results.Ok(result);
}).RequireAuthorization();

// Входящие заявки в друзья
app.MapGet("/api/friends/requests", async (ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var requests = await db.Set<Friendship>()
        .Where(f => f.FriendId == userId && f.Status == "pending")
        .ToListAsync();

    var result = new List<object>();
    foreach (var f in requests)
    {
        var user = await db.Users.FindAsync(f.UserId);
        if (user == null) continue;
        result.Add(new
        {
            id = f.Id,
            userId = user.Id,
            name = user.Name,
            login = user.Login,
            avatarUrl = user.AvatarUrl
        });
    }

    return Results.Ok(result);
}).RequireAuthorization();

// Отправить заявку в друзья
app.MapPost("/api/friends/request", async (ClaimsPrincipal principal, AppDb db, FriendRequestDto dto) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var login = dto.Login?.Trim();
    if (string.IsNullOrWhiteSpace(login))
        return Results.BadRequest(new { error = "Введите логин" });

    var target = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (target == null)
        return Results.NotFound(new { error = "Пользователь не найден" });
    if (target.Id == userId)
        return Results.BadRequest(new { error = "Нельзя добавить себя" });

    // Проверяем, нет ли уже дружбы/заявки
    var existing = await db.Set<Friendship>()
        .FirstOrDefaultAsync(f =>
            (f.UserId == userId && f.FriendId == target.Id) ||
            (f.UserId == target.Id && f.FriendId == userId));

    if (existing != null)
    {
        if (existing.Status == "accepted")
            return Results.BadRequest(new { error = "Вы уже друзья" });
        if (existing.Status == "pending")
            return Results.BadRequest(new { error = "Заявка уже отправлена" });
    }

    db.Set<Friendship>().Add(new Friendship
    {
        UserId = userId,
        FriendId = target.Id,
        Status = "pending",
        CreatedAt = DateTime.UtcNow
    });
    await db.SaveChangesAsync();

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Принять заявку
app.MapPost("/api/friends/accept/{id:int}", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var f = await db.Set<Friendship>().FindAsync(id);
    if (f == null || f.FriendId != userId || f.Status != "pending")
        return Results.BadRequest(new { error = "Заявка не найдена" });

    f.Status = "accepted";
    await db.SaveChangesAsync();

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Отклонить заявку
app.MapPost("/api/friends/reject/{id:int}", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var f = await db.Set<Friendship>().FindAsync(id);
    if (f == null || f.FriendId != userId)
        return Results.BadRequest(new { error = "Заявка не найдена" });

    db.Set<Friendship>().Remove(f);
    await db.SaveChangesAsync();

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Удалить из друзей
app.MapPost("/api/friends/remove/{userId:int}", async (int userId, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int myId)) return Results.Unauthorized();

    var f = await db.Set<Friendship>()
        .FirstOrDefaultAsync(x =>
            (x.UserId == myId && x.FriendId == userId) ||
            (x.UserId == userId && x.FriendId == myId));

    if (f != null)
    {
        db.Set<Friendship>().Remove(f);
        await db.SaveChangesAsync();
    }

    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Поиск пользователя по логину (для поиска друзей)
app.MapGet("/api/users/bylogin/{login}", async (string login, AppDb db) =>
{
    var user = await db.Users.FirstOrDefaultAsync(u => u.Login == login);
    if (user == null) return Results.NotFound(new { error = "Пользователь не найден" });
    return Results.Ok(new { id = user.Id, name = user.Name, login = user.Login, avatarUrl = user.AvatarUrl, status = user.Status ?? "" });
}).RequireAuthorization();

// Превью последних сообщений всех чатов — ОДНИМ запросом
app.MapGet("/api/rooms/previews", async (AppDb db, ClaimsPrincipal principal) =>
{
    var userIdValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(userIdValue, out int userId)) return Results.Unauthorized();

    var allRooms = await db.Rooms.OrderBy(r => r.Id).ToListAsync();
    var result = new List<object>();

    foreach (var room in allRooms)
    {
        if (!string.IsNullOrEmpty(room.Members) && room.IsGroup) continue;

        bool show = false;
        if (string.IsNullOrEmpty(room.Members))
        {
            show = true;
        }
        else
        {
            var memberIds = room.Members.Split(',', StringSplitOptions.RemoveEmptyEntries).Select(int.Parse).ToList();
            show = memberIds.Contains(userId);
        }

        if (!show) continue;

        var last = await db.Messages
            .Where(m => m.RoomId == room.Id)
            .OrderByDescending(m => m.Id)
            .Select(m => new { Name = m.User!.Name, m.Text, m.SentAt })
            .FirstOrDefaultAsync();

        var unread = await db.Messages.CountAsync(m => m.RoomId == room.Id && m.UserId != userId && !m.IsRead);
        result.Add(new { roomId = room.Id, last, unread });
    }

    return Results.Ok(result);
}).RequireAuthorization();

// ===== ОПРОСЫ =====
app.MapPost("/api/rooms/{id:int}/polls", async (int id, ClaimsPrincipal principal, AppDb db, CreatePollDto dto, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var room = await db.Rooms.FindAsync(id);
    if (room == null) return Results.NotFound(new { error = "Чат не найден" });

    var question = dto.Question?.Trim();
    if (string.IsNullOrWhiteSpace(question)) return Results.BadRequest(new { error = "Введите вопрос" });

    var options = (dto.Options ?? new List<string>()).Select(o => o.Trim()).Where(o => o.Length > 0).ToList();
    if (options.Count < 2) return Results.BadRequest(new { error = "Минимум 2 варианта" });

    var poll = new Poll { RoomId = id, Question = question, CreatedById = userId };
    db.Polls.Add(poll);
    await db.SaveChangesAsync();

    foreach (var opt in options)
        db.PollOptions.Add(new PollOption { PollId = poll.Id, Text = opt });
    await db.SaveChangesAsync();

    await hub.Clients.Group($"room-{id}").SendAsync("pollcreated", id);
    return Results.Ok(new { id = poll.Id });
}).RequireAuthorization();

app.MapGet("/api/rooms/{id:int}/polls", async (int id, ClaimsPrincipal principal, AppDb db) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var polls = await db.Polls.Where(p => p.RoomId == id).OrderBy(p => p.Id).ToListAsync();
    var result = new List<object>();
    foreach (var p in polls)
    {
        var opts = await db.PollOptions.Where(o => o.PollId == p.Id).OrderBy(o => o.Id).ToListAsync();
        var votes = await db.PollVotes.Where(v => v.PollId == p.Id).ToListAsync();
        var myVote = votes.FirstOrDefault(v => v.UserId == userId)?.OptionId ?? 0;

        result.Add(new
        {
            id = p.Id,
            question = p.Question,
            createdAt = p.CreatedAt,
            myVote,
            totalVotes = votes.Count,
            options = opts.Select(o => new
            {
                id = o.Id,
                text = o.Text,
                votes = votes.Count(v => v.OptionId == o.Id)
            }).ToList()
        });
    }
    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/polls/{id:int}/vote", async (int id, ClaimsPrincipal principal, AppDb db, VoteDto dto, IHubContext<ChatHub> hub) =>
{
    var idValue = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idValue, out int userId)) return Results.Unauthorized();

    var poll = await db.Polls.FindAsync(id);
    if (poll == null) return Results.NotFound(new { error = "Опрос не найден" });

    var option = await db.PollOptions.FirstOrDefaultAsync(o => o.Id == dto.OptionId && o.PollId == id);
    if (option == null) return Results.BadRequest(new { error = "Вариант не найден" });

    var existing = await db.PollVotes.FirstOrDefaultAsync(v => v.PollId == id && v.UserId == userId);
    if (existing != null)
    {
        if (existing.OptionId != dto.OptionId) existing.OptionId = dto.OptionId;
    }
    else
    {
        db.PollVotes.Add(new PollVote { PollId = id, OptionId = dto.OptionId, UserId = userId });
    }

    await db.SaveChangesAsync();
    await hub.Clients.Group($"room-{poll.RoomId}").SendAsync("pollvoted", poll.RoomId);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

app.MapGet("/api/users/online", () =>
    Results.Ok(ChatHub.OnlineUsers.Keys.ToArray())
).RequireAuthorization();

// Реакция на сообщение
app.MapPost("/api/messages/{id:int}/react", async (int id, ClaimsPrincipal principal, AppDb db, ReactMessageDto dto, IHubContext<ChatHub> hub) =>
{
    var idv = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idv, out int userId)) return Results.Unauthorized();

    var msg = await db.Messages.FindAsync(id);
    if (msg == null) return Results.NotFound(new { error = "Сообщение не найдено" });

    var existing = await db.MessageReactions.FirstOrDefaultAsync(r => r.MessageId == id && r.UserId == userId);
    if (existing != null && existing.Emoji == dto.Emoji)
        db.MessageReactions.Remove(existing);
    else if (existing != null)
        existing.Emoji = dto.Emoji;
    else
        db.MessageReactions.Add(new MessageReaction { MessageId = id, UserId = userId, Emoji = dto.Emoji });

    await db.SaveChangesAsync();

    var summary = (await db.MessageReactions.Where(r => r.MessageId == id).ToListAsync())
        .GroupBy(r => r.Emoji)
        .Select(g => new { emoji = g.Key, count = g.Count(), mine = g.Any(x => x.UserId == userId) })
        .ToList();

    await hub.Clients.Group($"room-{msg.RoomId}").SendAsync("messagereacted", id, summary);
    return Results.Ok(new { ok = true, reactions = summary });
}).RequireAuthorization();

// Редактирование сообщения (только своё, только текст)
app.MapPut("/api/messages/{id:int}", async (int id, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub, EditedMessageDto dto) =>
{
    var idv = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idv, out int userId)) return Results.Unauthorized();

    var msg = await db.Messages.FindAsync(id);
    if (msg == null) return Results.NotFound(new { error = "Сообщение не найдено" });
    if (msg.UserId != userId) return Results.BadRequest(new { error = "Можно редактировать только своё" });

    var text = (dto.Text ?? "").Trim();
    if (string.IsNullOrEmpty(text)) return Results.BadRequest(new { error = "Текст не может быть пустым" });
    if (text.Length > 1000) text = text[..1000];

    msg.Text = text;
    msg.EditedAt = DateTime.UtcNow;
    await db.SaveChangesAsync();

    await hub.Clients.Group($"room-{msg.RoomId}").SendAsync("messageedited", id, msg.Text, msg.EditedAt);
    return Results.Ok(new { ok = true });
}).RequireAuthorization();

// Пересылка сообщения в другой чат
app.MapPost("/api/messages/{id:int}/forward", async (int id, ClaimsPrincipal principal, AppDb db, IHubContext<ChatHub> hub, ForwardMessageDto dto) =>
{
    var idv = principal.FindFirstValue(ClaimTypes.NameIdentifier);
    if (!int.TryParse(idv, out int userId)) return Results.Unauthorized();

    var original = await db.Messages.FindAsync(id);
    if (original == null) return Results.NotFound(new { error = "Сообщение не найдено" });

    var targetRoom = await db.Rooms.FindAsync(dto.RoomId);
    if (targetRoom == null) return Results.NotFound(new { error = "Чат не найден" });

    // Проверяем что пользователь в целевом чате
    var memberIds = ParseMembers(targetRoom.Members);
    if (!string.IsNullOrEmpty(targetRoom.Members) && !memberIds.Contains(userId))
        return Results.BadRequest(new { error = "Вы не участник этого чата" });

    var author = await db.Users.FindAsync(original.UserId);
    
    var forwarded = new Message
    {
        RoomId = dto.RoomId,
        UserId = userId,
        Text = original.Text,
        ForwardedFromId = original.UserId,
        ForwardedFromName = author?.Name ?? "Неизвестный"
    };

    db.Messages.Add(forwarded);
    await db.SaveChangesAsync();

    var sender = await db.Users.FindAsync(userId);
    await hub.Clients.Group($"room-{dto.RoomId}").SendAsync("receive", new
    {
        forwarded.Id,
        roomId = dto.RoomId,
        userId,
        name = sender?.Name ?? "Неизвестный",
        avatarUrl = sender?.AvatarUrl,
        text = forwarded.Text,
        sentAt = forwarded.SentAt,
        isRead = false,
        replyToId = (int?)null,
        replyAuthorName = (string?)null,
        replyText = (string?)null,
        forwardedFromName = forwarded.ForwardedFromName,
        reactions = new object[] { }
    });

    return Results.Ok(new { ok = true, id = forwarded.Id });
}).RequireAuthorization();

app.MapHub<ChatHub>("/chathub").RequireAuthorization();



app.Run("http://0.0.0.0:5000");