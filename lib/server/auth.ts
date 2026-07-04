import { getServerSession, type NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import CredentialsProvider from "next-auth/providers/credentials";
import { normalizeEmail } from "@/lib/server/finz-password";
import { verifyPasswordCredential } from "@/lib/server/finz-account-store";

export const authOptions: NextAuthOptions = {
  secret: process.env.AUTH_SECRET,
  session: {
    strategy: "jwt",
  },
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
    }),
    // 이메일/비밀번호 로그인. 회원가입(자격증명 생성)은 /api/finz/auth/password/register 가 먼저 처리하고,
    // 여기 authorize 는 로그인 검증만 한다. Google 과 동일하게 "인증"만 — 계정/핸들은 온보딩에서 생성.
    CredentialsProvider({
      id: "password",
      name: "이메일",
      credentials: {
        email: { label: "이메일", type: "email" },
        password: { label: "비밀번호", type: "password" },
      },
      async authorize(credentials) {
        const email = normalizeEmail(credentials?.email);
        const password = typeof credentials?.password === "string" ? credentials.password : "";
        if (!email || !password) return null;
        const ok = await verifyPasswordCredential(email, password);
        if (!ok) return null;
        // id = provider_id(= 정규화 이메일). NextAuth 가 token.sub 로 싣고 resolveAuth 가 authlink 조회에 쓴다.
        return { id: email, email, name: email };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account }) {
      // account 는 로그인 시점에만 존재 — 어떤 provider 로 들어왔는지 토큰에 박아둔다(이후 요청은 JWT 로 유지).
      if (account?.provider) token.provider = account.provider;
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.provider = typeof token.provider === "string" ? token.provider : undefined;
      }
      return session;
    },
  },
};

export async function getCurrentUser() {
  const session = await getServerSession(authOptions);
  const sessionUser = session?.user;
  const email = sessionUser?.email;
  if (!email) return null;

  return {
    id: sessionUser.id,
    email,
    name: sessionUser.name ?? null,
    image: sessionUser.image ?? null,
    // 인증 제공자(google | password). resolveAuth 가 provider-agnostic authlink 조회에 쓴다.
    provider: sessionUser.provider ?? "google",
  };
}
