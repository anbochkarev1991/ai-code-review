import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-4">
      <h1 className="text-xl font-semibold">Authentication error</h1>
      <p className="text-center text-sm opacity-70">
        Something went wrong during sign in. Please try again.
      </p>
      <Link href="/" className="text-sm font-medium hover:underline">
        Return home
      </Link>
    </div>
  );
}
