namespace IzinYonetimi.Entities
{
    public enum LeaveRequestStatus
    {
        Draft = 0,
        PendingHRApproval = 1,
        PendingManagerApproval = 2,
        Approved = 3,
        Revision = 4,
        Cancelled = 5,
    }
}