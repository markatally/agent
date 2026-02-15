import { ChevronsUpDown, GripVertical, Loader2, Menu, Moon, PanelLeftClose, Sun, X } from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';
import { useClearAllSessions } from '../../hooks/useSessions';
import { Button } from '../ui/button';
import { Separator } from '../ui/separator';
import { SessionList } from '../session/SessionList';
import { NewSessionButton } from '../session/NewSessionButton';
import { cn } from '../../lib/utils';
import { useTheme } from '../../hooks/useTheme';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '../ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';

const MIN_SIDEBAR_WIDTH = 200;
const MAX_SIDEBAR_WIDTH = 480;
const DEFAULT_SIDEBAR_WIDTH = 256;
const STORAGE_KEY = 'sidebar-width';
const clampSidebarWidth = (value: number) =>
  Math.min(Math.max(value, MIN_SIDEBAR_WIDTH), MAX_SIDEBAR_WIDTH);

interface SidebarProps {
  className?: string;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onOpenSettings?: () => void;
}

export function Sidebar({
  className,
  collapsed = false,
  onToggleCollapse,
  onOpenSettings,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const { resolved: resolvedTheme, toggle: toggleTheme } = useTheme();
  const clearAllSessions = useClearAllSessions();
  const navigate = useNavigate();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [showClearAllDialog, setShowClearAllDialog] = useState(false);
  const [width, setWidth] = useState(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? clampSidebarWidth(parseInt(stored, 10)) : DEFAULT_SIDEBAR_WIDTH;
  });
  const [isResizing, setIsResizing] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);

  // Save width to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, String(width));
  }, [width]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
  }, []);

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isResizing) return;

    setWidth(clampSidebarWidth(e.clientX));
  }, [isResizing]);

  const handleMouseUp = useCallback(() => {
    setIsResizing(false);
  }, []);

  useEffect(() => {
    if (isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };
  }, [isResizing, handleMouseMove, handleMouseUp]);

  const handleLogout = useCallback(() => {
    logout();
    setIsMobileOpen(false);
  }, [logout]);

  const handleOpenSettings = useCallback(() => {
    onOpenSettings?.();
    setIsMobileOpen(false);
  }, [onOpenSettings]);

  const handleClearAllConversations = useCallback(async () => {
    try {
      await clearAllSessions.mutateAsync();
      setShowClearAllDialog(false);
      navigate('/chat');
      setIsMobileOpen(false);
    } catch {
      // Toast handled by mutation
    }
  }, [clearAllSessions, navigate]);

  return (
    <>
      {/* Mobile menu button */}
      <Button
        variant="ghost"
        size="icon"
        className="fixed top-4 left-4 z-50 md:hidden"
        onClick={() => setIsMobileOpen(!isMobileOpen)}
      >
        {isMobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
      </Button>

      {/* Sidebar */}
      <aside
        ref={sidebarRef}
        style={{ width: `${collapsed && !isMobileOpen ? 0 : width}px` }}
        className={cn(
          'fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-background transition-transform duration-200 md:relative',
          isMobileOpen ? 'translate-x-0' : '-translate-x-full',
          collapsed ? 'md:-translate-x-full md:overflow-hidden' : 'md:translate-x-0',
          isResizing && 'transition-none',
          className
        )}
      >
        {/* Header */}
        <div className="flex h-16 items-center justify-between border-b px-4">
          <h1 className="text-lg font-semibold">Mark Agent</h1>
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              aria-label={resolvedTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {resolvedTheme === 'dark' ? (
                <Sun className="h-4 w-4" />
              ) : (
                <Moon className="h-4 w-4" />
              )}
            </Button>
            {onToggleCollapse ? (
              <Button
                variant="ghost"
                size="icon"
                className="hidden md:inline-flex"
                onClick={onToggleCollapse}
                aria-label="Collapse sidebar"
              >
                <PanelLeftClose className="h-4 w-4" />
              </Button>
            ) : null}
          </div>
        </div>

        {/* New Session Button */}
        <div className="p-4">
          <NewSessionButton />
        </div>

        <Separator />

        {/* Session List */}
        <div className="flex-1 overflow-hidden">
          <SessionList />
        </div>

        <Separator />

        {/* User Menu */}
        <div className="p-4 dark:bg-card/50">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                className="h-auto w-full items-center justify-between rounded-lg px-3 py-2 text-left hover:bg-accent data-[state=open]:bg-accent"
              >
                <div className="flex-1 overflow-hidden">
                  <p className="truncate text-sm font-medium">{user?.email}</p>
                  <p className="text-xs text-muted-foreground">Signed in</p>
                </div>
                <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent
              align="start"
              side="top"
              sideOffset={8}
              className="w-[var(--radix-dropdown-menu-trigger-width)]"
            >
              <DropdownMenuItem onClick={handleLogout}>
                Logout
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={(event) => {
                  event.preventDefault();
                  setShowClearAllDialog(true);
                }}
                disabled={clearAllSessions.isPending}
                className="text-destructive focus:text-destructive"
              >
                {clearAllSessions.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Clearing conversations...
                  </>
                ) : (
                  'Clear All Conversations'
                )}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleOpenSettings}>
                Settings
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        {/* Resize handle - only visible on desktop */}
        {!collapsed ? (
          <div
            onMouseDown={handleMouseDown}
            className={cn(
              'absolute top-0 right-0 h-full w-1 cursor-col-resize hidden md:flex items-center justify-center group hover:bg-primary/20 transition-colors',
              isResizing && 'bg-primary/30'
            )}
          >
            <div className={cn(
              'absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-4 h-8 flex items-center justify-center rounded bg-border opacity-0 group-hover:opacity-100 transition-opacity',
              isResizing && 'opacity-100 bg-primary/50'
            )}>
              <GripVertical className="h-3 w-3 text-muted-foreground" />
            </div>
          </div>
        ) : null}
      </aside>

      {/* Overlay for mobile */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-background/80 backdrop-blur-sm md:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <AlertDialog open={showClearAllDialog} onOpenChange={setShowClearAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Clear all conversations?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all conversations and messages. This action cannot be
              undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={clearAllSessions.isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleClearAllConversations}
              disabled={clearAllSessions.isPending}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {clearAllSessions.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Clearing...
                </>
              ) : (
                'Clear all'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
