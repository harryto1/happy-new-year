"use client";

import { useEffect, useState } from "react";

export default function Countdown() {
    const [timeLeft, setTimeLeft] = useState({
        days: 0,
        hours: 0,
        minutes: 0,
        seconds: 0,
    });

    const [isNewYear, setIsNewYear] = useState(false);
    const [flashColor, setFlashColor] = useState<"red" | "white">("white");

    useEffect(() => {
        const targetDate = new Date('2026-01-01T00:00:00');
        let hasTriggeredNewYear = false;

        const calculateTimeLeft = () => {
            const now = new Date();
            const difference = targetDate.getTime() - now.getTime();

            if (difference <= 1000 && !hasTriggeredNewYear) {
                hasTriggeredNewYear = true;
                setIsNewYear(true);

                try {
                    fetch('/api/happy-new-year', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                    });
                } catch (error) {
                    console.error('Error sending New Year notification:', error);
                }

                return {
                    days: 0,
                    hours: 0,
                    minutes: 0,
                    seconds: 0,
                };
            }

            return {
                days: Math.floor(difference / (1000 * 60 * 60 * 24)),
                hours: Math.floor((difference / (1000 * 60 * 60)) % 24),
                minutes: Math.floor((difference / 1000 / 60) % 60),
                seconds: Math.floor((difference / 1000) % 60),
            };
        };

        // Initial update
        setTimeLeft(calculateTimeLeft());

        // Update every second
        const countdownInterval = setInterval(() => {
            setTimeLeft(calculateTimeLeft());
        }, 1000);

        return () => {
            clearInterval(countdownInterval);
        };
    }, []);

    // Separate effect for flash management
    useEffect(() => {
        const totalSeconds = timeLeft.days * 86400 + timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds;
        
        let flashInterval: NodeJS.Timeout | null = null;

        if (totalSeconds <= 10 && totalSeconds > 0) {
            // Flash every 250ms (0.25 seconds)
            flashInterval = setInterval(() => {
                setFlashColor(prev => prev === "red" ? "white" : "red");
            }, 250);
        } else if (totalSeconds <= 15 && totalSeconds > 0) {
            // Flash every 500ms (0.5 seconds)
            flashInterval = setInterval(() => {
                setFlashColor(prev => prev === "red" ? "white" : "red");
            }, 500);
        } else if (totalSeconds <= 30 && totalSeconds > 0) {
            // Flash every 1000ms (1 second)
            flashInterval = setInterval(() => {
                setFlashColor(prev => prev === "red" ? "white" : "red");
            }, 1000);
        } else {
            // No flashing
            setFlashColor("white");
        }

        return () => {
            if (flashInterval) clearInterval(flashInterval);
        };
    }, [timeLeft]); // Re-run when timeLeft changes

    const totalSeconds = timeLeft.days * 86400 + timeLeft.hours * 3600 + timeLeft.minutes * 60 + timeLeft.seconds;
    const isFinalCountdown = totalSeconds > 0 && totalSeconds <= 60 && timeLeft.days === 0 && timeLeft.hours === 0 && timeLeft.minutes === 0;

    if (isNewYear) {
        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
                <h1 className="text-4xl md:text-6xl lg:text-8xl font-bold text-transparent bg-clip-text bg-linear-to-r from-yellow-400 via-pink-500 to-purple-600 animate-pulse text-center px-4">
                    🎉 Happy New Year {new Date().getFullYear()}! 🎉
                </h1>
            </div>
        );
    }

    if (isFinalCountdown) {
        const colorClass = flashColor === "red" 
            ? "from-red-500 to-red-300" 
            : "from-white to-blue-200";

        return (
            <div className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center">
                    <div className={`bg-white/10 backdrop-blur-md rounded-2xl md:rounded-3xl p-8 md:p-12 lg:p-16 border border-white/20 shadow-2xl transition-all duration-200`}>
                        <span className={`text-8xl md:text-[12rem] lg:text-[16rem] font-bold text-transparent bg-clip-text bg-linear-to-br ${colorClass} drop-shadow-2xl`}>
                            {String(timeLeft.seconds).padStart(2, "0")}
                        </span>
                    </div>
                    <span className="text-2xl md:text-4xl lg:text-5xl text-white/80 mt-6 font-medium uppercase tracking-wider drop-shadow-lg">
                        Seconds
                    </span>
                </div>
            </div>
        );
    }

    return (
        <div className="fixed top-0 left-0 right-0 z-50 flex flex-col items-center justify-center pt-8 md:pt-12 pointer-events-none">
            <h2 className="text-2xl md:text-3xl lg:text-4xl font-semibold text-white/90 mb-4 md:mb-6 drop-shadow-lg">
                2026
            </h2>
            
            <div className="flex gap-3 md:gap-6 lg:gap-8">
                {timeLeft.days > 0 ? (
                    <>
                        <TimeUnit value={timeLeft.days} label="Days" />
                        <TimeUnit value={timeLeft.hours} label="Hours" />
                        <TimeUnit value={timeLeft.minutes} label="Minutes" />
                        <TimeUnit value={timeLeft.seconds} label="Seconds" />
                    </>
                ) : timeLeft.hours > 0 ? (
                    <>
                        <TimeUnit value={timeLeft.hours} label="Hours" />
                        <TimeUnit value={timeLeft.minutes} label="Minutes" />
                        <TimeUnit value={timeLeft.seconds} label="Seconds" />
                    </>
                ) : timeLeft.minutes > 0 ? (
                    <>
                        <TimeUnit value={timeLeft.minutes} label="Minutes" />
                        <TimeUnit value={timeLeft.seconds} label="Seconds" />
                    </>
                ) : (
                    <TimeUnit value={timeLeft.seconds} label="Seconds" />
                )}
            </div>
        </div>
    );
}

function TimeUnit({ value, label }: { value: number; label: string }) {
    return (
        <div className="flex flex-col items-center">
            <div className="bg-white/10 backdrop-blur-md rounded-lg p-2 md:p-3 min-w-12 md:min-w-16 border border-white/20 shadow-2xl">
                <span className="text-2xl md:text-4xl font-bold text-transparent bg-clip-text bg-linear-to-br from-white to-blue-200 drop-shadow-lg">
                    {String(value).padStart(2, "0")}
                </span>
            </div>
            <span className="text-xs md:text-sm text-white/80 mt-1 font-medium uppercase tracking-wider drop-shadow">
                {label}
            </span>
        </div>
    );
}