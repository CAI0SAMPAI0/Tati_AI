'use client';

import { useState } from 'react';
import { Upload, FileText, CheckCircle2, AlertCircle, Loader2, BookOpen, PenTool, Clapperboard } from 'lucide-react';
import { apiUpload, apiPost } from '@/lib/api/client';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';

export function CefrSection() {
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{success: boolean; message: string} | null>(null);

  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);
    setUploadStatus(null);
    
    const formData = new FormData();
    formData.append('file', file);
    
    try {
      const res = await apiUpload<{success: boolean; message: string; chunks_indexed: number}>(
        `/cefr/admin/upload-material?level=${level}`, 
        formData
      );
      
      if (res.ok) {
        setUploadStatus({
          success: true, 
          message: `${res.data.message} (${res.data.chunks_indexed} chunks indexed)`
        });
        setFile(null);
      } else {
        setUploadStatus({success: false, message: 'Upload failed'});
      }
    } catch (err: any) {
      setUploadStatus({success: false, message: err.message || 'Error uploading file'});
    } finally {
      setUploading(false);
    }
  };

  const handleGenerate = async (type: 'flashcards' | 'exercises' | 'simulations') => {
    if (!topic.trim()) return;
    setGenerating(true);
    
    try {
      let endpoint = '';
      if (type === 'flashcards') endpoint = `/cefr/admin/generate-flashcards?level=${level}&topic=${encodeURIComponent(topic)}&count=5`;
      else if (type === 'exercises') endpoint = `/cefr/admin/generate-exercises?level=${level}&topic=${encodeURIComponent(topic)}&count=3`;
      else if (type === 'simulations') endpoint = `/cefr/admin/generate-simulations?level=${level}&topic=${encodeURIComponent(topic)}&count=2`;
        
      const res = await apiPost<{success: boolean; data: any[]}>(endpoint, null);
      
      if (res.ok && res.data.success) {
        alert(`${type.charAt(0).toUpperCase() + type.slice(1)} generated and saved to the Dashboard successfully! Check the ${type === 'exercises' ? 'Modules' : type.charAt(0).toUpperCase() + type.slice(1)} tab.`);
      } else {
        alert('Failed to generate content');
      }
    } catch (err: any) {
      alert(err.message || 'Error generating content');
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="bg-surface border border-border p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
          <Upload size={24} className="text-primary" />
          Upload CEFR Diagnostic PDF
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="space-y-2">
            <label className="text-sm font-bold text-text-subtle">Target Level</label>
            <select 
              value={level} 
              onChange={e => setLevel(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none"
            >
              {LEVEL_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>
          
          <div className="space-y-2 md:col-span-2">
            <label className="text-sm font-bold text-text-subtle">Diagnostic PDF File</label>
            <div className="flex gap-4">
              <div className="flex-1 relative">
                <input 
                  type="file" 
                  accept="application/pdf"
                  onChange={e => {
                    const selectedFile = e.target.files?.[0] || null;
                    setFile(selectedFile);
                    if (selectedFile) {
                      const match = selectedFile.name.match(/(A1|A2|B1|B2|C1|C2)/i);
                      if (match) {
                        setLevel(match[1].toUpperCase());
                      }
                    }
                  }}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                />
                <div className="w-full border border-border rounded-xl bg-surface-hover flex items-center px-3 py-2 gap-3 overflow-hidden">
                  <div className="bg-primary/10 text-primary px-4 py-2 rounded-lg text-sm font-bold shrink-0">
                    Choose File
                  </div>
                  <span className="text-sm text-text-muted font-medium truncate flex-1">
                    {file ? file.name : "No file chosen"}
                  </span>
                </div>
              </div>
              <button 
                onClick={handleUpload}
                disabled={!file || uploading}
                className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2"
              >
                {uploading ? <Loader2 size={16} className="animate-spin" /> : <Upload size={16} />}
                Upload
              </button>
            </div>
          </div>
        </div>

        {uploadStatus && (
          <div className={`mt-4 p-4 rounded-xl flex items-center gap-3 text-sm font-medium ${uploadStatus.success ? 'bg-green-500/10 text-green-500' : 'bg-red-500/10 text-red-500'}`}>
            {uploadStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
            {uploadStatus.message}
          </div>
        )}
      </div>

      <div className="bg-surface border border-border p-6 rounded-2xl">
        <h2 className="text-xl font-bold text-text mb-4 flex items-center gap-2">
          <BookOpen size={24} className="text-primary" />
          Generate Content from PDFs
        </h2>
        <p className="text-xs text-text-muted mb-4">Content is automatically published and will be available in the Flashcards, Modules (Quizzes), and Simulations tabs.</p>
        
        <div className="flex flex-col md:flex-row gap-4 items-end">
          <div className="flex-1 space-y-2 w-full">
            <label className="text-sm font-bold text-text-subtle">Topic / Situation</label>
            <input 
              type="text" 
              placeholder="e.g. Shopping at the supermarket"
              value={topic}
              onChange={e => setTopic(e.target.value)}
              className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none"
            />
          </div>
          
          <button 
            onClick={() => handleGenerate('flashcards')}
            disabled={!topic.trim() || generating}
            className="px-6 py-3 bg-indigo-500/10 text-indigo-500 hover:bg-indigo-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
            Generate Flashcards
          </button>

          <button 
            onClick={() => handleGenerate('exercises')}
            disabled={!topic.trim() || generating}
            className="px-6 py-3 bg-orange-500/10 text-orange-500 hover:bg-orange-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
            Generate Exercises
          </button>
          
          <button 
            onClick={() => handleGenerate('simulations')}
            disabled={!topic.trim() || generating}
            className="px-6 py-3 bg-pink-500/10 text-pink-500 hover:bg-pink-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center gap-2 whitespace-nowrap"
          >
            {generating ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
            Generate Simulations
          </button>
        </div>
      </div>
    </div>
  );
}
