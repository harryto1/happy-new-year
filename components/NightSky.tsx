"use client";

import Fireworks3D from "@/components/Fireworks3D";
import Countdown from "@/components/Countdown";

export default function NightSky() {
  return (
    <div className="fixed inset-0 bg-black">
      <Countdown />
      <Fireworks3D />
    </div>
  );
}
