using System;
using Abp.Dependency;
using Abp.Domain.Repositories;
using Abp.Domain.Uow;
using IzinYonetimi.Authorization;
using IzinYonetimi.Entities;
using IzinYonetimi.EntityFrameworkCore.Seed;

namespace IzinYonetimi.EntityFrameworkCore
{
    public static class SeedHelper
    {
        public static void SeedHostDb(IIocResolver iocResolver)
        {
            try
            {
                Console.WriteLine("[SeedHelper] Creating IoC scope...");
                using (var scope = iocResolver.CreateScope())
                {
                    Console.WriteLine("[SeedHelper] Resolving repositories...");
                    var uowManager = scope.Resolve<IUnitOfWorkManager>();
                    var userRepo = scope.Resolve<IRepository<AppUser, long>>();
                    var roleRepo = scope.Resolve<IRepository<AppRole, long>>();
                    var userRoleRepo = scope.Resolve<IRepository<UserRole, long>>();
                    var rolePermRepo = scope.Resolve<IRepository<RolePermission, long>>();
                    var permRegistry = scope.Resolve<IPermissionRegistry>();

                    // ABP IRepository requires an active UnitOfWork — without this Begin() call
                    // any GetAll/Insert throws "ArgumentNullException: unitOfWork".
                    Console.WriteLine("[SeedHelper] Beginning UnitOfWork...");
                    using (var uow = uowManager.Begin())
                    {
                        Console.WriteLine("[SeedHelper] All dependencies resolved — running seeder");
                        var seeder = new DefaultUserSeeder(userRepo, roleRepo, userRoleRepo, rolePermRepo, permRegistry);
                        seeder.Seed();
                        uow.Complete();
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"[SeedHelper] FAILED: {ex.GetType().Name}: {ex.Message}");
                if (ex.InnerException != null)
                    Console.WriteLine($"[SeedHelper] InnerException: {ex.InnerException.GetType().Name}: {ex.InnerException.Message}");
                Console.WriteLine("[SeedHelper] StackTrace:");
                Console.WriteLine(ex.StackTrace);
                throw;
            }
        }
    }
}
