using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Abp.Application.Services;
using Abp.Application.Services.Dto;
using Abp.Authorization;
using Abp.Domain.Repositories;
using Abp.UI;
using Microsoft.EntityFrameworkCore;
using IzinYonetimi.Authorization;
using IzinYonetimi.Entities;

namespace IzinYonetimi.Users
{
    // PBKDF2 password helper — replaces BCrypt for AppUserAppService.
    // Some ABP forks crash with a runtime exception when an ApplicationService method body
    // references BCrypt.Net.BCrypt (works in non-AppService contexts like TokenAuthController/seed).
    // PBKDF2 has no external dependency and is JIT-clean inside ApplicationService.
    // Login path supports both formats so legacy BCrypt-hashed accounts (admin seed) keep working.
    public static class PasswordHelper
    {
        private const int Iterations = 100_000;
        private const int SaltSize = 16;
        private const int HashSize = 32;

        public static string Hash(string pw)
        {
            var salt = System.Security.Cryptography.RandomNumberGenerator.GetBytes(SaltSize);
            var hash = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(pw, salt, Iterations, System.Security.Cryptography.HashAlgorithmName.SHA256, HashSize);
            return $"PBKDF2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
        }

        public static bool VerifyPbkdf2(string pw, string stored)
        {
            if (string.IsNullOrEmpty(stored) || !stored.StartsWith("PBKDF2$")) return false;
            var parts = stored.Split('$');
            if (parts.Length != 4) return false;
            var iters = int.Parse(parts[1]);
            var salt = Convert.FromBase64String(parts[2]);
            var expected = Convert.FromBase64String(parts[3]);
            var actual = System.Security.Cryptography.Rfc2898DeriveBytes.Pbkdf2(pw, salt, iters, System.Security.Cryptography.HashAlgorithmName.SHA256, expected.Length);
            return System.Security.Cryptography.CryptographicOperations.FixedTimeEquals(expected, actual);
        }
    }

    public class AppUserDto : EntityDto<long>
    {
        public string UserName { get; set; }
        public string EmailAddress { get; set; }
        public string Name { get; set; }
        public string Surname { get; set; }
        public bool IsActive { get; set; }
        public List<long> RoleIds { get; set; } = new();
        public List<string> RoleNames { get; set; } = new();
    }

    public class CreateAppUserDto
    {
        public string UserName { get; set; }
        public string EmailAddress { get; set; }
        public string Name { get; set; }
        public string Surname { get; set; }
        public string Password { get; set; }
        public bool IsActive { get; set; } = true;
        public List<long> RoleIds { get; set; } = new();
    }

    public class UpdateAppUserDto : EntityDto<long>
    {
        public string UserName { get; set; }
        public string EmailAddress { get; set; }
        public string Name { get; set; }
        public string Surname { get; set; }
        /// <summary>Optional — only updates password when non-empty</summary>
        public string Password { get; set; }
        public bool IsActive { get; set; }
        public List<long> RoleIds { get; set; } = new();
    }

    public class GetAllUsersInput : PagedAndSortedResultRequestDto
    {
        /// <summary>Optional free-text search over userName / name / surname / email</summary>
        public string Keyword { get; set; }
        /// <summary>Optional — only users belonging to (any of) these roles</summary>
        public List<long> RoleIds { get; set; } = new();
    }

    public interface IAppUserAppService : IApplicationService
    {
        Task<PagedResultDto<AppUserDto>> GetAllAsync(GetAllUsersInput input);
        Task<AppUserDto> GetAsync(long id);
        Task<AppUserDto> CreateAsync(CreateAppUserDto input);
        Task<AppUserDto> UpdateAsync(UpdateAppUserDto input);
        Task DeleteAsync(long id);
    }

    public class AppUserAppService : ApplicationService, IAppUserAppService
    {
        private readonly IRepository<AppUser, long> _userRepo;
        private readonly IRepository<UserRole, long> _userRoleRepo;
        private readonly IRepository<AppRole, long> _roleRepo;

        public AppUserAppService(
            IRepository<AppUser, long> userRepo,
            IRepository<UserRole, long> userRoleRepo,
            IRepository<AppRole, long> roleRepo)
        {
            _userRepo = userRepo;
            _userRoleRepo = userRoleRepo;
            _roleRepo = roleRepo;
        }

