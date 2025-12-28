import { NextRequest, NextResponse } from 'next/server';
import Pusher from 'pusher';

const pusher = new Pusher({
    appId: process.env.PUSHER_APP_ID!,
    key: process.env.NEXT_PUBLIC_PUSHER_KEY!,
    secret: process.env.PUSHER_SECRET!,
    cluster: process.env.NEXT_PUBLIC_PUSHER_CLUSTER!,
    useTLS: true,
});

export async function POST(request: NextRequest) {
    try {
        const { x, y, clientId, color, latitude, longitude } = await request.json();

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