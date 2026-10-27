using Abp.Modules;
using Abp.Reflection.Extensions;

namespace IzinYonetimi
{
    public class IzinYonetimiCoreModule : AbpModule
    {
        public override void PreInitialize()
        {
            // ABP UnitOfWork/repository (seed dahil) connStr'i BURADAN alır (DbContextEfCoreTransactionStrategy).
            // Railway/Docker: ConnectionStrings__Default env var varsa gerçek connStr'i kullan; yoksa
            // appsettings.json'daki "Default" adına düş. Yoksa ABP name'i localhost'a çözer → seed 127.0.0.1'e
            // bağlanmaya çalışır (login controller raw IConfiguration kullandığı için bağlanır, seed kopuktur).
            var envConnStr = System.Environment.GetEnvironmentVariable("ConnectionStrings__Default");
            Configuration.DefaultNameOrConnectionString = string.IsNullOrEmpty(envConnStr)
                ? IzinYonetimiConsts.ConnectionStringName
                : envConnStr;
            // SMTP: ABP reads email settings from AbpSettings table by default.
            // Override via ISmtpEmailSenderConfiguration registration if needed.
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(IzinYonetimiCoreModule).GetAssembly());
        }
    }
}
