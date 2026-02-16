import { useParams, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Sidebar } from '../components/layout/Sidebar';
import { ChatContainer } from '../components/chat/ChatContainer';
import { ChatInput } from '../components/chat/ChatInput';
import { InspectorPanel } from '../components/inspector/InspectorPanel';
import { Button } from '../components/ui/button';
import { MessageSquare, PanelRight, PanelLeft } from 'lucide-react';
import { useChatStore } from '../stores/chatStore';
import { SkillsConfigModal, type SettingsTab } from '../components/skills/SkillsConfigModal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';
import { useCreateSession } from '../hooks/useSessions';

export function ChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const inspectorOpen = useChatStore((state) => state.inspectorOpen);
  const setInspectorOpen = useChatStore((state) => state.setInspectorOpen);
  const setInspectorTab = useChatStore((state) => state.setInspectorTab);
  const sidebarOpen = useChatStore((state) => state.sidebarOpen);
  const setSidebarOpen = useChatStore((state) => state.setSidebarOpen);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [settingsInitialTab, setSettingsInitialTab] = useState<SettingsTab>('layout');
  const createSession = useCreateSession();

  const openSettings = (tab: SettingsTab) => {
    setSettingsInitialTab(tab);
    setSettingsModalOpen(true);
  };

  useKeyboardShortcuts([
    {
      key: 'i',
      metaKey: true,
      handler: () => setInspectorOpen(!inspectorOpen),
    },
    {
      key: 'i',
      ctrlKey: true,
      handler: () => setInspectorOpen(!inspectorOpen),
    },
    {
      key: 'k',
      metaKey: true,
      handler: () => openSettings('skills'),
    },
    {
      key: 'k',
      ctrlKey: true,
      handler: () => openSettings('skills'),
    },
    {
      key: 'b',
      metaKey: true,
      handler: () => setSidebarOpen(!sidebarOpen),
    },
    {
      key: 'b',
      ctrlKey: true,
      handler: () => setSidebarOpen(!sidebarOpen),
    },
  ]);

  const handleStartChat = async (content: string) => {
    try {
      // Mount inspector immediately for new-session submit flow.
      setInspectorTab('computer');
      setInspectorOpen(true);
      const newSession = await createSession.mutateAsync(undefined);
      navigate(`/chat/${newSession.id}`, { state: { initialMessage: content } });
    } catch (error) {
      console.error('Failed to start session:', error);
    }
  };

  return (
    <div className="flex h-screen min-w-0 overflow-hidden">
      {/* Sidebar */}
      <Sidebar
        collapsed={!sidebarOpen}
        onToggleCollapse={() => setSidebarOpen(false)}
        onOpenSettings={() => openSettings('layout')}
      />

      <div className="flex min-w-0 flex-[1_1_auto] overflow-hidden">
        {/* Main content area */}
        <main className="relative flex min-w-0 flex-[1_1_auto] flex-col overflow-hidden dark:bg-[#212121]">
          {!sidebarOpen ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open sidebar"
              className="absolute left-3 top-3 z-20 hidden md:inline-flex"
            >
              <PanelLeft className="h-4 w-4" />
            </Button>
          ) : null}
          {!inspectorOpen ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setInspectorOpen(true)}
              aria-label="Open inspector"
              className="absolute right-3 top-3 z-20"
            >
              <PanelRight className="h-4 w-4" />
            </Button>
          ) : null}

          {sessionId ? (
            <ChatContainer sessionId={sessionId} onOpenSkills={() => openSettings('skills')} />
          ) : (
            // No session selected
            <div className="flex flex-1 flex-col items-center justify-center px-6">
              <div className="w-full space-y-6 text-center">
                <div className="space-y-3">
                  <MessageSquare className="mx-auto h-12 w-12 text-muted-foreground" />
                  <h2 className="text-3xl font-semibold">What can I do for you?</h2>
                  <p className="text-sm text-muted-foreground">
                    Select a session from the sidebar or create a new one to get started.
                  </p>
                </div>
                <div className="w-full max-w-[61.8%] min-w-[280px] mx-auto">
                  <ChatInput
                    onSend={handleStartChat}
                    disabled={createSession.isPending}
                    onOpenSkills={() => openSettings('skills')}
                  />
                </div>
              </div>
            </div>
          )}
        </main>

        <InspectorPanel
          open={inspectorOpen}
          sessionId={sessionId}
          onClose={() => setInspectorOpen(false)}
        />
      </div>

      <SkillsConfigModal
        open={settingsModalOpen}
        onOpenChange={setSettingsModalOpen}
        initialTab={settingsInitialTab}
      />
    </div>
  );
}
