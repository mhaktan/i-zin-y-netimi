using System.Collections.Generic;

namespace IzinYonetimi.Approvals
{
    public static class ApprovalDecisions
    {
        public static readonly Dictionary<string, string> RejectAction = new Dictionary<string, string>
        {
            ["LeaveRequest"] = "Revise",
        };
    }
}
