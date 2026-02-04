import { useState, useMemo } from 'react';
import { X, Search, Loader2, CheckCircle2, XCircle } from 'lucide-react';
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
import { ScrollArea } from '../ui/scroll-area';
import { Switch } from '../ui/switch';
import { Badge } from '../ui/badge';
import { useToast } from '../../hooks/use-toast';
import { useUserSkills, useUpdateUserSkills } from '../../hooks/useUserSkills';
import { apiClient, type UserSkill, type ExternalSkill } from '../../lib/api';
import { useQuery } from '@tanstack/react-query';

interface SkillsConfigModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type AvailableSkill = ExternalSkill;

export function SkillsConfigModal({ open, onOpenChange }: SkillsConfigModalProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [category, setCategory] = useState<string>('all');
  const { toast } = useToast();

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

    const userSkillsMap = new Map(
      userSkillsData.skills.map((s) => [s.canonicalId, s])
    );

    return availableSkillsData.skills.map((skill) => {
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
  }, [availableSkillsData, userSkillsData, pendingChanges]);

  // Filter skills based on search and category
  const filteredSkills = useMemo(() => {
    let filtered = combinedSkills;

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (skill) =>
          skill.name.toLowerCase().includes(query) ||
          skill.description.toLowerCase().includes(query)
      );
    }

    // Filter by category
    if (category !== 'all') {
      filtered = filtered.filter((skill) => skill.category === category);
    }

    return filtered;
  }, [combinedSkills, searchQuery, category]);

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<string>();
    combinedSkills.forEach((skill) => {
      if (skill.category) cats.add(skill.category);
    });
    return ['all', ...Array.from(cats).sort()];
  }, [combinedSkills]);

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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[80vh] flex flex-col p-0">
        <DialogHeader className="px-6 pt-6 pb-4">
          <DialogTitle>Skills</DialogTitle>
          <DialogDescription>
            Skills provide the agent with pre-packaged best practices and tools.
          </DialogDescription>
        </DialogHeader>

        {/* Search and filter controls */}
        <div className="px-6 pb-4 space-y-3">
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
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
              className="px-3 py-2 border rounded-md text-sm"
            >
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat === 'all' ? 'All types' : cat}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Skills list */}
        <ScrollArea className="flex-1 px-6">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
            </div>
          ) : filteredSkills.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <p>No skills found</p>
            </div>
          ) : (
            <div className="space-y-3 pb-4">
              {filteredSkills.map((skill) => (
                <div
                  key={skill.canonicalId}
                  className="border rounded-lg p-4 space-y-2"
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
                      <p className="text-sm text-muted-foreground">
                        {skill.description}
                      </p>
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
                          <CheckCircle2 className="h-4 w-4 mr-1" />
                          Add
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>

        {/* Footer */}
        <DialogFooter className="px-6 py-4 border-t">
          <Button variant="outline" onClick={handleCancel} disabled={updateMutation.isPending}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={!hasPendingChanges || updateMutation.isPending}
          >
            {updateMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
