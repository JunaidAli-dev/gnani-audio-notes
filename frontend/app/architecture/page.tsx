import Link from 'next/link';
import { ArrowLeft, Code, Database, Server, Cpu, HardDrive, ShieldCheck, Zap } from 'lucide-react';

export default function Architecture() {
  return (
    <main className="min-h-screen bg-[#f4f0ea] p-4 sm:p-10 font-sans text-gray-900 selection:bg-indigo-300">
      <div className="max-w-4xl mx-auto relative z-10">
        
        {/* Header & Navigation */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/" className="px-5 py-2 bg-white border-4 border-gray-900 rounded-xl shadow-[4px_4px_0px_0px_#111827] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#111827] transition-all font-black uppercase tracking-wider flex items-center gap-2">
            <ArrowLeft size={20} /> Back to App
          </Link>
          <a href="https://github.com/junaidali-dev/gnani-audio-notes" target="_blank" rel="noreferrer" className="px-5 py-2 bg-[#FFE66D] border-4 border-gray-900 rounded-xl shadow-[4px_4px_0px_0px_#111827] hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[6px_6px_0px_0px_#111827] transition-all font-black uppercase tracking-wider flex items-center gap-2">
            <Code size={20} /> GitHub Repo
          </a>
        </div>

        {/* Title Card */}
        <div className="bg-[#4ECDC4] border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827] mb-10">
          <h1 className="text-4xl font-black uppercase tracking-tighter mb-2">System Architecture</h1>
          <p className="font-bold text-gray-800 text-lg">
            How Textalize handles direct S3 uploads, asynchronous Gnani ASR, and multi-model LLM summarization.
          </p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          
          {/* Section 1: Presigned Direct S3 Upload */}
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Zap className="text-[#FF6B6B]" size={28} />
              <h2 className="text-2xl font-black uppercase">1. Direct-to-S3 Presigned Uploads</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed mb-4">
              To bypass Vercel's 4.5 MB serverless request body payload cap and avoid buffering heavy audio files in memory on Render, Textalize uses a <strong>Direct-to-S3 architecture</strong>:
            </p>
            <ol className="list-decimal list-inside font-medium text-gray-700 leading-relaxed space-y-2 pl-2">
              <li>The frontend requests a signed S3 upload URL from FastAPI via <code>POST /api/presigned-url</code>.</li>
              <li>The browser streams the raw audio binary directly into the Supabase S3 Storage bucket using an HTTP <code>PUT</code> request.</li>
              <li>Once uploaded, the frontend triggers <code>POST /api/start-job</code> with the S3 public URL, initiating asynchronous transcription without server memory bloat.</li>
            </ol>
          </section>

          {/* Section 2: Async Gnani Batch ASR */}
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="text-[#4F46E5]" size={28} />
              <h2 className="text-2xl font-black uppercase">2. Gnani Batch ASR Pipeline</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed mb-4">
              Standard REST ASR APIs restrict audio length to 60 seconds. Textalize utilizes the <strong>Gnani Batch ASR v3 API</strong> to process long recordings (up to 4 hours):
            </p>
            <p className="font-medium text-gray-700 leading-relaxed">
              The backend submits the S3 audio URL to Gnani and immediately returns a job ID with a <code>processing</code> status to PostgreSQL. The Next.js frontend polls the status endpoint every 3 seconds while showing an interactive progress state.
            </p>
          </section>

          {/* Section 3: Multi-Model LLM Fallback Chain */}
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <ShieldCheck className="text-[#A8E6CF]" size={28} />
              <h2 className="text-2xl font-black uppercase">3. Resilient Multi-Model LLM Summarization</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed mb-4">
              To guarantee high availability and prevent <code>429 RESOURCE_EXHAUSTED</code> quota failures on free tiers, the backend implements an <strong>asynchronous fallback chain</strong> across 7 active models:
            </p>
            <ul className="list-disc list-inside font-medium text-gray-700 leading-relaxed space-y-2 pl-2 mb-4">
              <li><code>gemini-3.5-flash-lite</code> (500 Requests/Day)</li>
              <li><code>gemini-3.1-flash-lite</code> (500 Requests/Day)</li>
              <li><code>gemma-4-26b</code> & <code>gemma-4-31b</code> (14,400 Requests/Day each)</li>
              <li><code>gemini-3.8-flash</code> & <code>gemini-3.5-flash</code> (20 Requests/Day preview tiers)</li>
            </ul>
            <p className="font-medium text-gray-700 leading-relaxed">
              If any model returns a 429 quota error or 404 deprecation notice, the async handler instantly skips to the next candidate model in milliseconds without sleeping or blocking the event loop.
            </p>
          </section>

          {/* Section 4: Hosting & Infrastructure */}
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Server className="text-[#FFE66D]" size={28} />
              <h2 className="text-2xl font-black uppercase">4. Hosting & Runtime Topology</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-medium text-gray-800">
              <div className="bg-gray-50 border-2 border-gray-900 p-4 rounded-xl">
                <span className="font-black block uppercase text-sm mb-1">Frontend</span>
                Next.js (App Router) deployed on Vercel with runtime API route proxies.
              </div>
              <div className="bg-gray-50 border-2 border-gray-900 p-4 rounded-xl">
                <span className="font-black block uppercase text-sm mb-1">Backend</span>
                FastAPI (Python 3.11) hosted on Render with automatic cold-start retry handling.
              </div>
              <div className="bg-gray-50 border-2 border-gray-900 p-4 rounded-xl">
                <span className="font-black block uppercase text-sm mb-1">Storage & DB</span>
                Supabase S3 bucket for audio storage & PostgreSQL database for transcript logs.
              </div>
            </div>
          </section>

          {/* Section 5: Future Improvements */}
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="text-[#FF6B6B]" size={28} />
              <h2 className="text-2xl font-black uppercase">5. Roadmap & Optimization</h2>
            </div>
            <ul className="list-disc list-inside font-medium text-gray-700 leading-relaxed space-y-2">
              <li><strong>Real-time WebSockets / SSE:</strong> Replace HTTP status polling with Server-Sent Events for instant transcript streaming.</li>
              <li><strong>Celery & Redis Worker Queue:</strong> Offload ASR status checking to dedicated background workers rather than dynamic request polling.</li>
              <li><strong>Automated S3 Lifecycle Policies:</strong> Configure 30-day auto-deletion on Supabase S3 buckets to reduce storage overhead.</li>
            </ul>
          </section>

        </div>
      </div>
    </main>
  );
}