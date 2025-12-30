"use client";

import Fireworks3D from "@/components/Fireworks3D";
import Countdown from "@/components/Countdown";
import VolumeControl from "./VolumeControl";
import Terms from "./Terms";

export default function NightSky() {
  return (
    <div className="fixed inset-0 bg-black">
      <Countdown />
      <Fireworks3D />
      <VolumeControl />
      <Terms />
    </div>
  );
}
