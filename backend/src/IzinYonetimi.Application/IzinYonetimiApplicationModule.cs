using Abp.AutoMapper;
using Abp.Modules;
using Abp.Reflection.Extensions;

namespace IzinYonetimi
{
    [DependsOn(typeof(IzinYonetimiCoreModule), typeof(AbpAutoMapperModule))]
    public class IzinYonetimiApplicationModule : AbpModule
    {
        public override void PreInitialize()
        {
            Configuration.Modules.AbpAutoMapper().Configurators.Add(cfg =>
            {
                cfg.AddMaps(typeof(IzinYonetimiApplicationModule).GetAssembly());
            });
        }

        public override void Initialize()
        {
            IocManager.RegisterAssemblyByConvention(typeof(IzinYonetimiApplicationModule).GetAssembly());
        }
    }
}
