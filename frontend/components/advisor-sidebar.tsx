"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard,
  GraduationCap,
  Settings,
  LogOut,
  ChevronsUpDown,
  UserCircle,
} from "lucide-react";
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
  SidebarSeparator,
} from "@/components/ui/sidebar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { clearToken } from "@/lib/api";

const navGroups = [
  {
    label: "Overview",
    items: [{ title: "Dashboard", url: "/advisor", icon: LayoutDashboard }],
  },
  {
    label: "Workspace",
    items: [
      { title: "My Students", url: "/advisor/students", icon: GraduationCap },
      { title: "Settings", url: "/advisor/settings", icon: Settings },
    ],
  },
];

function isRouteActive(pathname: string, url: string) {
  if (url === "/advisor") return pathname === url;
  return pathname === url || pathname.startsWith(`${url}/`);
}

export function AdvisorSidebar() {
  const pathname = usePathname();
  const router = useRouter();

  function handleLogout() {
    clearToken();
    router.push("/login");
  }

  return (
    <Sidebar collapsible="icon" className="border-r">
      <SidebarHeader>
        <div className="flex items-center gap-2.5 px-2 py-2 transition-all duration-200 group-data-[collapsible=icon]:justify-center group-data-[collapsible=icon]:gap-0 group-data-[collapsible=icon]:px-0">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <GraduationCap className="h-4 w-4" />
          </div>
          <div className="flex flex-col overflow-hidden whitespace-nowrap transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
            <span className="truncate text-sm font-semibold leading-tight">
              Elios Academy
            </span>
            <span className="truncate text-xs text-muted-foreground">
              Advisor console
            </span>
          </div>
        </div>
      </SidebarHeader>

      <SidebarSeparator />

      <SidebarContent>
        {navGroups.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const active = isRouteActive(pathname, item.url);
                  return (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        render={<Link href={item.url} />}
                        isActive={active}
                        tooltip={item.title}
                        className="group/item relative overflow-hidden transition-colors duration-200"
                      >
                        <span
                          className={cn(
                            "absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-primary transition-all duration-300 ease-out",
                            active
                              ? "scale-y-100 opacity-100"
                              : "scale-y-0 opacity-0"
                          )}
                        />
                        <item.icon className="transition-transform duration-200 ease-out group-hover/item:translate-x-0.5" />
                        <span className="transition-transform duration-200 ease-out group-hover/item:translate-x-0.5">
                          {item.title}
                        </span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger
                render={
                  <SidebarMenuButton className="h-12 transition-colors duration-200 data-[state=open]:bg-sidebar-accent" />
                }
              >
                <Avatar className="h-7 w-7 shrink-0 rounded-md">
                  <AvatarFallback className="rounded-md bg-primary/10 text-xs font-medium text-primary">
                    AV
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col overflow-hidden whitespace-nowrap text-left transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0">
                  <span className="truncate text-sm font-medium leading-tight">
                    Advisor
                  </span>
                  <span className="truncate text-xs text-muted-foreground">
                    advisor@elios-academy.com
                  </span>
                </div>
                <ChevronsUpDown className="ml-auto h-4 w-4 shrink-0 text-muted-foreground transition-all duration-200 group-data-[collapsible=icon]:w-0 group-data-[collapsible=icon]:opacity-0" />
              </DropdownMenuTrigger>
              <DropdownMenuContent side="right" align="end" className="w-56">
                <DropdownMenuItem
                  render={
                    <Link href="/advisor/settings" className="cursor-pointer" />
                  }
                >
                  <UserCircle className="mr-2 h-4 w-4" />
                  Account settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleLogout}
                  className="cursor-pointer text-destructive focus:text-destructive"
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  Log out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}