"use client";

import { Suspense } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ClipboardCheckIcon, LayoutDashboardIcon, MessageSquareIcon, ScaleIcon, UsersIcon } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";

const NAV = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/candidates", label: "Candidates", icon: UsersIcon },
  { href: "/assessments", label: "Assessments", icon: ClipboardCheckIcon },
  { href: "/messages", label: "Messages", icon: MessageSquareIcon },
  { href: "/scoring-rules", label: "Scoring rules", icon: ScaleIcon },
] as const;

/** Reads the URL, so it must sit inside <Suspense> (Cache Components); the fallback renders the same links unhighlighted. */
function NavItems({ pathname }: { pathname: string | null }) {
  return NAV.map(({ href, label, icon: Icon }) => (
    <SidebarMenuItem key={href}>
      <SidebarMenuButton asChild isActive={pathname?.startsWith(href) ?? false} tooltip={label}>
        <Link href={href}>
          <Icon />
          <span>{label}</span>
        </Link>
      </SidebarMenuButton>
    </SidebarMenuItem>
  ));
}

function ActiveNavItems() {
  return <NavItems pathname={usePathname()} />;
}

/** `footer` is a server-rendered slot (signed-in admin + sign out). */
export function AppSidebar({ footer }: { footer?: React.ReactNode }) {
  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="gap-1 px-4 pt-5 pb-3 group-data-[collapsible=icon]:px-2">
        <Link href="/dashboard" aria-label="Waterlift Solar — dashboard" className="block">
          <Logo variant="wordmark" className="w-40 group-data-[collapsible=icon]:hidden" priority />
          <Logo variant="mark" className="hidden size-8 group-data-[collapsible=icon]:block" />
        </Link>
        <p className="text-muted-foreground text-[0.7rem] font-semibold tracking-widest uppercase group-data-[collapsible=icon]:hidden">
          Solar Talent Registry
        </p>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Recruitment</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <Suspense fallback={<NavItems pathname={null} />}>
                <ActiveNavItems />
              </Suspense>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="text-muted-foreground px-4 pb-4 text-xs group-data-[collapsible=icon]:hidden">{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
