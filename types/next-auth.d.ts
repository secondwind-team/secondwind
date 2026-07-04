import "next-auth";

declare module "next-auth" {
  interface User {
    id?: string;
  }

  interface Session {
    user?: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
      provider?: string; // "google" | "password" — 인증 제공자(provider-agnostic authlink 조회용)
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    provider?: string;
  }
}
