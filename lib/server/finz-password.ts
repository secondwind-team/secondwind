// 서버 전용: 이메일/비밀번호 로그인의 비밀번호 해싱·검증 + 이메일/비밀번호 형식 검증.
// 새 패키지 없이 Node 내장 crypto 의 scrypt(메모리-하드 KDF)를 쓴다. 해시는 salt 와 함께 저장하고,
// 검증은 timingSafeEqual 로 타이밍 공격을 막는다. 평문 비밀번호는 어디에도 로그·저장하지 않는다.

import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (password: string, salt: Buffer, keylen: number) => Promise<Buffer>;

const KEY_LEN = 64;
const SALT_LEN = 16;

export const PASSWORD_MIN_LENGTH = 8;
export const PASSWORD_MAX_LENGTH = 100;
export const EMAIL_MAX_LENGTH = 254;

// 이메일: 소문자·trim 정규화(로그인 아이디 = provider_id 로 이 값을 쓴다).
export function normalizeEmail(raw: unknown): string {
  return typeof raw === "string" ? raw.trim().toLowerCase() : "";
}

// 형식만 확인(도메인 실재 검증은 안 함 — v0 는 이메일 발송 인프라 없어 '미검증 식별자'로 취급).
export function isValidEmail(email: string): boolean {
  if (email.length === 0 || email.length > EMAIL_MAX_LENGTH) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: unknown): password is string {
  return (
    typeof password === "string" &&
    password.length >= PASSWORD_MIN_LENGTH &&
    password.length <= PASSWORD_MAX_LENGTH
  );
}

// scrypt$<saltHex>$<hashHex> 포맷으로 저장.
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN);
  const derived = await scrypt(password, salt, KEY_LEN);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 3 || parts[0] !== "scrypt") return false;
  let salt: Buffer;
  let expected: Buffer;
  try {
    salt = Buffer.from(parts[1]!, "hex");
    expected = Buffer.from(parts[2]!, "hex");
  } catch {
    return false;
  }
  if (salt.length === 0 || expected.length === 0) return false;
  const derived = await scrypt(password, salt, expected.length);
  return derived.length === expected.length && timingSafeEqual(derived, expected);
}
