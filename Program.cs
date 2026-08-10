using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Authentication.Cookies;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Identity;
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
                    var otherUser = await db.Users.FindAsync(otherId);
                    displayName = otherUser?.Name ?? "Чат";
                }
            }
        }

        if (show)
        {
            result.Add(new { id = room.Id, name = displayName });
        }
    }

    return Results.Ok(result);
}).RequireAuthorization();

app.MapPost("/api/rooms", async (CreateRoomDto dto, AppDb db) =>
{
    var name = dto.Name?.Trim();

    if (string.IsNullOrWhiteSpace(name))
        return Results.BadRequest(new { error = "Введите название чата." });

    if (name.Length > 50)
        name = name[..50];

    var room = new Room { Name = name };

    db.Rooms.Add(room);
    await db.SaveChangesAsync();

    return Results.Ok(new { room.Id, room.Name });
}).RequireAuthorization();

app.MapGet("/api/rooms/{id:int}/messages", async (int id, AppDb db) =>
{
    if (!await db.Rooms.AnyAsync(r => r.Id == id))
        return Results.NotFound();

    var messages = await db.Messages
        .Where(m => m.RoomId == id)
        .OrderBy(m => m.Id)
        .Select(m => new
        {
            m.Id,
            m.RoomId,
            m.UserId,
            Name = m.User!.Name,
            AvatarUrl = m.User.AvatarUrl,
            m.Text,
            m.SentAt
        })
        .ToListAsync();

    return Results.Ok(messages);
}).RequireAuthorization();

app.MapHub<ChatHub>("/chathub").RequireAuthorization();

app.Run("http://0.0.0.0:5000");