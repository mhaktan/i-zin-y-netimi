using System;
using System.Collections.Generic;
using System.IdentityModel.Tokens.Jwt;
using System.Linq;
using System.Security.Claims;
using System.Text;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Configuration;
using Microsoft.IdentityModel.Tokens;
using Abp.AspNetCore.Mvc.Controllers;
using IzinYonetimi.Authentication;
using IzinYonetimi.Entities;
using IzinYonetimi.EntityFrameworkCore;

namespace IzinYonetimi.Web.Host.Controllers
{
    public class SwitchDemoUserModel { public string UserName { get; set; } }

    [Route("api/[controller]/[action]")]
    public class TokenAuthController : AbpController
    {
        private readonly IConfiguration _configuration;

        public TokenAuthController(IConfiguration configuration)
        {
            _configuration = configuration;
        }

        [HttpPost]
        public ActionResult Authenticate([FromBody] AuthenticateModel model)
        {
            try
            {
                if (string.IsNullOrEmpty(model.UserNameOrEmailAddress) || string.IsNullOrEmpty(model.Password))
                {
                    return new JsonResult(new { success = false, error = "Invalid credentials" }) { StatusCode = 400 };
                }

                var connStr = _configuration.GetConnectionString("Default");
                var optionsBuilder = new DbContextOptionsBuilder();
                optionsBuilder.UseNpgsql(connStr);

                using var db = new IzinYonetimiDbContext(optionsBuilder.Options);

                // !u.IsDeleted SART: burada ham DbContext kullaniliyor, ABP'nin soft-delete
                // filtresi DEVREDE DEGIL. AppUser FullAuditedEntity oldugu icin silme
                // soft-delete; filtre olmadan iki sorun cikiyordu:
                //   1) GUVENLIK: silinmis kullanici hala giris yapabiliyor.
                //   2) Ayni kullanici adi yeniden olusturulunca FirstOrDefault ESKI
                //      (silinmis) satiri seciyor, token yanlis user id tasiyor ve
                //      rol/onay atamalari hic eslesmiyor.
                var user = db.AppUsers
                    .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.RolePermissions)
                    .FirstOrDefault(u =>
                        (u.UserName == model.UserNameOrEmailAddress ||
                         u.EmailAddress == model.UserNameOrEmailAddress) &&
                        u.IsActive && !u.IsDeleted);

                if (user == null)
                {
                    return new JsonResult(new { success = false, error = "Invalid username or password" }) { StatusCode = 401 };
                }

                // Dual-format password verify: legacy BCrypt hashes (admin seed) + PBKDF2 hashes (CreateAsync via PasswordHelper)
                bool pwOk;
                if (user.PasswordHash != null && user.PasswordHash.StartsWith("PBKDF2$"))
                    pwOk = IzinYonetimi.Users.PasswordHelper.VerifyPbkdf2(model.Password, user.PasswordHash);
                else
                    pwOk = BCrypt.Net.BCrypt.Verify(model.Password, user.PasswordHash);
                if (!pwOk)
                {
                    return new JsonResult(new { success = false, error = "Invalid username or password" }) { StatusCode = 401 };
                }

                return IssueToken(user);
            }
            catch (Exception ex)
            {
                return new JsonResult(new { success = false, error = ex.Message, details = ex.InnerException?.Message }) { StatusCode = 500 };
            }
        }

