"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";

export default function VolumeControl() {
    const [volume, setVolume] = useState(70);
    const [isMuted, setIsMuted] = useState(false);
    const [previousVolume, setPreviousVolume] = useState(70);

    useEffect(() => {
        // Get saved volume from localStorage
        const savedVolume = localStorage.getItem("fireworks-volume");
        const savedMuted = localStorage.getItem("fireworks-muted");

        if (savedVolume) {
            setVolume(parseInt(savedVolume));
        }

        if (savedMuted) {
            setIsMuted(savedMuted === "true");
        }
    }, []);

    useEffect(() => {
        // Save volume to local storage
        localStorage.setItem("fireworks-volume", volume.toString());
        localStorage.setItem("fireworks-muted", isMuted.toString());
        
        // Update global volume
        const actualVolume = isMuted ? 0 : volume;
        if (typeof window !== "undefined" && (window as any).setMasterVolume) {
            (window as any).setMasterVolume(actualVolume / 100);
        }
    }, [volume, isMuted]);

    const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newVolume = parseInt(e.target.value);
        setVolume(newVolume);
        if (newVolume > 0 && isMuted) {
            setIsMuted(false);
        }
        if (newVolume === 0) {
            setIsMuted(true);
        }
    };

    const toggleMute = () => {
        if (isMuted) {
            setIsMuted(false);
            setVolume(previousVolume > 0 ? previousVolume : 70);
        } else {
            setPreviousVolume(volume);
            setIsMuted(true);
            setVolume(0);
        }
    };

    return (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 bg-white/10 backdrop-blur-md rounded-full px-4 py-3 border border-white/20 shadow-2xl">
            <button
                onClick={toggleMute}
                className="text-white hover:text-white/80 transition-colors focus:outline-none"
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted || volume === 0 ? (
                    <VolumeX className="w-6 h-6" />
                ) : (
                    <Volume2 className="w-6 h-6" />
                )}
            </button>
            
            <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                className="w-24 h-2 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                style={{
                    background: `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.2) ${volume}%)`,
                }}
            />

            <style jsx>{`
                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }
                
                .slider::-moz-range-thumb {
                    width: 16px;
                    height: 16px;
                    background: white;
                    border-radius: 50%;
                    cursor: pointer;
                    border: none;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }

                .slider::-webkit-slider-thumb:hover {
                    transform: scale(1.1);
                }

                .slider::-moz-range-thumb:hover {
                    transform: scale(1.1);
                }
            
            `}</style>
        </div>
    );

}