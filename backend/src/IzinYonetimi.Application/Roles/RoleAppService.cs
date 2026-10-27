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

namespace IzinYonetimi.Roles
{
    public class AppRoleDto : EntityDto<long>
    {
        public string Name { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public bool IsSystem { get; set; }
        public bool IsActive { get; set; }
        public List<string> Permissions { get; set; } = new();
    }

    public class CreateAppRoleDto
    {
        public string Name { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public bool IsActive { get; set; } = true;
        public List<string> Permissions { get; set; } = new();
    }

    public class UpdateAppRoleDto : EntityDto<long>
    {
        public string Name { get; set; }
        public string DisplayName { get; set; }
        public string Description { get; set; }
        public bool IsActive { get; set; }
        public List<string> Permissions { get; set; } = new();
    }

    public class GetAllRolesInput : PagedAndSortedResultRequestDto
    {
        /// <summary>Optional free-text search over name / displayName / description</summary>
        public string Keyword { get; set; }
    }

    public interface IAppRoleAppService : IApplicationService
    {
        Task<PagedResultDto<AppRoleDto>> GetAllAsync(GetAllRolesInput input);
        Task<AppRoleDto> GetAsync(long id);
        Task<AppRoleDto> CreateAsync(CreateAppRoleDto input);
        Task<AppRoleDto> UpdateAsync(UpdateAppRoleDto input);
        Task DeleteAsync(long id);
    }

    public class AppRoleAppService : ApplicationService, IAppRoleAppService
    {
        private readonly IRepository<AppRole, long> _roleRepo;
        private readonly IRepository<RolePermission, long> _rolePermRepo;
        private readonly IPermissionRegistry _permRegistry;

        public AppRoleAppService(
            IRepository<AppRole, long> roleRepo,
            IRepository<RolePermission, long> rolePermRepo,
            IPermissionRegistry permRegistry)
        {
            _roleRepo = roleRepo;
            _rolePermRepo = rolePermRepo;
            _permRegistry = permRegistry;
        }

        [AbpAuthorize(PermissionNames.AppRole_Read)]
        public async Task<PagedResultDto<AppRoleDto>> GetAllAsync(GetAllRolesInput input)
        {
            var query = _roleRepo.GetAll();
            if (!string.IsNullOrWhiteSpace(input.Keyword))
                query = query.Where(r => r.Name.Contains(input.Keyword) || (r.DisplayName ?? "").Contains(input.Keyword) || (r.Description ?? "").Contains(input.Keyword));
            var total = await query.CountAsync();
            var items = await query.OrderBy(r => r.Id)
                .Skip(input.SkipCount).Take(input.MaxResultCount)
                .ToListAsync();

            var allPerms = await _rolePermRepo.GetAll().ToListAsync();
            var dtos = items.Select(r => new AppRoleDto
            {
                Id = r.Id, Name = r.Name, DisplayName = r.DisplayName,
                Description = r.Description, IsSystem = r.IsSystem, IsActive = r.IsActive,
                Permissions = allPerms.Where(p => p.RoleId == r.Id).Select(p => p.PermissionName).ToList(),
            }).ToList();
            return new PagedResultDto<AppRoleDto>(total, dtos);
        }

        [AbpAuthorize(PermissionNames.AppRole_Read)]
        public async Task<AppRoleDto> GetAsync(long id)
        {
            var role = await _roleRepo.GetAsync(id);
            var perms = await _rolePermRepo.GetAll().Where(p => p.RoleId == id).Select(p => p.PermissionName).ToListAsync();
            return new AppRoleDto
            {
                Id = role.Id, Name = role.Name, DisplayName = role.DisplayName,
                Description = role.Description, IsSystem = role.IsSystem, IsActive = role.IsActive,
                Permissions = perms,
            };
        }

        [AbpAuthorize(PermissionNames.AppRole_Create)]
        public async Task<AppRoleDto> CreateAsync(CreateAppRoleDto input)
        {
            if (await _roleRepo.GetAll().AnyAsync(r => r.Name == input.Name))
                throw new UserFriendlyException($"Role '{input.Name}' already exists");

            var role = new AppRole
            {
                Name = input.Name, DisplayName = input.DisplayName ?? input.Name,
                Description = input.Description, IsActive = input.IsActive, IsSystem = false,
            };
            var id = await _roleRepo.InsertAndGetIdAsync(role);
            await SyncPermissionsAsync(id, input.Permissions ?? new List<string>());
            return await GetAsync(id);
        }

        [AbpAuthorize(PermissionNames.AppRole_Update)]
        public async Task<AppRoleDto> UpdateAsync(UpdateAppRoleDto input)
        {
            var role = await _roleRepo.GetAsync(input.Id);
            if (role.IsSystem && role.Name != input.Name)
                throw new UserFriendlyException("System role name cannot be changed");

            role.Name = input.Name;
            role.DisplayName = input.DisplayName ?? input.Name;
            role.Description = input.Description;
            role.IsActive = input.IsActive;
            await _roleRepo.UpdateAsync(role);
            await SyncPermissionsAsync(input.Id, input.Permissions ?? new List<string>());
            return await GetAsync(input.Id);
        }

        [AbpAuthorize(PermissionNames.AppRole_Delete)]
        public async Task DeleteAsync(long id)
        {
            var role = await _roleRepo.GetAsync(id);
            if (role.IsSystem) throw new UserFriendlyException("System roles cannot be deleted");
            // Remove permissions first
            var perms = await _rolePermRepo.GetAll().Where(p => p.RoleId == id).ToListAsync();
            foreach (var p in perms) await _rolePermRepo.DeleteAsync(p);
            await _roleRepo.DeleteAsync(role);
        }

        private async Task SyncPermissionsAsync(long roleId, List<string> wanted)
        {
            // Validate against registry
            var validNames = _permRegistry.All.Select(p => p.Name).ToHashSet();
            var filtered = wanted.Where(p => validNames.Contains(p)).Distinct().ToList();

            var existing = await _rolePermRepo.GetAll().Where(p => p.RoleId == roleId).ToListAsync();
            // Izin vermek yonetici isi: AppRole.Update/Create tek basina yetki yukseltmeye yetmesin
            var permsChanged = existing.Any(e => !filtered.Contains(e.PermissionName))
                || filtered.Any(n => existing.All(e => e.PermissionName != n));
            if (permsChanged && !await IsGrantedAsync(PermissionNames.AppRole_AssignPermissions))
                throw new UserFriendlyException("Rol izinlerini değiştirmek için yetkiniz yok.");
            // Delete removed
            foreach (var p in existing.Where(e => !filtered.Contains(e.PermissionName)))
                await _rolePermRepo.DeleteAsync(p);
            // Add new
            var existingNames = existing.Select(e => e.PermissionName).ToHashSet();
            foreach (var name in filtered.Where(n => !existingNames.Contains(n)))
                await _rolePermRepo.InsertAsync(new RolePermission { RoleId = roleId, PermissionName = name });
        }
    }
}
