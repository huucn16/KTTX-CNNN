# Security Specification — Nông Nghiệp Quiz

## 1. Data Invariants
1. A `Submission` record in `/submissions/{submissionId}` is write-once from students (`allow create` only) and strictly read/managed only by verified teachers (`isAdmin()`). Students can never read, list, update, or delete other students' submissions.
2. Every `Submission` must contain a valid `submissionId` matching `^[a-zA-Z0-9_\-]+$` (length <= 128), match `data.id == submissionId`, include all required fields and no ghost fields (`hasAll` + `hasOnly`), enforce bounded string lengths and array sizes, valid score bounds (`0 <= score10 <= 10`), and server-enforced timestamp (`createdAt == request.time`).
3. Teacher/Admin access requires `request.auth != null && request.auth.token.email_verified == true` and either the bootstrapped teacher email (`huucn16@gmail.com`) or an explicit document in `/admins/{request.auth.uid}`.
4. `/admins/{adminId}` documents are strictly private and readable/writable only by verified admins.
5. `/savedExams/{savedExamId}` documents contain archived student exam records and can only be read, created, or deleted by verified teachers (`isAdmin()`), with strict schema validation, immutable `savedByUid == request.auth.uid`, and server-enforced `savedAt == request.time`.

## 2. Adversarial "Dirty Dozen" Payloads (All Must Return PERMISSION_DENIED)
1. **Unauthenticated read of `/submissions`**: Anonymous user calls `getDocs(collection(db, 'submissions'))` -> DENIED.
2. **Non-admin verified user read of `/submissions`**: Random Google account (`student@gmail.com`) reads `/submissions` -> DENIED.
3. **Unverified email admin spoof**: User with `email: 'huucn16@gmail.com'` and `email_verified: false` reads `/submissions` -> DENIED.
4. **Ghost field injection on `/submissions` create**: Payload includes `isOfficialOverride: true` -> DENIED (`hasOnly` check).
5. **Score tampering above 10**: Payload sets `score10: 99` -> DENIED.
6. **Negative score / correctCount > totalCount**: Payload sets `score10: -2` or `correctCount: 50, totalCount: 10` -> DENIED.
7. **Forged `createdAt` timestamp**: Payload sends client `Date` instead of `request.time` -> DENIED.
8. **ID mismatch / ID poisoning**: Document path ID `../../../etc` or `data.id != submissionId` -> DENIED.
9. **Oversized `studentName` (>100 chars) / Denial-of-Wallet string**: 50KB `studentName` -> DENIED.
10. **Student update attempt on `/submissions/{id}`**: Student tries to modify `score10` after submit -> DENIED (`allow update: if false`).
11. **Student delete attempt on `/submissions/{id}`**: Student tries to delete submission -> DENIED (`isAdmin()` required).
12. **Privilege escalation on `/admins/{uid}` or `/savedExams/{id}`**: Non-admin user tries to create `/admins/{myUid}` or read/write `/savedExams/{id}`, or admin tries to forge `savedByUid` to another UID -> DENIED.
