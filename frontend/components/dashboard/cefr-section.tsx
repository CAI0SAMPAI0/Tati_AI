'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  Loader2,
  BookOpen,
  PenTool,
  Clapperboard,
  Trash2,
  Info,
  Layers,
  FileIcon,
  X,
  Calendar,
  Clock,
  Settings,
  ToggleLeft,
  ToggleRight,
  Pencil,
  Check,
  Eye,
  EyeOff,
  Plus
} from 'lucide-react';
import { apiUpload, apiPost, apiGet, apiDelete, apiPut } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { DialogModal } from '@/components/ui/dialog-modal';
import { LEVEL_OPTIONS } from '@/lib/constants/levels';
import toast from 'react-hot-toast';

const WEEKDAYS_OPTIONS = [
  { value: 'mon', label: 'Monday' },
  { value: 'tue', label: 'Tuesday' },
  { value: 'wed', label: 'Wednesday' },
  { value: 'thu', label: 'Thursday' },
  { value: 'fri', label: 'Friday' },
  { value: 'sat', label: 'Saturday' },
  { value: 'sun', label: 'Sunday' }
];

export function CefrSection() {
  const [level, setLevel] = useState('A1');
  const [topic, setTopic] = useState('');
  const [cefrTitle, setCefrTitle] = useState('');
  const [cardCount, setCardCount] = useState(10);
  const [exerciseCount, setExerciseCount] = useState(10);
  const [simulationCount] = useState(1);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [references, setReferences] = useState<any[]>([]);
  const [loadingReferences, setLoadingReferences] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [generatingFlashcards, setGeneratingFlashcards] = useState(false);
  const [generatingExercises, setGeneratingExercises] = useState(false);
  const [generatingSimulations, setGeneratingSimulations] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<{ success: boolean; message: string } | null>(null);

  // Phase 3: State for selected references to feed RAG
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [filterLevel, setFilterLevel] = useState<string>('All');

  // Phase 2: Scheduling states
  const [schedules, setSchedules] = useState<any[]>([]);
  const [loadingSchedules, setLoadingSchedules] = useState(false);
  const [scheduleActive, setScheduleActive] = useState(true);
  const [scheduleWeekdays, setScheduleWeekdays] = useState<string[]>([]);
  const [scheduleTime, setScheduleTime] = useState('06:00');
  const [scheduleLimit, setScheduleLimit] = useState(5);
  const [savingSchedule, setSavingSchedule] = useState(false);
  const [editingScheduleId, setEditingScheduleId] = useState<string | null>(null);
  const [scheduleTypes, setScheduleTypes] = useState<string[]>(['flashcards', 'exercises', 'simulations']);

  // Top-level tabs
  const [activeMainTab, setActiveMainTab] = useState<'configure' | 'curator'>('configure');

  // Curator Panel states
  const [generatedFlashcards, setGeneratedFlashcards] = useState<any[]>([]);
  const [generatedExercises, setGeneratedExercises] = useState<any[]>([]);
  const [generatedSimulations, setGeneratedSimulations] = useState<any[]>([]);
  const [loadingGenerated, setLoadingGenerated] = useState(false);
  const [generatedFilterLevel, setGeneratedFilterLevel] = useState<string>('All');
  const [curatorStatusFilter, setCuratorStatusFilter] = useState<'All' | 'Drafts' | 'Published'>('Drafts');
  const [activeCuratorTab, setActiveCuratorTab] = useState<'flashcards' | 'modules' | 'simulations'>('flashcards');

  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [editingItemType, setEditingItemType] = useState<'flashcard' | 'exercise' | 'simulation' | null>(null);
  const [editForm, setEditForm] = useState<any>({});
  const [savingEdit, setSavingEdit] = useState(false);

  const fetchGeneratedContent = async (silent = false) => {
    if (!silent) setLoadingGenerated(true);
    try {
      const res = await apiGet<{ success: boolean; flashcards?: any[]; exercises?: any[]; simulations?: any[] }>('/cefr/admin/all');
      if (res) {
        setGeneratedFlashcards(res.flashcards || []);
        setGeneratedExercises(res.exercises || []);
        setGeneratedSimulations(res.simulations || []);
      }
    } catch (err) {
      console.error('Error fetching generated content:', err);
    } finally {
      if (!silent) setLoadingGenerated(false);
    }
  };

  const handleTogglePublishFlashcardGroup = async (group: any) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/flashcards/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}&is_published=${!group.is_published}`, null);
      if (res.ok) {
        toast.success(!group.is_published ? 'Flashcard deck approved & published!' : 'Flashcard deck returned to drafts.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error updating status.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status.');
    }
  };

  const handleDeleteFlashcardGroup = async (group: any) => {
    if (!confirm(`Are you sure you want to delete flashcard deck "${group.topic}"?`)) return;
    try {
      const res = await apiDelete(`/cefr/admin/flashcards/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}`);
      if (res.ok) {
        toast.success('Flashcard deck deleted successfully.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error deleting flashcard deck.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting flashcard deck.');
    }
  };

  const handleTogglePublishExerciseGroup = async (group: any) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/exercises/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}&is_published=${!group.is_published}`, null);
      if (res.ok) {
        toast.success(!group.is_published ? 'Quiz approved & published!' : 'Quiz returned to drafts.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error updating status.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status.');
    }
  };

  const handleDeleteExerciseGroup = async (group: any) => {
    if (!confirm(`Are you sure you want to delete quiz "${group.topic}"?`)) return;
    try {
      const res = await apiDelete(`/cefr/admin/exercises/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}`);
      if (res.ok) {
        toast.success('Quiz deleted successfully.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error deleting quiz.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting quiz.');
    }
  };

  const handleTogglePublishSimulation = async (id: string, currentStatus: boolean) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/simulations/${id}`, { is_published: !currentStatus });
      if (res.ok) {
        toast.success(!currentStatus ? 'Simulation approved & published!' : 'Simulation returned to drafts.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error updating status.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status.');
    }
  };

  const handleDeleteSimulation = async (id: string) => {
    if (!confirm('Are you sure you want to delete this simulation?')) return;
    try {
      const res = await apiDelete(`/cefr/admin/simulations/${id}`);
      if (res.ok) {
        toast.success('Simulation deleted successfully.');
        fetchGeneratedContent(true);
      } else {
        toast.error('Error deleting simulation.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting simulation.');
    }
  };

  const handleStartEditFlashcardGroup = (group: any) => {
    setEditingItem(group);
    setEditingItemType('flashcard');
    setEditForm({
      old_level: group.level,
      old_topic: group.topic,
      new_level: group.level,
      new_topic: group.topic,
      flashcards: group.cards.map((c: any) => ({
        front: c.front || '',
        back: c.back || '',
        explanation: c.explanation || '',
        image_url: c.image_url || ''
      }))
    });
  };

  const handleStartEditExerciseGroup = (group: any) => {
    setEditingItem(group);
    setEditingItemType('exercise');
    setEditForm({
      old_level: group.level,
      old_topic: group.topic,
      new_level: group.level,
      new_topic: group.topic,
      exercises: group.questions.map((q: any) => ({
        question: q.question || '',
        options: q.options || ['', '', '', ''],
        correct_index: q.correct_index ?? 0,
        explanation: q.explanation || ''
      }))
    });
  };

  const handleStartEditItem = (item: any, type: 'flashcard' | 'exercise' | 'simulation') => {
    setEditingItem(item);
    setEditingItemType(type);
    if (type === 'simulation') {
      setEditForm({
        topic: item.topic || '',
        scenario: item.scenario || '',
        goal: item.goal || '',
        level: item.level || ''
      });
    }
  };

  const handleSaveEditItem = async () => {
    if (!editingItem || !editingItemType) return;
    setSavingEdit(true);
    try {
      let res;
      if (editingItemType === 'flashcard') {
        res = await apiPost<any>(`/cefr/admin/flashcards/group/save`, editForm);
      } else if (editingItemType === 'exercise') {
        res = await apiPost<any>(`/cefr/admin/exercises/group/save`, editForm);
      } else if (editingItemType === 'simulation') {
        res = await apiPut<any>(`/cefr/admin/simulations/${editingItem.id}`, editForm);
      }

      if (res && res.ok) {
        toast.success('Material updated successfully!');
        setEditingItem(null);
        setEditingItemType(null);
        setEditForm({});
        fetchGeneratedContent(true);
      } else {
        toast.error('Error updating material.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating material.');
    } finally {
      setSavingEdit(false);
    }
  };

  const groupedFlashcards = useMemo(() => {
    const groups: Record<string, { level: string; topic: string; is_published: boolean; cards: any[]; id: string }> = {};
    generatedFlashcards.forEach(card => {
      const key = `${card.level}_${card.topic}`;
      if (!groups[key]) {
        groups[key] = {
          id: `cefr_fc_${card.level.toLowerCase()}_${card.topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
          level: card.level,
          topic: card.topic,
          is_published: true,
          cards: []
        };
      }
      groups[key].cards.push(card);
      if (!card.is_published) {
        groups[key].is_published = false;
      }
    });
    return Object.values(groups);
  }, [generatedFlashcards]);

  const groupedExercises = useMemo(() => {
    const groups: Record<string, { level: string; topic: string; is_published: boolean; questions: any[]; id: string }> = {};
    generatedExercises.forEach(ex => {
      const key = `${ex.level}_${ex.topic}`;
      if (!groups[key]) {
        groups[key] = {
          id: `cefr_ex_${ex.level.toLowerCase()}_${ex.topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase()}`,
          level: ex.level,
          topic: ex.topic,
          is_published: true,
          questions: []
        };
      }
      groups[key].questions.push(ex);
      if (!ex.is_published) {
        groups[key].is_published = false;
      }
    });
    return Object.values(groups);
  }, [generatedExercises]);

  const activeGroupedFlashcards = useMemo(() => {
    return groupedFlashcards.filter((group: any) => {
      const matchLevel = generatedFilterLevel === 'All' || group.level === generatedFilterLevel;
      const matchStatus = curatorStatusFilter === 'All'
        || (curatorStatusFilter === 'Drafts' && !group.is_published)
        || (curatorStatusFilter === 'Published' && group.is_published);
      return matchLevel && matchStatus;
    });
  }, [groupedFlashcards, generatedFilterLevel, curatorStatusFilter]);

  const activeGroupedExercises = useMemo(() => {
    return groupedExercises.filter((group: any) => {
      const matchLevel = generatedFilterLevel === 'All' || group.level === generatedFilterLevel;
      const matchStatus = curatorStatusFilter === 'All'
        || (curatorStatusFilter === 'Drafts' && !group.is_published)
        || (curatorStatusFilter === 'Published' && group.is_published);
      return matchLevel && matchStatus;
    });
  }, [groupedExercises, generatedFilterLevel, curatorStatusFilter]);

  const activeSimulations = useMemo(() => {
    return generatedSimulations.filter((sim: any) => {
      const matchLevel = generatedFilterLevel === 'All' || sim.level === generatedFilterLevel;
      const matchStatus = curatorStatusFilter === 'All'
        || (curatorStatusFilter === 'Drafts' && !sim.is_published)
        || (curatorStatusFilter === 'Published' && sim.is_published);
      return matchLevel && matchStatus;
    });
  }, [generatedSimulations, generatedFilterLevel, curatorStatusFilter]);

  const activeList = useMemo(() => {
    if (activeCuratorTab === 'flashcards') return activeGroupedFlashcards;
    if (activeCuratorTab === 'modules') return activeGroupedExercises;
    return activeSimulations;
  }, [activeCuratorTab, activeGroupedFlashcards, activeGroupedExercises, activeSimulations]);

  const handlePublishAllFiltered = async () => {
    let itemsToPublish: any[] = [];
    let endpointPrefix = '';
     if (activeCuratorTab === 'flashcards') {
      activeGroupedFlashcards.filter((g: any) => !g.is_published).forEach((g: any) => {
        itemsToPublish.push(g);
      });
      endpointPrefix = '/cefr/admin/flashcards/group';
    } else if (activeCuratorTab === 'modules') {
      activeGroupedExercises.filter((g: any) => !g.is_published).forEach((g: any) => {
        itemsToPublish.push(g);
      });
      endpointPrefix = '/cefr/admin/exercises/group';
    } else if (activeCuratorTab === 'simulations') {
      activeSimulations.filter((s: any) => !s.is_published).forEach((s: any) => {
        itemsToPublish.push(s);
      });
      endpointPrefix = '/cefr/admin/simulations';
    }

    if (itemsToPublish.length === 0) {
      toast.error("No drafts to publish in the current filtered list.");
      return;
    }
    const toastId = toast.loading(`Publishing ${itemsToPublish.length} items...`);
    try {
      const results = await Promise.all(
        itemsToPublish.map((item: any) => {
          if (activeCuratorTab === 'simulations') {
            return apiPut<any>(`${endpointPrefix}/${item.id}`, { is_published: true });
          } else {
            return apiPut<any>(`${endpointPrefix}?level=${item.level}&topic=${encodeURIComponent(item.topic)}&is_published=true`, null);
          }
        })
      );
      const failedCount = results.filter((res: any) => !res.ok).length;
      if (failedCount > 0) {
        toast.error(`Failed to publish ${failedCount} items.`, { id: toastId });
      } else {
        toast.success(`Successfully published ${itemsToPublish.length} items!`, { id: toastId });
      }
      fetchGeneratedContent(true);
    } catch (err) {
      toast.error("Error publishing items.", { id: toastId });
    }
  };

  const fetchReferences = async () => {
    setLoadingReferences(true);
    try {
      const res = await apiGet<{ success: boolean; references: any[] }>('/cefr/admin/references');
      if (res && res.references) {
        setReferences(res.references);
      }
    } catch (err) {
      console.error('Error fetching references:', err);
    } finally {
      setLoadingReferences(false);
    }
  };

  const fetchSchedules = async () => {
    setLoadingSchedules(true);
    try {
      const res = await apiGet<{ success: boolean; schedules: any[] }>('/cefr/admin/schedules');
      if (res && res.schedules) {
        setSchedules(res.schedules);
      }
    } catch (err) {
      console.error('Error fetching schedules:', err);
    } finally {
      setLoadingSchedules(false);
    }
  };

  useEffect(() => {
    fetchReferences();
    fetchSchedules();
    fetchGeneratedContent();
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const filesArray = Array.from(e.target.files);
    
    if (selectedFiles.length + filesArray.length > 10) {
      toast.error('Only 10 files can be uploaded at a time.');
      return;
    }

    const validFiles = filesArray.filter(f => {
      const ext = f.name.split('.').pop()?.toLowerCase();
      return ext && ['pdf', 'docx', 'txt'].includes(ext);
    });

    if (validFiles.length !== filesArray.length) {
      toast.error('Some files were ignored. Only PDF, DOCX and TXT are accepted.');
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
  };

  const handleRemoveSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;
    setUploading(true);
    setUploadStatus(null);

    const formData = new FormData();
    selectedFiles.forEach(f => {
      formData.append('files', f);
    });

    try {
      const res = await apiUpload<{ success: boolean; results: any[] }>(
        `/cefr/admin/upload-material?level=${level}`,
        formData
      );

      if (res.ok && res.data.results) {
        const successCount = res.data.results.filter((r: any) => r.success).length;
        const failCount = res.data.results.filter((r: any) => !r.success).length;

        if (failCount === 0) {
          toast.success(`${successCount} file(s) uploaded and indexed successfully!`);
        } else {
          toast.success(`${successCount} uploaded successfully. ${failCount} failed.`);
        }

        setUploadStatus({
          success: true,
          message: `${successCount} file(s) indexed successfully. ${failCount} failure(s).`
        });
        setSelectedFiles([]);
        fetchReferences();
      } else {
        setUploadStatus({ success: false, message: 'Upload failed on server.' });
      }
    } catch (err: any) {
      setUploadStatus({ success: false, message: err.message || 'Error uploading files.' });
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteReference = async (id: string) => {
    if (!confirm('Are you sure you want to delete this reference? All chunks and associated files will be removed.')) return;
    try {
      const res = await apiDelete(`/cefr/admin/references/${id}`);
      if (res.ok) {
        toast.success('Reference deleted successfully!');
        setSelectedRefIds(prev => prev.filter(refId => refId !== id));
        fetchReferences();
      } else {
        toast.error('Failed to delete reference.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting reference.');
    }
  };

  const toggleSelectReference = (id: string) => {
    setSelectedRefIds(prev => 
      prev.includes(id) ? prev.filter(refId => refId !== id) : [...prev, id]
    );
  };

  const toggleWeekdaySelection = (day: string) => {
    setScheduleWeekdays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  const handleSaveSchedule = async () => {
    if (scheduleWeekdays.length === 0) {
      toast.error('Please select at least one day of the week for scheduling.');
      return;
    }
    if (scheduleTypes.length === 0) {
      toast.error('Please select at least one type of material to generate.');
      return;
    }
    setSavingSchedule(true);
    try {
      const body = {
        active: scheduleActive,
        weekdays: scheduleWeekdays,
        execution_time: scheduleTime,
        weekly_frequency: 1,
        materials_per_execution: scheduleLimit,
        selected_types: scheduleTypes
      };

      let res;
      if (editingScheduleId) {
        res = await apiPut<any>(`/cefr/admin/schedules/${editingScheduleId}`, body);
      } else {
        res = await apiPost<{ success: boolean; data: any }>('/cefr/admin/schedules', body);
      }

      if (res.ok) {
        toast.success(editingScheduleId ? 'Schedule updated successfully!' : 'Schedule configured successfully!');
        setScheduleWeekdays([]);
        setScheduleTime('06:00');
        setScheduleLimit(5);
        setScheduleTypes(['flashcards', 'exercises', 'simulations']);
        setEditingScheduleId(null);
        setScheduleActive(true);
        fetchSchedules();
      } else {
        toast.error(editingScheduleId ? 'Error updating schedule.' : 'Error creating schedule.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error saving schedule.');
    } finally {
      setSavingSchedule(false);
    }
  };

  const handleStartEditSchedule = (sch: any) => {
    setEditingScheduleId(sch.id);
    setScheduleWeekdays(sch.weekdays || []);
    setScheduleTime(sch.execution_time.slice(0, 5));
    setScheduleLimit(sch.materials_per_execution || 5);
    setScheduleActive(sch.active);
    setScheduleTypes(sch.selected_types || ['flashcards', 'exercises', 'simulations']);
  };

  const handleCancelEditSchedule = () => {
    setEditingScheduleId(null);
    setScheduleWeekdays([]);
    setScheduleTime('06:00');
    setScheduleLimit(5);
    setScheduleActive(true);
    setScheduleTypes(['flashcards', 'exercises', 'simulations']);
  };

  const handleToggleSchedule = async (id: string, currentActive: boolean) => {
    try {
      const res = await apiPut<any>(`/cefr/admin/schedules/${id}`, { active: !currentActive });
      if (res.ok) {
        toast.success('Schedule status updated!');
        fetchSchedules();
      } else {
        toast.error('Error updating status.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error updating status.');
    }
  };

  const handleDeleteSchedule = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schedule?')) return;
    try {
      const res = await apiDelete(`/cefr/admin/schedules/${id}`);
      if (res.ok) {
        toast.success('Schedule deleted successfully!');
        fetchSchedules();
      } else {
        toast.error('Error deleting schedule.');
      }
    } catch (err: any) {
      toast.error(err.message || 'Error deleting schedule.');
    }
  };

  const handleGenerate = async (type: 'flashcards' | 'exercises' | 'simulations') => {
    if (!topic.trim()) return;

    if (type === 'flashcards') setGeneratingFlashcards(true);
    else if (type === 'exercises') setGeneratingExercises(true);
    else if (type === 'simulations') setGeneratingSimulations(true);

    try {
      let endpoint = '';
      if (type === 'flashcards') {
        endpoint = `/cefr/admin/generate-flashcards?level=${level}&topic=${encodeURIComponent(topic)}&count=${cardCount}`;
        if (cefrTitle.trim()) endpoint += `&title=${encodeURIComponent(cefrTitle.trim())}`;
      } else if (type === 'exercises') {
        endpoint = `/cefr/admin/generate-exercises?level=${level}&topic=${encodeURIComponent(topic)}&count=${exerciseCount}`;
        if (cefrTitle.trim()) endpoint += `&title=${encodeURIComponent(cefrTitle.trim())}`;
      } else if (type === 'simulations') {
        endpoint = `/cefr/admin/generate-simulations?level=${level}&topic=${encodeURIComponent(topic)}&count=${simulationCount}`;
        if (cefrTitle.trim()) endpoint += `&title=${encodeURIComponent(cefrTitle.trim())}`;
      }

      let finalEndpoint = endpoint;
      if (selectedRefIds.length > 0) {
        selectedRefIds.forEach(id => {
          finalEndpoint += `&reference_ids=${id}`;
        });
      }

      const res = await apiPost<{ success: boolean; task_id?: string }>(finalEndpoint, null);

      if (res.ok && res.data.success && res.data.task_id) {
        const taskId = res.data.task_id;
        toast.loading(`Starting generation of ${type}...`, { id: taskId, duration: 4000 });

        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await apiGet<{ status: string; error?: string }>(`/tasks/status/${taskId}`);
            if (statusRes) {
              if (statusRes.status === 'success') {
                clearInterval(pollInterval);
                if (type === 'flashcards') setGeneratingFlashcards(false);
                else if (type === 'exercises') setGeneratingExercises(false);
                else if (type === 'simulations') setGeneratingSimulations(false);
                toast.success(`${type.charAt(0).toUpperCase() + type.slice(1)} generated successfully!`, { id: taskId });
                fetchGeneratedContent(true);
              } else if (statusRes.status === 'failed') {
                clearInterval(pollInterval);
                if (type === 'flashcards') setGeneratingFlashcards(false);
                else if (type === 'exercises') setGeneratingExercises(false);
                else if (type === 'simulations') setGeneratingSimulations(false);
                toast.error(`Failed to generate ${type}: ${statusRes.error || 'Unknown error'}`, { id: taskId });
              }
            }
          } catch (err: any) {
            clearInterval(pollInterval);
            if (type === 'flashcards') setGeneratingFlashcards(false);
            else if (type === 'exercises') setGeneratingExercises(false);
            else if (type === 'simulations') setGeneratingSimulations(false);
            toast.error(`Error checking status for ${type}: ${err.message}`, { id: taskId });
          }
        }, 2000);
      } else {
        if (type === 'flashcards') setGeneratingFlashcards(false);
        else if (type === 'exercises') setGeneratingExercises(false);
        else if (type === 'simulations') setGeneratingSimulations(false);
        toast.error('Failed to initiate content generation.');
      }
    } catch (err: any) {
      if (type === 'flashcards') setGeneratingFlashcards(false);
      else if (type === 'exercises') setGeneratingExercises(false);
      else if (type === 'simulations') setGeneratingSimulations(false);
      toast.error(err.message || 'Error generating content.');
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  const getLevelBadgeStyle = (lvl: string) => {
    const l = lvl.toUpperCase();
    if (l.startsWith('A')) return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20';
    if (l.startsWith('B')) return 'bg-sky-500/10 text-sky-500 border-sky-500/20';
    return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
  };

  const getFileIconStyle = (type: string) => {
    const t = type.toLowerCase();
    if (t === 'pdf') return 'text-red-400 bg-red-500/10';
    if (t === 'docx') return 'text-blue-400 bg-blue-500/10';
    return 'text-amber-400 bg-amber-500/10';
  };

  const formatWeekdays = (days: string[]) => {
    const labels = days.map(d => WEEKDAYS_OPTIONS.find(opt => opt.value === d.toLowerCase())?.label || d);
    return labels.join(', ');
  };

  const filteredReferences = references.filter(
    ref => filterLevel === 'All' || ref.cefr_level === filterLevel
  );
  const allFilteredSelected = filteredReferences.length > 0 && filteredReferences.every(ref => selectedRefIds.includes(ref.id));

  const handleSelectAllToggle = () => {
    if (allFilteredSelected) {
      const filteredIds = filteredReferences.map(ref => ref.id);
      setSelectedRefIds(prev => prev.filter(id => !filteredIds.includes(id)));
    } else {
      const filteredIds = filteredReferences.map(ref => ref.id);
      setSelectedRefIds(prev => {
        const newIds = [...prev];
        filteredIds.forEach(id => {
          if (!newIds.includes(id)) {
            newIds.push(id);
          }
        });
        return newIds;
      });
    }
  };

  return (
    <div className="space-y-8 max-w-5xl">
      {/* ─── MAIN LEVEL TABS ─── */}
      <div className="flex border-b border-border gap-6 mb-6">
        <button
          onClick={() => setActiveMainTab('configure')}
          className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all relative ${
            activeMainTab === 'configure'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
        >
          <Settings size={16} />
          Configure & Generate
        </button>
        <button
          onClick={() => setActiveMainTab('curator')}
          className={`flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all relative ${
            activeMainTab === 'curator'
              ? 'border-primary text-primary'
              : 'border-transparent text-text-muted hover:text-text hover:border-border'
          }`}
        >
          <Layers size={16} />
          AI Generated Curator
          {/* Badge showing count of drafts across all types */}
          {(() => {
            const draftFlashcards = generatedFlashcards.filter(f => !f.is_published).length;
            const draftExercises = generatedExercises.filter(e => !e.is_published).length;
            const draftSimulations = generatedSimulations.filter(s => !s.is_published).length;
            const totalDrafts = draftFlashcards + draftExercises + draftSimulations;
            if (totalDrafts > 0) {
              return (
                <span className="ml-1.5 px-1.5 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full">
                  {totalDrafts}
                </span>
              );
            }
            return null;
          })()}
        </button>
      </div>

      {activeMainTab === 'configure' ? (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* ─── MULTIPLE UPLOAD CARD ─── */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
              <Upload size={22} className="text-primary" />
              Import CEFR Reference Sources
            </h2>
            <p className="text-sm text-text-subtle mb-6">
              Add source pedagogical materials. The AI will process and use the content as context for generation.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Suggested Level (Default)</label>
                <select
                  value={level}
                  onChange={e => setLevel(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                >
                  {LEVEL_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-text-subtle">Files (PDF, DOCX, TXT)</label>
                
                <div className="flex flex-col gap-4">
                  <div className="relative border-2 border-dashed border-border hover:border-primary/50 transition-all rounded-xl p-6 flex flex-col items-center justify-center bg-surface-hover/40 cursor-pointer">
                    <input
                      type="file"
                      multiple
                      accept=".pdf,.docx,.txt"
                      onChange={handleFileChange}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
                    />
                    <Upload className="text-text-muted mb-2" size={28} />
                    <p className="text-sm font-medium text-text">Drag & drop or click to select</p>
                    <p className="text-xs text-text-muted mt-1">
                      Maximum of 10 files per upload. Formats: PDF, DOCX and TXT.
                    </p>
                  </div>

                  {selectedFiles.length > 0 && (
                    <div className="space-y-2 max-h-48 overflow-y-auto border border-border p-3 rounded-xl bg-bg/50">
                      <div className="flex justify-between items-center text-xs font-bold text-text-subtle pb-2 border-b border-border">
                        <span>Selected Files ({selectedFiles.length})</span>
                        <button onClick={() => setSelectedFiles([])} className="text-red-400 hover:text-red-500">Clear All</button>
                      </div>
                      {selectedFiles.map((file, idx) => (
                        <div key={idx} className="flex justify-between items-center text-sm p-2 bg-surface rounded-lg border border-border/60">
                          <div className="flex items-center gap-2 truncate">
                            <FileText size={16} className="text-primary shrink-0" />
                            <span className="truncate text-text font-medium">{file.name}</span>
                            <span className="text-xs text-text-muted">({formatBytes(file.size)})</span>
                          </div>
                          <button
                            onClick={() => handleRemoveSelectedFile(idx)}
                            className="text-text-muted hover:text-red-400 p-1 transition-colors"
                            title="Remove"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <button
                      onClick={handleUpload}
                      disabled={selectedFiles.length === 0 || uploading}
                      className="px-6 py-3 bg-primary text-white rounded-xl font-bold text-sm disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-primary-hover shadow-md shadow-primary/10 transition-all"
                    >
                      {uploading ? (
                        <>
                          <Loader2 size={16} className="animate-spin" />
                          Indexing to Database...
                        </>
                      ) : (
                        <>
                          <Upload size={16} />
                          Upload and Process ({selectedFiles.length})
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {uploadStatus && (
              <div
                className={`mt-4 p-4 rounded-xl flex items-center gap-3 text-sm font-medium border ${
                  uploadStatus.success
                    ? 'bg-green-500/5 text-green-400 border-green-500/10'
                    : 'bg-red-500/5 text-red-400 border-red-500/10'
                }`}
              >
                {uploadStatus.success ? <CheckCircle2 size={18} /> : <AlertCircle size={18} />}
                {uploadStatus.message}
              </div>
            )}
          </div>

          {/* ─── INDEXED REFERENCE MATERIALS SECTION ─── */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
              <Layers size={22} className="text-primary" />
              Available Reference Sources
            </h2>
            <p className="text-sm text-text-subtle mb-6">
              These files are indexed in the vector database. Select the materials you want to use as context to guide generation.
            </p>

            {loadingReferences ? (
              <div className="flex justify-center py-10">
                <Loader2 className="animate-spin text-primary" size={30} />
              </div>
            ) : references.length === 0 ? (
              <div className="text-center py-10 text-text-muted border border-dashed border-border rounded-xl">
                <Info className="mx-auto mb-2 opacity-50" size={24} />
                <p className="text-sm">No reference materials registered at the moment.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Toolbar for Filtering & Select All */}
                <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-bg rounded-xl border border-border/60">
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">Filter by Level:</span>
                    <div className="flex gap-1.5 flex-wrap">
                      {['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                        <button
                          key={lvl}
                          onClick={() => setFilterLevel(lvl)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                            filterLevel === lvl
                              ? 'bg-primary/10 text-primary border-primary/20'
                              : 'bg-surface text-text-subtle border-border/80 hover:border-border'
                          }`}
                        >
                          {lvl}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    onClick={handleSelectAllToggle}
                    className="px-4 py-2 bg-surface border border-border/80 hover:border-border text-text-subtle rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-sm"
                  >
                    {allFilteredSelected ? 'Deselect All Filtered' : 'Select All Filtered'}
                  </button>
                </div>

                <div className="overflow-x-auto border border-border rounded-xl">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-bg border-b border-border text-xs font-bold text-text-subtle uppercase">
                        <th className="p-3 w-10">Use</th>
                        <th className="p-3">File Name</th>
                        <th className="p-3 w-24">CEFR Level</th>
                        <th className="p-3 w-20">Type</th>
                        <th className="p-3 w-28">Size</th>
                        <th className="p-3 w-24 text-center">Chunks</th>
                        <th className="p-3 w-16 text-center">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {filteredReferences.map((ref) => (
                        <tr key={ref.id} className="hover:bg-bg/40 transition-colors">
                          <td className="p-3 text-center">
                            <input
                              type="checkbox"
                              checked={selectedRefIds.includes(ref.id)}
                              onChange={() => toggleSelectReference(ref.id)}
                              className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 bg-bg cursor-pointer"
                            />
                          </td>
                          <td className="p-3 font-medium text-text max-w-xs truncate" title={ref.filename}>
                            {ref.filename}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-full border ${getLevelBadgeStyle(ref.cefr_level)}`}>
                              {ref.cefr_level}
                            </span>
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 text-xs font-semibold rounded-md shrink-0 border ${getFileIconStyle(ref.file_type)}`}>
                              {ref.file_type.toUpperCase()}
                            </span>
                          </td>
                          <td className="p-3 text-sm text-text-muted">
                            {formatBytes(ref.file_size)}
                          </td>
                          <td className="p-3 text-sm text-center text-text font-semibold">
                            {ref.chunks_indexed}
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={() => handleDeleteReference(ref.id)}
                              className="text-text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                              title="Delete reference"
                            >
                              <Trash2 size={16} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {filteredReferences.length === 0 && (
                    <div className="text-center py-12 text-text-muted bg-bg/20">
                      <Info className="mx-auto mb-2 opacity-40" size={24} />
                      <p className="text-sm font-medium">No materials indexed for level "{filterLevel}".</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ─── CONTENT GENERATION CARD ─── */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
              <BookOpen size={22} className="text-primary" />
              Generate Content from References
            </h2>
            <p className="text-sm text-text-subtle mb-6">
              Create new study materials based on the selected level and references checked above.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Content Title (Optional)</label>
                <input
                  type="text"
                  placeholder="e.g. At the Supermarket (If empty, prompt will be used)"
                  value={cefrTitle}
                  onChange={e => setCefrTitle(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Topic / Situation (Detailed prompt for the AI)</label>
                <input
                  type="text"
                  placeholder="e.g. Shopping at the supermarket and talking to a cashier"
                  value={topic}
                  onChange={e => setTopic(e.target.value)}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>
            </div>

            {selectedRefIds.length > 0 && (
              <div className="mb-6 p-3 bg-primary/5 border border-primary/20 rounded-xl text-xs font-semibold text-primary flex items-center gap-2">
                <Info size={14} />
                <span>Active context filter: The AI will only use the {selectedRefIds.length} selected materials.</span>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Quantity of Flashcards</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={cardCount}
                  onChange={e => setCardCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle">Quantity of Exercises / Questions</label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={exerciseCount}
                  onChange={e => setExerciseCount(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-3 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-text-subtle flex items-center gap-1">
                  Quantity of Simulations
                  <span className="text-[10px] text-text-muted font-normal">(Always 1)</span>
                </label>
                <input
                  type="number"
                  disabled
                  value={1}
                  className="w-full bg-bg/50 border border-border rounded-xl px-4 py-3 text-text-muted cursor-not-allowed outline-none"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-4 pt-4 border-t border-border">
              <button
                onClick={() => handleGenerate('flashcards')}
                disabled={!topic.trim() || generatingFlashcards}
                className="flex-1 min-w-[200px] px-6 py-3.5 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap transition-all border border-indigo-500/20"
              >
                {generatingFlashcards ? <Loader2 size={16} className="animate-spin" /> : <FileText size={16} />}
                Generate Flashcards ({cardCount} cards)
              </button>

              <button
                onClick={() => handleGenerate('exercises')}
                disabled={!topic.trim() || generatingExercises}
                className="flex-1 min-w-[200px] px-6 py-3.5 bg-orange-500/10 text-orange-400 hover:bg-orange-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap transition-all border border-orange-500/20"
              >
                {generatingExercises ? <Loader2 size={16} className="animate-spin" /> : <PenTool size={16} />}
                Generate Exercises ({exerciseCount} questions)
              </button>

              <button
                onClick={() => handleGenerate('simulations')}
                disabled={!topic.trim() || generatingSimulations}
                className="flex-1 min-w-[200px] px-6 py-3.5 bg-pink-500/10 text-pink-400 hover:bg-pink-500/20 rounded-xl font-bold text-sm disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap transition-all border border-pink-500/20"
              >
                {generatingSimulations ? <Loader2 size={16} className="animate-spin" /> : <Clapperboard size={16} />}
                Generate 1 Simulation
              </button>
            </div>
          </div>

          {/* ─── DYNAMIC CRON SCHEDULING CARD (PHASE 2) ─── */}
          <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm">
            <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
              <Calendar size={22} className="text-primary" />
              Autonomous Scheduling (Cron)
            </h2>
            <p className="text-sm text-text-subtle mb-6">
              Configure the AI to generate new content (flashcards and exercises) autonomously on the specified days and times.
            </p>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Schedule Creation Form */}
              <div className="lg:col-span-1 space-y-4 border-r border-border/60 pr-0 lg:pr-8">
                <h3 className="text-md font-bold text-text flex items-center gap-2">
                  <Settings size={18} className="text-text-subtle" />
                  {editingScheduleId ? 'Edit Schedule' : 'New Schedule'}
                </h3>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase">Days of the Week</label>
                  <div className="flex flex-wrap gap-2">
                    {WEEKDAYS_OPTIONS.map(day => {
                      const isSelected = scheduleWeekdays.includes(day.value);
                      return (
                        <button
                          key={day.value}
                          onClick={() => toggleWeekdaySelection(day.value)}
                          className={`px-3 py-2 text-xs font-semibold rounded-xl border transition-all ${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                              : 'bg-bg text-text border-border hover:bg-surface-hover'
                          }`}
                        >
                          {day.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-xs font-bold text-text-subtle uppercase">Material Types</label>
                  <div className="flex flex-col gap-2">
                    {[
                      { value: 'flashcards', label: 'Flashcards (10 cards per level)' },
                      { value: 'exercises', label: 'Exercises (10 questions per level)' },
                      { value: 'simulations', label: 'Simulations (1 roleplay per level)' }
                    ].map(type => {
                      const isChecked = scheduleTypes.includes(type.value);
                      return (
                        <label key={type.value} className="flex items-center gap-2 text-sm text-text cursor-pointer hover:opacity-95 select-none">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              setScheduleTypes(prev =>
                                prev.includes(type.value)
                                  ? prev.filter(t => t !== type.value)
                                  : [...prev, type.value]
                              );
                            }}
                            className="h-4 w-4 rounded border-border text-primary focus:ring-primary/20 bg-bg cursor-pointer"
                          />
                          <span>{type.label}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-subtle uppercase flex items-center gap-1">
                      <Clock size={12} />
                      Time
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={e => setScheduleTime(e.target.value)}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-xs font-bold text-text-subtle uppercase flex items-center gap-1">Level Limit</label>
                    <input
                      type="number"
                      min="1"
                      max="6"
                      value={scheduleLimit}
                      onChange={e => setScheduleLimit(Math.max(1, Math.min(6, parseInt(e.target.value) || 1)))}
                      className="w-full bg-bg border border-border rounded-xl px-3 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between py-2 border-y border-border/40">
                  <span className="text-sm font-semibold text-text">Activate Schedule</span>
                  <button
                    onClick={() => setScheduleActive(!scheduleActive)}
                    className="text-primary hover:opacity-90 transition-all"
                  >
                    {scheduleActive ? <ToggleRight size={36} /> : <ToggleLeft size={36} className="text-text-muted" />}
                  </button>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={handleSaveSchedule}
                    disabled={savingSchedule}
                    className="flex-1 py-3 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-2"
                  >
                    {savingSchedule ? <Loader2 size={16} className="animate-spin" /> : editingScheduleId ? 'Update Schedule' : 'Save Configuration'}
                  </button>
                  {editingScheduleId && (
                    <button
                      onClick={handleCancelEditSchedule}
                      className="px-4 py-3 bg-bg border border-border hover:bg-surface-hover text-text rounded-xl font-bold text-sm transition-all"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </div>

              {/* Active Schedules List */}
              <div className="lg:col-span-2 space-y-4">
                <h3 className="text-md font-bold text-text flex items-center gap-2">
                  <Layers size={18} className="text-text-subtle" />
                  Active Configurations
                </h3>

                {loadingSchedules ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="animate-spin text-primary" size={24} />
                  </div>
                ) : schedules.length === 0 ? (
                  <div className="text-center py-8 text-text-muted border border-dashed border-border rounded-xl">
                    <p className="text-sm">No schedules registered.</p>
                  </div>
                ) : (
                  <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                    {schedules.map(sch => (
                      <div
                        key={sch.id}
                        className={`p-4 rounded-xl border transition-all flex items-center justify-between ${
                          sch.active
                            ? 'bg-primary/5 border-primary/20'
                            : 'bg-bg/40 border-border/80 opacity-70'
                        }`}
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <Clock size={16} className="text-primary" />
                            <span className="text-md font-bold text-text">{sch.execution_time.slice(0, 5)}</span>
                            <span className="text-xs text-text-muted">|</span>
                            <span className="text-xs font-semibold text-text-subtle bg-bg border border-border px-2 py-0.5 rounded-md">
                              Max: {sch.materials_per_execution} levels
                            </span>
                          </div>
                          <p className="text-xs text-text-muted font-medium">
                            Days: {formatWeekdays(sch.weekdays)}
                          </p>
                          {sch.selected_types && (
                            <p className="text-[11px] text-text-subtle font-medium">
                              Generates: {sch.selected_types.map((t: string) => t.charAt(0).toUpperCase() + t.slice(1)).join(', ')}
                            </p>
                          )}
                        </div>

                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => handleStartEditSchedule(sch)}
                            className={`p-1.5 rounded-lg transition-all ${
                              editingScheduleId === sch.id
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'text-text-muted hover:text-primary hover:bg-primary/5'
                            }`}
                            title="Edit schedule"
                          >
                            <Pencil size={16} />
                          </button>
                          <button
                            onClick={() => handleToggleSchedule(sch.id, sch.active)}
                            className="text-primary hover:opacity-90 transition-all p-1"
                            title={sch.active ? 'Deactivate' : 'Activate'}
                          >
                            {sch.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} className="text-text-muted" />}
                          </button>
                          <button
                            onClick={() => handleDeleteSchedule(sch.id)}
                            className="text-text-muted hover:text-red-400 p-1.5 rounded-lg hover:bg-red-500/5 transition-all"
                            title="Delete schedule"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      ) : (
        /* ─── AI GENERATED MATERIALS CURATOR PANEL ─── */
        <div className="bg-surface border border-border p-6 rounded-2xl shadow-sm animate-in fade-in duration-200">
          <h2 className="text-xl font-bold text-text mb-2 flex items-center gap-2">
            <BookOpen size={22} className="text-primary" />
            AI Generated Materials (Curator Panel)
          </h2>
          <p className="text-sm text-text-subtle mb-6">
            Review, edit, delete, and approve (publish) materials generated by AI before they go to students.
          </p>

          {/* Filters and Tabs Toolbar */}
          <div className="space-y-4 mb-6">
            <div className="flex flex-wrap items-center justify-between gap-4 p-4 bg-bg rounded-xl border border-border/60">
              <div className="flex flex-wrap items-center gap-6">
                {/* Level Filter */}
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">Level:</span>
                  <div className="flex gap-1.5 flex-wrap">
                    {['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                      <button
                        key={lvl}
                        onClick={() => setGeneratedFilterLevel(lvl)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          generatedFilterLevel === lvl
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-surface text-text-subtle border-border/80 hover:border-border'
                        }`}
                      >
                        {lvl}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Status Filter */}
                <div className="flex items-center gap-3 border-l border-border/60 pl-6 animate-in fade-in duration-150">
                  <span className="text-xs font-bold text-text-subtle uppercase tracking-wider">Status:</span>
                  <div className="flex gap-1.5">
                    {[
                      { id: 'All', label: 'All' },
                      { id: 'Drafts', label: 'Drafts' },
                      { id: 'Published', label: 'Published' }
                    ].map((status) => (
                      <button
                        key={status.id}
                        onClick={() => setCuratorStatusFilter(status.id as any)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                          curatorStatusFilter === status.id
                            ? 'bg-primary/10 text-primary border-primary/20'
                            : 'bg-surface text-text-subtle border-border/80 hover:border-border'
                        }`}
                      >
                        {status.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Type Tabs */}
              <div className="flex gap-2">
                {[
                  {
                    id: 'flashcards',
                    label: `Flashcards (${activeGroupedFlashcards.length})`
                  },
                  {
                    id: 'modules',
                    label: `Modules (${activeGroupedExercises.length})`
                  },
                  {
                    id: 'simulations',
                    label: `Simulations (${activeSimulations.length})`
                  }
                ].map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveCuratorTab(tab.id as any)}
                    className={`px-4 py-2 rounded-xl text-xs font-bold transition-all border ${
                      activeCuratorTab === tab.id
                        ? 'bg-primary text-white border-primary shadow-sm shadow-primary/10'
                        : 'bg-surface text-text border-border hover:bg-surface-hover'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Row - Bulk Publish Button */}
            {activeList.some((item: any) => !item.is_published) && (
              <div className="flex justify-end animate-in fade-in duration-200">
                <button
                  onClick={handlePublishAllFiltered}
                  className="px-4 py-2 bg-emerald-500 text-white hover:bg-emerald-600 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-emerald-500/10"
                >
                  <CheckCircle2 size={14} />
                  Publish All Filtered ({activeList.filter((item: any) => !item.is_published).length} drafts)
                </button>
              </div>
            )}
          </div>

          {loadingGenerated ? (
            <div className="flex justify-center py-12">
              <Loader2 className="animate-spin text-primary" size={30} />
            </div>
          ) : (
            <div>
              {activeCuratorTab === 'flashcards' && (
                (() => {
                  if (activeGroupedFlashcards.length === 0) {
                    return (
                      <div className="text-center py-10 text-text-muted border border-dashed border-border rounded-xl">
                        <p className="text-sm">No flashcard decks found for the selected level and status.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
                      {activeGroupedFlashcards.map((group) => (
                        <div key={group.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 group hover:border-primary/40 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="bg-indigo-500/10 w-10 h-10 rounded-xl flex items-center justify-center text-indigo-400">
                               <Layers size={20} />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-indigo-500/5 border border-indigo-500/20 text-indigo-400">
                                {group.cards.length} cards
                              </span>
                              <span className={cn(
                                "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                group.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                              )}>
                                {group.is_published ? 'Published' : 'Draft'}
                              </span>
                              <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                                {group.level}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-text mb-1 truncate">{group.topic}</h4>
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                              Vocabulary deck about {group.topic}.
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
                             <button onClick={() => handleStartEditFlashcardGroup(group)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                                <Pencil size={16} />
                             </button>
                             <button onClick={() => handleTogglePublishFlashcardGroup(group)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title={group.is_published ? "Unpublish (Draft)" : "Publish"}>
                                {group.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                             </button>
                             <button
                                onClick={() => handleDeleteFlashcardGroup(group)}
                                className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                                title="Delete"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}

              {activeCuratorTab === 'modules' && (
                (() => {
                  if (activeGroupedExercises.length === 0) {
                    return (
                      <div className="text-center py-10 text-text-muted border border-dashed border-border rounded-xl">
                        <p className="text-sm">No exercise modules found for the selected level and status.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
                      {activeGroupedExercises.map((group) => (
                        <div key={group.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 group hover:border-primary/40 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="bg-orange-500/10 w-10 h-10 rounded-xl flex items-center justify-center text-orange-400">
                               <BookOpen size={20} />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-orange-500/5 border border-orange-500/20 text-orange-400">
                                {group.questions.length} questions
                              </span>
                              <span className={cn(
                                "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                group.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                              )}>
                                {group.is_published ? 'Published' : 'Draft'}
                              </span>
                              <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                                {group.level}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-text mb-1 truncate">{group.topic}</h4>
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8">
                              Exercise module about {group.topic}.
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
                             <button onClick={() => handleStartEditExerciseGroup(group)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                                <Pencil size={16} />
                             </button>
                             <button onClick={() => handleTogglePublishExerciseGroup(group)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title={group.is_published ? "Unpublish (Draft)" : "Publish"}>
                                {group.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                             </button>
                             <button
                                onClick={() => handleDeleteExerciseGroup(group)}
                                className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                                title="Delete"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}

              {activeCuratorTab === 'simulations' && (
                (() => {
                  if (activeSimulations.length === 0) {
                    return (
                      <div className="text-center py-10 text-text-muted border border-dashed border-border rounded-xl">
                        <p className="text-sm">No simulations found for the selected level and status.</p>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-150">
                      {activeSimulations.map((sim) => (
                        <div key={sim.id} className="bg-surface border border-border rounded-2xl p-5 flex flex-col gap-4 group hover:border-primary/40 transition-all">
                          <div className="flex items-start justify-between">
                            <div className="bg-pink-500/10 w-10 h-10 rounded-xl flex items-center justify-center text-pink-400">
                               <Clapperboard size={20} />
                            </div>
                            <div className="flex flex-col items-end gap-1">
                              <span className={cn(
                                "text-[0.6rem] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider",
                                sim.is_published ? 'bg-success/10 text-success border-success/20' : 'bg-warning/10 text-warning border-warning/20'
                              )}>
                                {sim.is_published ? 'Published' : 'Draft'}
                              </span>
                              <span className="text-[0.55rem] font-black uppercase text-text-subtle tracking-tighter">
                                {sim.level}
                              </span>
                            </div>
                          </div>

                          <div>
                            <h4 className="font-bold text-text mb-1 truncate">{sim.topic}</h4>
                            <p className="text-xs text-text-muted line-clamp-2 leading-relaxed h-8" title={sim.scenario}>
                              {sim.scenario || 'No scenario details provided.'}
                            </p>
                          </div>

                          <div className="grid grid-cols-3 gap-2 mt-auto pt-2">
                             <button onClick={() => handleStartEditItem(sim, 'simulation')} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title="Edit">
                                <Pencil size={16} />
                             </button>
                             <button onClick={() => handleTogglePublishSimulation(sim.id, sim.is_published)} className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-primary/10 hover:text-primary transition-all text-text-subtle border border-border" title={sim.is_published ? "Unpublish (Draft)" : "Publish"}>
                                {sim.is_published ? <EyeOff size={16} /> : <Eye size={16} />}
                             </button>
                             <button
                                onClick={() => handleDeleteSimulation(sim.id)}
                                className="flex items-center justify-center p-2 rounded-lg bg-bg-secondary hover:bg-danger/10 hover:text-danger transition-all text-text-subtle border border-border"
                                title="Delete"
                             >
                                <Trash2 size={16} />
                             </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()
              )}
            </div>
          )}
        </div>
      )}

      {/* ─── CURATOR EDIT DIALOG MODAL ─── */}
      <DialogModal
        isOpen={editingItem !== null}
        onClose={() => { setEditingItem(null); setEditingItemType(null); }}
        title={`Edit Generated ${editingItemType ? editingItemType.charAt(0).toUpperCase() + editingItemType.slice(1) : ''}`}
        size="lg"
      >
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-text-subtle uppercase mb-1">Topic</label>
              <input
                type="text"
                value={editingItemType === 'simulation' ? (editForm.topic || '') : (editForm.new_topic || '')}
                onChange={(e) => setEditForm({
                  ...editForm,
                  [editingItemType === 'simulation' ? 'topic' : 'new_topic']: e.target.value
                })}
                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all"
              />
            </div>
            <div>
              <label className="block text-xs font-bold text-text-subtle uppercase mb-1">CEFR Level</label>
              <select
                value={editingItemType === 'simulation' ? (editForm.level || '') : (editForm.new_level || '')}
                onChange={(e) => setEditForm({
                  ...editForm,
                  [editingItemType === 'simulation' ? 'level' : 'new_level']: e.target.value
                })}
                className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all cursor-pointer"
              >
                {['A1', 'A2', 'B1', 'B2', 'C1', 'C2'].map((lvl) => (
                  <option key={lvl} value={lvl}>{lvl}</option>
                ))}
              </select>
            </div>
          </div>

          {editingItemType === 'flashcard' && (
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <Layers size={16} /> Flashcards ({(editForm.flashcards || []).length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const current = editForm.flashcards || [];
                    setEditForm({
                      ...editForm,
                      flashcards: [...current, { front: '', back: '', explanation: '', image_url: '' }]
                    });
                  }}
                  className="px-3 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-primary hover:bg-surface-hover flex items-center gap-1"
                >
                  <Plus size={12} /> Add Card
                </button>
              </div>

              <div className="space-y-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {(editForm.flashcards || []).map((card: any, idx: number) => (
                  <div key={idx} className="p-4 bg-surface border border-border rounded-xl space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const current = editForm.flashcards || [];
                        setEditForm({
                          ...editForm,
                          flashcards: current.filter((_: any, i: number) => i !== idx)
                        });
                      }}
                      className="absolute top-2 right-2 p-1 text-text-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove Card"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[10px] font-bold text-text-subtle uppercase mb-1">Front (Term)</label>
                        <input
                          type="text"
                          value={card.front || ''}
                          onChange={(e) => {
                            const newCards = [...editForm.flashcards];
                            newCards[idx] = { ...newCards[idx], front: e.target.value };
                            setEditForm({ ...editForm, flashcards: newCards });
                          }}
                          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:ring-1 focus:ring-primary/20 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-[10px] font-bold text-text-subtle uppercase mb-1">Back (Definition)</label>
                        <input
                          type="text"
                          value={card.back || ''}
                          onChange={(e) => {
                            const newCards = [...editForm.flashcards];
                            newCards[idx] = { ...newCards[idx], back: e.target.value };
                            setEditForm({ ...editForm, flashcards: newCards });
                          }}
                          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-xs text-text focus:ring-1 focus:ring-primary/20 outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[10px] font-bold text-text-subtle uppercase mb-1">Explanation</label>
                      <textarea
                        value={card.explanation || ''}
                        onChange={(e) => {
                          const newCards = [...editForm.flashcards];
                          newCards[idx] = { ...newCards[idx], explanation: e.target.value };
                          setEditForm({ ...editForm, flashcards: newCards });
                        }}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-1 text-xs text-text focus:ring-1 focus:ring-primary/20 outline-none resize-none min-h-[50px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingItemType === 'exercise' && (
            <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 space-y-4">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-bold text-primary flex items-center gap-2">
                  <BookOpen size={16} /> Questions ({(editForm.exercises || []).length})
                </h4>
                <button
                  type="button"
                  onClick={() => {
                    const current = editForm.exercises || [];
                    setEditForm({
                      ...editForm,
                      exercises: [...current, { question: '', options: ['', '', '', ''], correct_index: 0, explanation: '' }]
                    });
                  }}
                  className="px-3 py-1 bg-surface border border-border rounded-lg text-xs font-bold text-primary hover:bg-surface-hover flex items-center gap-1"
                >
                  <Plus size={12} /> Add Question
                </button>
              </div>

              <div className="space-y-4 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                {(editForm.exercises || []).map((ex: any, idx: number) => (
                  <div key={idx} className="p-4 bg-surface border border-border rounded-xl space-y-3 relative group">
                    <button
                      type="button"
                      onClick={() => {
                        const current = editForm.exercises || [];
                        setEditForm({
                          ...editForm,
                          exercises: current.filter((_: any, i: number) => i !== idx)
                        });
                      }}
                      className="absolute top-2 right-2 p-1 text-text-subtle hover:text-danger opacity-0 group-hover:opacity-100 transition-all"
                      title="Remove Question"
                    >
                      <Trash2 size={14} />
                    </button>

                    <div className="flex gap-2">
                      <span className="w-5 h-5 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-[10px] shrink-0 mt-1">
                        {idx + 1}
                      </span>
                      <textarea
                        placeholder="Question text..."
                        value={ex.question || ''}
                        onChange={(e) => {
                          const newExs = [...editForm.exercises];
                          newExs[idx] = { ...newExs[idx], question: e.target.value };
                          setEditForm({ ...editForm, exercises: newExs });
                        }}
                        className="flex-1 bg-transparent border-b border-border text-xs py-1 outline-none focus:border-primary transition-all resize-none min-h-[40px]"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2 pl-7">
                      {(ex.options || ['', '', '', '']).map((opt: string, oIdx: number) => {
                        const isCorrect = ex.correct_index === oIdx;
                        return (
                          <div key={oIdx} className="relative">
                            <input
                              className={cn(
                                "w-full pl-2 pr-6 py-1.5 bg-bg/50 border rounded-lg text-xs outline-none transition-all",
                                isCorrect ? "border-success bg-success/5" : "border-border"
                              )}
                              placeholder={`Option ${oIdx + 1}`}
                              value={opt}
                              onChange={(e) => {
                                const newOpts = [...ex.options];
                                newOpts[oIdx] = e.target.value;
                                const newExs = [...editForm.exercises];
                                newExs[idx] = { ...newExs[idx], options: newOpts };
                                setEditForm({ ...editForm, exercises: newExs });
                              }}
                            />
                            <button
                              type="button"
                              onClick={() => {
                                const newExs = [...editForm.exercises];
                                newExs[idx] = { ...newExs[idx], correct_index: oIdx };
                                setEditForm({ ...editForm, exercises: newExs });
                              }}
                              className={cn("absolute right-1.5 top-1/2 -translate-y-1/2", isCorrect ? "text-success" : "text-text-subtle")}
                            >
                              <CheckCircle2 size={12} />
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <div className="pl-7">
                      <label className="block text-[10px] font-bold text-text-subtle uppercase mb-1">Explanation</label>
                      <textarea
                        value={ex.explanation || ''}
                        onChange={(e) => {
                          const newExs = [...editForm.exercises];
                          newExs[idx] = { ...newExs[idx], explanation: e.target.value };
                          setEditForm({ ...editForm, exercises: newExs });
                        }}
                        className="w-full bg-bg border border-border rounded-lg px-3 py-1 text-xs text-text focus:ring-1 focus:ring-primary/20 outline-none resize-none min-h-[40px]"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {editingItemType === 'simulation' && (
            <>
              <div>
                <label className="block text-xs font-bold text-text-subtle uppercase mb-1">Scenario Description / System Prompt</label>
                <textarea
                  value={editForm.scenario || ''}
                  onChange={(e) => setEditForm({ ...editForm, scenario: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[150px] resize-none"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-text-subtle uppercase mb-1">Goal Description</label>
                <textarea
                  value={editForm.goal || ''}
                  onChange={(e) => setEditForm({ ...editForm, goal: e.target.value })}
                  className="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-text focus:ring-2 focus:ring-primary/20 outline-none transition-all min-h-[100px] resize-none"
                />
              </div>
            </>
          )}

          <div className="flex justify-end gap-3 pt-4 border-t border-border">
            <button
              onClick={() => { setEditingItem(null); setEditingItemType(null); }}
              className="px-4 py-2 bg-bg border border-border hover:bg-surface-hover text-text rounded-xl font-bold text-sm transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSaveEditItem}
              disabled={savingEdit}
              className="px-6 py-2 bg-primary text-white rounded-xl font-bold text-sm hover:bg-primary-hover shadow-md shadow-primary/10 transition-all flex items-center justify-center gap-2"
            >
              {savingEdit ? <Loader2 size={16} className="animate-spin" /> : 'Save Changes'}
            </button>
          </div>
        </div>
      </DialogModal>
    </div>
  );
}