        [AbpAuthorize(PermissionNames.AppUser_Read)]
        public async Task<PagedResultDto<AppUserDto>> GetAllAsync(GetAllUsersInput input)
        {
            var q = _userRepo.GetAll();
            if (!string.IsNullOrWhiteSpace(input.Keyword))
                q = q.Where(u => u.UserName.Contains(input.Keyword) || u.Name.Contains(input.Keyword) || u.Surname.Contains(input.Keyword) || u.EmailAddress.Contains(input.Keyword));
            if (input.RoleIds != null && input.RoleIds.Any())
            {
                var roleUserIds = _userRoleRepo.GetAll().Where(ur => input.RoleIds.Contains(ur.RoleId)).Select(ur => ur.UserId);
                q = q.Where(u => roleUserIds.Contains(u.Id));
            }
            var total = await q.CountAsync();
            var users = await q.OrderBy(u => u.Id)
                .Skip(input.SkipCount).Take(input.MaxResultCount)
                .ToListAsync();
            var userIds = users.Select(u => u.Id).ToList();
            var userRoles = await _userRoleRepo.GetAll().Where(ur => userIds.Contains(ur.UserId)).ToListAsync();
            var roles = await _roleRepo.GetAll().ToListAsync();

            var dtos = users.Select(u => new AppUserDto
            {
                Id = u.Id, UserName = u.UserName, EmailAddress = u.EmailAddress,
                Name = u.Name, Surname = u.Surname, IsActive = u.IsActive,
                RoleIds = userRoles.Where(ur => ur.UserId == u.Id).Select(ur => ur.RoleId).ToList(),
                RoleNames = userRoles.Where(ur => ur.UserId == u.Id)
                    .Select(ur => roles.FirstOrDefault(r => r.Id == ur.RoleId)?.Name ?? "")
                    .Where(n => !string.IsNullOrEmpty(n)).ToList(),
            }).ToList();
            return new PagedResultDto<AppUserDto>(total, dtos);
        }

        [AbpAuthorize(PermissionNames.AppUser_Read)]
        public async Task<AppUserDto> GetAsync(long id)
        {
            var u = await _userRepo.GetAsync(id);
            var roleIds = await _userRoleRepo.GetAll().Where(ur => ur.UserId == id).Select(ur => ur.RoleId).ToListAsync();
            var roles = await _roleRepo.GetAll().Where(r => roleIds.Contains(r.Id)).ToListAsync();
            return new AppUserDto
            {
                Id = u.Id, UserName = u.UserName, EmailAddress = u.EmailAddress,
                Name = u.Name, Surname = u.Surname, IsActive = u.IsActive,
                RoleIds = roleIds, RoleNames = roles.Select(r => r.Name).ToList(),
            };
        }

        [AbpAuthorize(PermissionNames.AppUser_Create)]
        public async Task<AppUserDto> CreateAsync(CreateAppUserDto input)
        {
            if (string.IsNullOrEmpty(input.Password) || input.Password.Length < 6)
                throw new UserFriendlyException("Password must be at least 6 characters");
            if (await _userRepo.GetAll().AnyAsync(u => u.UserName == input.UserName || u.EmailAddress == input.EmailAddress))
                throw new UserFriendlyException("User with this username or email already exists");

            var user = new AppUser
            {
                UserName = input.UserName, EmailAddress = input.EmailAddress,
                Name = input.Name, Surname = input.Surname,
                PasswordHash = PasswordHelper.Hash(input.Password),
                IsActive = input.IsActive,
            };
            var id = await _userRepo.InsertAndGetIdAsync(user);
            await SyncRolesAsync(id, input.RoleIds ?? new List<long>());
            return await GetAsync(id);
        }

        [AbpAuthorize(PermissionNames.AppUser_Update)]
        public async Task<AppUserDto> UpdateAsync(UpdateAppUserDto input)
        {
            var user = await _userRepo.GetAsync(input.Id);

            // Last-Admin protection: if this update would remove the Admin role from the only Admin user, block.
            var adminRole = await _roleRepo.GetAll().FirstOrDefaultAsync(r => r.Name == "Admin");
            if (adminRole != null)
            {
                var currentlyHasAdmin = await _userRoleRepo.GetAll().AnyAsync(ur => ur.UserId == input.Id && ur.RoleId == adminRole.Id);
                var willHaveAdmin = (input.RoleIds ?? new List<long>()).Contains(adminRole.Id);
                if (currentlyHasAdmin && !willHaveAdmin)
                {
                    var totalAdmins = await _userRoleRepo.GetAll().CountAsync(ur => ur.RoleId == adminRole.Id);
                    if (totalAdmins <= 1)
                        throw new UserFriendlyException("Cannot remove Admin role — at least one user must remain in the Admin role.");
                }
                // Also block deactivating the only Admin
                if (currentlyHasAdmin && !input.IsActive)
                {
                    var activeAdmins = await (from ur in _userRoleRepo.GetAll()
                                              join u in _userRepo.GetAll() on ur.UserId equals u.Id
                                              where ur.RoleId == adminRole.Id && u.IsActive
                                              select u.Id).Distinct().CountAsync();
                    if (activeAdmins <= 1)
                        throw new UserFriendlyException("Cannot deactivate the last active Admin user.");
                }
            }

            // Admin hesabini (sifre, e-posta, rol) yalniz Admin degistirir; e-posta onay/vekalet eslesmesinin anahtari
            if (adminRole != null && await _userRoleRepo.GetAll().AnyAsync(ur => ur.UserId == input.Id && ur.RoleId == adminRole.Id)
                && !await CallerIsAdminAsync())
                throw new UserFriendlyException("Admin kullanıcıyı yalnızca bir Admin düzenleyebilir.");
            if (await _userRepo.GetAll().AnyAsync(u => u.Id != input.Id && (u.UserName == input.UserName || u.EmailAddress == input.EmailAddress)))
                throw new UserFriendlyException("Bu kullanıcı adı ya da e-posta başka bir kullanıcıda kayıtlı.");

            user.UserName = input.UserName;
            user.EmailAddress = input.EmailAddress;
            user.Name = input.Name;
            user.Surname = input.Surname;
            user.IsActive = input.IsActive;
            if (!string.IsNullOrEmpty(input.Password))
            {
                if (input.Password.Length < 6) throw new UserFriendlyException("Password must be at least 6 characters");
                user.PasswordHash = PasswordHelper.Hash(input.Password);
            }
            await _userRepo.UpdateAsync(user);
            await SyncRolesAsync(input.Id, input.RoleIds ?? new List<long>());
            return await GetAsync(input.Id);
        }

