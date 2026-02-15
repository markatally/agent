import { useState, useMemo, useEffect, useRef } from 'react';
import { Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
import { useVirtualizer } from '@tanstack/react-virtual';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { useToast } from '../../hooks/use-toast';
import { useUserSkills, useUpdateUserSkills } from '../../hooks/useUserSkills';
import { apiClient, type ExternalSkill } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';
import { useChatLayout, type ChatLayoutMode } from '../../hooks/useChatLayout';

export type SettingsTab = 'layout' | 'skills';

interface SkillsConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialTab?: SettingsTab;
}

type AvailableSkill = ExternalSkill;
type CombinedSkill = AvailableSkill & {
  isInUserSet: boolean;
  enabled: boolean;
  addedAt?: string;
  updatedAt?: string;
};

const LAYOUT_OPTIONS: Array<{
  mode: ChatLayoutMode;
  label: string;
  description: string;
  previewWidthClass: string;
}> = [
  {
    mode: 'narrow',
    label: 'Narrow',
    description: 'Focused reading width',
    previewWidthClass: 'w-[45%]',
  },
  {
    mode: 'normal',
    label: 'Normal',
    description: 'Balanced default',
    previewWidthClass: 'w-[62%]',
  },
  {
    mode: 'wide',
    label: 'Wide',
    description: 'More room for content',
    previewWidthClass: 'w-[80%]',
  },
];

function normalizeText(value: string | null | undefined): string {
  return (value || '').trim().toLowerCase();
}

function skillDisplayKey(skill: Pick<CombinedSkill, 'name' | 'description' | 'category'>): string {
  return [
    normalizeText(skill.name),
    normalizeText(skill.description),
    normalizeText(skill.category),
  ].join('|');
}

function preferCombinedSkill(a: CombinedSkill, b: CombinedSkill): CombinedSkill {
  // Prefer skills already in user's set to preserve existing state/actions.
  if (a.isInUserSet !== b.isInUserSet) return a.isInUserSet ? a : b;
  // Then prefer enabled entries.
  if (a.enabled !== b.enabled) return a.enabled ? a : b;
  // Then prefer official entries (repo-backed metadata).
  const aOfficial = Boolean(a.source?.repoUrl);
  const bOfficial = Boolean(b.source?.repoUrl);
  if (aOfficial !== bOfficial) return aOfficial ? a : b;
  // Then prefer richer description.
  const aDescLen = a.description?.length ?? 0;
  const bDescLen = b.description?.length ?? 0;
  if (aDescLen !== bDescLen) return aDescLen > bDescLen ? a : b;
  return a;
}

