import { getApps, initializeApp } from 'firebase/app';
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getAuth,
  GoogleAuthProvider,
  linkWithCredential,
  reauthenticateWithPopup,
  signOut,
  updatePassword,
  updateProfile,
} from 'firebase/auth';
import { doc, getDocFromServer, getFirestore } from 'firebase/firestore';
import firebaseConfig from '../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

export const ISSUED_ACCOUNT_EMAIL_DOMAIN = 'account.tranvanhuu.edu.vn';

export function normalizeIssuedAccountIdentifier(rawInput: string): {
  username: string;
  email: string;
} {
  const cleaned = rawInput.trim().toLowerCase().replace(/\s+/g, '');
  if (!cleaned) {
    return { username: '', email: '' };
  }
  if (cleaned.includes('@')) {
    return { username: cleaned, email: cleaned };
  }
  return {
    username: cleaned,
    email: `${cleaned}@${ISSUED_ACCOUNT_EMAIL_DOMAIN}`,
  };
}

export async function createProvisionedAuthUser(
  email: string,
  password: string,
  displayName: string
): Promise<string> {
  const provisionerApp =
    getApps().find((item) => item.name === 'admin-provisioner') ??
    initializeApp(firebaseConfig, 'admin-provisioner');
  const provisionerAuth = getAuth(provisionerApp);
  try {
    const cred = await createUserWithEmailAndPassword(provisionerAuth, email, password);
    if (displayName.trim()) {
      await updateProfile(cred.user, { displayName: displayName.trim().slice(0, 100) });
    }
    return cred.user.uid;
  } finally {
    await signOut(provisionerAuth).catch(() => undefined);
  }
}

export async function setOrUpdateOwnPassword(newPassword: string): Promise<void> {
  const currentUser = auth.currentUser;
  if (!currentUser || !currentUser.email) {
    throw new Error('Bạn cần đăng nhập tài khoản trước khi thiết lập mật khẩu.');
  }
  if (newPassword.length < 6) {
    throw new Error('Mật khẩu phải có ít nhất 6 ký tự.');
  }

  const hasPasswordProvider = currentUser.providerData.some(
    (p) => p.providerId === 'password'
  );

  const applyPassword = async () => {
    if (hasPasswordProvider) {
      await updatePassword(currentUser, newPassword);
    } else {
      const cred = EmailAuthProvider.credential(currentUser.email!, newPassword);
      await linkWithCredential(currentUser, cred);
    }
  };

  try {
    await applyPassword();
  } catch (error) {
    const code =
      typeof error === 'object' && error !== null && 'code' in error
        ? String((error as { code?: unknown }).code || '')
        : '';
    if (code === 'auth/requires-recent-login') {
      await reauthenticateWithPopup(currentUser, googleProvider);
      await applyPassword();
      return;
    }
    throw error;
  }
}

export function mapAuthErrorToVietnamese(error: unknown): string {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String((error as { code?: unknown }).code || '')
      : '';

  switch (code) {
    case 'auth/operation-not-allowed':
      return 'Tính năng đăng nhập bằng Tài khoản/Mật khẩu chưa được bật trong Firebase Console (Authentication → Sign-in method → Email/Password).';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Tên đăng nhập hoặc mật khẩu không chính xác.';
    case 'auth/invalid-email':
      return 'Tên đăng nhập hoặc địa chỉ email không hợp lệ.';
    case 'auth/email-already-in-use':
      return 'Tên đăng nhập hoặc email này đã được cấp trước đó.';
    case 'auth/weak-password':
      return 'Mật khẩu phải có ít nhất 6 ký tự.';
    case 'auth/too-many-requests':
      return 'Thử đăng nhập quá nhiều lần. Vui lòng đợi ít phút rồi thử lại.';
    case 'auth/user-disabled':
      return 'Tài khoản này đã bị vô hiệu hóa.';
    case 'auth/network-request-failed':
      return 'Lỗi kết nối mạng. Vui lòng kiểm tra Internet và thử lại.';
    default:
      return error instanceof Error && error.message
        ? error.message
        : 'Không thể xác thực tài khoản. Vui lòng thử lại.';
  }
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(
  error: unknown,
  operationType: OperationType,
  path: string | null
): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo:
        auth.currentUser?.providerData?.map((provider) => ({
          providerId: provider.providerId,
          email: provider.email,
        })) || [],
    },
    operationType,
    path,
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

async function testConnection() {
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.error('Please check your Firebase configuration.');
    }
  }
}

void testConnection();
