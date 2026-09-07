# Account Lifecycle

## Roles

```text
owner
admin
user
```

Rules:

- Exactly one `owner`.
- Up to three `admin` accounts in addition to the Owner.
- All new registrations start as `user`.
- Only Owner can promote an approved user to Admin.
- Only Owner can demote an Admin.
- Admin cannot manage Owner.
- Admin cannot promote users.

## Statuses

```text
pending
approved
denied
suspended
```

Email verification is a separate property:

```text
email_verified_at = null        -> Unverified
email_verified_at != null       -> Verified
```

Do not add `verified` as an account status.

## Signup state

Immediately after signup:

```text
role               user
status             pending
email_verified_at  null
```

Admin and Owner can already see this row.

## Verification state

After the user clicks the verification email:

```text
role               user
status             pending
email_verified_at  2026-...
```

The user is verified, but not approved.

## Approval

Approval is permitted only when:

```text
status = pending
AND
email_verified_at IS NOT NULL
```

Result:

```text
status = approved
```

## Ignore

"Ignore" performs no database mutation.

The account stays:

```text
pending
```

This is useful when Admin wants to review later.

## Deny

Admin/Owner may deny a pending account.

```text
status = denied
```

The Auth user is NOT deleted.

Therefore the same email remains registered and cannot create another fresh Qurio account.

## Suspend

Only an approved account can be suspended.

```text
approved -> suspended
```

The account and learner state remain in the database.

Reactivate:

```text
suspended -> approved
```

## Delete

Delete is intentionally different from Deny/Suspend.

Hard delete:

```text
auth.users row removed
        |
        +-- profile deleted
        +-- settings deleted
        +-- study state deleted
        +-- quiz state deleted
        +-- exam progress deleted

audit history remains
```

Only after hard deletion may the same email sign up again.

## State diagram

```text
                SIGN UP
                   |
                   v
        +---------------------+
        | pending/unverified  |
        +---------------------+
                   |
           verify email
                   |
                   v
        +---------------------+
        | pending/verified    |
        +---------------------+
          |        |       |
       approve    deny   ignore
          |        |       |
          v        v       +---- stays pending
      approved   denied
          |
       suspend
          |
          v
      suspended
          |
      reactivate
          |
          v
      approved

Any manageable non-owner account
          |
       DELETE
          |
          v
     Auth user gone
          |
          v
 same email may sign up again
```
