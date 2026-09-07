# Testing Checklist

## Email verification

- [ ] Register a new user.
- [ ] Profile appears immediately as `pending`.
- [ ] `email_verified_at` is null.
- [ ] Admin can see the user under Unverified.
- [ ] Approve action is disabled in UI.
- [ ] Direct approve RPC also fails.
- [ ] User receives email through Resend.
- [ ] Click verification link.
- [ ] `profiles.email_verified_at` updates.
- [ ] Admin now sees Verified.
- [ ] Approve succeeds.

## Resend

- [ ] User can self-resend confirmation.
- [ ] Admin can resend for an unverified pending user.
- [ ] Owner can resend.
- [ ] Normal user cannot invoke Admin resend.
- [ ] Resend creates audit record.
- [ ] Resend on already verified user is rejected/no-op.

## Approval

- [ ] Verified pending user can be approved.
- [ ] Unverified pending user cannot.
- [ ] Ignored user stays pending.
- [ ] Denied user cannot access learner data.
- [ ] Denied email cannot create a second account.

## Suspension

- [ ] Admin can suspend normal approved user.
- [ ] Suspended user immediately loses DB access.
- [ ] Admin can reactivate normal user.
- [ ] Admin cannot suspend Admin or Owner.
- [ ] Owner can suspend Admin.
- [ ] Owner cannot be suspended from Control Center.

## Roles

- [ ] Owner can promote approved user.
- [ ] Admin cannot promote.
- [ ] Three Admins are allowed.
- [ ] Fourth Admin promotion is rejected by DB.
- [ ] Owner can demote Admin.
- [ ] Only one Owner exists.

## Delete

- [ ] Admin can hard-delete normal user.
- [ ] Admin cannot delete Admin/Owner.
- [ ] Owner can delete Admin.
- [ ] Owner cannot be deleted.
- [ ] Learning state is removed.
- [ ] Audit deletion record remains.
- [ ] Deleted email can sign up again.

## Learner state

- [ ] Study completion syncs.
- [ ] Language change does not duplicate study identity.
- [ ] Multiple quiz attempts are retained.
- [ ] Wrong-question history is correct.
- [ ] Exam-plan task state syncs.
