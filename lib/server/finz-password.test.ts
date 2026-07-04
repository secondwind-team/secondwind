import { describe, expect, it } from "vitest";
import {
  hashPassword,
  verifyPassword,
  normalizeEmail,
  isValidEmail,
  isValidPassword,
} from "./finz-password";

describe("finz-password", () => {
  it("normalizeEmail: trim + 소문자", () => {
    expect(normalizeEmail("  Foo@Bar.COM ")).toBe("foo@bar.com");
    expect(normalizeEmail(123)).toBe("");
    expect(normalizeEmail(undefined)).toBe("");
  });

  it("isValidEmail", () => {
    expect(isValidEmail("a@b.com")).toBe(true);
    expect(isValidEmail("nope")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false); // TLD 없음
    expect(isValidEmail("a b@c.com")).toBe(false); // 공백
    expect(isValidEmail("")).toBe(false);
  });

  it("isValidPassword: 8~100자", () => {
    expect(isValidPassword("1234567")).toBe(false);
    expect(isValidPassword("12345678")).toBe(true);
    expect(isValidPassword("a".repeat(100))).toBe(true);
    expect(isValidPassword("a".repeat(101))).toBe(false);
    expect(isValidPassword(12345678)).toBe(false); // 문자열 아님
  });

  it("hashPassword/verifyPassword 왕복", async () => {
    const hash = await hashPassword("correct horse battery");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse battery", hash)).toBe(true);
    expect(await verifyPassword("wrong password", hash)).toBe(false);
  });

  it("형식이 깨진 해시는 false(크래시 없이)", async () => {
    expect(await verifyPassword("x", "garbage")).toBe(false);
    expect(await verifyPassword("x", "scrypt$only-two")).toBe(false);
    expect(await verifyPassword("x", "")).toBe(false);
  });

  it("같은 비번도 salt 로 매번 다른 해시", async () => {
    const a = await hashPassword("same-password");
    const b = await hashPassword("same-password");
    expect(a).not.toBe(b);
    expect(await verifyPassword("same-password", a)).toBe(true);
    expect(await verifyPassword("same-password", b)).toBe(true);
  });
});