        [AbpAuthorize(PermissionNames.AppUser_Delete)]
        public async Task DeleteAsync(long id)
        {
            var user = await _userRepo.GetAsync(id);
            if (user.UserName == "admin") throw new UserFriendlyException("Default admin user cannot be deleted");

            // Last-Admin protection: if this user holds the Admin role and is the only one, block deletion.
            // System cannot be left without an Administrator.
            var adminRole = await _roleRepo.GetAll().FirstOrDefaultAsync(r => r.Name == "Admin");
            if (adminRole != null)
            {
                var hasAdminRole = await _userRoleRepo.GetAll().AnyAsync(ur => ur.UserId == id && ur.RoleId == adminRole.Id);
                if (hasAdminRole)
                {
                    var totalAdmins = await _userRoleRepo.GetAll().CountAsync(ur => ur.RoleId == adminRole.Id);
                    if (totalAdmins <= 1)
                        throw new UserFriendlyException("Cannot delete the last user with the Admin role. Assign Admin to another user first.");
                }
            }

            var userRoles = await _userRoleRepo.GetAll().Where(ur => ur.UserId == id).ToListAsync();
            foreach (var ur in userRoles) await _userRoleRepo.DeleteAsync(ur);
            await _userRepo.DeleteAsync(user);
        }

        private async Task<bool> CallerIsAdminAsync()
        {
            var adminRole = await _roleRepo.GetAll().FirstOrDefaultAsync(r => r.Name == "Admin");
            return adminRole != null && AbpSession.UserId.HasValue
                && await _userRoleRepo.GetAll().AnyAsync(ur => ur.UserId == AbpSession.UserId.Value && ur.RoleId == adminRole.Id);
        }

        private async Task SyncRolesAsync(long userId, List<long> wanted)
        {
            var existing = await _userRoleRepo.GetAll().Where(ur => ur.UserId == userId).ToListAsync();
            // Rol atamak yetki vermektir: AppUser.Update/Create tek basina kendini Admin yapmaya yetmesin.
            // Varsayilan "User" rolu serbest (personel kaydi acan IK kullanicisi icin).
            var added = wanted.Distinct().Where(r => existing.All(e => e.RoleId != r)).ToList();
            var removed = existing.Where(e => !wanted.Contains(e.RoleId)).ToList();
            var addedNames = await _roleRepo.GetAll().Where(r => added.Contains(r.Id)).Select(r => r.Name).ToListAsync();
            if ((removed.Any() || addedNames.Any(n => n != "User")) && !await IsGrantedAsync(PermissionNames.AppRole_AssignPermissions))
                throw new UserFriendlyException("Rol atamak için yetkiniz yok.");
            if (addedNames.Contains("Admin") && !await CallerIsAdminAsync())
                throw new UserFriendlyException("Admin rolünü yalnızca bir Admin verebilir.");
            foreach (var ur in existing.Where(e => !wanted.Contains(e.RoleId)))
                await _userRoleRepo.DeleteAsync(ur);
            var existingIds = existing.Select(e => e.RoleId).ToHashSet();
            foreach (var roleId in wanted.Distinct().Where(r => !existingIds.Contains(r)))
                await _userRoleRepo.InsertAsync(new UserRole { UserId = userId, RoleId = roleId });
        }
    }
}
