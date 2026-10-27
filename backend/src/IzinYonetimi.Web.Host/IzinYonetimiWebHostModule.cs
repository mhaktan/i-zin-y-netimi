using Abp.AspNetCore;
using Abp.AspNetCore.Configuration;
using Abp.Modules;
using Abp.Reflection.Extensions;
using IzinYonetimi.EntityFrameworkCore;

namespace IzinYonetimi.Web.Host
{
    [DependsOn(typeof(IzinYonetimiApplicationModule), typeof(IzinYonetimiEntityFrameworkCoreModule), typeof(AbpAspNetCoreModule))]
    public class IzinYonetimiWebHostModule : AbpModule
    {
        public override void PreInitialize()
        {
            // Expose all AppServices as dynamic API controllers
            Configuration.Modules.AbpAspNetCore()
                .CreateControllersForAppServices(
                    typeof(IzinYonetimiApplicationModule).GetAssembly(),
                    moduleName: "app",
                    useConventionalHttpVerbs: true
                );
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(IzinYonetimiWebHostModule).GetAssembly());
        }
    }
}
