import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  updateDoc,
} from 'firebase/firestore';
import {
  createProvisionedAuthUser,
  db,
  handleFirestoreError,
  normalizeIssuedAccountIdentifier,
  OperationType,
} from '../firebase';
import { IssuedAccount, IssuedAccountRole } from '../types/quiz';

function sanitizeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '-').slice(0, 128);
}

function toIsoString(val: unknown): string {
  if (val instanceof Timestamp) {
    return val.toDate().toISOString();
  }
  if (typeof val === 'string' && val.trim()) {
    return val;
  }
  return new Date().toISOString();
}

function mapDocToIssuedAccount(data: Record<string, unknown>, fallbackId: string): IssuedAccount {
  const role: IssuedAccountRole =
    data.role === 'admin' ? 'admin' : data.role === 'teacher' ? 'teacher' : 'student';
  return {
    uid: typeof data.uid === 'string' ? data.uid : fallbackId,
    username: typeof data.username === 'string' ? data.username : '',
    email: typeof data.email === 'string' ? data.email : '',
    displayName: typeof data.displayName === 'string' ? data.displayName : 'Người dùng',
    role,
    studentClass: typeof data.studentClass === 'string' ? data.studentClass : '',
    active: data.active !== false,
    createdByUid: typeof data.createdByUid === 'string' ? data.createdByUid : '',
    createdAt: toIsoString(data.createdAt),
    updatedAt: toIsoString(data.updatedAt),
  };
}

export async function fetchIssuedAccountProfile(uid: string): Promise<IssuedAccount | null> {
  const safeUid = sanitizeId(uid);
  if (!safeUid) return null;
  const path = `issuedAccounts/${safeUid}`;
  try {
    const snap = await getDoc(doc(db, 'issuedAccounts', safeUid));
    if (!snap.exists()) return null;
    return mapDocToIssuedAccount(snap.data() as Record<string, unknown>, safeUid);
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, path);
  }
}

export function subscribeIssuedAccounts(
  onData: (accounts: IssuedAccount[]) => void,
  onError: (err: Error) => void
): () => void {
  const path = 'issuedAccounts';
  const q = query(collection(db, path), orderBy('createdAt', 'desc'), limit(200));
  return onSnapshot(
    q,
    (snapshot) => {
      const list = snapshot.docs.map((d) =>
        mapDocToIssuedAccount(d.data() as Record<string, unknown>, d.id)
      );
      onData(list);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, path);
      } catch (wrapped) {
        onError(wrapped instanceof Error ? wrapped : new Error(String(wrapped)));
      }
    }
  );
}

export interface CreateIssuedAccountInput {
  identifier: string;
  password: string;
  displayName: string;
  role: IssuedAccountRole;
  studentClass: string;
  adminUid: string;
}

export async function createIssuedAccount(
  input: CreateIssuedAccountInput
): Promise<IssuedAccount> {
  const { username, email } = normalizeIssuedAccountIdentifier(input.identifier);
  const safeDisplayName = input.displayName.trim().slice(0, 100);
  const safeClass =
    input.role === 'student' ? input.studentClass.trim().slice(0, 30) : '';
  const safeAdminUid = sanitizeId(input.adminUid);

  if (!username || username.length < 2 || username.length > 150) {
    throw new Error('Tên đăng nhập phải có từ 2 ký tự trở lên.');
  }
  if (!email || email.length < 5 || email.length > 150 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Tên đăng nhập hoặc email không hợp lệ (không chứa khoảng trắng hoặc ký tự đặc biệt).');
  }
  if (input.password.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }
  if (!safeDisplayName) {
    throw new Error('Vui lòng nhập Họ và tên người dùng.');
  }
  if (input.role === 'student' && !safeClass) {
    throw new Error('Vui lòng nhập Lớp cho tài khoản học sinh.');
  }

  const uid = await createProvisionedAuthUser(email, input.password, safeDisplayName);
  const safeUid = sanitizeId(uid);

  const accountPayload = {
    uid: safeUid,
    username,
    email,
    displayName: safeDisplayName,
    role: input.role,
    studentClass: safeClass,
    active: true,
    createdByUid: safeAdminUid,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  const accountPath = `issuedAccounts/${safeUid}`;
  try {
    await setDoc(doc(db, 'issuedAccounts', safeUid), accountPayload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, accountPath);
  }

  if (input.role === 'teacher' || input.role === 'admin') {
    const adminPath = `admins/${safeUid}`;
    try {
      await setDoc(doc(db, 'admins', safeUid), {
        uid: safeUid,
        email,
        displayName: safeDisplayName,
        createdAt: serverTimestamp(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, adminPath);
    }
  }

  const nowIso = new Date().toISOString();
  return {
    uid: safeUid,
    username,
    email,
    displayName: safeDisplayName,
    role: input.role,
    studentClass: safeClass,
    active: true,
    createdByUid: safeAdminUid,
    createdAt: nowIso,
    updatedAt: nowIso,
  };
}

export async function setIssuedAccountActive(
  account: IssuedAccount,
  active: boolean
): Promise<void> {
  const safeUid = sanitizeId(account.uid);
  const accountPath = `issuedAccounts/${safeUid}`;
  try {
    await updateDoc(doc(db, 'issuedAccounts', safeUid), {
      active,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, accountPath);
  }

  if (account.role === 'teacher' || account.role === 'admin') {
    const adminPath = `admins/${safeUid}`;
    try {
      if (active) {
        await setDoc(doc(db, 'admins', safeUid), {
          uid: safeUid,
          email: account.email,
          displayName: account.displayName,
          createdAt: serverTimestamp(),
        });
      } else {
        await deleteDoc(doc(db, 'admins', safeUid));
      }
    } catch (error) {
      handleFirestoreError(error, active ? OperationType.CREATE : OperationType.DELETE, adminPath);
    }
  }
}

export async function deleteIssuedAccountRecord(account: IssuedAccount): Promise<void> {
  const safeUid = sanitizeId(account.uid);
  if (account.role === 'teacher' || account.role === 'admin') {
    const adminPath = `admins/${safeUid}`;
    try {
      await deleteDoc(doc(db, 'admins', safeUid));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, adminPath);
    }
  }

  const accountPath = `issuedAccounts/${safeUid}`;
  try {
    await deleteDoc(doc(db, 'issuedAccounts', safeUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, accountPath);
  }
}
