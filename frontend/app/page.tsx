'use client';

import { useState, useEffect } from 'react';
import { Upload, FileAudio, CheckCircle2, Loader2, AlertCircle, Clock, FileText, Sparkles, Disc3 } from 'lucide-react';

interface AudioNote {
  id: string;
  filename: string;
  status: string;
  transcript?: string;
  summary?: string;
  created_at: string;
}

const ALLOWED_EXTENSIONS = ['wav', 'mp3', 'm4a', 'aac', 'flac', 'ogg'];

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [activeNote, setActiveNote] = useState<AudioNote | null>(null);
  const [notesList, setNotesList] = useState<AudioNote[]>([]);
  const [pollError, setPollError] = useState<string | null>(null);

  useEffect(() => {
    fetchNotes();
  }, []);

  const fetchNotes = async () => {
    try {
      const res = await fetch('/api/notes');
      if (res.ok) {
        const data = await res.json();
        setNotesList(data);
      }
    } catch (err) {
      console.error('Failed to fetch notes', err);
    }
  };

  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (currentNoteId && activeNote?.status !== 'completed' && activeNote?.status !== 'failed') {
      interval = setInterval(async () => {
        try {
          const res = await fetch(`/api/notes/${currentNoteId}`);
          if (res.ok) {
            const data: AudioNote = await res.json();
            setActiveNote(data);
            if (data.status === 'completed' || data.status === 'failed') {
              clearInterval(interval);
              fetchNotes();
            }
          }
        } catch (err) {
          setPollError('Backend connection lost while polling.');
        }
      }, 3000);
    }
    return () => clearInterval(interval);
  }, [currentNoteId, activeNote?.status]);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!ext || !ALLOWED_EXTENSIONS.includes(ext)) {
      setPollError(`Invalid file format (.${ext || 'unknown'}). Please select a valid audio file (WAV, MP3, M4A, AAC, FLAC, OGG).`);
      return;
    }

    setUploading(true);
    setPollError(null);

    try {
      // Step A: Request direct upload URL from backend
      const urlRes = await fetch(`/api/presigned-url?filename=${encodeURIComponent(file.name)}`, {
        method: 'POST',
      });
      
      if (!urlRes.ok) {
        const errData = await urlRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to get upload URL.');
      }

      const { upload_url, public_url, content_type } = await urlRes.json();

      // Step B: Upload file directly to Supabase S3 using the exact signed Content-Type
      const uploadRes = await fetch(upload_url, {
        method: 'PUT',
        headers: {
          'Content-Type': content_type,
        },
        body: file,
      });
      if (!uploadRes.ok) throw new Error('Direct S3 upload failed.');

      // Step C: Trigger backend processing pipeline
      const startRes = await fetch('/api/start-job', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ public_url, filename: file.name }),
      });

      if (!startRes.ok) {
        const errData = await startRes.json().catch(() => ({}));
        throw new Error(errData.detail || 'Failed to start transcription job.');
      }

      const data = await startRes.json();

      setCurrentNoteId(data.id);
      setActiveNote({
        id: data.id,
        filename: file.name,
        status: 'processing',
        created_at: new Date().toISOString(),
      });
    } catch (err: any) {
      setPollError(err.message || 'Upload failed.');
    } finally {
      setUploading(false);
      setFile(null);
    }
  };

  return (
    <main className="flex h-screen overflow-hidden selection:bg-indigo-300">

      {/* SIDEBAR */}
      <aside className="w-80 border-r-4 border-gray-900 bg-[#e8e4d9] flex flex-col z-10 shadow-[4px_0px_0px_0px_rgba(17,24,39,0.1)]">
        <div className="p-6 border-b-4 border-gray-900 flex items-center gap-3 bg-[#FFE66D]">
          <div className="p-2 bg-gray-900 rounded-lg">
            <Disc3 className="text-[#FFE66D]" size={28} />
          </div>
          <h1 className="font-black text-2xl uppercase tracking-tighter">Textalize</h1>
        </div>

        <div className="p-4 bg-gray-900 text-white font-bold text-sm uppercase tracking-widest border-b-4 border-gray-900 flex justify-between items-center">
          <span>Archive Log</span>
          <a href="/architecture" className="text-[10px] bg-white text-gray-900 px-2 py-1 rounded hover:bg-[#FFE66D] transition-colors">
            Docs
          </a>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {notesList.length === 0 ? (
            <div className="text-center p-6 border-4 border-dashed border-gray-400 rounded-2xl text-gray-500 font-medium">
              No tapes found.
            </div>
          ) : (
            notesList.map((note) => (
              <button
                key={note.id}
                onClick={() => { setCurrentNoteId(note.id); setActiveNote(note); }}
                className={`w-full text-left p-4 rounded-2xl border-4 border-gray-900 transition-all ${currentNoteId === note.id
                  ? 'bg-[#4ECDC4] shadow-[4px_4px_0px_0px_#111827] translate-x-[-2px] translate-y-[-2px]'
                  : 'bg-white hover:bg-gray-50 hover:shadow-[4px_4px_0px_0px_#111827] hover:translate-x-[-2px] hover:translate-y-[-2px]'
                  }`}
              >
                <p className="font-bold truncate text-gray-900 mb-2">{note.filename}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] px-3 py-1 rounded-full uppercase font-black border-2 border-gray-900 ${note.status === 'completed' ? 'bg-[#A8E6CF]' :
                    note.status === 'failed' ? 'bg-[#FF8B94]' : 'bg-[#FFD3B6]'
                    }`}>
                    {note.status}
                  </span>
                  <span className="text-xs font-mono font-bold text-gray-600 flex items-center gap-1">
                    <Clock size={12} /> {new Date(note.created_at).toLocaleDateString()}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </aside>

      {/* MAIN CONTENT AREA */}
      <section className="flex-1 flex flex-col h-full overflow-y-auto p-4 sm:p-10 relative">

        {/* Upload Card */}
        <div className="max-w-4xl mx-auto w-full mb-10 z-10">
          <div className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827]">
            <h2 className="text-3xl font-black uppercase tracking-tight mb-2">Initialize Tape</h2>
            <p className="font-medium text-gray-600 mb-8 border-b-2 border-gray-100 pb-4">
              Upload an audio file (WAV, MP3, M4A, AAC, FLAC, OGG). The Gnani AI engine will transcribe and summarize it.
            </p>

            <form onSubmit={handleUpload} className="flex flex-col sm:flex-row items-stretch gap-6">
              <label className="flex-1 border-4 border-dashed border-gray-300 hover:border-gray-900 bg-gray-50 hover:bg-indigo-50 rounded-2xl p-6 text-center cursor-pointer transition-colors flex items-center justify-center gap-4 group">
                <div className="p-3 bg-white border-2 border-gray-200 rounded-xl group-hover:border-gray-900 transition-colors">
                  <Upload className="text-gray-900" size={24} />
                </div>
                <span className="font-bold text-gray-700 truncate text-lg">
                  {file ? file.name : "Select audio file"}
                </span>
                <input
                  type="file"
                  accept="audio/*,.wav,.mp3,.m4a,.aac,.flac,.ogg"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                />
              </label>

              <button
                type="submit"
                disabled={!file || uploading}
                className="px-8 bg-[#FF6B6B] disabled:bg-gray-300 text-white border-4 border-gray-900 rounded-2xl shadow-[6px_6px_0px_0px_#111827] active:shadow-none active:translate-x-[6px] active:translate-y-[6px] disabled:shadow-none disabled:translate-x-0 disabled:translate-y-0 transition-all font-black text-xl uppercase tracking-wider flex items-center justify-center gap-3"
              >
                {uploading ? <Loader2 className="animate-spin" size={24} /> : <Sparkles size={24} />}
                <span>Process</span>
              </button>
            </form>

            {pollError && (
              <div className="mt-6 p-4 bg-[#FF8B94] border-4 border-gray-900 rounded-xl text-gray-900 font-bold flex items-center gap-3 shadow-[4px_4px_0px_0px_#111827]">
                <AlertCircle size={24} /> {pollError}
              </div>
            )}
          </div>
        </div>

        {/* RESULTS AREA */}
        {activeNote ? (
          <div className="max-w-4xl mx-auto w-full space-y-8 pb-12 z-10">

            {/* Status Banner */}
            <div className="bg-[#4F46E5] border-4 border-gray-900 rounded-2xl p-6 shadow-[6px_6px_0px_0px_#111827] flex flex-col sm:flex-row items-start sm:items-center justify-between text-white gap-4">
              <div>
                <h3 className="font-black text-2xl truncate max-w-md">{activeNote.filename}</h3>
                <p className="font-mono text-sm opacity-80 mt-1">ID: {activeNote.id}</p>
              </div>
              <div className="flex items-center gap-3 bg-white text-gray-900 px-5 py-2 rounded-xl border-4 border-gray-900 font-black uppercase tracking-widest shadow-[4px_4px_0px_0px_#111827]">
                {activeNote.status === 'completed' && <CheckCircle2 className="text-[#4ECDC4]" size={24} />}
                {(activeNote.status === 'starting' || activeNote.status === 'processing') && <Loader2 className="text-[#FF6B6B] animate-spin" size={24} />}
                {activeNote.status === 'failed' && <AlertCircle className="text-[#FF6B6B]" size={24} />}
                {activeNote.status}
              </div>
            </div>

            {/* Processing State Loader */}
            {(activeNote.status === 'starting' || activeNote.status === 'processing') && (
              <div className="bg-white border-4 border-gray-900 rounded-[2rem] p-16 text-center flex flex-col items-center justify-center space-y-6 shadow-[8px_8px_0px_0px_#111827]">
                <div className="relative">
                  <div className="absolute inset-0 bg-[#FFE66D] rounded-full blur-xl animate-pulse"></div>
                  <Loader2 className="text-gray-900 animate-spin relative z-10" size={64} />
                </div>
                <h4 className="text-3xl font-black uppercase tracking-tight">Processing Audio</h4>
                <p className="font-medium text-gray-500 max-w-md text-lg">
                  Gnani Batch ASR is transcribing and Gemini AI is summarizing. Please stand by...
                </p>
              </div>
            )}

            {/* Completed Results Grid */}
            {activeNote.status === 'completed' && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* AI Summary */}
                <div className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827] flex flex-col">
                  <div className="flex items-center gap-3 mb-6 bg-[#FFE66D] border-4 border-gray-900 w-max px-4 py-2 rounded-xl shadow-[4px_4px_0px_0px_#111827]">
                    <Sparkles size={20} className="text-gray-900" />
                    <h4 className="font-black uppercase tracking-widest text-gray-900">AI Summary</h4>
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-2xl p-6 border-4 border-gray-900 text-gray-800 font-medium leading-relaxed whitespace-pre-wrap text-lg">
                    {activeNote.summary || "No summary generated."}
                  </div>
                </div>

                {/* Transcript */}
                <div className="bg-white border-4 border-gray-900 rounded-[2rem] p-8 shadow-[8px_8px_0px_0px_#111827] flex flex-col">
                  <div className="flex items-center gap-3 mb-6 bg-[#4ECDC4] border-4 border-gray-900 w-max px-4 py-2 rounded-xl shadow-[4px_4px_0px_0px_#111827]">
                    <FileText size={20} className="text-gray-900" />
                    <h4 className="font-black uppercase tracking-widest text-gray-900">Transcript</h4>
                  </div>
                  <div className="flex-1 bg-gray-900 rounded-2xl p-6 border-4 border-gray-900 text-green-400 font-mono text-sm leading-relaxed max-h-[500px] overflow-y-auto whitespace-pre-wrap shadow-inner">
                    {activeNote.transcript || "No transcript available."}
                  </div>
                </div>

              </div>
            )}

          </div>
        ) : (
          <div className="max-w-4xl mx-auto w-full flex-1 flex flex-col items-center justify-center text-center text-gray-900 bg-white border-4 border-gray-900 border-dashed rounded-[2rem] p-12 shadow-[8px_8px_0px_0px_rgba(17,24,39,0.1)]">
            <div className="p-6 bg-gray-100 rounded-full mb-6">
              <FileAudio size={64} className="text-gray-400" />
            </div>
            <p className="text-2xl font-black uppercase tracking-tight mb-2">No Tape Inserted</p>
            <p className="font-medium text-gray-500 text-lg">Upload an audio file or select a past recording from the archive log.</p>
          </div>
        )}
      </section>
    </main>
  );
}