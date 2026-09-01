import SignInForm from "@/components/auth/SignInForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Sign in | CareFlow",
  description: "Sign in to your CareFlow clinic workspace.",
};

export default function SignIn() {
  return <SignInForm />;
}
