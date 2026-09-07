# Roles, Admins and Owner

## Owner

Exactly one Owner.

Owner permissions:

- everything Admin can do
- view Admin accounts
- promote approved User -> Admin
- demote Admin -> User
- suspend/reactivate Admin
- delete Admin
- view full account audit
- see who approved/denied/suspended/deleted whom

Owner must not be deletable or suspendable through normal Control Center actions.

## Admin

Maximum:

```text
3 Admins
```

Owner is separate and does not consume an Admin slot.

Admin permissions:

- see all registered profiles
- see verified/unverified state
- see pending users
- approve a verified pending normal User
- ignore a pending user
- deny a pending normal User
- suspend an approved normal User
- reactivate a suspended normal User
- resend verification to an unverified normal User
- hard-delete a normal User

Admin cannot:

- promote Admins
- demote Admins
- suspend/delete Owner
- manage another Admin

## User

Normal learner.

May access learning features only when:

```text
status = approved
```

Email must already be verified because approval enforces verification.

## Admin limit enforcement

Do not only disable the Promote button in Angular.

The database must transactionally enforce the maximum.

Recommended:

```text
Owner + 0..3 Admins
```

When 3 Admins already exist:

```text
Promote to Admin -> database rejects
```

This prevents simultaneous requests from exceeding the limit.

## Who approved or denied?

`profiles` should contain the current decision metadata:

```text
status_changed_by
status_changed_at
status_reason
```

Owner's audit page shows full history from `account_audit_log`.

Example:

```text
06 Sep 2026 18:42
Admin: Priya
Action: Approve
User: Kumar

06 Sep 2026 18:50
Admin: Ravi
Action: Suspend
User: Arun
Reason: Account review required
```