export function SkillsConfigModal({
  open,
  onOpenChange,
  initialTab = 'skills',
}: SkillsConfigModalProps) {
  const [activeTab, setActiveTab] = useState<SettingsTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const [scope, setScope] = useState<'added' | 'all'>('all');
  const [enabledOnly, setEnabledOnly] = useState(false);
  const [hideAdded, setHideAdded] = useState(false);
  const [officialOnly, setOfficialOnly] = useState(false);
  const { toast } = useToast();
  const { mode: chatLayoutMode, setMode: setChatLayoutMode } = useChatLayout();

  useEffect(() => {
    if (!open) return;
    setActiveTab(initialTab);
  }, [initialTab, open]);

  // Fetch all available external skills
  const { data: availableSkillsData, isLoading: loadingAvailable } = useQuery({
    queryKey: ['external-skills'],
    queryFn: () => apiClient.externalSkills.list(),
    enabled: open,
  });

  // Fetch user's skill preferences
  const { data: userSkillsData, isLoading: loadingUserSkills } = useUserSkills();

  // Update mutation
  const updateMutation = useUpdateUserSkills();

  // Local state for pending changes
  const [pendingChanges, setPendingChanges] = useState<
    Map<string, { enabled: boolean; isInUserSet: boolean }>
  >(new Map());

  // Combine available skills with user preferences
  const combinedSkills = useMemo(() => {
    if (!availableSkillsData?.skills || !userSkillsData?.skills) {
      return [];
    }

    const userSkillsMap = new Map(userSkillsData.skills.map((s) => [s.canonicalId, s]));

    const enriched = availableSkillsData.skills.map((skill) => {
      const userSkill = userSkillsMap.get(skill.canonicalId);
      const pending = pendingChanges.get(skill.canonicalId);

      return {
        ...skill,
        isInUserSet: pending?.isInUserSet ?? !!userSkill,
        enabled: pending?.enabled ?? userSkill?.enabled ?? false,
        addedAt: userSkill?.addedAt,
        updatedAt: userSkill?.updatedAt,
      };
    });

    // 1) Strict dedupe by canonicalId to avoid accidental repeated rows from source payloads.
    const byCanonical = new Map<string, CombinedSkill>();
    for (const skill of enriched) {
      const existing = byCanonical.get(skill.canonicalId);
      byCanonical.set(skill.canonicalId, existing ? preferCombinedSkill(existing, skill) : skill);
    }

    // 2) Soft dedupe by display identity (name+description+category) to collapse
    // same skill published under multiple canonical IDs.
    const byDisplay = new Map<string, CombinedSkill>();
    for (const skill of byCanonical.values()) {
      const displayKey = skillDisplayKey(skill);
      const existing = byDisplay.get(displayKey);
      byDisplay.set(displayKey, existing ? preferCombinedSkill(existing, skill) : skill);
    }

    return Array.from(byDisplay.values());
  }, [availableSkillsData, userSkillsData, pendingChanges]);

  // Filter skills based on scope, quick filters, search, and category
  const filteredSkills = useMemo(() => {
    let filtered = combinedSkills;

    // 1. Scope filter
    if (scope === 'added') {
      filtered = filtered.filter((skill) => skill.isInUserSet);
    }

    // 2. Quick filters (contextual)
    if (scope === 'added' && enabledOnly) {
      filtered = filtered.filter((skill) => skill.enabled);
    }
    if (scope === 'all' && hideAdded) {
      filtered = filtered.filter((skill) => !skill.isInUserSet);
    }
    if (scope === 'all' && officialOnly) {
      filtered = filtered.filter((skill) => !!skill.source.repoUrl);
    }

    // 3. Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query)
      );
    }

    // 4. Filter by category
    if (category !== 'all') {
      filtered = filtered.filter((skill) => skill.category === category);
    }

    return filtered;
  }, [combinedSkills, scope, enabledOnly, hideAdded, officialOnly, searchQuery, category]);

  // Get unique categories from scoped skills
  const categories = useMemo(() => {
    const scopedSkills =
      scope === 'added' ? combinedSkills.filter((skill) => skill.isInUserSet) : combinedSkills;
    const cats = new Set<string>();
    scopedSkills.forEach((skill) => {
      if (skill.category) cats.add(skill.category);
    });
    return ['all', ...Array.from(cats).sort()];
  }, [combinedSkills, scope]);

  // Default scope on open based on user state
  useEffect(() => {
    if (open && userSkillsData?.skills) {
      setScope(userSkillsData.skills.length > 0 ? 'added' : 'all');
      // Reset filters when modal opens
      setEnabledOnly(false);
      setHideAdded(false);
      setOfficialOnly(false);
    }
  }, [open, userSkillsData]);

  // Compute counts for tab labels
  const addedCount = useMemo(() => combinedSkills.filter((s) => s.isInUserSet).length, [combinedSkills]);
  const allCount = combinedSkills.length;

  // Handle add skill to user's set
  const handleAddSkill = (canonicalId: string) => {
    setPendingChanges((prev) => {
      const newChanges = new Map(prev);
      newChanges.set(canonicalId, { enabled: true, isInUserSet: true });
      return newChanges;
    });
  };

  // Handle remove skill from user's set
  const handleRemoveSkill = (canonicalId: string) => {
    setPendingChanges((prev) => {
      const newChanges = new Map(prev);
      newChanges.set(canonicalId, { enabled: false, isInUserSet: false });
      return newChanges;
    });
  };

  // Handle toggle enabled state
  const handleToggleEnabled = (canonicalId: string, enabled: boolean) => {
    setPendingChanges((prev) => {
      const newChanges = new Map(prev);
      const current = prev.get(canonicalId);
      newChanges.set(canonicalId, {
        enabled,
        isInUserSet: current?.isInUserSet ?? true,
      });
      return newChanges;
    });
  };

  // Handle save
  const handleSave = async () => {
    try {
      // Build the update payload
      const skillsToUpdate = combinedSkills
        .filter((skill) => skill.isInUserSet)
        .map((skill) => ({
          canonicalId: skill.canonicalId,
          enabled: skill.enabled,
        }));

      await updateMutation.mutateAsync(skillsToUpdate);

      toast({
        title: 'Skills updated',
        description: 'Your skill preferences have been saved.',
      });

      // Clear pending changes and close
      setPendingChanges(new Map());
      onOpenChange(false);
    } catch (error) {
      toast({
        title: 'Failed to update skills',
        description: error instanceof Error ? error.message : 'Unknown error',
        variant: 'destructive',
      });
    }
  };

  // Handle cancel
  const handleCancel = () => {
    setPendingChanges(new Map());
    onOpenChange(false);
  };

  const isLoading = loadingAvailable || loadingUserSkills;
  const hasPendingChanges = pendingChanges.size > 0;

  // Virtualization
  const parentRef = useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredSkills.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 120, // approx row height
    overscan: 5,
    measureElement: (el) => el.getBoundingClientRect().height,
  });

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      virtualizer.measure();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, filteredSkills.length, virtualizer]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] max-w-4xl flex-col overflow-hidden p-0">
        <DialogHeader className="flex-shrink-0 px-6 pb-4 pt-6">
          <DialogTitle>Settings</DialogTitle>
          <DialogDescription>
            Configure layout preferences and skill availability.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as SettingsTab)}
          className="flex min-h-0 flex-1 flex-col"
        >
          <div className="border-b px-6 pb-4">
            <TabsList>
              <TabsTrigger value="layout">Layout</TabsTrigger>
              <TabsTrigger value="skills">Skills</TabsTrigger>
            </TabsList>
          </div>

          <TabsContent value="layout" className="m-0 flex min-h-0 flex-1 flex-col">
            <div className="flex-1 overflow-auto px-6 py-5">
              <h3 className="text-base font-semibold">Layout</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Control how wide the center chat content appears.
              </p>
              <div className="mt-4 grid gap-3 md:grid-cols-3">
                {LAYOUT_OPTIONS.map((option) => {
                  const isActive = chatLayoutMode === option.mode;
                  return (
                    <button
                      key={option.mode}
                      type="button"
                      onClick={() => setChatLayoutMode(option.mode)}
                      className={`rounded-xl border p-3 text-left transition ${
                        isActive
                          ? 'border-primary bg-primary/5 shadow-sm'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <div className="rounded-lg border border-border bg-muted/40 p-3">
                        <div className={`mx-auto h-16 rounded-md border border-border bg-background ${option.previewWidthClass}`} />
                      </div>
                      <p className="mt-3 text-sm font-medium">{option.label}</p>
                      <p className="text-xs text-muted-foreground">{option.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>
            <DialogFooter className="border-t px-6 py-4">
              <Button variant="outline" onClick={() => onOpenChange(false)}>
                Close
              </Button>
            </DialogFooter>
          </TabsContent>

          <TabsContent value="skills" className="m-0 flex min-h-0 flex-1 flex-col">
            <div className="sticky top-0 z-10 flex-shrink-0 space-y-3 border-b bg-background px-6 pb-4">
              <Tabs value={scope} onValueChange={(value) => setScope(value as 'added' | 'all')}>
                <TabsList>
                  <TabsTrigger value="added">Added ({addedCount})</TabsTrigger>
                  <TabsTrigger value="all">All ({allCount})</TabsTrigger>
                </TabsList>
              </Tabs>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                  <Input
                    placeholder="Search skills..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="h-10 min-w-[9.5rem] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                >
                  {categories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat === 'all' ? 'All types' : cat}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex gap-2">
                {scope === 'added' ? (
                  <Badge
                    variant={enabledOnly ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setEnabledOnly(!enabledOnly)}
                  >
                    Enabled only
                  </Badge>
                ) : (
                  <>
                    <Badge
                      variant={hideAdded ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setHideAdded(!hideAdded)}
                    >
                      Hide added
                    </Badge>
                    <Badge
                      variant={officialOnly ? 'default' : 'outline'}
                      className="cursor-pointer"
                      onClick={() => setOfficialOnly(!officialOnly)}
                    >
                      Official only
                    </Badge>
                  </>
                )}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-hidden px-6">
              <TooltipProvider delayDuration={300}>
                {isLoading ? (
                  <div className="flex items-center justify-center py-12">
                    <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                  </div>
                ) : filteredSkills.length === 0 ? (
                  <div className="py-12 text-center">
                    {scope === 'added' && !searchQuery ? (
                      <div className="space-y-4">
                        <p className="text-muted-foreground">No skills added yet</p>
                        <Button variant="outline" onClick={() => setScope('all')}>
                          Browse all skills
                        </Button>
                      </div>
                    ) : searchQuery ? (
                      <div className="space-y-4">
                        <p className="text-muted-foreground">
                          No skills match &quot;{searchQuery}&quot;
                        </p>
                        <Button variant="ghost" onClick={() => setSearchQuery('')}>
                          Clear search
                        </Button>
                      </div>
                    ) : (
                      <p className="text-muted-foreground">No skills found</p>
                    )}
                  </div>
                ) : (
                  <div ref={parentRef} className="h-full overflow-auto" data-testid="skills-scroll">
                    <div
                      style={{
                        height: `${virtualizer.getTotalSize()}px`,
                        width: '100%',
                        position: 'relative',
                      }}
                    >
                      {virtualizer.getVirtualItems().map((virtualItem) => {
                        const skill = filteredSkills[virtualItem.index];
                        return (
                          <div
                            key={skill.canonicalId}
                            data-index={virtualItem.index}
                            ref={virtualizer.measureElement}
                            style={{
                              position: 'absolute',
                              top: 0,
                              left: 0,
                              width: '100%',
                              transform: `translateY(${virtualItem.start}px)`,
                            }}
                          >
                            <div
                              className="mb-3 mr-4 space-y-2 rounded-lg border p-4"
                              data-testid="skill-card"
                              data-skill-name={skill.name}
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 space-y-1">
                                  <div className="flex items-center gap-2">
                                    <h3 className="font-semibold">{skill.name}</h3>
                                    {skill.source.repoUrl && (
                                      <Badge variant="secondary" className="text-xs">
                                        Official
                                      </Badge>
                                    )}
                                    {skill.category && (
                                      <Badge variant="outline" className="text-xs">
                                        {skill.category}
                                      </Badge>
                                    )}
                                  </div>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <p className="line-clamp-2 cursor-default text-sm text-muted-foreground">
                                        {skill.description}
                                      </p>
                                    </TooltipTrigger>
                                    <TooltipContent side="bottom" align="start" className="max-w-md">
                                      <p className="text-sm">{skill.description}</p>
                                    </TooltipContent>
                                  </Tooltip>
                                  {skill.updatedAt && (
                                    <p className="text-xs text-muted-foreground">
                                      Last updated:{' '}
                                      {new Date(skill.updatedAt).toLocaleDateString('en-US', {
                                        month: 'short',
                                        year: 'numeric',
                                      })}
                                    </p>
                                  )}
                                </div>

                                <div className="flex items-center gap-2">
                                  {skill.isInUserSet ? (
                                    <>
                                      <div className="flex items-center gap-2">
                                        <Switch
                                          checked={skill.enabled}
                                          onCheckedChange={(checked) =>
                                            handleToggleEnabled(skill.canonicalId, checked)
                                          }
                                        />
                                        <span className="text-sm text-muted-foreground">
                                          {skill.enabled ? 'Enabled' : 'Disabled'}
                                        </span>
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => handleRemoveSkill(skill.canonicalId)}
                                        title="Remove skill"
                                      >
                                        <XCircle className="h-4 w-4" />
                                      </Button>
                                    </>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => handleAddSkill(skill.canonicalId)}
                                    >
                                      <CheckCircle2 className="mr-1 h-4 w-4" />
                                      Add
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </TooltipProvider>
            </div>

            <DialogFooter className="flex-shrink-0 border-t px-6 py-4">
              <Button variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={!hasPendingChanges || updateMutation.isPending}>
                {updateMutation.isPending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save'
                )}
              </Button>
            </DialogFooter>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
