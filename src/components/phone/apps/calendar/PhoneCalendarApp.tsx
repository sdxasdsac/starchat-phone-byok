"use client";

import '@/styles/phone-apps/calendar.css';
import { useEffect, useMemo, useState } from "react";
import { Check, ChevronLeft, HeartPulse, Plus, Trash2, X } from "lucide-react";
import { Avatar } from "./ui/primitives";
import { Input } from "./ui/form";
import type { CalendarOwnerType, CalendarScheduleItem, CalendarWeekPlan } from "@/lib/phone-apps/calendar/types";
import {
  CALENDAR_DAYS_PER_PAGE_OPTIONS,
  CALENDAR_THEME_IDS,
  deleteCalendarScheduleItem,
  loadCalendarConfig,
  loadOwnerCalendarPlans,
  saveCalendarConfig,
  upsertCalendarScheduleItem,
  validateScheduleDraft,
} from "@/lib/phone-apps/calendar/storage";
import {
  formatIsoDate,
  getWeekStartIso,
  getWeekdayLabel,
  parseIsoDate,
  pickScheduleColorKey,
  sanitizeScheduleEmoji,
} from "@/lib/phone-apps/calendar/utils";
import {
  buildMenstrualDayMap,
  cancelFinishCurrentPeriod,
  cancelCurrentPeriodStart,
  finishCurrentPeriod,
  deleteMenstrualRecord,
  getMenstrualSummary,
  loadMenstrualConfig,
  loadMenstrualRecords,
  saveMenstrualConfig,
  startCurrentPeriod,
  validateMenstrualSettings,
  type MenstrualRecord,
} from "@/lib/phone-apps/calendar/menstrual-storage";
import { CalendarMonthPage } from "./month-page";
import { CalendarDetailPage } from "./detail-page";
import { CalendarEventEditModal, type CalendarEventDraft } from "./event-edit-modal";

/** 参考 lib/calendar-engine.ts 的 createDefaultScheduleDraft（纯本地，不引入 LLM 引擎） */
function createDefaultScheduleDraft(date: string) {
  return {
    date,
    weekday: getWeekdayLabel(date),
    startTime: "09:00",
    endTime: "10:00",
    location: "",
    title: "",
    emoji: "",
    source: "manual" as const,
  };
}

type OwnerOption = {
  key: string;
  ownerType: CalendarOwnerType;
  ownerId: string;
  name: string;
  avatar?: string | null;
};

const CALENDAR_THEMES: Array<{ id: (typeof CALENDAR_THEME_IDS)[number]; name: string }> = [
  { id: "light", name: "默认" },
  { id: "dark", name: "深色" },
  { id: "cream", name: "奶油" },
  { id: "mint", name: "薄荷" },
  { id: "mist", name: "雾紫" },
  { id: "sakura", name: "樱粉" },
];

export type PeriodCareCharacterOption = {
  characterId: string;
  name: string;
  avatar?: string | null;
};

