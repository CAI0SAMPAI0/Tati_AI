'use client';

import { useState, useEffect, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sidebar } from '@/components/chat/sidebar';
import { ChatTopbar } from '@/components/chat/topbar';
import { MessageList } from '@/components/chat/message-list';
import { ChatInput } from '@/components/chat/chat-input';
import { fetchWeeklyPlan } from '@/lib/api/weekly-plan';
import { useChatSocket } from '@/hooks/useChatSocket';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Message, Conversation } from '@/lib/api/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';

const ReactMarkdown = dynamic(() => import('@/components/chat/markdown-wrapper'), { ssr: false });

export default function ChatClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentConvId, setCurrentConvId] = useState<string | null>(
    searchParams.get('conv_id') ?? searchParams.get('id'),
  );
  const [convTitle, setConvTitle] = useState('Teacher Tati');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const [loadingSummary, setLoadingSummary] = useState(false);
  const locale = 'en-US';

  useEffect(() => {
    const nextConvId = searchParams.get('conv_id') ?? searchParams.get('id');
    setCurrentConvId(nextConvId);
  }, [searchParams]);

  const {
    messages,
    setMessages,
    isStreaming,
    streamingContent,
    sendMessage,
    sendAudio,
    sendFile,
  } = useChatSocket(currentConvId);

  useEffect(() => {
    if (currentConvId) {
      // 1. Carrega do Cache Local (IndexedDB) para abertura instantânea
      import('@/lib/db/indexedDB').then(({ getMessagesLocal }) => {
        getMessagesLocal(currentConvId).then((cachedMsgs) => {
          if (cachedMsgs.length > 0) {
            setMessages(cachedMsgs);
          }
        });
      }).catch(err => console.error('IndexedDB load error:', err));

      // 2. SWR - Busca do backend e sincroniza
      apiGet<Message[]>(ENDPOINTS.CONVERSATION_MESSAGES(currentConvId))
        .then((msgs) => {
          if (msgs.length > 0) {
            setMessages(msgs);
            import('@/lib/db/indexedDB').then(({ saveMessagesLocal }) => {
              saveMessagesLocal(currentConvId, msgs);
            }).catch(err => console.error('IndexedDB save error:', err));
          }
        })
        .catch((err) => console.error('Error loading messages:', err));
      setSummary(null);
    } else {
      setMessages([]);
      setConvTitle('Teacher Tati');
      setSummary(null);
    }
  }, [currentConvId, setMessages]);

  const handleSelectConv = useCallback((id: string) => {
    setSidebarOpen(false);
    router.push(`/chat?conv_id=${id}`);
  }, [router]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConvTitle('Teacher Tati');
    setSidebarOpen(false);
    router.push('/chat');
  }, [router, setMessages]);

  const handleSend = async (text: string) => {
    let convId = currentConvId;

    if (!convId) {
      try {
        const res = await apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, {
          title: text.substring(0, 20) + '...'
        });
        if (res.ok) {
          convId = res.data.id;
          setCurrentConvId(convId);
          setConvTitle(res.data.title);
          router.replace(`/chat?conv_id=${convId}`, { scroll: false });
        } else {
          console.error('Failed to create conversation:', res.data);
          return;
        }
      } catch (err) {
        console.error('Error creating conversation:', err);
        return;
      }
    }

    if (convId) {
      sendMessage(text, convId);
    }
  };

  const handleSendAudio = async (base64: string) => {
    let convId = currentConvId;

    if (!convId) {
      try {
        const res = await apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, {
          title: 'Vocal Message...'
        });
        if (res.ok) {
          convId = res.data.id;
          setCurrentConvId(convId);
          setConvTitle(res.data.title);
          router.replace(`/chat?conv_id=${convId}`, { scroll: false });
        } else {
          toast.error('Could not create conversation for audio.');
          return;
        }
      } catch (err) {
        console.error('Error creating conversation for audio:', err);
        return;
      }
    }

    if (convId) {
      sendAudio(base64, convId);
    }
  };

  const handleEditMessage = async (messageId: string, newContent: string) => {
    if (!currentConvId) return;

    try {
      const res = await apiPatch<Message>(ENDPOINTS.EDIT_MESSAGE(currentConvId, messageId), {
        content: newContent
      });

      if (res.ok) {
        setMessages((prev) => prev.map(m =>
          m.id === messageId ? { ...m, content: newContent } : m
        ));
        toast.success('Message updated.');
      } else {
        toast.error('Could not update message.');
      }
    } catch (err) {
      console.error('Error editing message:', err);
      toast.error('Error connecting to server.');
    }
  };

  // Resend a message (e.g., after editing error)
  const handleResend = useCallback(async (content: string) => {
    if (!currentConvId) {
      // If no conversation yet, create one like handleSend does
      try {
        const convRes = await apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, {
          title: content.substring(0, 20) + '...'
        });
        if (convRes.ok) {
          const newId = convRes.data.id;
          setCurrentConvId(newId);
          setConvTitle(convRes.data.title);
          router.replace(`/chat?conv_id=${newId}`, { scroll: false });
          sendMessage(content, newId);
        } else {
          toast.error('Could not create conversation for resend.');
        }
      } catch (err) {
        console.error('Error creating conversation for resend:', err);
        toast.error('Error creating conversation.');
      }
    } else {
      sendMessage(content, currentConvId);
    }
  }, [currentConvId, sendMessage, router]);

  const handleSendFile = async (filename: string, base64: string, caption?: string) => {
    let convId = currentConvId;

    if (!convId) {
      try {
        const res = await apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, {
          title: `File: ${filename}`
        });
        if (res.ok) {
          convId = res.data.id;
          setCurrentConvId(convId);
          setConvTitle(res.data.title);
          router.replace(`/chat?conv_id=${convId}`, { scroll: false });
        } else {
          toast.error('Could not create conversation for file.');
          return;
        }
      } catch (err) {
        console.error('Error creating conversation for file:', err);
        return;
      }
    }

    if (convId) {
      sendFile(filename, base64, caption, convId);
    }
  };

  const handleOpenSummary = async () => {
    if (!currentConvId) return;
    setIsSummaryOpen(true);
    if (!summary) {
      setLoadingSummary(true);
      try {
        const path = `${ENDPOINTS.CONVERSATION_SUMMARY(currentConvId)}?lang=${locale}`;
        const res = await apiGet<{ summary: string }>(path);
        setSummary(res.summary);
      } catch (err) {
        console.error('Error fetching summary:', err);
        toast.error('Error fetching summary. Please try again.');
      } finally {
        setLoadingSummary(false);
      }
    }
  };

  useEffect(() => {
    const receiptFlag = searchParams.get('receipt');
    if (receiptFlag === 'success' || receiptFlag === '1' || receiptFlag === 'true') {
      toast.success('Payment Approved!');
      const nextQuery = currentConvId ? `?conv_id=${currentConvId}` : '';
      router.replace(`/chat${nextQuery}`);
    }
  }, [searchParams, router, currentConvId]);

  const { data: weeklyPlan } = useQuery({
    queryKey: ['weekly-plan'],
    queryFn: fetchWeeklyPlan,
    staleTime: 5 * 60 * 1000,
  });

  const weeklyTopics = weeklyPlan?.topics ?? [];

  return (
    <div className="flex h-screen bg-bg overflow-hidden selection:bg-primary/20">
      <Sidebar
        currentConvId={currentConvId}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />

      <div className="flex-1 flex flex-col min-w-0 relative bg-[radial-gradient(circle_at_top_right,_var(--tw-gradient-stops))] from-primary/5 via-bg to-bg">
        <ChatTopbar
          title={convTitle}
          onToggleSidebar={() => setSidebarOpen(true)}
          onShowSummary={handleOpenSummary}
          onSwitchToVoice={() => router.push(currentConvId ? `/voice?conv_id=${currentConvId}` : '/voice')}
          showSummaryBtn={messages.length >= 3}
        />

        <div className="flex-1 overflow-hidden relative flex flex-col">
          <MessageList
            messages={messages}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onEdit={handleEditMessage}
            onResend={handleResend}
          />
        </div>
        <div className="p-2 md:p-6 bg-gradient-to-t from-bg via-bg/80 to-transparent">
          <div className="max-w-4xl mx-auto w-full">
            <ChatInput
              onSend={handleSend}
              onSendAudio={handleSendAudio}
              onSendFile={handleSendFile}
              disabled={false}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSummaryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-2xl max-h-[80vh] overflow-hidden bg-bg border border-border rounded-3xl shadow-2xl flex flex-col"
            >
              <div className="p-6 border-b border-border flex justify-between items-center bg-surface/50">
                <div>
                  <h2 className="text-xl font-bold text-text">Pedagogical Summary</h2>
                  <p className="text-xs text-text-muted mt-0.5">Analysis of your practice with Teacher Tati</p>
                </div>
                <button
                  onClick={() => setIsSummaryOpen(false)}
                  className="p-2 rounded-lg hover:bg-surface-hover transition-colors"
                >
                  <X size={20} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
                {loadingSummary ? (
                  <div className="h-40 flex flex-col items-center justify-center gap-4">
                    <div className="w-10 h-10 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
                    <p className="text-xs font-bold text-primary uppercase tracking-widest animate-pulse">Generating analysis...</p>
                  </div>
                ) : (
                  <div className="prose dark:prose-invert prose-headings:text-text prose-headings:font-black prose-p:text-text/90 prose-strong:text-primary prose-ul:list-disc prose-li:text-text/80 max-w-none text-sm leading-relaxed text-text">
                    <ReactMarkdown>
                      {summary || 'No summary available at the moment.'}
                    </ReactMarkdown>
                  </div>
                )}
              </div>

              <div className="p-6 border-t border-border flex justify-center bg-surface/50">
                <button
                  onClick={() => setIsSummaryOpen(false)}
                  className="px-8 py-2.5 rounded-xl bg-primary text-white font-bold text-sm shadow-lg shadow-primary/20 hover:scale-105 active:scale-95 transition-all"
                >
                  Close
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
