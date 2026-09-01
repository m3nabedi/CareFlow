import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create clinic account | CareFlow",
  description: "Create a CareFlow clinic workspace.",
};

export default function SignUp() {
  return <SignUpForm />;
}
