import { NextRequest, NextResponse } from 'next/server';
import { auth, currentUser } from '@clerk/nextjs/server';
import { createCheckoutSession, getClientIP } from '@/lib/payments';

export async function POST(req: NextRequest) {
  try {
    const { userId } = await auth();
    if (!userId) {
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const user = await currentUser();
    const email = user?.emailAddresses[0]?.emailAddress;

    const ip = getClientIP(req.headers);
    const checkoutSession = await createCheckoutSession(userId, ip, email);

    return NextResponse.json(checkoutSession);
  } catch (error: any) {
    console.error('API checkout session creation error:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
