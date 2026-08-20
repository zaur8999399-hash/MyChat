using Microsoft.EntityFrameworkCore;

public class AppDb : DbContext
{
    public AppDb(DbContextOptions<AppDb> options) : base(options)
    {
    }

    public DbSet<User> Users => Set<User>();

    public DbSet<Room> Rooms => Set<Room>();

    public DbSet<Message> Messages => Set<Message>();
public DbSet<Post> Posts => Set<Post>();
public DbSet<Comment> Comments => Set<Comment>();
public DbSet<PostReaction> PostReactions => Set<PostReaction>();
public DbSet<Friendship> Friendships => Set<Friendship>();

public DbSet<Poll> Polls => Set<Poll>();
public DbSet<PollOption> PollOptions => Set<PollOption>();
public DbSet<PollVote> PollVotes => Set<PollVote>();
    protected override void OnModelCreating(ModelBuilder builder)
    {
        builder.Entity<User>()
            .HasIndex(u => u.Login)
            .IsUnique();
    }

}
