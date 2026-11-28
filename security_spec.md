# Security Specification — GVBM: Trần Văn Hữu

## 1. Data Invariants
1. A `Submission` record in `/submissions/{submissionId}` is write-once from students (`allow create` only), readable/listable on the Bảng điểm view without login (contains only student name, class, quiz title, and score; no email/phone/UID PII), and strictly immutable (`allow update: if false`) with deletion restricted only to verified teachers (`isAdmin()`).
2. Every `Submission` must contain a valid `submissionId` matching `^[a-zA-Z0-9_\-]+$` (length <= 128), match `data.id == submissionId`, include all required fields and no ghost fields (`hasAll` + `hasOnly`), enforce bounded string lengths and array sizes, valid score bounds (`0 <= score10 <= 10`), and server-enforced timestamp (`createdAt == request.time`).
3. Teacher/Admin write/delete access (`/submissions` delete, `/savedExams` create/delete, `/examControl` write, `/admins` manage, `/issuedAccounts` list/create/update/delete) requires either the verified primary Google admin (`huucn16@gmail.com` with `email_verified == true`) or an explicit document in `/admins/{request.auth.uid}` provisioned by an admin.
4. `/admins/{adminId}` documents are strictly private and readable only by the matching user (`request.auth.uid == adminId`) or an admin, and writable/deletable only by an admin.
5. `/savedExams/{savedExamId}` documents contain archived student exam records readable in Bảng điểm without login, and can only be created or deleted by verified teachers (`isAdmin()`), with strict schema validation, immutable `savedByUid == request.auth.uid`, and server-enforced `savedAt == request.time`.
6. `/issuedAccounts/{accountId}` documents store non-secret account metadata (`uid`, `username`, `email`, `displayName`, `role`, `studentClass`, `active`, `createdByUid`, `createdAt`, `updatedAt`) and NEVER store passwords or secret credentials. `get` is restricted to the owning user (`request.auth.uid == accountId`) or `isAdmin()`; `list`, `create`, `update`, `delete` are strictly restricted to `isAdmin()`. `uid`, `username`, `email`, `createdByUid`, and `createdAt` are immutable on update, and only `['displayName', 'role', 'studentClass', 'active', 'updatedAt']` may change.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated delete of `/submissions/{id}`**: Anonymous user calls `deleteDoc(doc(db, 'submissions', id))` -> DENIED.
2. **Non-admin verified user delete of `/submissions/{id}`**: Random Google account or issued student account deletes `/submissions/{id}` -> DENIED.
3. **Unverified email admin spoof**: User with `email: 'huucn16@gmail.com'` and `email_verified: false` (and not in `/admins/{uid}`) deletes `/submissions/{id}` or writes `/examControl/global` -> DENIED.
4. **Ghost field injection on `/submissions` create**: Payload includes `isOfficialOverride: true` -> DENIED (`hasOnly` check).
5. **Score tampering above 10**: Payload sets `score10: 99` -> DENIED.
6. **Negative score / correctCount > totalCount**: Payload sets `score10: -2` or `correctCount: 50, totalCount: 10` -> DENIED.
7. **Forged `createdAt` timestamp**: Payload sends client `Date` instead of `request.time` -> DENIED.
8. **ID mismatch / ID poisoning**: Document path ID `../../../etc` or `data.id != submissionId` -> DENIED.
9. **Oversized `studentName` (>100 chars) / Denial-of-Wallet string**: 50KB `studentName` -> DENIED.
10. **Student update attempt on `/submissions/{id}`**: Student tries to modify `score10` after submit -> DENIED (`allow update: if false`).
11. **Non-admin reads or creates `/issuedAccounts/{otherUid}`**: Issued student tries to list `/issuedAccounts`, read another user's `/issuedAccounts/{otherUid}`, or self-promote `role: 'teacher'` -> DENIED.
12. **Privilege escalation on `/admins/{uid}` or `/savedExams/{id}`**: Non-admin user tries to create `/admins/{myUid}` or write `/savedExams/{id}`, or admin tries to forge `savedByUid` / `createdByUid` to another UID -> DENIED.
