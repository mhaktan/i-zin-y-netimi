using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Abp.Application.Services;
using IzinYonetimi.Authorization;

namespace IzinYonetimi.Authorization
{
    public class PermissionDto
    {
        public string Name { get; set; }
        public string Group { get; set; }
        public string Description { get; set; }
        public bool IsRbac { get; set; }
    }

    public interface IPermissionAppService : IApplicationService
    {
        Task<List<PermissionDto>> GetAllAsync();
    }

    public class PermissionAppService : ApplicationService, IPermissionAppService
    {
        private readonly IPermissionRegistry _registry;
        public PermissionAppService(IPermissionRegistry registry) { _registry = registry; }

        public Task<List<PermissionDto>> GetAllAsync()
        {
            var list = _registry.All
                .Select(p => new PermissionDto { Name = p.Name, Group = p.Group, Description = p.Description, IsRbac = p.IsRbac })
                .ToList();
            return Task.FromResult(list);
        }
    }
}
