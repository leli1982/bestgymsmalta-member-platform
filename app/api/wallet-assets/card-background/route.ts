export const dynamic = "force-dynamic";

const BUNDLED_ARTWORK = "/wallet/bgm-wallet-hero-v8.jpg?v=11";

export function GET(request: Request) {
  // Serve the approved bundled photograph through Vercel's static asset path.
  // The previous serverless fs read could leave the Member App with only its
  // dark fallback/overlay when the public file was not present in the function bundle.
  return Response.redirect(new URL(BUNDLED_ARTWORK, request.url), 307);
}
