using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace IzinYonetimi.EntityFrameworkCore
{
    public class IzinYonetimiDbContextFactory : IDesignTimeDbContextFactory<IzinYonetimiDbContext>
    {
        public IzinYonetimiDbContext CreateDbContext(string[] args)
        {
            var configuration = new ConfigurationBuilder()
                .SetBasePath(Path.Combine(Directory.GetCurrentDirectory(), "../IzinYonetimi.Web.Host"))
                .AddJsonFile("appsettings.json", optional: false)
                .Build();

            var connStr = configuration.GetConnectionString("Default");
            var builder = new DbContextOptionsBuilder();
            builder.UseNpgsql(connStr);
            return new IzinYonetimiDbContext(builder.Options);
        }
    }
}
