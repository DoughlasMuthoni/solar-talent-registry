"use server";

import { redirect } from "next/navigation";
import { authConfigured, supabaseServer } from "./supabase";

export async function signOut() {
  if (authConfigured) {
    const supabase = await supabaseServer();
    await supabase.auth.signOut();
  }
  redirect("/login");
}
