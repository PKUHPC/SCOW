"use client";
import { useRouter } from "next/navigation";

export default async function Home() {
  const router = useRouter();

  router.push("/extensions/notification", { scroll: false });
  return <div>redirecting</div>;
}
