import Link from "next/link";
import { LogOutIcon, ShieldCheckIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { signOut } from "@/lib/auth/actions";
import { getAdmin } from "@/lib/auth/session";

/** Signed-in admin + sign out, for the sidebar footer. Reads cookies, so render inside <Suspense>. */
export async function AdminUser() {
  const admin = await getAdmin();
  if (!admin) return null;
  return (
    <div className="flex flex-col gap-2">
      {admin.devBypass && (
        <p className="bg-warning-soft text-warning rounded-md px-2 py-1 text-[0.7rem] font-semibold">
          Development admin — Supabase sign-in not configured
        </p>
      )}
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-foreground truncate text-sm font-medium">{admin.name}</p>
          <p className="truncate text-xs">{admin.email}</p>
          <Link href="/account/security" className="hover:text-foreground mt-0.5 inline-flex items-center gap-1 text-xs underline-offset-2 hover:underline">
            <ShieldCheckIcon className="size-3" /> Two-factor
          </Link>
        </div>
        <form action={signOut}>
          <Button type="submit" variant="ghost" size="icon" aria-label="Sign out" title="Sign out">
            <LogOutIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}
