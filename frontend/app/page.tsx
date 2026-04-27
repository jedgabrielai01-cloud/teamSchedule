"use client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function Root() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.replace("/login");
    } else {
      const username = localStorage.getItem("username");
      router.replace(username === "Admin" ? "/admin" : "/calendar");
    }
  }, [router]);
  return null;
}
