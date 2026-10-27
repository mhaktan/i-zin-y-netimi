using System.Threading.Tasks;
using Abp;
using Abp.Authorization;
using Abp.Dependency;
using Microsoft.AspNetCore.Http;

namespace IzinYonetimi.Web.Host
{
    /// <summary>
    /// Reads JWT "permission" claims (added by TokenAuthController on login)
    /// and answers IPermissionChecker.IsGrantedAsync. ABP's default checker
    /// requires AbpUserManager / Identity which we do not use here.
    /// </summary>
    public class JwtPermissionChecker : IPermissionChecker, ITransientDependency
    {
        private readonly IHttpContextAccessor _http;
        public JwtPermissionChecker(IHttpContextAccessor http) { _http = http; }

        public Task<bool> IsGrantedAsync(string permissionName)
            => Task.FromResult(IsGranted(permissionName));

        public bool IsGranted(string permissionName)
        {
            var user = _http.HttpContext?.User;
            if (user?.Identity?.IsAuthenticated != true) return false;
            return user.HasClaim(c => c.Type == "permission" && c.Value == permissionName);
        }

        // Per-user overloads — we don't model a per-user store; rely on the current request's claims.
        public Task<bool> IsGrantedAsync(long userId, string permissionName) => IsGrantedAsync(permissionName);
        public bool IsGranted(long userId, string permissionName) => IsGranted(permissionName);
        public Task<bool> IsGrantedAsync(UserIdentifier user, string permissionName) => IsGrantedAsync(permissionName);
        public bool IsGranted(UserIdentifier user, string permissionName) => IsGranted(permissionName);
    }
}
