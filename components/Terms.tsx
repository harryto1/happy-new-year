"use client";

import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";

export default function Terms() {
    const [isOpen, setIsOpen] = useState(false);
    const [isActive, setIsActive] = useState(false);

    useEffect(() => {
        setIsActive(true);
        const timer = setTimeout(() => {
            setIsActive(false);
        }, 3000);

        return () => clearTimeout(timer);
    }, []);

    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    };

    const handleInteraction = () => {
        setIsActive(true);
    }

  return (
    <>
      {/* Info button */}
      <button
        onClick={(e) => {
          handleClick(e);
          setIsOpen(true);
        }}
        onMouseEnter={handleInteraction}
        onMouseMove={handleInteraction}
        className={`fixed bottom-4 left-4 z-50 p-2 bg-white/10 backdrop-blur-md rounded-full border border-white/20 shadow-2xl text-white hover:bg-white/20 transition-all duration-500 ${
            isActive ? 'opacity-100' : 'opacity-30'
        }`}
        aria-label="Terms and Privacy"
      >
        <Info className="w-5 h-5" />
      </button>

      {/* Modal */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center backdrop-blur-md bg-black/50"
          onClick={() => setIsOpen(false)}
        >
          <div
            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 max-w-md mx-4 shadow-2xl"
            onClick={handleClick}
          >
            <div className="flex items-start justify-between mb-4">
              <h2 className="text-xl font-semibold text-white">Location Usage</h2>
              <button
                onClick={() => setIsOpen(false)}
                className="text-white/70 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="w-6 h-6 cursor-pointer" />
              </button>
            </div>
            <p className="text-white/90 leading-relaxed">
              Your location is used solely to scale fireworks based on distance. 
              Fireworks from nearby users appear larger, while those from farther away appear smaller and more distant. 
              Your location data is not stored and is only used for this real-time visual effect.
            </p>
          </div>
        </div>
      )}
    </>
  );
}