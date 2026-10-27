// Auto-generated flow: LeaveRequest Approval Flow
// Auto-generated approval flow for LeaveRequest. Customize email templates and add conditions as needed.
// Resource: LeaveRequest
// Enabled: true
//
// Nodes:
  // trigger: On LeaveRequest Submit
  // condition: Status = PendingHRApproval?
  // approval: LeaveRequest Approval
  // action: Send Approval Email
  // trigger: On LeaveRequest Approved
  // action: Send Completion Email
//
// Edges:
  // On LeaveRequest Submit → Status = PendingHRApproval?
  // Status = PendingHRApproval? → LeaveRequest Approval (true)
  // LeaveRequest Approval → Send Approval Email
  // On LeaveRequest Approved → Send Completion Email
//
// This file is for documentation purposes.
// Flow execution is handled by FlowEngine.ts using flowDefinitions.json.

export const FLOW_LEAVEREQUEST_APPROVAL_FLOW_ID = 'flow-LeaveRequest-approval';
