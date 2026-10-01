import Link from 'next/link';
import { ArrowLeft, Code, Database, Server, Cpu, HardDrive } from 'lucide-react';

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
          <p className="font-bold text-gray-800 text-lg">How Vocalize handles heavy audio files asynchronously.</p>
        </div>

        {/* Content Sections */}
        <div className="space-y-8">
          
          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Server className="text-[#FF6B6B]" size={28} />
              <h2 className="text-2xl font-black uppercase">The Flow: Upload to Transcript</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed mb-4">
              When a user uploads a file, it is sent via a synchronous `POST` request to the FastAPI backend. 
              The backend immediately streams this file into a Supabase S3 Storage Bucket. 
              Once stored, the backend generates a public URL and passes it to the Gnani Batch STT API.
            </p>
            <p className="font-medium text-gray-700 leading-relaxed">
              Because transcription takes time, the backend does not wait. It saves a `processing` state in the PostgreSQL database and immediately returns a 200 OK to the frontend. The Next.js frontend then begins polling the backend every 3 seconds for status updates.
            </p>
          </section>

          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Cpu className="text-[#4F46E5]" size={28} />
              <h2 className="text-2xl font-black uppercase">Handling Long Audio</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed">
              The Gnani REST API is capped at 60 seconds and restricts direct file uploads to 10 MB. To comfortably handle 2+ minute recordings, this architecture pivots to the **Gnani Batch API**. By hosting the file ourselves on S3 and passing a public URL to the Batch API, we bypass the 10 MB limit entirely (bounded only by a 4-hour duration limit).
            </p>
          </section>

          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <HardDrive className="text-[#FFE66D]" size={28} />
              <h2 className="text-2xl font-black uppercase">Where Files Live</h2>
            </div>
            <ul className="list-disc list-inside font-medium text-gray-700 leading-relaxed space-y-2">
              <li><strong>Audio Files:</strong> Stored persistently in a Supabase S3 Bucket with a public-read ACL.</li>
              <li><strong>State & Results:</strong> A Supabase PostgreSQL database tracks the job IDs, statuses, and ultimately stores the final JSON transcript and Gemini AI summary.</li>
            </ul>
          </section>

          <section className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <div className="flex items-center gap-3 mb-4">
              <Database className="text-[#A8E6CF]" size={28} />
              <h2 className="text-2xl font-black uppercase">Future Improvements</h2>
            </div>
            <p className="font-medium text-gray-700 leading-relaxed">
              With more time, I would replace the frontend HTTP polling with WebSockets or Server-Sent Events (SSE) to reduce network overhead. I would also implement a dedicated Celery/Redis worker on the backend to handle the Gnani API polling, rather than doing it dynamically when the frontend requests a status check. Finally, I would add automatic deletion of the S3 audio files after 30 days to save storage costs.
            </p>
          </section>

        </div>
      </div>
    </main>
  );
}