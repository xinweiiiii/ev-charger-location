"use client";
import dynamic from "next/dynamic";

const EVChargerFinder = dynamic(() => import("@/components/ui/EVChargerFinder"), {
  ssr: false,
});

export default function Page() {
  return <EVChargerFinder />;
}