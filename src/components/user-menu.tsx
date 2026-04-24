"use client";

import { signOut } from "next-auth/react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LogOut } from "lucide-react";

export function UserMenu({
  name,
  image,
  role,
  subPlan,
}: {
  name: string;
  image: string | null;
  role: string;
  subPlan: string;
}) {
  const initials = name
    .split(/\s+/)
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 h-9">
          <Avatar className="h-7 w-7">
            {image ? <AvatarImage src={image} alt={name} /> : null}
            <AvatarFallback className="text-xs">
              {initials || "??"}
            </AvatarFallback>
          </Avatar>
          <span className="text-sm hidden sm:inline">{name}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="text-sm font-medium">{name}</span>
            <div className="flex items-center gap-2 mt-1">
              <Badge variant="outline" className="text-[10px] py-0 h-4">
                {subPlan}
              </Badge>
              {role !== "user" && (
                <Badge variant="secondary" className="text-[10px] py-0 h-4">
                  {role === "primary_admin" ? "admin" : role}
                </Badge>
              )}
            </div>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={() => signOut({ callbackUrl: "/login?loggedout=1" })}
        >
          <LogOut className="h-4 w-4" /> Log out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
