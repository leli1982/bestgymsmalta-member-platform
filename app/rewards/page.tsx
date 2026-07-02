import { redirect } from "next/navigation";

export default function DeprecatedFeatureRedirectPage() {
  redirect("/passport");
}
