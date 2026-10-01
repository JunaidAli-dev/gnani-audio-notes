import { NextRequest, NextResponse } from 'next/server';

async function handleProxy(
  req: NextRequest,
  { params }: { params: Promise<{ path: string[] }> | { path: string[] } }
) {
  const backendUrl = process.env.BACKEND_URL;

  if (!backendUrl) {
    return NextResponse.json(
      { error: 'BACKEND_URL environment variable is not configured on the server.' },
      { status: 500 }
    );
  }

  const resolvedParams = await params;
  const subPath = resolvedParams.path.join('/');
  const searchParams = req.nextUrl.search;
  const targetUrl = `${backendUrl.replace(/\/$/, '')}/api/${subPath}${searchParams}`;

  // Forward request headers while stripping the browser host header
  const headers = new Headers(req.headers);
  headers.delete('host');

  try {
    const body = ['GET', 'HEAD'].includes(req.method) ? undefined : await req.blob();

    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body,
      cache: 'no-store',
    });

    const data = await response.arrayBuffer();

    return new NextResponse(data, {
      status: response.status,
      statusText: response.statusText,
      headers: response.headers,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Failed to proxy request to backend service.', detail: err.message },
      { status: 502 }
    );
  }
}

export const GET = handleProxy;
export const POST = handleProxy;
export const PUT = handleProxy;
export const DELETE = handleProxy;
export const PATCH = handleProxy;