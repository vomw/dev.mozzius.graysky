import { redirect } from "next/navigation";

/**
 * The root route now redirects to the app.
 * The (app)/layout.tsx auth gate will show the login form if not authenticated.
 */
export default function RootPage() {
  redirect("/feeds");
}
