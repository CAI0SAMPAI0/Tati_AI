'use client';

import { useQuery } from '@tanstack/react-query';
import { 
  History,
  Clock
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';

interface SubmissionRow {
  id: string;
  created_at: string;
  score: number;
  status: string;
  user?: { username?: string; name?: string; avatar_url?: string };
  module?: { title?: string };
}

export function SubmissionsSection() {
  const { data: submissions = [], isLoading } = useQuery<SubmissionRow[]>({
    queryKey: ['admin-submissions'],
    queryFn: () => apiGet<SubmissionRow[]>('/dashboard/submissions/all'),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  return (
    <div className="space-y-6">
      <div className="bg-surface border border-border rounded-2xl overflow-hidden">
        <div className="p-5 border-b border-border flex items-center justify-between">
          <h3 className="font-bold text-text flex items-center gap-2">
            <History size={20} className="text-primary" />
            Submissions
          </h3>
          <span className="text-xs font-bold text-text-muted">{submissions.length} Total</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest border-b border-border bg-bg-secondary/30">
              <tr>
                <th className="px-6 py-4">Student</th>
                <th className="px-6 py-4">Activity</th>
                <th className="px-6 py-4">Date</th>
                <th className="px-6 py-4 text-right">Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/50">
              {submissions.length > 0 ? submissions.map((s) => (
                <tr key={s.id} className="hover:bg-bg-secondary/20 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.7rem] font-bold text-primary overflow-hidden">
                        {s.user?.avatar_url ? (
                          <img src={s.user.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (s.user?.name || s.user?.username || '?').charAt(0).toUpperCase()
                        )}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-semibold text-text">{s.user?.name || s.user?.username}</span>
                        <span className="text-[0.65rem] text-text-muted">@{s.user?.username}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-col">
                      <span className="text-xs font-medium text-text">{s.module?.title || 'General Quiz'}</span>
                      <div className="flex items-center gap-1 text-text-subtle text-[0.65rem]">
                        <Clock size={10} />
                        <span>{new Date(s.created_at).toLocaleTimeString()}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-[0.7rem] text-text-muted">
                    {new Date(s.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className={`inline-flex items-center px-2 py-1 rounded-lg text-xs font-black ${
                      s.score >= 80 ? 'bg-success/10 text-success' : 
                      s.score >= 60 ? 'bg-warning/10 text-warning' : 
                      'bg-danger/10 text-danger'
                    }`}>
                      {s.score}%
                    </div>
                  </td>
                </tr>
              )) : (
                <tr>
                  <td colSpan={4} className="px-6 py-20 text-center text-xs text-text-muted italic">
                    No submissions found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
