import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
});

const rateLimitMap = new Map<string, number[]>(); 

setInterval(() => {
    const now = Date.now();
    for (const [clientId, timestamps] of rateLimitMap.entries()) {
        const filtered = timestamps.filter(t => now - t < 1000);
        if (filtered.length === 0) {
            rateLimitMap.delete(clientId);
        } else {
            rateLimitMap.set(clientId, filtered);
        }
    }
}, 1 * 60 * 1000);

export async function POST(request: NextRequest) {
    try {
        const { x, y, clientId, color, latitude, longitude } = await request.json();

        const now = Date.now();

        if (!rateLimitMap.has(clientId)) {
            rateLimitMap.set(clientId, []);
        }

        const timestamps = rateLimitMap.get(clientId)!;

        const recentTimestamps = timestamps.filter(t => now - t < 1000);

        if (recentTimestamps.length >= 5) {
            return NextResponse.json({ error: 'Rate limit exceeded. Maximum 5 fireworks per second.' }, { status: 429 });
        }

        recentTimestamps.push(now);
        rateLimitMap.set(clientId, recentTimestamps);

        const channel = process.env.NODE_ENV === 'production'
            ? 'fireworks-channel-production'
            : 'fireworks-channel-development';

        await pusher.trigger(channel, 'new-firework', {
            x,
            y,
            clientId,
            color,
            latitude,
            longitude
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Pusher error: ', error);
        return NextResponse.json({ error: 'Failed to trigger event' }, { status: 500 });
    }
}