function formatSimpleDate(dateText: string | null): string {
  if (!dateText) return "待记录";
  const date = parseIsoDate(dateText);
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

export function PhoneCalendarApp({
  onClose,
  onNotice,
  owners,
  periodCareCharacters,
}: {
  onClose: () => void;
  onNotice?: (text: string) => void;
  owners: OwnerOption[];
  periodCareCharacters: PeriodCareCharacterOption[];
}) {
  const todayIso = formatIsoDate(new Date());
  const [selectedKey, setSelectedKey] = useState<string>(() => owners[0]?.key ?? "user:me");
  const [view, setView] = useState<"month" | "detail">("month");
  const [selectedDate, setSelectedDate] = useState<string>(todayIso);
  const [detailKey, setDetailKey] = useState(0);
  const [ownerPlans, setOwnerPlans] = useState<CalendarWeekPlan[]>([]);
  const [config, setConfig] = useState(() => loadCalendarConfig());
  const [menstrualConfig, setMenstrualConfig] = useState(() => loadMenstrualConfig());
  const [menstrualRecords, setMenstrualRecords] = useState<MenstrualRecord[]>(() => loadMenstrualRecords());
  const [showThemePanel, setShowThemePanel] = useState(false);
  const [showDaysPanel, setShowDaysPanel] = useState(false);
  const [showMenstrualSettings, setShowMenstrualSettings] = useState(false);
  const [fabMenuOpen, setFabMenuOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<(CalendarEventDraft & { originalDate?: string }) | null>(null);

  const [menstrualDraft, setMenstrualDraft] = useState<{
    cycleLength: string;
    periodLength: string;
    periodCareEnabled: boolean;
    periodCareCharacterIds: string[];
    periodCareLeadDays: "1" | "2" | "3";
  }>(() => {
    const initial = loadMenstrualConfig();
    return {
      cycleLength: String(initial.cycleLength),
      periodLength: String(initial.periodLength),
      periodCareEnabled: initial.periodCareEnabled,
      periodCareCharacterIds: initial.periodCareCharacterIds,
      periodCareLeadDays: String(initial.periodCareLeadDays) as "1" | "2" | "3",
    };
  });

  const selectedOwner = useMemo(
    () => owners.find(owner => owner.key === selectedKey) ?? owners[0] ?? null,
    [owners, selectedKey],
  );
  const itemsByDate = useMemo(() => {
    const map = new Map<string, CalendarScheduleItem[]>();
    for (const plan of ownerPlans) {
      for (const item of plan.items) {
        const list = map.get(item.date) || [];
        list.push(item);
        map.set(item.date, list);
      }
    }
    for (const list of map.values()) {
      list.sort((a, b) => a.startTime.localeCompare(b.startTime));
    }
    return map;
  }, [ownerPlans]);

  // 经期标注：覆盖月历页 ±1 年范围
  const cycleMap = useMemo(() => {
    if (selectedOwner?.ownerType !== "user") return null;
    const today = parseIsoDate(todayIso);
    const start = formatIsoDate(new Date(today.getFullYear() - 1, today.getMonth(), 1));
    const end = formatIsoDate(new Date(today.getFullYear() + 1, today.getMonth() + 1, 0));
    return buildMenstrualDayMap(start, end, menstrualRecords, menstrualConfig);
  }, [selectedOwner, todayIso, menstrualRecords, menstrualConfig]);

  const menstrualSummary = useMemo(
    () => getMenstrualSummary(menstrualRecords, menstrualConfig, selectedDate),
    [menstrualRecords, menstrualConfig, selectedDate],
  );
  const periodCareCharacterOptions = showMenstrualSettings ? periodCareCharacters : [];

  const refreshPlans = () => {
    if (!selectedOwner) return;
    setOwnerPlans(loadOwnerCalendarPlans(selectedOwner.ownerType, selectedOwner.ownerId));
  };

  useEffect(() => {
    if (!selectedOwner) return;
    setOwnerPlans(loadOwnerCalendarPlans(selectedOwner.ownerType, selectedOwner.ownerId));
  }, [selectedOwner]);

  // 聊天/工具调用改动日程后刷新
  useEffect(() => {
    const handler = () => {
      if (!selectedOwner) return;
      setOwnerPlans(loadOwnerCalendarPlans(selectedOwner.ownerType, selectedOwner.ownerId));
    };
    window.addEventListener("calendar-updated", handler);
    return () => window.removeEventListener("calendar-updated", handler);
  }, [selectedOwner]);

  // ── 事件编辑 ──
  const openNewDraft = (date: string) => {
    const base = createDefaultScheduleDraft(date);
    setEditingItem({
      date: base.date,
      startTime: base.startTime,
      endTime: base.endTime,
      location: base.location,
      title: base.title,
      emoji: base.emoji,
    });
  };

  const openEditItem = (item: CalendarScheduleItem) => {
    setEditingItem({
      id: item.id,
      date: item.date,
      endDate: item.date,
      originalDate: item.date,
      startTime: item.startTime,
      endTime: item.endTime,
      location: item.location,
      title: item.title,
      emoji: item.emoji || "",
      colorKey: item.colorKey,
    });
  };

  const handleSaveDraft = () => {
    if (!selectedOwner || !editingItem) return;
    const error = validateScheduleDraft(editingItem);
    if (error) {
      onNotice?.(error);
      return;
    }
    const startDate = editingItem.date;
    const endDate = editingItem.endDate || editingItem.date;
    if (endDate < startDate) {
      onNotice?.("结束日期不能早于开始日期");
      return;
    }
    const dayCount = Math.round((parseIsoDate(endDate).getTime() - parseIsoDate(startDate).getTime()) / 86400000) + 1;
    if (dayCount > 31) {
      onNotice?.("一次最多创建 31 天的日程");
      return;
    }
    const firstWeekStart = getWeekStartIso(parseIsoDate(startDate));
    // 跨周移动：先从原来的周删除
    if (editingItem.id && editingItem.originalDate) {
      const originalWeekStart = getWeekStartIso(parseIsoDate(editingItem.originalDate));
      if (originalWeekStart !== firstWeekStart) {
        deleteCalendarScheduleItem(selectedOwner.ownerType, selectedOwner.ownerId, originalWeekStart, editingItem.id);
      }
    }
    // 多天：第一天沿用原 id（编辑场景），其余每天各生成一条独立日程
    for (let offset = 0; offset < dayCount; offset++) {
      const day = parseIsoDate(startDate);
      day.setDate(day.getDate() + offset);
      const dayIso = formatIsoDate(day);
      upsertCalendarScheduleItem(selectedOwner.ownerType, selectedOwner.ownerId, getWeekStartIso(parseIsoDate(dayIso)), {
        id: offset === 0 ? editingItem.id : undefined,
        date: dayIso,
        startTime: editingItem.startTime,
        endTime: editingItem.endTime,
        location: editingItem.location,
        title: editingItem.title,
        emoji: sanitizeScheduleEmoji(editingItem.emoji),
        source: "manual",
        colorKey: editingItem.colorKey ?? pickScheduleColorKey(editingItem.startTime),
      });
    }
    setEditingItem(null);
    refreshPlans();
    onNotice?.(dayCount > 1 ? `已创建 ${dayCount} 天的日程` : "日程已保存");
  };

  const handleDeleteItem = () => {
    if (!selectedOwner || !editingItem?.id) return;
    const targetWeekStart = getWeekStartIso(parseIsoDate(editingItem.originalDate || editingItem.date));
    deleteCalendarScheduleItem(selectedOwner.ownerType, selectedOwner.ownerId, targetWeekStart, editingItem.id);
    setEditingItem(null);
    refreshPlans();
    onNotice?.("日程已删除");
  };

  // ── 经期 ──
  const refreshMenstrual = () => {
    setMenstrualConfig(loadMenstrualConfig());
    setMenstrualRecords(loadMenstrualRecords());
  };

  const openMenstrualSettings = () => {
    setMenstrualDraft({
      cycleLength: String(menstrualConfig.cycleLength),
      periodLength: String(menstrualConfig.periodLength),
      periodCareEnabled: menstrualConfig.periodCareEnabled,
      periodCareCharacterIds: menstrualConfig.periodCareCharacterIds,
      periodCareLeadDays: String(menstrualConfig.periodCareLeadDays) as "1" | "2" | "3",
    });
    setShowMenstrualSettings(true);
  };

  const togglePeriodCareCharacter = (characterId: string) => {
    setMenstrualDraft(prev => {
      const selected = new Set(prev.periodCareCharacterIds);
      if (selected.has(characterId)) selected.delete(characterId);
      else selected.add(characterId);
      return { ...prev, periodCareCharacterIds: Array.from(selected) };
    });
  };

  const handleSaveMenstrualSettings = () => {
    const cycleLength = Number(menstrualDraft.cycleLength);
    const periodLength = Number(menstrualDraft.periodLength);
    const error = validateMenstrualSettings({ cycleLength, periodLength });
    if (error) {
      onNotice?.(error);
      return;
    }
    const availableCharacterIds = new Set(periodCareCharacterOptions.map(option => option.characterId));
    const periodCareCharacterIds = menstrualDraft.periodCareCharacterIds.filter(id => availableCharacterIds.has(id));
    if (menstrualDraft.periodCareEnabled && periodCareCharacterIds.length === 0) {
      onNotice?.("请选择至少一个已有聊天角色");
      return;
    }
    const savedConfig = saveMenstrualConfig({
      ...menstrualConfig,
      cycleLength,
      periodLength,
      periodCareEnabled: menstrualDraft.periodCareEnabled,
      periodCareCharacterIds,
      periodCareLeadDays: Number(menstrualDraft.periodCareLeadDays) as 1 | 2 | 3,
    });
    setMenstrualConfig(savedConfig);
    window.dispatchEvent(new CustomEvent("menstrual-period-care-updated"));
    setShowMenstrualSettings(false);
    onNotice?.("周期设置已保存");
  };

  const canCancelSelectedStart = menstrualSummary.currentPeriodStartDate === selectedDate && !menstrualSummary.todayFinished;
  const canStartSelected = !menstrualSummary.todayStarted && !menstrualSummary.isPeriodActive;
  const canCancelSelectedFinish = menstrualSummary.todayFinished;
  const canFinishSelected =
    menstrualSummary.isPeriodActive &&
    !!menstrualSummary.currentPeriodStartDate &&
    selectedDate >= menstrualSummary.currentPeriodStartDate &&
    !menstrualSummary.todayFinished;

  const cycleStateForSelected = cycleMap?.get(selectedDate) ?? null;
  const cycleSummaryLine = cycleStateForSelected
    ? `周期 · ${cycleStateForSelected.label || cycleStateForSelected.shortLabel}`
    : menstrualSummary.isPeriodActive && menstrualSummary.currentPeriodStartDate
      ? `本次经期从 ${formatSimpleDate(menstrualSummary.currentPeriodStartDate)} 开始`
      : menstrualSummary.latest
        ? null
        : "点「经期来了」开始记录与预测";

  // 详情页经期打卡行（仅用户视图）
  const cyclePanel = selectedOwner?.ownerType === "user" ? (
    <div className="calendar-cycle-line">
      <i className="calendar-cycle-dot" data-type={cycleStateForSelected?.type ?? "period"} aria-hidden="true" />
      <span className="calendar-cycle-line-text">{cycleSummaryLine ?? "周期记录"}</span>
      {canCancelSelectedStart ? (
        <button type="button" className="calendar-mini-btn" data-variant="primary" onClick={() => {
          setMenstrualConfig(cancelCurrentPeriodStart(selectedDate));
          setMenstrualRecords(loadMenstrualRecords());
          onNotice?.("已取消这一天的经期来了");
        }}>撤销来了</button>
      ) : (
        <button type="button" className="calendar-mini-btn" data-variant="primary" disabled={!canStartSelected} onClick={() => {
          setMenstrualConfig(startCurrentPeriod(selectedDate));
          setMenstrualRecords(loadMenstrualRecords());
          onNotice?.("已记录经期来了");
        }}>经期来了</button>
      )}
      {canCancelSelectedFinish ? (
        <button type="button" className="calendar-mini-btn" data-variant="primary" onClick={() => {
          const result = cancelFinishCurrentPeriod(selectedDate);
          if (!result.restored) {
            onNotice?.("这一天还没有记录经期走了");
            return;
          }
          setMenstrualConfig(result.config);
          setMenstrualRecords(result.records);
          onNotice?.("已取消这一天的经期走了");
        }}>撤销走了</button>
      ) : (
        <button type="button" className="calendar-mini-btn" data-variant="ghost" disabled={!canFinishSelected} onClick={() => {
          const result = finishCurrentPeriod(selectedDate);
          if (!result.saved) {
            onNotice?.("请先记录经期来了");
            return;
          }
          setMenstrualConfig(result.config);
          setMenstrualRecords(result.records);
          onNotice?.("已记录经期走了");
        }}>经期走了</button>
      )}
    </div>
  ) : null;

  const ownerStrip = (
    <section className="calendar-owner-strip hide-scrollbar">
      {owners.map(owner => (
        <button
          key={owner.key}
          type="button"
          className="calendar-owner-chip"
          data-active={owner.key === selectedKey ? "true" : undefined}
          onClick={() => {
            setFabMenuOpen(false);
            setSelectedKey(owner.key);
            setSelectedDate(todayIso);
          }}
        >
          <Avatar src={owner.avatar || undefined} name={owner.name} size="md" />
          <span>{owner.name}</span>
        </button>
      ))}
    </section>
  );

  const openDetail = (date: string) => {
    setSelectedDate(date);
    setDetailKey(k => k + 1);
    setView("detail");
  };

  return (
    <div className="fp-root fp-app-calendar">
      <div className="calendar-app-shell" data-calendar-theme={config.theme}>
        <div className="calendar-app">
        {view === "month" ? (
          <CalendarMonthPage
            todayIso={todayIso}
            itemsByDate={itemsByDate}
            cycleMap={cycleMap}
            ownerStrip={ownerStrip}
            onPickDay={openDetail}
            onClose={onClose}
            onOpenTheme={() => setShowThemePanel(true)}
          />
        ) : (
          <CalendarDetailPage
            key={detailKey}
            initialDate={selectedDate}
            todayIso={todayIso}
            itemsByDate={itemsByDate}
            cycleMap={cycleMap}
            cyclePanel={cyclePanel}
            daysPerPage={config.daysPerPage}
            onOpenDaysPicker={() => setShowDaysPanel(true)}
            onOpenCycleSettings={selectedOwner?.ownerType === "user" ? openMenstrualSettings : null}
            onBack={() => setView("month")}
            onSelectedChange={setSelectedDate}
            onEditItem={openEditItem}
          />
        )}

        {fabMenuOpen ? <div className="calendar-fab-backdrop" onClick={() => setFabMenuOpen(false)} /> : null}
        <div className="calendar-fab-stack">
          {fabMenuOpen && selectedOwner?.ownerType === "character" ? (
            <div className="calendar-fab-menu" role="menu">
              <button
                type="button"
                className="calendar-fab-menu-item"
                onClick={() => {
                  setFabMenuOpen(false);
                  openNewDraft(view === "detail" ? selectedDate : todayIso);
                }}
              >
                <Plus size={15} />
                新增日程
              </button>
            </div>
          ) : null}
          <button
            type="button"
            className="calendar-fab calendar-fab-primary"
            onClick={() => {
              if (selectedOwner?.ownerType === "character") {
                setFabMenuOpen(prev => !prev);
              } else {
                openNewDraft(view === "detail" ? selectedDate : todayIso);
              }
            }}
            aria-label={selectedOwner?.ownerType === "character" ? "日程操作菜单" : "新增事项"}
            aria-expanded={selectedOwner?.ownerType === "character" ? fabMenuOpen : undefined}
          >
            <Plus size={20} style={{ transform: fabMenuOpen ? "rotate(45deg)" : undefined, transition: "transform 0.2s" }} />
          </button>
        </div>
      </div>

      {showThemePanel && (
        <div className="modal-overlay calendar-edit-modal-overlay" onClick={() => setShowThemePanel(false)}>
          <div className="calendar-edit-modal calendar-theme-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-theme-modal-head">
              <strong>主题</strong>
              <button type="button" onClick={() => setShowThemePanel(false)} className="calendar-icon-btn" aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="calendar-theme-grid">
              {CALENDAR_THEMES.map(theme => (
                <button
                  key={theme.id}
                  type="button"
                  className="calendar-theme-option"
                  data-active={config.theme === theme.id ? "true" : undefined}
                  onClick={() => {
                    const nextConfig = { ...config, theme: theme.id };
                    setConfig(nextConfig);
                    saveCalendarConfig(nextConfig);
                  }}
                >
                  <span className="calendar-theme-swatch" data-theme-id={theme.id} aria-hidden="true" />
                  <span>{theme.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showDaysPanel && (
        <div className="modal-overlay calendar-edit-modal-overlay" onClick={() => setShowDaysPanel(false)}>
          <div className="calendar-edit-modal calendar-days-modal" onClick={e => e.stopPropagation()}>
            <div className="calendar-theme-modal-head">
              <strong>每页天数</strong>
              <button type="button" onClick={() => setShowDaysPanel(false)} className="calendar-icon-btn" aria-label="关闭">
                <X size={16} />
              </button>
            </div>
            <div className="calendar-days-options">
              {CALENDAR_DAYS_PER_PAGE_OPTIONS.map(n => (
                <button
                  key={n}
                  type="button"
                  className="calendar-days-option"
                  data-active={config.daysPerPage === n ? "true" : undefined}
                  onClick={() => {
                    const nextConfig = { ...config, daysPerPage: n };
                    setConfig(nextConfig);
                    saveCalendarConfig(nextConfig);
                    setShowDaysPanel(false);
                  }}
                >
                  <b>{n}</b>
                  <span>{n === 1 ? "单日" : `${n} 天`}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {editingItem && (
        <CalendarEventEditModal
          draft={editingItem}
          onChange={next => setEditingItem(prev => (prev ? { ...prev, ...next } : next))}
          onSave={handleSaveDraft}
          onDelete={handleDeleteItem}
          onClose={() => setEditingItem(null)}
        />
      )}

      {showMenstrualSettings && (
        <div className="modal-overlay calendar-edit-modal-overlay" onClick={() => setShowMenstrualSettings(false)}>
          <div className="calendar-edit-modal calendar-menstrual-modal" onClick={e => e.stopPropagation()}>
            <div className="modal-header" data-ui="modal-header">
              <button onClick={() => setShowMenstrualSettings(false)} className="modal-header-btn modal-header-btn-muted" aria-label="返回">
                <ChevronLeft size={18} />
              </button>
              <span className="modal-header-title">周期设置</span>
              <button onClick={handleSaveMenstrualSettings} className="modal-header-btn modal-header-btn-action" aria-label="保存">
                <Check size={18} />
              </button>
            </div>

            <div className="modal-body hide-scrollbar flex flex-col gap-3 pb-10" data-ui="modal-body">
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1">
                  <label className="menu-desc ml-1">周期长度</label>
                  <Input
                    type="number"
                    min={21}
                    max={60}
                    value={menstrualDraft.cycleLength}
                    onChange={e => setMenstrualDraft(prev => ({ ...prev, cycleLength: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label className="menu-desc ml-1">经期天数</label>
                  <Input
                    type="number"
                    min={2}
                    max={10}
                    value={menstrualDraft.periodLength}
                    onChange={e => setMenstrualDraft(prev => ({ ...prev, periodLength: e.target.value }))}
                  />
                </div>
              </div>

              <div className="calendar-menstrual-care-panel">
                <button
                  type="button"
                  className="calendar-menstrual-care-toggle"
                  data-active={menstrualDraft.periodCareEnabled ? "true" : undefined}
                  onClick={() => setMenstrualDraft(prev => ({ ...prev, periodCareEnabled: !prev.periodCareEnabled }))}
                >
                  <span className="calendar-menstrual-care-toggle-icon">
                    <HeartPulse size={16} />
                  </span>
                  <span className="calendar-menstrual-care-toggle-copy">
                    <strong>让TA关心我的经期</strong>
                    <span>只显示已有聊天会话的角色</span>
                  </span>
                  <span className="calendar-menstrual-pill-switch" aria-hidden="true">
                    <span className="calendar-menstrual-pill-switch-thumb" />
                  </span>
                </button>

                {menstrualDraft.periodCareEnabled ? (
                  <div className="calendar-menstrual-care-body">
                    <div className="calendar-menstrual-care-section">
                      <label className="menu-desc ml-1">提前多久关心</label>
                      <div className="calendar-period-care-lead-row">
                        {(["1", "2", "3"] as const).map(value => (
                          <button
                            key={value}
                            type="button"
                            className="calendar-period-care-lead"
                            data-active={menstrualDraft.periodCareLeadDays === value ? "true" : undefined}
                            onClick={() => setMenstrualDraft(prev => ({ ...prev, periodCareLeadDays: value }))}
                          >
                            {value}天
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="calendar-menstrual-care-section">
                      <label className="menu-desc ml-1">选择角色</label>
                      {periodCareCharacterOptions.length > 0 ? (
                        <div className="calendar-period-care-avatars">
                          {periodCareCharacterOptions.map(option => {
                            const selected = menstrualDraft.periodCareCharacterIds.includes(option.characterId);
                            return (
                              <button
                                key={option.characterId}
                                type="button"
                                className="calendar-period-care-avatar"
                                data-active={selected ? "true" : undefined}
                                onClick={() => togglePeriodCareCharacter(option.characterId)}
                              >
                                <Avatar src={option.avatar || undefined} name={option.name} size="md" />
                                <span>{option.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div className="calendar-menstrual-empty">已有聊天会话的角色会显示在这里。</div>
                      )}
                    </div>
                  </div>
                ) : null}
              </div>

              {menstrualRecords.length > 0 ? (
                <div className="calendar-menstrual-modal-history">
                  <label className="menu-desc ml-1">最近完成的经期</label>
                  <div className="calendar-menstrual-modal-list">
                    {menstrualRecords.slice(0, 4).map(record => (
                      <div key={record.id} className="calendar-menstrual-modal-item">
                        <div>
                          <strong>{formatSimpleDate(record.startDate)} - {formatSimpleDate(record.endDate)}</strong>
                          <span>{record.startDate} 至 {record.endDate}</span>
                        </div>
                        <button
                          type="button"
                          className="calendar-menstrual-modal-delete"
                          onClick={() => {
                            setMenstrualRecords(deleteMenstrualRecord(record.id));
                            refreshMenstrual();
                            onNotice?.("经期记录已删除");
                          }}
                          aria-label="删除记录"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="calendar-menstrual-empty">还没有完成的经期记录。先在日程页点“经期来了”，结束时再点“经期走了”。</div>
              )}
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
