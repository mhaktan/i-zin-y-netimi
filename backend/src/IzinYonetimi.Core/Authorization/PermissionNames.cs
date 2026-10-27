namespace IzinYonetimi.Authorization
{
    public static class PermissionNames
    {
        public const string Pages = "Pages";

        // LeaveRequest
        public const string LeaveRequest_Read = "LeaveRequest.Read";
        public const string LeaveRequest_Create = "LeaveRequest.Create";
        public const string LeaveRequest_Update = "LeaveRequest.Update";
        public const string LeaveRequest_Delete = "LeaveRequest.Delete";
        public const string LeaveRequest_ChangeStatus = "LeaveRequest.ChangeStatus";

        // LeaveBalance
        public const string LeaveBalance_Read = "LeaveBalance.Read";
        public const string LeaveBalance_Create = "LeaveBalance.Create";
        public const string LeaveBalance_Update = "LeaveBalance.Update";
        public const string LeaveBalance_Delete = "LeaveBalance.Delete";

        // RBAC management
        public const string AppUser_Read = "AppUser.Read";
        public const string AppRole_Read = "AppRole.Read";
        public const string AppUser_Create = "AppUser.Create";
        public const string AppRole_Create = "AppRole.Create";
        public const string AppUser_Update = "AppUser.Update";
        public const string AppRole_Update = "AppRole.Update";
        public const string AppUser_Delete = "AppUser.Delete";
        public const string AppRole_Delete = "AppRole.Delete";
        public const string AppRole_AssignPermissions = "AppRole.AssignPermissions";

    }
}
