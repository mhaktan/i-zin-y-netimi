using Abp.EntityFrameworkCore;
using Abp.EntityFrameworkCore.Configuration;
using Abp.Modules;
using Abp.Reflection.Extensions;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;

namespace IzinYonetimi.EntityFrameworkCore
{
    [DependsOn(typeof(IzinYonetimiCoreModule), typeof(AbpEntityFrameworkCoreModule))]
    public class IzinYonetimiEntityFrameworkCoreModule : AbpModule
    {
        public override void PreInitialize()
        {
            Configuration.Modules.AbpEfCore().AddDbContext<IzinYonetimiDbContext>(options =>
            {
                // connStr ABP tarafından CoreModule.DefaultNameOrConnectionString'ten resolve edilir
                // (Railway'de ConnectionStrings__Default env var). Ekstra ConfigurationBuilder/paket
                // gerekmez. ExistingConnection = nested UnitOfWork bağlantı paylaşımı.
                if (options.ExistingConnection != null)
                {
                    options.DbContextOptions.UseNpgsql(options.ExistingConnection);
                }
                else
                {
                    options.DbContextOptions.UseNpgsql(options.ConnectionString);
                }
            });
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(IzinYonetimiEntityFrameworkCoreModule).GetAssembly());
        }
    }
}
