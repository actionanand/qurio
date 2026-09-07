# Admin Control Center

## Access

```text
/control-center
```

Visible only to:

```text
approved owner
approved admin
```

## Dashboard cards

Recommended:

```text
Pending
Unverified
Approved
Suspended
Denied
Admins
```

`Admins` card can be visible only to Owner.

## Pending / Unverified table

Columns:

```text
Name
Email
Verified?
Registered at
Status
Actions
```

### Unverified pending user

Actions:

```text
Resend verification
Deny
Delete
```

Approve must be disabled.

Tooltip:

```text
Email must be verified before approval.
```

### Verified pending user

Actions:

```text
Approve
Deny
Delete
```

## Approved users

Actions:

```text
Suspend
Delete
```

Owner additionally sees:

```text
Promote to Admin
```

if fewer than 3 Admins exist.

## Suspended users

Actions:

```text
Reactivate
Delete
```

## Denied users

Actions:

```text
Delete
```

Do not offer Approve directly from `denied`.

If you later want reconsideration, add a dedicated Owner/Admin "Return to Pending" business action explicitly rather than silently changing semantics.

## Admin management — Owner only

```text
/control-center/admins
```

Show:

```text
Admin name
Email
Since
Promoted by
Status
```

Actions:

```text
Demote
Suspend
Delete
```

## Audit — Owner only

```text
/control-center/audit
```

Filters:

```text
Action
Actor
Target
Date range
```

Audit entries:

```text
Approve
Deny
Suspend
Reactivate
Resend verification
Promote
Demote
Delete
```

## Confirmation dialogs

Require confirmation for destructive/privileged actions.

Examples:

### Deny

Require reason.

### Suspend

Require reason.

### Delete

Strong confirmation:

```text
Delete Anand's account?

This removes the Auth account and learner progress.
The email will be allowed to register again.

[Cancel] [Delete account]
```
