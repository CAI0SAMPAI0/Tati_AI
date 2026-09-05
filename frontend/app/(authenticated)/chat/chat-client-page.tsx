'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useChatSocket } from '@/hooks/useChatSocket';
import { apiGet, apiPost, apiPatch } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { Message, Conversation } from '@/lib/api/types';
import { useRouter, useSearchParams } from 'next/navigation';
import { X, Target } from 'lucide-react';
import { LevelingModal } from '@/components/chat/leveling-modal';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import { cn } from '@/lib/utils';
import { useSidebarState } from '@/hooks/useSidebarState';


const Sidebar = dynamic(
  () => import('@/components/chat/sidebar').then(m => m.Sidebar),
  {
    ssr: false,
    loading: () => (
      <div className="hidden md:flex w-[280px] bg-bg-secondary border-r border-border flex-col animate-pulse">
        <div className="p-6"><div className="h-8 w-32 bg-surface rounded-lg" /></div>
        <div className="flex-1 px-3 space-y-3">
          {Array(6).fill(0).map((_, i) => <div key={i} className="h-11 w-full bg-surface rounded-xl" />)}
        </div>
      </div>
    ),
  }
);
const ChatTopbar = dynamic(
  () => import('@/components/chat/topbar').then(m => m.ChatTopbar),
  { ssr: false, loading: () => <div className="h-16 border-b border-border bg-bg animate-pulse" /> }
);
const MessageList = dynamic(
  () => import('@/components/chat/message-list').then(m => m.MessageList),
  { ssr: false, loading: () => <div className="flex-1 bg-bg" /> }
);
const ChatInput = dynamic(
  () => import('@/components/chat/chat-input').then(m => m.ChatInput),
  { ssr: false, loading: () => <div className="h-16 bg-surface/30 animate-pulse rounded-2xl mx-4 mb-4" /> }
);

// framer-motion (~75KB) — só necessário no modal de summary
const MotionDiv = dynamic(() => import('framer-motion').then(m => m.motion.div), { ssr: false });
const AnimatePresence = dynamic(() => import('framer-motion').then(m => m.AnimatePresence), { ssr: false });
const ReactMarkdown = dynamic(() => import('@/components/chat/markdown-wrapper'), { ssr: false });

