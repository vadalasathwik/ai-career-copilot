import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

import { prisma } from "@/backend/db/prisma"

export const {
  handlers,
  signIn,
  signOut,
  auth
} = NextAuth({
  secret: process.env.AUTH_SECRET || process.env.JWT_SECRET,
  providers: [
    Google({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? ""
    })
  ],

  pages: {
    signIn: "/auth"
  },

  callbacks: {
    async signIn({ user, account }) {
      if (account?.provider === "google" && user.email) {
        const existingUser = await prisma.user.findUnique({
          where: {
            email: user.email
          }
        })

        if (!existingUser) {
          await prisma.user.create({
            data: {
              name: user.name ?? "",
              email: user.email,
              image: user.image ?? null,
              provider: "google",
              providerId: account.providerAccountId
            }
          })
        } else {
          // Safe account linking: preserve existing password if local, update providerId / image if absent
          const updateData: { providerId?: string; image?: string } = {}
          if (!existingUser.providerId && account.providerAccountId) {
            updateData.providerId = account.providerAccountId
          }
          if (!existingUser.image && user.image) {
            updateData.image = user.image
          }
          if (Object.keys(updateData).length > 0) {
            await prisma.user.update({
              where: { id: existingUser.id },
              data: updateData
            })
          }
        }
      }

      return true
    },

    async jwt({ token, user }) {
      const email = user?.email || token.email
      if (email && !token.userId) {
        try {
          const dbUser = await prisma.user.findUnique({
            where: { email }
          })
          if (dbUser) {
            token.userId = dbUser.id
          }
        } catch {
          // Ignore lookup errors in JWT callback to avoid crashing
        }
      }
      return token
    },

    async session({ session, token }) {
      if (session.user && token?.userId) {
        session.user.id = String(token.userId)
        ;(session.user as { dbId?: number }).dbId = Number(token.userId)
      }
      return session
    },

    async redirect({ url, baseUrl }) {
      if (url.startsWith("/")) {
        return `${baseUrl}${url}`
      } else if (new URL(url).origin === baseUrl) {
        return url
      }
      return `${baseUrl}/dashboard`
    }
  }
})
