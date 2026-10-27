using Abp.Authorization;
using Abp.Localization;

namespace IzinYonetimi.Authorization
{
    public class IzinYonetimiAuthorizationProvider : AuthorizationProvider
    {
        public override void SetPermissions(IPermissionDefinitionContext context)
        {
            var pages = context.GetPermissionOrNull("Pages") ?? context.CreatePermission("Pages", L("Pages"));

            // LeaveRequest
            pages.CreateChildPermission(PermissionNames.LeaveRequest_Read, L("LeaveRequest.Read"));
            pages.CreateChildPermission(PermissionNames.LeaveRequest_Create, L("LeaveRequest.Create"));
            pages.CreateChildPermission(PermissionNames.LeaveRequest_Update, L("LeaveRequest.Update"));
            pages.CreateChildPermission(PermissionNames.LeaveRequest_Delete, L("LeaveRequest.Delete"));
            pages.CreateChildPermission(PermissionNames.LeaveRequest_ChangeStatus, L("LeaveRequest.ChangeStatus"));

            // LeaveBalance
            pages.CreateChildPermission(PermissionNames.LeaveBalance_Read, L("LeaveBalance.Read"));
            pages.CreateChildPermission(PermissionNames.LeaveBalance_Create, L("LeaveBalance.Create"));
            pages.CreateChildPermission(PermissionNames.LeaveBalance_Update, L("LeaveBalance.Update"));
            pages.CreateChildPermission(PermissionNames.LeaveBalance_Delete, L("LeaveBalance.Delete"));

            // RBAC
            pages.CreateChildPermission(PermissionNames.AppUser_Read, L("AppUser.Read"));
            pages.CreateChildPermission(PermissionNames.AppRole_Read, L("AppRole.Read"));
            pages.CreateChildPermission(PermissionNames.AppUser_Create, L("AppUser.Create"));
            pages.CreateChildPermission(PermissionNames.AppRole_Create, L("AppRole.Create"));
            pages.CreateChildPermission(PermissionNames.AppUser_Update, L("AppUser.Update"));
            pages.CreateChildPermission(PermissionNames.AppRole_Update, L("AppRole.Update"));
            pages.CreateChildPermission(PermissionNames.AppUser_Delete, L("AppUser.Delete"));
            pages.CreateChildPermission(PermissionNames.AppRole_Delete, L("AppRole.Delete"));
            pages.CreateChildPermission(PermissionNames.AppRole_AssignPermissions, L("AppRole.AssignPermissions"));
        }

        private static ILocalizableString L(string name)
        {
            return new LocalizableString(name, IzinYonetimiConsts.LocalizationSourceName);
        }
    }
}
