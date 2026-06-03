import NextAuth from "next-auth"
import Google from "next-auth/providers/google"

import { prisma } from "@/backend/db/prisma"

export const {
  handlers,
  signIn,
  signOut,
  auth
} = NextAuth({

  providers: [
    Google({
      clientId:
        process.env.GOOGLE_CLIENT_ID!,
      clientSecret:
        process.env.GOOGLE_CLIENT_SECRET!
    })
  ],

  pages: {
    signIn: "/auth"
  },

  callbacks: {

    async signIn({ user, account }) {

      if (
        account?.provider === "google"
      ) {

        const existingUser =
          await prisma.user.findUnique({
            where: {
              email: user.email!
            }
          })

        if (!existingUser) {

          await prisma.user.create({
            data: {
              name:
                user.name ?? "",

              email:
                user.email!,

              image:
                user.image,

              provider:
                "google",

              providerId:
                account.providerAccountId
            }
          })

          console.log(
            "GOOGLE USER CREATED"
          )

        }

      }

      return true
    },

    async redirect() {
      return "/dashboard"
    }

  }

})