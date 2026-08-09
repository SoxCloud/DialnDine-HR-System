"use client";

import { logout } from "@/lib/auth";
import Button from "./Button";

export default function LogoutButton({ className = "" }: { className?: string }) {
  return (
    <Button variant="danger" onClick={logout} className={className}>
      Logout
    </Button>
  );
}