        /// <summary>Kullanici icin JWT (roller + izinler claim olarak)</summary>
        private ActionResult IssueToken(AppUser user)
        {
            var jwtConfig = _configuration.GetSection("Authentication:JwtBearer");
            var securityKey = jwtConfig["SecurityKey"];
            var issuer = jwtConfig["Issuer"];
            var audience = jwtConfig["Audience"];
            var expireMinutes = int.Parse(jwtConfig["ExpireMinutes"] ?? "1440");

            // Aggregate role names + permission names from UserRoles → RolePermissions
            var roleNames = user.UserRoles.Select(ur => ur.Role).Where(r => r != null && r.IsActive).Select(r => r.Name).Distinct().ToList();
            var permissionNames = user.UserRoles
                .Where(ur => ur.Role != null && ur.Role.IsActive)
                .SelectMany(ur => ur.Role.RolePermissions ?? new List<RolePermission>())
                .Select(rp => rp.PermissionName)
                .Distinct()
                .ToList();

            var claims = new List<Claim>
            {
                new Claim(ClaimTypes.Name, user.UserName),
                new Claim(ClaimTypes.Email, user.EmailAddress),
                new Claim(ClaimTypes.NameIdentifier, user.Id.ToString()),
                new Claim(JwtRegisteredClaimNames.Jti, Guid.NewGuid().ToString()),
            };
            foreach (var rn in roleNames) claims.Add(new Claim(ClaimTypes.Role, rn));
            // ABP and ASP.NET Core read this claim type by default
            foreach (var pn in permissionNames) claims.Add(new Claim("permission", pn));

            var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(securityKey));
            var credentials = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);
            var token = new JwtSecurityToken(
                issuer: issuer,
                audience: audience,
                claims: claims,
                expires: DateTime.UtcNow.AddMinutes(expireMinutes),
                signingCredentials: credentials
            );

            return new JsonResult(new
            {
                success = true,
                result = new AuthenticateResultModel
                {
                    AccessToken = new JwtSecurityTokenHandler().WriteToken(token),
                    ExpireInSeconds = expireMinutes * 60,
                    UserId = user.Id,
                }
            });
        }

        private static bool DemoMode => Environment.GetEnvironmentVariable("DEMO_MODE") == "true";

        private IzinYonetimiDbContext OpenDb()
        {
            var optionsBuilder = new DbContextOptionsBuilder();
            var connStr = _configuration.GetConnectionString("Default");
            optionsBuilder.UseNpgsql(connStr);
            return new IzinYonetimiDbContext(optionsBuilder.Options);
        }

        /// <summary>Demo modunda rol kullanicilari (demo.*) — rehberli ilk akis icin. Demo kapaliysa bos.</summary>
        [HttpGet]
        [Abp.Authorization.AbpAuthorize]
        public ActionResult GetDemoUsers()
        {
            if (!DemoMode) return new JsonResult(new { success = true, result = new object[0] });
            using var db = OpenDb();
            // Yayindan sonra eklenen roller icin de demo kullanici: liste her acilista guncel rollerden tamamlanir
            var roles = db.AppRoles.Where(r => r.IsActive && r.Name != "Admin" && r.Name != "User").ToList();
            foreach (var role in roles)
            {
                var demoName = "demo." + role.Name.ToLowerInvariant();
                var u = db.AppUsers.FirstOrDefault(x => x.UserName == demoName);
                if (u == null)
                {
                    u = new AppUser
                    {
                        UserName = demoName, EmailAddress = demoName + "@demo.local",
                        Name = role.DisplayName ?? role.Name, Surname = "(Demo)",
                        // Rastgele sifre: demo hesabina yalniz rol degistirme ile girilir
                        PasswordHash = BCrypt.Net.BCrypt.HashPassword(Guid.NewGuid().ToString("N")),
                        IsActive = true,
                    };
                    db.AppUsers.Add(u);
                    db.SaveChanges();
                }
                if (!db.UserRoles.Any(ur => ur.UserId == u.Id && ur.RoleId == role.Id))
                {
                    db.UserRoles.Add(new UserRole { UserId = u.Id, RoleId = role.Id });
                    db.SaveChanges();
                }
            }
            var users = db.AppUsers.Include(u => u.UserRoles).ThenInclude(ur => ur.Role)
                .Where(u => u.UserName.StartsWith("demo.") && u.IsActive && !u.IsDeleted).ToList()
                .Select(u => new { userName = u.UserName, displayName = u.Name, roles = u.UserRoles.Where(ur => ur.Role != null).Select(ur => ur.Role.DisplayName ?? ur.Role.Name).ToList() });
            return new JsonResult(new { success = true, result = users });
        }

        /// <summary>
        /// Demo modunda giris yapmis kullanici bir demo rol hesabina gecer (rol degistirme kisayolu).
        /// Yalniz DEMO_MODE=true ve yalniz demo.* hesaplari — canli kurulumda kapali.
        /// </summary>
        [HttpPost]
        [Abp.Authorization.AbpAuthorize]
        public ActionResult SwitchDemoUser([FromBody] SwitchDemoUserModel model)
        {
            if (!DemoMode) return new JsonResult(new { success = false, error = "Demo modu kapali" }) { StatusCode = 403 };
            if (model?.UserName == null || !model.UserName.StartsWith("demo.")) return new JsonResult(new { success = false, error = "Yalniz demo hesaplari" }) { StatusCode = 403 };
            using var db = OpenDb();
            var user = db.AppUsers
                .Include(u => u.UserRoles).ThenInclude(ur => ur.Role).ThenInclude(r => r.RolePermissions)
                .FirstOrDefault(u => u.UserName == model.UserName && u.IsActive && !u.IsDeleted);
            if (user == null) return new JsonResult(new { success = false, error = "Demo kullanicisi yok" }) { StatusCode = 404 };
            return IssueToken(user);
        }
    }
}