export default function ChatClientPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [currentConvId, setCurrentConvId] = useState<string | null>(
    searchParams.get('conv_id') ?? searchParams.get('id'),
  );
  const [convTitle, setConvTitle] = useState('Teacher Tati');
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);
  const [isLevelingModalOpen, setIsLevelingModalOpen] = useState(false);
  const [isStartingLeveling, setIsStartingLeveling] = useState(false);
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
    sendFiles,
  } = useChatSocket(currentConvId);

  useEffect(() => {
    if (currentConvId) {
      import('@/lib/db/indexedDB').then(({ getMessagesLocal }) => {
        getMessagesLocal(currentConvId).then((cachedMsgs) => {
          if (cachedMsgs.length > 0) {
            setMessages(cachedMsgs);
          }
        });
      }).catch(err => console.error('IndexedDB load error:', err));

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
    if (window.innerWidth < 768) {
      handleCloseSidebar();
    }
    router.push(`/chat?conv_id=${id}`);
  }, [router, handleCloseSidebar]);

  const handleNewChat = useCallback(() => {
    setMessages([]);
    setConvTitle('Teacher Tati');
    if (window.innerWidth < 768) {
      handleCloseSidebar();
    }
    router.push('/chat');
  }, [router, setMessages, handleCloseSidebar]);

  const handleStartLeveling = useCallback(() => {
    setIsLevelingModalOpen(true);
  }, []);

  const handleExecuteStartLeveling = useCallback(async (totalQuestions: number) => {
    try {
      setIsStartingLeveling(true);
      toast.loading('Starting your CEFR Leveling Challenge...', { id: 'start-leveling' });
      const res = await apiPost<any>(ENDPOINTS.LEVELING_START, { total_questions: totalQuestions });
      if (res.ok && res.data?.conversation_id) {
        toast.success(`Leveling Challenge started with ${res.data.total_questions || totalQuestions} questions! Please answer in English.`, { id: 'start-leveling' });
        const newConvId = res.data.conversation_id;
        setCurrentConvId(newConvId);
        setConvTitle(res.data.title || 'CEFR Leveling Challenge');
        const initialMsg: Message = {
          id: `leveling-init-${Date.now()}`,
          conversation_id: newConvId,
          role: 'assistant',
          content: res.data.reply || res.data.message || '',
          audio_b64: res.data.audio_b64,
          created_at: new Date().toISOString(),
        };
        setMessages([initialMsg]);
        setIsLevelingModalOpen(false);
        router.push(`/chat?conv_id=${newConvId}`);
        if (window.innerWidth < 768) {
          handleCloseSidebar();
        }
      } else {
        toast.error('Could not start leveling challenge right now.', { id: 'start-leveling' });
      }
    } catch (err) {
      console.error('Error starting leveling assessment:', err);
      toast.error('Connection error when starting leveling assessment.', { id: 'start-leveling' });
    } finally {
      setIsStartingLeveling(false);
    }
  }, [router, setMessages, handleCloseSidebar]);

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

  const handleResend = useCallback(async (content: string) => {
    if (!currentConvId) {
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

  const handleSendFiles = async (files: Array<{ name: string; base64: string; type?: string }>, caption?: string) => {
    let convId = currentConvId;

    if (!convId) {
      try {
        const title = files.length === 1 ? `File: ${files[0].name}` : `${files.length} attached files`;
        const res = await apiPost<Conversation>(ENDPOINTS.CONVERSATIONS, {
          title
        });
        if (res.ok) {
          convId = res.data.id;
          setCurrentConvId(convId);
          setConvTitle(res.data.title);
          router.replace(`/chat?conv_id=${convId}`, { scroll: false });
        } else {
          toast.error('Could not create conversation for files.');
          return;
        }
      } catch (err) {
        console.error('Error creating conversation for files:', err);
        return;
      }
    }

    if (convId) {
      sendFiles(files, caption, convId);
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

  const isLevelingCompleted = useMemo(() => {
    return messages.some((m) =>
      m.content?.includes('Leveling Assessment Summary') ||
      m.content?.includes('completed your Leveling Assessment') ||
      m.content?.includes('finished the Leveling Assessment early') ||
      m.content?.includes('Your Performance by Level:')
    );
  }, [messages]);

  const isLevelingActive = Boolean(
    (convTitle?.toLowerCase().includes('leveling') ||
      (messages.length > 0 && messages[0]?.content?.includes('Leveling Challenge'))) &&
    !isLevelingCompleted
  );

  const handleFinishEarly = useCallback(async () => {
    if (!currentConvId) return;
    const confirm = window.confirm(
      'Do you wish to conclude your Leveling Assessment now? Teacher Tati will evaluate the questions answered so far and mark the remainder as 0.'
    );
    if (!confirm) return;

    await handleSend('/finish');
  }, [currentConvId, handleSend]);

  useEffect(() => {
    const receiptFlag = searchParams.get('receipt');
    if (receiptFlag === 'success' || receiptFlag === '1' || receiptFlag === 'true') {
      toast.success('Payment Approved!');
      const nextQuery = currentConvId ? `?conv_id=${currentConvId}` : '';
      router.replace(`/chat${nextQuery}`);
    }
  }, [searchParams, router, currentConvId]);


  return (
    <div className="flex h-screen bg-bg overflow-hidden selection:bg-primary/20 relative">
      <Sidebar
        currentConvId={currentConvId}
        onSelectConv={handleSelectConv}
        onNewChat={handleNewChat}
        onStartLeveling={handleStartLeveling}
        isOpen={sidebarOpen}
        onClose={handleCloseSidebar}
      />

      <div className={cn("flex-1 flex flex-col min-w-0 relative bg-bg transition-all duration-300", sidebarOpen ? "md:pl-[280px]" : "md:pl-0")}>
        <ChatTopbar
          title={convTitle}
          onToggleSidebar={handleToggleSidebar}
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
            onSendMessage={handleSend}
            onStartLeveling={handleStartLeveling}
          />
        </div>
        <div className="p-2 md:p-6 bg-gradient-to-t from-bg via-bg/80 to-transparent">
          <div className="max-w-4xl mx-auto w-full">
            {isLevelingActive && (
              <div className="mb-2.5 p-2.5 px-3.5 rounded-xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs shadow-xs animate-in fade-in">
                <div className="flex items-center gap-2 text-text font-medium min-w-0">
                  <Target size={15} className="text-primary shrink-0" />
                  <span className="truncate">
                    CEFR Leveling Challenge in progress. Type <strong className="font-mono text-primary font-bold">/finish</strong> to conclude at any time.
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleFinishEarly}
                  className="shrink-0 px-2.5 py-1 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/30 text-red-600 dark:text-red-400 font-bold transition-all text-[0.72rem] active:scale-95 cursor-pointer"
                  title="Conclude assessment and calculate score now"
                >
                  Finish (/finish)
                </button>
              </div>
            )}
            <ChatInput
              onSend={handleSend}
              onSendAudio={handleSendAudio}
              onSendFile={handleSendFile}
              onSendFiles={handleSendFiles}
              disabled={false}
              isStreaming={isStreaming}
            />
          </div>
        </div>
      </div>

      <AnimatePresence>
        {isSummaryOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-12">
            <MotionDiv
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSummaryOpen(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <MotionDiv
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
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>

      <LevelingModal
        isOpen={isLevelingModalOpen}
        onClose={() => setIsLevelingModalOpen(false)}
        onStart={handleExecuteStartLeveling}
        loading={isStartingLeveling}
      />
    </div>
  );
}
