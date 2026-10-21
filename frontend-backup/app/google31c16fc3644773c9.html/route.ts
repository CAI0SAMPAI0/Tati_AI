export async function GET() {
  return new Response('google-site-verification: google31c16fc3644773c9.html', {
    status: 200,
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
