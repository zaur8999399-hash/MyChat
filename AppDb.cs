using Microsoft.EntityFrameworkCore;

public class AppDb : DbContext
{
    public AppDb(DbContextOptions<AppDb> options) : base(options)
    {
    }

    // ===== ОСНОВНЫЕ ТАБЛИЦЫ =====
    public DbSet<User> Users => Set<User>();
    public DbSet<Room> Rooms => Set<Room>();
    public DbSet<Message> Messages => Set<Message>();

    // ===== СОЦСЕТЬ =====
    public DbSet<Post> Posts => Set<Post>();
    public DbSet<Comment> Comments => Set<Comment>();
    public DbSet<PostReaction> PostReactions => Set<PostReaction>();
    public DbSet<Friendship> Friendships => Set<Friendship>();
    public DbSet<Follow> Follows => Set<Follow>();

    // ===== МЕДИА =====
    public DbSet<Story> Stories => Set<Story>();

    // ===== ГРУППЫ И ОПРОСЫ =====
    public DbSet<Poll> Polls => Set<Poll>();
    public DbSet<PollOption> PollOptions => Set<PollOption>();
    public DbSet<PollVote> PollVotes => Set<PollVote>();

    // ===== СООБЩЕНИЯ =====
    public DbSet<MessageReaction> MessageReactions => Set<MessageReaction>();
    public DbSet<ChatClear> ChatClears => Set<ChatClear>();   // ← ДОБАВЛЕНО!

public class ChatClear
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public int RoomId { get; set; }
    public DateTime ClearedAt { get; set; } = DateTime.UtcNow;
}
    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<User>()
            .HasIndex(u => u.Login)
            .IsUnique();
    }
}