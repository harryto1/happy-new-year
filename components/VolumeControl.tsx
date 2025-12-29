"use client";

import { useState, useEffect } from "react";
import { Volume2, VolumeX } from "lucide-react";

export default function VolumeControl() {
    const [volume, setVolume] = useState(70);
    const [isMuted, setIsMuted] = useState(false);
    const [previousVolume, setPreviousVolume] = useState(70);
    const [isActive, setIsActive] = useState(false);

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

    useEffect(() => {
        setIsActive(true);
        const timer = setTimeout(() => {
            setIsActive(false);
        }, 3000);

        return () => clearTimeout(timer);
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

    // Prevent click events from propagating to underlying elements
    const handleClick = (e: React.MouseEvent) => {
        e.stopPropagation();
    }

    const handleInteraction = () => {
        setIsActive(true);
    }

    return (
        <div 
            className={`fixed bottom-4 right-4 z-50 flex items-center gap-2 bg-white/10 backdrop-blur-md rounded-full px-3 py-2 border border-white/20 shadow-2xl pointer-events-auto transition-opacity duration-500 ${
                isActive ? 'opacity-100' : 'opacity-30'
            }`}
            onClick={handleClick}
            onMouseEnter={handleInteraction}
            onMouseMove={handleInteraction}
        >
            <button
                onClick={toggleMute}
                className="text-white hover:text-white/80 transition-colors focus:outline-none"
                aria-label={isMuted ? "Unmute" : "Mute"}
            >
                {isMuted || volume === 0 ? (
                    <VolumeX className="w-5 h-5" />
                ) : (
                    <Volume2 className="w-5 h-5" />
                )}
            </button>
            
            <input
                type="range"
                min="0"
                max="100"
                value={volume}
                onChange={handleVolumeChange}
                onInput={handleInteraction}
                className="w-20 h-1.5 bg-white/20 rounded-lg appearance-none cursor-pointer slider"
                style={{
                    background: `linear-gradient(to right, #ffffff ${volume}%, rgba(255, 255, 255, 0.2) ${volume}%)`,
                }}
            />

            <style jsx>{`
                .slider::-webkit-slider-thumb {
                    -webkit-appearance: none;
                    appearance: none;
                    width: 14px;
                    height: 14px;
                    background: white;
                    border-radius: 50%;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0, 0, 0, 0.3);
                }
                
                .slider::-moz-range-thumb {
                    width: 14px;
                    height: 14px;
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