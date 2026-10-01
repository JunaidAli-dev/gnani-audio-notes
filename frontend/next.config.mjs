/** @type {import('next').NextConfig} */
const nextConfig = {
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        // This silently forwards all frontend /api/ requests to your FastAPI backend
        destination: 'http://127.0.0.1:8000/api/:path*', 
      },
    ];
  },
};

export default nextConfig;