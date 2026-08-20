import React, { useEffect, useRef, useState } from 'react';
import { supabase } from './supabase';

const CASE_COLORS = [
  { label: 'Blue', value: 'rgba(14, 165, 233, 0.35)', border: 'rgb(125, 211, 252)' },
  { label: 'Green', value: 'rgba(34, 197, 94, 0.35)', border: 'rgb(134, 239, 172)' },
  { label: 'Amber', value: 'rgba(245, 158, 11, 0.35)', border: 'rgb(252, 211, 77)' },
  { label: 'Rose', value: 'rgba(244, 63, 94, 0.35)', border: 'rgb(253, 164, 175)' },
  { label: 'Violet', value: 'rgba(168, 85, 247, 0.35)', border: 'rgb(196, 181, 253)' },
  { label: 'Slate', value: 'rgba(100, 116, 139, 0.45)', border: 'rgb(203, 213, 225)' },
];

const DEFAULT_CASE_COLOR = CASE_COLORS[0];
const MAX_HISTORY = 100;
const TOUCH_SELECT_HOLD_MS = 220;
const TOUCH_SELECT_MOVE_TOLERANCE = 18;
const TEMPLATE_CATEGORIES = ['Monitors', 'Racks', 'Video Cases', 'LED Cases'];
const DEFAULT_TEMPLATE_CATEGORY = 'Cases';
const ALL_TEMPLATE_CATEGORIES = ['All', ...TEMPLATE_CATEGORIES];


export default function App() {
  const [truckPresets, setTruckPresets] = useState([]);
  const [templateCategories, setTemplateCategories] = useState(TEMPLATE_CATEGORIES);
  const allTemplateCategories = ['All', ...templateCategories];
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [customTruckName, setCustomTruckName] = useState('');
  const [customTruckLength, setCustomTruckLength] = useState('');
  const [customTruckWidth, setCustomTruckWidth] = useState('');
  const [floatingScrollLeft, setFloatingScrollLeft] = useState(0);
  const [floatingScrollMax, setFloatingScrollMax] = useState(0);
  const appScrollRef = useRef(null);
  
  const [appScale, setAppScale] = useState(1);
  const pinchStartDistanceRef = useRef(null);
  const pinchStartScaleRef = useRef(1);

  const [cases, setCases] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [draggingTemplate, setDraggingTemplate] = useState(null);
  const [draggingCaseId, setDraggingCaseId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [touchTemplatePreview, setTouchTemplatePreview] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);

  const [historyPast, setHistoryPast] = useState([]);
  const [historyFuture, setHistoryFuture] = useState([]);
  const [clipboard, setClipboard] = useState(null);

  const truckRef = useRef(null);
  const waitingRef = useRef(null);
  const justFinishedBoxSelectRef = useRef(false);
  const transparentDragImageRef = useRef(null);
  const dragStartSnapshotRef = useRef(null);

  const casesRef = useRef(cases);
  const selectedIdsRef = useRef(selectedIds);
  const historyPastRef = useRef(historyPast);
  const historyFutureRef = useRef(historyFuture);
  const clipboardRef = useRef(clipboard);

  const groupDragRef = useRef({
    active: false,
    anchorId: null,
    startX: 0,
    startY: 0,
    startZone: 'truck',
    bounds: null,
    itemPositions: [],
  });

  const [templates, setTemplates] = useState([]);
  const [selectedTemplateCategory, setSelectedTemplateCategory] = useState('All');
  const [newTemplateCategory, setNewTemplateCategory] = useState(DEFAULT_TEMPLATE_CATEGORY);
  const [templateCategoryOverrides, setTemplateCategoryOverrides] = useState({});

  const [newName, setNewName] = useState('');
  const [newW, setNewW] = useState('');
  const [newH, setNewH] = useState('');

  const [packs, setPacks] = useState([]);
  const [selectedPackId, setSelectedPackId] = useState('');
  const [packName, setPackName] = useState('');

  const touchCaseDragRef = useRef({
    active: false,
    caseId: null,
    offsetX: 0,
    offsetY: 0,
  });

  const touchTemplateDragRef = useRef({
    active: false,
    template: null,
    offsetX: 0,
    offsetY: 0,
    lastPos: null,
  });

  const selectionDragRef = useRef({
    active: false,
    startX: 0,
    startY: 0,
    additive: false,
    baseSelection: [],
    zone: 'truck',
  });

  const touchSelectionRef = useRef({
    pending: false,
    active: false,
    zone: 'truck',
    touchId: null,
    startClientX: 0,
    startClientY: 0,
    startX: 0,
    startY: 0,
  });

  const touchSelectionHoldTimerRef = useRef(null);

  useEffect(() => {
  const updateFloatingScroll = () => {
    const max = Math.max(
      0,
      document.documentElement.scrollWidth - window.innerWidth
    );

    setFloatingScrollMax(max);
    setFloatingScrollLeft(window.scrollX || 0);
  };

  updateFloatingScroll();

  window.addEventListener('resize', updateFloatingScroll);
  window.addEventListener('scroll', updateFloatingScroll, { passive: true });

  const timer = window.setInterval(updateFloatingScroll, 500);

  return () => {
    window.removeEventListener('resize', updateFloatingScroll);
    window.removeEventListener('scroll', updateFloatingScroll);
    window.clearInterval(timer);
  };
}, []);

useEffect(() => {
  const handleShiftWheel = (e) => {
    if (!e.shiftKey) return;

    const scrollContainer = appScrollRef.current;
    if (!scrollContainer) return;

    e.preventDefault();

    scrollContainer.scrollLeft += e.deltaY;
  };

  const scrollContainer = appScrollRef.current;
  if (!scrollContainer) return;

  scrollContainer.addEventListener('wheel', handleShiftWheel, { passive: false });

  return () => {
    scrollContainer.removeEventListener('wheel', handleShiftWheel);
  };
}, []);

  useEffect(() => {
    casesRef.current = cases;
  }, [cases]);

  useEffect(() => {
    selectedIdsRef.current = selectedIds;
  }, [selectedIds]);

  useEffect(() => {
    historyPastRef.current = historyPast;
  }, [historyPast]);

  useEffect(() => {
    historyFutureRef.current = historyFuture;
  }, [historyFuture]);

  useEffect(() => {
    clipboardRef.current = clipboard;
  }, [clipboard]);

  useEffect(() => {
    const img = new Image();
    img.src =
      'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==';
    transparentDragImageRef.current = img;
  }, []);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem('truck-pack-template-categories');
      if (saved) {
        setTemplateCategoryOverrides(JSON.parse(saved));
      }
    } catch (error) {
      console.warn('Could not load saved template categories:', error);
    }
  }, []);

  function saveTemplateCategoryOverride(templateId, category) {
    setTemplateCategoryOverrides((prev) => {
      const next = { ...prev, [templateId]: category };
      try {
        window.localStorage.setItem('truck-pack-template-categories', JSON.stringify(next));
      } catch (error) {
        console.warn('Could not save template category locally:', error);
      }
      return next;
    });
  }

  function setTransparentDragImage(event) {
    if (transparentDragImageRef.current && event.dataTransfer) {
      event.dataTransfer.setDragImage(transparentDragImageRef.current, 0, 0);
    }
  }

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function snapHalf(value) {
    return Math.round(value * 2) / 2;
  }

  function deepClone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function snapshotState() {
    return {
      cases: deepClone(casesRef.current),
      selectedIds: [...selectedIdsRef.current],
    };
  }

  function snapshotsEqual(a, b) {
    return JSON.stringify(a) === JSON.stringify(b);
  }

  function pushHistorySnapshot(beforeSnapshot) {
    setHistoryPast((prev) => {
      const next = [...prev, deepClone(beforeSnapshot)];
      return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next;
    });
    setHistoryFuture([]);
  }

  function applySnapshot(snapshot) {
    setCases(deepClone(snapshot.cases));
    setSelectedIds([...snapshot.selectedIds]);
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
    setSelectionBox(null);

    groupDragRef.current = {
      active: false,
      anchorId: null,
      startX: 0,
      startY: 0,
      startZone: 'truck',
      bounds: null,
      itemPositions: [],
    };
  }

  function undo() {
    const past = historyPastRef.current;
    if (past.length === 0) return;

    const current = snapshotState();
    const previous = deepClone(past[past.length - 1]);

    setHistoryPast((prev) => prev.slice(0, -1));
    setHistoryFuture((prev) => [current, ...prev]);
    applySnapshot(previous);
  }

  function redo() {
    const future = historyFutureRef.current;
    if (future.length === 0) return;

    const current = snapshotState();
    const next = deepClone(future[0]);

    setHistoryPast((prev) => {
      const updated = [...prev, current];
      return updated.length > MAX_HISTORY
        ? updated.slice(updated.length - MAX_HISTORY)
        : updated;
    });
    setHistoryFuture((prev) => prev.slice(1));
    applySnapshot(next);
  }

  function copySelection() {
    const currentSelectedCases = casesRef.current.filter((c) =>
      selectedIdsRef.current.includes(c.id)
    );
    if (currentSelectedCases.length === 0) return;

    const minX = Math.min(...currentSelectedCases.map((c) => c.x));
    const minY = Math.min(...currentSelectedCases.map((c) => c.y));

    setClipboard({
      items: currentSelectedCases.map((c) => ({
        templateId: c.templateId || null,
        name: c.name,
        w: c.w,
        h: c.h,
        z: c.z || 0,
        stackCount: c.stackCount || 1,
        color: c.color || DEFAULT_CASE_COLOR.value,
        borderColor: c.borderColor || DEFAULT_CASE_COLOR.border,
        relX: c.x - minX,
        relY: c.y - minY,
        zone: c.zone || 'truck',
      })),
      width:
        Math.max(...currentSelectedCases.map((c) => c.x + c.w)) - minX,
      height:
        Math.max(...currentSelectedCases.map((c) => c.y + c.h)) - minY,
    });
  }

  function pasteClipboard() {
    const currentClipboard = clipboardRef.current;
    if (!selectedTruck || !currentClipboard || currentClipboard.items.length === 0) return;

    const before = snapshotState();

    let baseX = 1;
    let baseY = 1;

    if (selectedIdsRef.current.length > 0) {
      const selectedCasesNow = casesRef.current.filter((c) =>
        selectedIdsRef.current.includes(c.id)
      );
      if (selectedCasesNow.length > 0) {
        const minX = Math.min(...selectedCasesNow.map((c) => c.x));
        const minY = Math.min(...selectedCasesNow.map((c) => c.y));
        baseX = minX + 1;
        baseY = minY + 1;
      }
    }

    baseX = clamp(baseX, 0, Math.max(0, truck.width - currentClipboard.width));
    baseY = clamp(baseY, 0, Math.max(0, truck.height - currentClipboard.height));
    baseX = snapHalf(baseX);
    baseY = snapHalf(baseY);

    const newItems = currentClipboard.items.map((item, index) => ({
      id: makeLocalCaseId(),
      templateId: item.templateId,
      name: item.name,
      w: item.w,
      h: item.h,
      x: snapHalf(clamp(baseX + item.relX, 0, truck.width - item.w)),
      y: snapHalf(clamp(baseY + item.relY, 0, truck.height - item.h)),
      z: index + 1,
      stackCount: item.stackCount || 1,
      color: item.color || DEFAULT_CASE_COLOR.value,
      borderColor: item.borderColor || DEFAULT_CASE_COLOR.border,
    }));

    setCases((prev) => {
      let zSeed = nextZ(prev);
      const withZ = newItems.map((item) => ({ ...item, z: zSeed++ }));
      setSelectedIds(withZ.map((item) => item.id));
      return [...prev, ...withZ];
    });

    pushHistorySnapshot(before);
  }

  function shouldIgnoreShortcutTarget(target) {
    if (!target) return false;
    const tag = target.tagName;
    return (
      tag === 'INPUT' ||
      tag === 'TEXTAREA' ||
      tag === 'SELECT' ||
      target.isContentEditable
    );
  }

  useEffect(() => {
    function handleKeyDown(e) {
      if (shouldIgnoreShortcutTarget(e.target)) return;

      const isMod = e.ctrlKey || e.metaKey;
      if (!isMod) return;

      const key = e.key.toLowerCase();

      if (key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
        return;
      }

      if (key === 'z' && e.shiftKey) {
        e.preventDefault();
        redo();
        return;
      }

      if (key === 'c') {
        if (selectedIdsRef.current.length === 0) return;
        e.preventDefault();
        copySelection();
        return;
      }

      if (key === 'v') {
        if (!clipboardRef.current) return;
        e.preventDefault();
        pasteClipboard();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedTruckId, truckPresets, clipboard]);

  const selectedTruck =
    truckPresets.find((t) => String(t.id) === String(selectedTruckId)) ||
    truckPresets[0] ||
    null;

  const truck = selectedTruck
    ? {
        width: (Number(selectedTruck.length_ft) * 12) / 6,
        height: (Number(selectedTruck.width_ft) * 12) / 6,
      }
    : { width: 0, height: 0 };

  const scale = 14;
  const boardEdgeInsetPx = 2;
  const truckPixelWidth = Math.max(truck.width * scale, 300);
  const truckPixelHeight = Math.max(truck.height * scale, 120);
  const waitingArea = { width: Math.max(truck.width, 20), height: Math.max(truck.height, 12) };
  const waitingPixelWidth = Math.max(waitingArea.width * scale, truckPixelWidth);
  const waitingPixelHeight = Math.max(waitingArea.height * scale, truckPixelHeight);
  const dragGraceUnits = 1.5;

  const selectedCases = cases.filter((c) => selectedIds.includes(c.id));
  const selectedCase = selectedCases.length === 1 ? selectedCases[0] : null;
  const hasSelection = selectedCases.length > 0;

  useEffect(() => {
  fetchTruckPresets();
  fetchTemplates();
  fetchTemplateCategories();
  fetchPacks();
}, []);
  useEffect(() => {
    function getActiveTouch(touchList) {
  if (!touchList) return null;
  const touchId = touchSelectionRef.current.touchId;
  if (touchId === null) return touchList[0] || null;

  for (let i = 0; i < touchList.length; i += 1) {
    if (touchList[i].identifier === touchId) {
      return touchList[i];
    }
  }

  return touchList[0] || null;
}

function handleWindowTouchStart(e) {
  if (e.touches.length < 2) return;

  touchTemplateDragRef.current = {
    active: false,
    pending: false,
    template: null,
    offsetX: 0,
    offsetY: 0,
    grabRatioX: 0,
    grabRatioY: 0,
    startX: 0,
    startY: 0,
    lastPos: null,
  };

  setDraggingTemplate(null);
  setTouchTemplatePreview(null);
  setGhost(null);

  return;
}
function handleWindowTouchMove(e) {
  if (e.touches.length >= 2) {
    touchTemplateDragRef.current = {
      active: false,
      pending: false,
      template: null,
      offsetX: 0,
      offsetY: 0,
      grabRatioX: 0,
      grabRatioY: 0,
      startX: 0,
      startY: 0,
      lastPos: null,
    };

    setDraggingTemplate(null);
    setTouchTemplatePreview(null);
    setGhost(null);

    return;
  }
      const touch = getActiveTouch(e.touches);
      if (!touch) return;

      if (touchSelectionRef.current.pending && !touchSelectionRef.current.active) {
        const dx = touch.clientX - touchSelectionRef.current.startClientX;
        const dy = touch.clientY - touchSelectionRef.current.startClientY;
        if (Math.hypot(dx, dy) > TOUCH_SELECT_MOVE_TOLERANCE) {
          if (touchSelectionHoldTimerRef.current) {
            clearTimeout(touchSelectionHoldTimerRef.current);
            touchSelectionHoldTimerRef.current = null;
          }
          touchSelectionRef.current.pending = false;
        }
      }

      if (touchSelectionRef.current.active) {
        e.preventDefault();

        const rect = getBoardRect(touchSelectionRef.current.zone);
        if (!rect) return;

        const currentX = clamp(touch.clientX - rect.left, 0, rect.width);
        const currentY = clamp(touch.clientY - rect.top, 0, rect.height);
        const nextBox = {
          ...buildSelectionBox(
            touchSelectionRef.current.startX,
            touchSelectionRef.current.startY,
            currentX,
            currentY
          ),
          zone: touchSelectionRef.current.zone,
        };

        setSelectionBox(nextBox);
        applySelectionFromBox(nextBox);
        return;
      }

      if (touchCaseDragRef.current.active) {
        e.preventDefault();

        const dragged = casesRef.current.find((c) => c.id === touchCaseDragRef.current.caseId);
        if (!dragged) return;

        const pos = getDragPosition(
          touch.clientX,
          touch.clientY,
          dragged,
          dragged.zone || 'truck',
          touchCaseDragRef.current.offsetX,
          touchCaseDragRef.current.offsetY
        );

        if (!pos) return;

        if (groupDragRef.current.active) {
          const groupMove = getClampedGroupMove(pos.x, pos.y, pos.zone);
          applyGroupMove(groupMove.dx, groupMove.dy, groupMove.zone);
          setGhost({
            x: groupDragRef.current.bounds.minX + groupMove.dx,
            y: groupDragRef.current.bounds.minY + groupMove.dy,
            w: groupDragRef.current.bounds.maxX - groupDragRef.current.bounds.minX,
            h: groupDragRef.current.bounds.maxY - groupDragRef.current.bounds.minY,
            zone: groupMove.zone,
            isGroup: true,
          });
          return;
        }

        setCases((prev) =>
          prev.map((c) =>
            c.id === dragged.id
              ? {
                  ...c,
                  x: pos.x,
                  y: pos.y,
                  zone: pos.zone,
                }
              : c
          )
        );
        return;
      }

      if (
  touchTemplateDragRef.current.pending ||
  touchTemplateDragRef.current.active
) {
  const dragState = touchTemplateDragRef.current;
  const template = dragState.template;

  if (!template) return;

  if (dragState.pending) {
    const distanceMoved = Math.hypot(
      touch.clientX - dragState.startX,
      touch.clientY - dragState.startY
    );

    if (distanceMoved < 10) {
      return;
    }

    dragState.pending = false;
    dragState.active = true;

    setDraggingTemplate(template);
  }

  e.preventDefault();

  const scaledCaseWidth =
  template.w * scale * appScale;

const scaledCaseHeight =
  template.h * scale * appScale;

const caseOffsetX =
  scaledCaseWidth * dragState.grabRatioX;

const caseOffsetY =
  scaledCaseHeight * dragState.grabRatioY;

const truckRect =
  truckRef.current?.getBoundingClientRect();

const waitingRect =
  waitingRef.current?.getBoundingClientRect();

function isTouchInside(rect) {
  return (
    rect &&
    touch.clientX >= rect.left &&
    touch.clientX <= rect.right &&
    touch.clientY >= rect.top &&
    touch.clientY <= rect.bottom
  );
}

let targetZone = null;

if (isTouchInside(truckRect)) {
  targetZone = 'truck';
} else if (isTouchInside(waitingRect)) {
  targetZone = 'waiting';
}

let pos = null;

if (targetZone === 'truck' && truckRect) {
  const rawX =
    (touch.clientX - truckRect.left) /
      (scale * appScale) -
    template.w * dragState.grabRatioX;

  const rawY =
    (touch.clientY - truckRect.top) /
      (scale * appScale) -
    template.h * dragState.grabRatioY;

  pos = {
    x: clamp(
      rawX,
      0,
      Math.max(0, truck.width - template.w)
    ),
    y: clamp(
      rawY,
      0,
      Math.max(0, truck.height - template.h)
    ),
    zone: 'truck',
  };
} else if (targetZone === 'waiting' && waitingRect) {
  pos = getAreaPositionFromTopLeft(
    touch.clientX,
    touch.clientY,
    template,
    caseOffsetX,
    caseOffsetY,
    'waiting'
  );
}

dragState.lastPos = pos;

setTouchTemplatePreview({
  template,
  clientX: touch.clientX,
  clientY: touch.clientY,
  grabRatioX: dragState.grabRatioX,
  grabRatioY: dragState.grabRatioY,
});

setGhost(null);
}
    }
  

    function clearTouchSelectionState() {
      if (touchSelectionHoldTimerRef.current) {
        clearTimeout(touchSelectionHoldTimerRef.current);
        touchSelectionHoldTimerRef.current = null;
      }

      touchSelectionRef.current = {
        pending: false,
        active: false,
        zone: 'truck',
        touchId: null,
        startClientX: 0,
        startClientY: 0,
        startX: 0,
        startY: 0,
      };
    }

    function handleWindowTouchEnd(e) {
      if (touchSelectionRef.current.active) {
        justFinishedBoxSelectRef.current = true;
        selectionDragRef.current = {
          active: false,
          startX: 0,
          startY: 0,
          additive: false,
          baseSelection: [],
          zone: 'truck',
        };
        setSelectionBox(null);
        clearTouchSelectionState();
        setTimeout(() => {
          justFinishedBoxSelectRef.current = false;
        }, 0);
        return;
      }

      if (touchSelectionRef.current.pending) {
        setSelectedIds([]);
        clearTouchSelectionState();
        return;
      }

      if (touchCaseDragRef.current.active) {
        finishTouchCaseDrag(touchCaseDragRef.current.caseId);
      }

      if (touchTemplateDragRef.current.active) {
  const touch = e.changedTouches?.[0];
  const dragState = touchTemplateDragRef.current;
  const template = dragState.template;

  if (touch && template) {
    const scaledCaseWidth =
      template.w * scale * appScale;

    const scaledCaseHeight =
      template.h * scale * appScale;

    const caseOffsetX =
      scaledCaseWidth * dragState.grabRatioX;

    const caseOffsetY =
      scaledCaseHeight * dragState.grabRatioY;

    const truckRect =
      truckRef.current?.getBoundingClientRect();

    const waitingRect =
      waitingRef.current?.getBoundingClientRect();

    let targetZone = null;

    if (
      truckRect &&
      touch.clientX >= truckRect.left &&
      touch.clientX <= truckRect.right &&
      touch.clientY >= truckRect.top &&
      touch.clientY <= truckRect.bottom
    ) {
      targetZone = 'truck';
    } else if (
      waitingRect &&
      touch.clientX >= waitingRect.left &&
      touch.clientX <= waitingRect.right &&
      touch.clientY >= waitingRect.top &&
      touch.clientY <= waitingRect.bottom
    ) {
      targetZone = 'waiting';
    }

    let finalPos = null;

if (targetZone === 'truck' && truckRect) {
  const rawX =
    (touch.clientX - truckRect.left) /
      (scale * appScale) -
    template.w * dragState.grabRatioX;

  const rawY =
    (touch.clientY - truckRect.top) /
      (scale * appScale) -
    template.h * dragState.grabRatioY;

  finalPos = {
    x: clamp(
      rawX,
      0,
      Math.max(0, truck.width - template.w)
    ),
    y: clamp(
      rawY,
      0,
      Math.max(0, truck.height - template.h)
    ),
    zone: 'truck',
  };
} else if (targetZone === 'waiting' && waitingRect) {
  finalPos = getAreaPositionFromTopLeft(
    touch.clientX,
    touch.clientY,
    template,
    caseOffsetX,
    caseOffsetY,
    'waiting'
  );
}

dragState.lastPos = finalPos;
  }

  finishTouchTemplateDrag();
  setTouchTemplatePreview(null);

} else if (touchTemplateDragRef.current.pending) {
  touchTemplateDragRef.current = {
    active: false,
    pending: false,
    template: null,
    offsetX: 0,
    offsetY: 0,
    startX: 0,
    startY: 0,
    lastPos: null,
  };

  setDraggingTemplate(null);
  setGhost(null);
  setTouchTemplatePreview(null);
}

      clearTouchSelectionState();
    }

    window.addEventListener('touchstart', handleWindowTouchStart, { passive: false });
    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchstart', handleWindowTouchStart);
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
      if (touchSelectionHoldTimerRef.current) {
        clearTimeout(touchSelectionHoldTimerRef.current);
      }
    };
  }, [clipboard, selectedTruckId, truckPresets, appScale]);

  useEffect(() => {
    function handleWindowMouseMove(e) {
      if (!selectionDragRef.current.active) return;

      const rect = getBoardRect(selectionDragRef.current.zone);
      if (!rect) return;

      const currentX = clamp(e.clientX - rect.left, 0, rect.width);
      const currentY = clamp(e.clientY - rect.top, 0, rect.height);

      const nextBox = {
        ...buildSelectionBox(
          selectionDragRef.current.startX,
          selectionDragRef.current.startY,
          currentX,
          currentY
        ),
        zone: selectionDragRef.current.zone,
      };

      setSelectionBox(nextBox);
      applySelectionFromBox(nextBox);
    }

    function handleWindowMouseUp() {
      if (!selectionDragRef.current.active) return;

      justFinishedBoxSelectRef.current = true;

      selectionDragRef.current = {
        active: false,
        startX: 0,
        startY: 0,
        additive: false,
        baseSelection: [],
        zone: 'truck',
      };

      setSelectionBox(null);

      setTimeout(() => {
        justFinishedBoxSelectRef.current = false;
      }, 0);
    }

    window.addEventListener('mousemove', handleWindowMouseMove);
    window.addEventListener('mouseup', handleWindowMouseUp);

    return () => {
      window.removeEventListener('mousemove', handleWindowMouseMove);
      window.removeEventListener('mouseup', handleWindowMouseUp);
    };
  }, []);

  async function fetchTruckPresets() {
    const { data, error } = await supabase
      .from('truck_presets')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading truck presets:', error);
      return;
    }

    const rows = data ?? [];
    setTruckPresets(rows);

    if (rows.length > 0) {
      setSelectedTruckId((current) =>
        rows.some((t) => String(t.id) === String(current)) ? String(current) : String(rows[0].id)
      );
    } else {
      setSelectedTruckId('');
    }
  }
  async function fetchTemplateCategories() {
  const { data, error } = await supabase
    .from('template_categories')
    .select('name')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error loading template categories:', error);
    return;
  }

  const names = (data ?? [])
    .map((row) => row.name)
    .filter(Boolean);

  if (names.length > 0) {
    setTemplateCategories(names);
  }
}
async function addTemplateCategory() {
  const enteredName = window.prompt('New category name:');
  if (!enteredName) return;

  const name = enteredName.trim();
  if (!name) return;

  const alreadyExists = templateCategories.some(
    (category) => category.toLowerCase() === name.toLowerCase()
  );

  if (alreadyExists) {
    window.alert('That category already exists.');
    return;
  }

  const { data, error } = await supabase
    .from('template_categories')
    .insert([{ name }])
    .select('name')
    .single();

  if (error) {
    console.error('Error adding template category:', error);
    window.alert('Could not add category.');
    return;
  }

  setTemplateCategories((prev) => [...prev, data.name]);
}
async function deleteTemplateCategory() {
  const category = selectedTemplateCategory;

  if (!category || category === 'All') {
    window.alert('Select a category to delete first.');
    return;
  }

  const categoryInUse = templates.some(
    (template) => getTemplateCategory(template) === category
  );

  if (categoryInUse) {
    window.alert(
      `Cannot delete "${category}" because one or more cases are assigned to it.`
    );
    return;
  }

  const confirmed = window.confirm(
    `Delete the category "${category}"?`
  );

  if (!confirmed) return;

  const { error } = await supabase
    .from('template_categories')
    .delete()
    .eq('name', category);

  if (error) {
    console.error('Error deleting template category:', error);
    window.alert('Could not delete category.');
    return;
  }

  const remainingCategories = templateCategories.filter(
    (item) => item !== category
  );

  setTemplateCategories(remainingCategories);
  setSelectedTemplateCategory('All');

  if (newTemplateCategory === category) {
    setNewTemplateCategory(
      remainingCategories[0] || DEFAULT_TEMPLATE_CATEGORY
    );
  }
}
  async function fetchTemplates() {
    const { data, error } = await supabase
      .from('case_templates')
      .select('*')
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error loading case templates:', error);
      return;
    }

    setTemplates(data ?? []);
  }

  async function fetchPacks() {
    const { data, error } = await supabase
      .from('packs')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      console.error('Error loading packs:', error);
      return;
    }

    setPacks(data ?? []);
  }

  function makeLocalCaseId() {
    return `local-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  }

  function nextZ(prevCases) {
    return Math.max(...prevCases.map((c) => c.z || 0), 0) + 1;
  }

  function updateCase(id, updater) {
    setCases((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  function updateSelectedCases(updater) {
    setCases((prev) => prev.map((c) => (selectedIds.includes(c.id) ? updater(c) : c)));
  }

  function handleCaseSelection(caseId, multiSelect = false) {
    setSelectedIds((prev) => {
      if (multiSelect) {
        return prev.includes(caseId) ? prev.filter((id) => id !== caseId) : [...prev, caseId];
      }
      return [caseId];
    });
  }

  function buildSelectionBox(startX, startY, currentX, currentY) {
    return {
      left: Math.min(startX, currentX),
      top: Math.min(startY, currentY),
      width: Math.abs(currentX - startX),
      height: Math.abs(currentY - startY),
      right: Math.max(startX, currentX),
      bottom: Math.max(startY, currentY),
    };
  }

  function getIdsInsideSelectionBox(box, zone = selectionDragRef.current.zone || 'truck') {
    if (!box) return [];

    return casesRef.current
      .filter((c) => (c.zone || 'truck') === zone)
      .filter((c) => {
        const left = c.x * scale;
        const top = c.y * scale;
        const right = left + c.w * scale;
        const bottom = top + c.h * scale;

        return !(right < box.left || left > box.right || bottom < box.top || top > box.bottom);
      })
      .map((c) => c.id);
  }

  function applySelectionFromBox(box) {
    const hitIds = getIdsInsideSelectionBox(box, box?.zone || selectionDragRef.current.zone || 'truck');

    if (selectionDragRef.current.additive) {
      setSelectedIds(Array.from(new Set([...selectionDragRef.current.baseSelection, ...hitIds])));
      return;
    }

    setSelectedIds(hitIds);
  }

  function getBoardRect(zone = 'truck') {
    if (zone === 'waiting') {
      return waitingRef.current?.getBoundingClientRect() || null;
    }
    return truckRef.current?.getBoundingClientRect() || null;
  }

  function startBoxSelection(zone, clientX, clientY, additive = false) {
    const rect = getBoardRect(zone);
    if (!rect) return false;

    const startX = clamp(clientX - rect.left, 0, rect.width);
    const startY = clamp(clientY - rect.top, 0, rect.height);

    selectionDragRef.current = {
      active: true,
      startX,
      startY,
      additive,
      baseSelection: additive ? [...selectedIdsRef.current] : [],
      zone,
    };

    const initialBox = { ...buildSelectionBox(startX, startY, startX, startY), zone };
    setSelectionBox(initialBox);

    if (!additive) {
      setSelectedIds([]);
    }

    return true;
  }

  function beginTouchSelectionHold(zone, event) {
    if (event.target !== event.currentTarget || draggingCaseId !== null || draggingTemplate) {
      return;
    }

    event.preventDefault();

    const touch = event.touches[0];
    if (!touch) return;

    if (touchSelectionHoldTimerRef.current) {
      clearTimeout(touchSelectionHoldTimerRef.current);
    }

    touchSelectionRef.current = {
      pending: true,
      active: false,
      zone,
      touchId: touch.identifier,
      startClientX: touch.clientX,
      startClientY: touch.clientY,
      startX: 0,
      startY: 0,
    };

    touchSelectionHoldTimerRef.current = setTimeout(() => {
      if (!touchSelectionRef.current.pending) return;

      const started = startBoxSelection(
        zone,
        touchSelectionRef.current.startClientX,
        touchSelectionRef.current.startClientY,
        false
      );
      if (started) {
        touchSelectionRef.current.active = true;
        touchSelectionRef.current.pending = false;
        touchSelectionRef.current.startX = selectionDragRef.current.startX;
        touchSelectionRef.current.startY = selectionDragRef.current.startY;
      }
      touchSelectionHoldTimerRef.current = null;
    }, TOUCH_SELECT_HOLD_MS);
  }

  function beginGroupDrag(anchorCase) {
    const anchorZone = anchorCase.zone || 'truck';
    const groupItems = casesRef.current.filter(
      (c) => selectedIdsRef.current.includes(c.id) && (c.zone || 'truck') === anchorZone
    );
    if (groupItems.length <= 1) {
      groupDragRef.current = {
        active: false,
        anchorId: null,
        startX: 0,
        startY: 0,
        startZone: 'truck',
        bounds: null,
        itemPositions: [],
      };
      return false;
    }

    const minX = Math.min(...groupItems.map((c) => c.x));
    const minY = Math.min(...groupItems.map((c) => c.y));
    const maxX = Math.max(...groupItems.map((c) => c.x + c.w));
    const maxY = Math.max(...groupItems.map((c) => c.y + c.h));

    groupDragRef.current = {
      active: true,
      anchorId: anchorCase.id,
      startX: anchorCase.x,
      startY: anchorCase.y,
      startZone: anchorZone,
      bounds: { minX, minY, maxX, maxY },
      itemPositions: groupItems.map((c) => ({
        id: c.id,
        x: c.x,
        y: c.y,
      })),
    };

    setGhost({
      x: minX,
      y: minY,
      w: maxX - minX,
      h: maxY - minY,
      isGroup: true,
    });

    return true;
  }

  function getClampedGroupMove(nextAnchorX, nextAnchorY, targetZone = null) {
    const group = groupDragRef.current;
    const zone = targetZone || group.startZone || 'truck';
    const area = getAreaSize(zone);
    const rawDx = nextAnchorX - group.startX;
    const rawDy = nextAnchorY - group.startY;

    const minDx = -group.bounds.minX;
    const maxDx = area.width - group.bounds.maxX;
    const minDy = -group.bounds.minY;
    const maxDy = area.height - group.bounds.maxY;

    return {
      dx: clamp(rawDx, minDx, maxDx),
      dy: clamp(rawDy, minDy, maxDy),
      zone,
    };
  }

  function applyGroupMove(dx, dy, targetZone = null) {
    const zone = targetZone || groupDragRef.current.startZone || 'truck';
    setCases((prev) =>
      prev.map((c) => {
        const original = groupDragRef.current.itemPositions.find((item) => item.id === c.id);
        if (!original) return c;

        return {
          ...c,
          x: original.x + dx,
          y: original.y + dy,
          zone,
        };
      })
    );
  }

  function rotateSelected() {
    if (!hasSelection || !selectedTruck) return;

    const before = snapshotState();
    const selectedItems = casesRef.current.filter((c) => selectedIdsRef.current.includes(c.id));
    if (selectedItems.length === 0) return;

    const zoneSet = new Set(selectedItems.map((c) => c.zone || 'truck'));
    const singleZone = zoneSet.size === 1 ? selectedItems[0].zone || 'truck' : null;

    if (selectedItems.length === 1 || !singleZone) {
      setCases((prev) =>
        prev.map((c) => {
          if (!selectedIdsRef.current.includes(c.id)) return c;

          const area = getAreaSize(c.zone || 'truck');
          const rotated = { ...c, w: c.h, h: c.w };
          return {
            ...rotated,
            x: clamp(rotated.x, 0, Math.max(0, area.width - rotated.w)),
            y: clamp(rotated.y, 0, Math.max(0, area.height - rotated.h)),
          };
        })
      );
      pushHistorySnapshot(before);
      return;
    }

    const groupItems = selectedItems.filter((c) => (c.zone || 'truck') === singleZone);
    if (groupItems.length <= 1) return;

    const area = getAreaSize(singleZone);
    const minX = Math.min(...groupItems.map((c) => c.x));
    const minY = Math.min(...groupItems.map((c) => c.y));
    const maxX = Math.max(...groupItems.map((c) => c.x + c.w));
    const maxY = Math.max(...groupItems.map((c) => c.y + c.h));

    const groupHeight = maxY - minY;

    const rotatedItems = groupItems.map((c) => {
      const relX = c.x - minX;
      const relY = c.y - minY;
      const newW = c.h;
      const newH = c.w;

      const rotatedRelX = groupHeight - (relY + c.h);
      const rotatedRelY = relX;

      return {
        ...c,
        x: rotatedRelX,
        y: rotatedRelY,
        w: newW,
        h: newH,
      };
    });

    const rotatedMinX = Math.min(...rotatedItems.map((c) => c.x));
    const rotatedMinY = Math.min(...rotatedItems.map((c) => c.y));
    const rotatedMaxX = Math.max(...rotatedItems.map((c) => c.x + c.w));
    const rotatedMaxY = Math.max(...rotatedItems.map((c) => c.y + c.h));

    let placedX = minX;
    let placedY = minY;

    placedX = clamp(placedX, -rotatedMinX, area.width - rotatedMaxX);
    placedY = clamp(placedY, -rotatedMinY, area.height - rotatedMaxY);

    const rotatedMap = new Map(
      rotatedItems.map((c) => [
        c.id,
        {
          ...c,
          x: c.x + placedX,
          y: c.y + placedY,
        },
      ])
    );

    setCases((prev) => prev.map((c) => (rotatedMap.has(c.id) ? rotatedMap.get(c.id) : c)));
    pushHistorySnapshot(before);
  }

  function normalizeTemplateCategory(category) {
   return templateCategories.includes(category) ? category : DEFAULT_TEMPLATE_CATEGORY;
  }

  function getTemplateCategory(template) {
    return normalizeTemplateCategory(
      templateCategoryOverrides[template.id] || template.category || DEFAULT_TEMPLATE_CATEGORY
    );
  }

  async function updateTemplateCategory(templateId, category) {
    const nextCategory = normalizeTemplateCategory(category);

    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, category: nextCategory } : template
      )
    );
    saveTemplateCategoryOverride(templateId, nextCategory);

    const { error } = await supabase
      .from('case_templates')
      .update({ category: nextCategory })
      .eq('id', templateId);

    if (error) {
      console.warn(
        'Category saved locally, but not to Supabase. Add a category column to case_templates to sync it across devices.',
        error
      );
    }
  }

  async function renameTemplate(templateId, newNameValue) {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, name: newNameValue } : template
      )
    );

    const { error } = await supabase
      .from('case_templates')
      .update({ name: newNameValue })
      .eq('id', templateId);

    if (error) {
      console.error('Error renaming template:', error);
      fetchTemplates();
    }
  }

  function renameSelected(newNameValue) {
    if (!selectedCase) return;
    const before = snapshotState();
    updateCase(selectedCase.id, (c) => ({ ...c, name: newNameValue }));
    pushHistorySnapshot(before);
  }

  function recolorSelected(colorValue) {
    if (!hasSelection) return;
    const before = snapshotState();
    const nextColor = CASE_COLORS.find((color) => color.value === colorValue) || DEFAULT_CASE_COLOR;
    updateSelectedCases((c) => ({
      ...c,
      color: nextColor.value,
      borderColor: nextColor.border,
    }));
    pushHistorySnapshot(before);
  }

  function duplicateSelected() {
  if (!hasSelection || !selectedTruck) return;

  const before = snapshotState();

  const duplicated = selectedCases.map((item) => ({
    ...item,
    id: makeLocalCaseId(),
    name: item.name,
    x: clamp(item.x + 1, 0, truck.width - item.w),
    y: clamp(item.y + 1, 0, truck.height - item.h),
    z: 0,
    stackCount: item.stackCount || 1,
    color: item.color || DEFAULT_CASE_COLOR.value,
    borderColor: item.borderColor || DEFAULT_CASE_COLOR.border,
  }));

  setCases((prev) => {
    let zSeed = nextZ(prev);
    const withZ = duplicated.map((item) => ({ ...item, z: zSeed++ }));
    setSelectedIds(withZ.map((item) => item.id));
    return [...prev, ...withZ];
  });

  pushHistorySnapshot(before);
}

  function removeSelected() {
    if (!hasSelection) return;
    const before = snapshotState();
    setCases((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
    pushHistorySnapshot(before);
  }
  
  function deleteOneFromSelectedStack() {
  if (!selectedCase || (selectedCase.stackCount || 1) <= 1) return;

  const before = snapshotState();

  updateCase(selectedCase.id, (c) => ({
    ...c,
    stackCount: Math.max(1, (c.stackCount || 1) - 1),
  }));

  pushHistorySnapshot(before);
}

function splitSelectedStack() {
  if (!selectedCase || (selectedCase.stackCount || 1) <= 1) return;

  const before = snapshotState();
  const stackQty = selectedCase.stackCount || 1;
  const zone = selectedCase.zone || 'truck';
  const area = getAreaSize(zone);

  const newIds = [selectedCase.id];

  setCases((prev) => {
    let zSeed = nextZ(prev);

    const splitCases = [];

    for (let i = 1; i < stackQty; i += 1) {
      const offset = i * 0.8;

      const newCase = {
        ...selectedCase,
        id: makeLocalCaseId(),
        stackCount: 1,
        x: clamp(selectedCase.x + offset, 0, Math.max(0, area.width - selectedCase.w)),
        y: clamp(selectedCase.y + offset, 0, Math.max(0, area.height - selectedCase.h)),
        z: zSeed++,
      };

      newIds.push(newCase.id);
      splitCases.push(newCase);
    }

    return [
      ...prev.map((c) =>
        c.id === selectedCase.id
          ? {
              ...c,
              stackCount: 1,
            }
          : c
      ),
      ...splitCases,
    ];
  });

  setSelectedIds(newIds);
  pushHistorySnapshot(before);
}

  function clearTruck() {
    if (casesRef.current.length === 0 && selectedIdsRef.current.length === 0) return;
    const before = snapshotState();

    setCases([]);
    setSelectedIds([]);
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
    setSelectionBox(null);

    touchCaseDragRef.current = {
      active: false,
      caseId: null,
      offsetX: 0,
      offsetY: 0,
    };

    touchTemplateDragRef.current = {
      active: false,
      template: null,
      offsetX: 0,
      offsetY: 0,
      lastPos: null,
    };

    selectionDragRef.current = {
      active: false,
      startX: 0,
      startY: 0,
      additive: false,
      baseSelection: [],
      zone: 'truck',
    };

    groupDragRef.current = {
      active: false,
      anchorId: null,
      startX: 0,
      startY: 0,
      startZone: 'truck',
      bounds: null,
      itemPositions: [],
    };

    pushHistorySnapshot(before);
  }

  function newPack() {
    setSelectedPackId('');
    setPackName('');
    clearTruck();
  }

  async function loadPack(packId) {
    if (!packId) return;

    const { data: pack, error: packError } = await supabase
      .from('packs')
      .select('*')
      .eq('id', packId)
      .single();

    if (packError) {
      console.error('Error loading pack:', packError);
      return;
    }

    const { data: packCases, error: casesError } = await supabase
      .from('pack_cases')
      .select('*')
      .eq('pack_id', packId)
      .order('z', { ascending: true });

    if (casesError) {
      console.error('Error loading pack cases:', casesError);
      return;
    }

    setSelectedPackId(pack.id);
    setPackName(pack.name || '');
    setSelectedTruckId(pack.truck_preset_id || '');
    setCases(
      (packCases ?? []).map((c) => ({
        id: String(c.id),
        templateId: c.template_id,
        name: c.name,
        x: Number(c.x),
        y: Number(c.y),
        w: Number(c.w),
        h: Number(c.h),
        z: Number(c.z),
        stackCount: Number(c.stack_count || 1),
        color: c.color || DEFAULT_CASE_COLOR.value,
        borderColor: c.border_color || DEFAULT_CASE_COLOR.border,
      }))
    );
    setSelectedIds([]);
    setSelectionBox(null);
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
    setHistoryPast([]);
    setHistoryFuture([]);
  }

  async function savePack(saveAsNew = false) {
    if (!packName.trim()) {
      alert('Enter a Pack name first.');
      return;
    }

    if (!selectedTruckId) {
      alert('Select a truck first.');
      return;
    }

    const packId = saveAsNew || !selectedPackId ? `pack-${Date.now()}` : selectedPackId;

    const packRow = {
      id: packId,
      name: packName.trim(),
      truck_preset_id: selectedTruckId,
      updated_at: new Date().toISOString(),
    };

    if (saveAsNew || !selectedPackId) {
      packRow.created_at = new Date().toISOString();
    }

    const { error: packError } = await supabase.from('packs').upsert([packRow]);

    if (packError) {
      console.error('Error saving pack:', packError);
      return;
    }

    const { error: deleteError } = await supabase
      .from('pack_cases')
      .delete()
      .eq('pack_id', packId);

    if (deleteError) {
      console.error('Error clearing old pack cases:', deleteError);
      return;
    }

    if (cases.length > 0) {
      const rows = cases.map((c, index) => ({
        id: `${packId}-case-${index + 1}`,
        pack_id: packId,
        template_id: c.templateId || null,
        name: c.name,
        x: c.x,
        y: c.y,
        w: c.w,
        h: c.h,
        z: c.z,
        stack_count: c.stackCount || 1,
        color: c.color || DEFAULT_CASE_COLOR.value,
        border_color: c.borderColor || DEFAULT_CASE_COLOR.border,
      }));

      const { error: insertError } = await supabase.from('pack_cases').insert(rows);

      if (insertError) {
        console.error('Error saving pack cases:', insertError);
        return;
      }
    }

    setSelectedPackId(packId);
    await fetchPacks();
    alert(saveAsNew || !selectedPackId ? 'Pack saved.' : 'Pack updated.');
  }

  async function deletePack() {
    if (!selectedPackId) return;

    const { error } = await supabase.from('packs').delete().eq('id', selectedPackId);

    if (error) {
      console.error('Error deleting pack:', error);
      return;
    }

    setSelectedPackId('');
    setPackName('');
    setCases([]);
    setSelectedIds([]);
    setHistoryPast([]);
    setHistoryFuture([]);
    fetchPacks();
  }

  async function addTemplate() {
    const lengthIn = parseFloat(newW);
    const widthIn = parseFloat(newH);

    if (
      !newName.trim() ||
      !Number.isFinite(lengthIn) ||
      !Number.isFinite(widthIn) ||
      lengthIn <= 0 ||
      widthIn <= 0
    ) {
      return;
    }

    const newTemplate = {
      id: `template-${Date.now()}`,
      name: newName.trim(),
      length_in: lengthIn,
      width_in: widthIn,
      category: normalizeTemplateCategory(newTemplateCategory),
    };

    let { error } = await supabase.from('case_templates').insert([newTemplate]);

    if (error) {
      console.warn('Could not save template category to Supabase. Retrying without category:', error);
      const { category, ...templateWithoutCategory } = newTemplate;
      const retry = await supabase.from('case_templates').insert([templateWithoutCategory]);
      error = retry.error;
    }

    if (error) {
      console.error('Error adding template:', error);
      return;
    }

    saveTemplateCategoryOverride(newTemplate.id, newTemplate.category);
    setNewName('');
    setNewW('');
    setNewH('');
    setNewTemplateCategory(DEFAULT_TEMPLATE_CATEGORY);
    fetchTemplates();
  }

  async function addTruckPreset() {
    const lengthFt = parseFloat(customTruckLength);
    const widthFt = parseFloat(customTruckWidth);

    if (
      !customTruckName.trim() ||
      !Number.isFinite(lengthFt) ||
      !Number.isFinite(widthFt) ||
      lengthFt <= 0 ||
      widthFt <= 0
    ) {
      return;
    }

    const newTruck = {
      id: `truck-${Date.now()}`,
      name: customTruckName.trim(),
      length_ft: lengthFt,
      width_ft: widthFt,
    };

    const { error } = await supabase.from('truck_presets').insert([newTruck]);

    if (error) {
      console.error('Error adding truck preset:', error);
      return;
    }

    setCustomTruckName('');
    setCustomTruckLength('');
    setCustomTruckWidth('');
    await fetchTruckPresets();
    setSelectedTruckId(newTruck.id);
  }

  async function deleteSelectedTruck() {
    if (truckPresets.length <= 1 || !selectedTruckId) return;

    const { error } = await supabase
      .from('truck_presets')
      .delete()
      .eq('id', selectedTruckId);

    if (error) {
      console.error('Error deleting truck preset:', error);
      return;
    }

    clearTruck();
    fetchTruckPresets();
  }

  async function deleteTemplate(id) {
    const { error } = await supabase
      .from('case_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return;
    }

    fetchTemplates();
  }

  function addCaseFromTemplate(template, x = 1, y = 1, zone = 'truck') {
    if (!selectedTruck) return;

    const newId = makeLocalCaseId();
    const w = Number(template.length_in) / 6;
    const h = Number(template.width_in) / 6;

    setCases((prev) => [
      ...prev,
      {
        id: newId,
        templateId: template.id,
        name: template.name,
        w,
        h,
        x: clamp(x, 0, Math.max(0, getAreaSize(zone).width - w)),
        y: clamp(y, 0, Math.max(0, getAreaSize(zone).height - h)),
        zone,
        z: nextZ(prev),
        stackCount: 1,
        color: DEFAULT_CASE_COLOR.value,
        borderColor: DEFAULT_CASE_COLOR.border,
      },
    ]);
    setSelectedIds([newId]);
  }

  function getAreaRect(zone) {
    return zone === 'waiting'
      ? waitingRef.current?.getBoundingClientRect()
      : truckRef.current?.getBoundingClientRect();
  }

  function getAreaSize(zone) {
    return zone === 'waiting' ? waitingArea : truck;
  }

  function getAreaPosition(clientX, clientY, item, zone = 'truck') {
    const rect = getAreaRect(zone);
    const area = getAreaSize(zone);
    if (!rect || !item || !selectedTruck) return null;

    const rawX = (clientX - rect.left) / scale - item.w / 2;
    const rawY = (clientY - rect.top) / scale - item.h / 2;

    const edgeInsetUnits = boardEdgeInsetPx / scale;

    return {
      x: clamp(rawX, edgeInsetUnits, Math.max(edgeInsetUnits, area.width - item.w - edgeInsetUnits)),
      y: clamp(rawY, edgeInsetUnits, Math.max(edgeInsetUnits, area.height - item.h - edgeInsetUnits)),
      zone,
    };
  }

  function getAreaPositionFromTopLeft(clientX, clientY, item, offsetX, offsetY, zone = 'truck') {
    const rect = getAreaRect(zone);
    const area = getAreaSize(zone);
    if (!rect || !item || !selectedTruck) return null;

    const rawX =
  (clientX - rect.left - offsetX) /
  (scale * appScale);

const rawY =
  (clientY - rect.top - offsetY) /
  (scale * appScale);

    const edgeInsetUnits = boardEdgeInsetPx / scale;

    return {
      x: clamp(rawX, edgeInsetUnits, Math.max(edgeInsetUnits, area.width - item.w - edgeInsetUnits)),
      y: clamp(rawY, edgeInsetUnits, Math.max(edgeInsetUnits, area.height - item.h - edgeInsetUnits)),
      zone,
    };
  }

  function resolveDropZone(clientX, item, originZone = 'truck') {
    const truckRect = truckRef.current?.getBoundingClientRect();
    const waitingRect = waitingRef.current?.getBoundingClientRect();
    if (!truckRect || !waitingRect || !item) return originZone;

    if (originZone === 'truck') {
      if (clientX > truckRect.right + dragGraceUnits * scale) {
        return 'waiting';
      }
      return 'truck';
    }

    if (originZone === 'waiting') {
      if (clientX < waitingRect.left - dragGraceUnits * scale) {
        return 'truck';
      }
      return 'waiting';
    }

    return originZone;
  }

  function getDragPosition(clientX, clientY, item, originZone = 'truck', offsetX = null, offsetY = null) {
    const zone = resolveDropZone(clientX, item, originZone);
    return offsetX === null || offsetY === null
      ? getAreaPosition(clientX, clientY, item, zone)
      : getAreaPositionFromTopLeft(clientX, clientY, item, offsetX, offsetY, zone);
  }

  function findStackTarget(item, pos, ignoreId = null) {
  const targetZone = pos.zone || item.zone || 'truck';

  return (
    casesRef.current.find((c) => {
      if ((c.zone || 'truck') !== targetZone) return false;
      if (ignoreId && c.id === ignoreId) return false;

      return (
        c.name === item.name &&
        Math.abs(c.x - pos.x) < 0.75 &&
        Math.abs(c.y - pos.y) < 0.75
      );
    }) || null
  );
}

  function finishCaseMove(caseId, caseSnapshot = null) {
    const dragged = caseSnapshot || casesRef.current.find((c) => c.id === caseId);

    if (dragged) { 
      const target = findStackTarget(dragged, { x: dragged.x, y: dragged.y }, caseId);

      if (target) {
        setCases((prev) =>
          prev
            .map((c) =>
              c.id === target.id
                ? { ...c, stackCount: (c.stackCount || 1) + (dragged.stackCount || 1) }
                : c
            )
            .filter((c) => c.id !== caseId)
        );
        setSelectedIds([target.id]);
      }
    }

    setDraggingCaseId(null);

    touchCaseDragRef.current = {
      active: false,
      caseId: null,
      offsetX: 0,
      offsetY: 0,
    };

    groupDragRef.current = {
      active: false,
      anchorId: null,
      startX: 0,
      startY: 0,
      startZone: 'truck',
      bounds: null,
      itemPositions: [],
    };
  }

  function finishTemplatePlacement(templateSnapshot, pos) {
    if (!templateSnapshot || !pos) return;

    const before = snapshotState();

    const target = findStackTarget(templateSnapshot, pos);
    if (target) {
      updateCase(target.id, (c) => ({
        ...c,
        stackCount: (c.stackCount || 1) + 1,
      }));
      setSelectedIds([target.id]);
    } else {
      addCaseFromTemplate(templateSnapshot, pos.x, pos.y, pos.zone || 'truck');
    }

    pushHistorySnapshot(before);
  }

  function handleTemplateDragStart(event, template) {
    setTransparentDragImage(event);

    const dragTemplate = {
      ...template,
      w: Number(template.length_in) / 6,
      h: Number(template.width_in) / 6,
    };
    setDraggingTemplate(dragTemplate);
    setDraggingCaseId(null);
  }

  function handleTemplateTouchStart(e, template) {
    if (!selectedTruck) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const dragTemplate = {
      ...template,
      w: Number(template.length_in) / 6,
      h: Number(template.width_in) / 6,
    };

    const offsetX = touch.clientX - rect.left;
    const offsetY = touch.clientY - rect.top;
    const grabRatioX = Math.max(
  0,
  Math.min(1, offsetX / rect.width)
);

const grabRatioY = Math.max(
  0,
  Math.min(1, offsetY / rect.height)
);

    const pos = getDragPosition(
      touch.clientX,
      touch.clientY,
      dragTemplate,
      'truck',
      offsetX,
      offsetY
    );

    touchTemplateDragRef.current = {
  active: false,
  pending: true,
  template: dragTemplate,
  offsetX,
  offsetY,
  grabRatioX,
  grabRatioY,
  startX: touch.clientX,
  startY: touch.clientY,
  lastPos: null,
};

setDraggingTemplate(null);
setGhost(null);
  }

  function finishTouchTemplateDrag() {
    const template = touchTemplateDragRef.current.template;
    const pos = touchTemplateDragRef.current.lastPos;

    if (template && pos) {
      finishTemplatePlacement(template, pos);
    }

    touchTemplateDragRef.current = {
      active: false,
      template: null,
      offsetX: 0,
      offsetY: 0,
      lastPos: null,
    };

    setDraggingTemplate(null);
    setGhost(null);
  }

  function handlePlacedCaseDragStart(event, caseItem) {
    setTransparentDragImage(event);
    dragStartSnapshotRef.current = snapshotState();

    setDraggingCaseId(caseItem.id);
    setDraggingTemplate(null);

    const shouldGroupDrag =
      selectedIdsRef.current.includes(caseItem.id) &&
      selectedIdsRef.current.length > 1;

    if (!selectedIdsRef.current.includes(caseItem.id)) {
      setSelectedIds([caseItem.id]);
    }

    if (shouldGroupDrag) {
      beginGroupDrag(caseItem);
    } else {
      groupDragRef.current = {
        active: false,
        anchorId: null,
        startX: 0,
        startY: 0,
        bounds: null,
        itemPositions: [],
      };
      setGhost({ ...caseItem });
    }
  }

  function handleTruckDragOver(event) {
    event.preventDefault();

    if (!selectedTruck) return;

    if (draggingTemplate) {
      const pos = getDragPosition(event.clientX, event.clientY, draggingTemplate, 'truck');
      setGhost(pos ? { ...draggingTemplate, stackCount: 1, ...pos } : null);
      return;
    }

    if (draggingCaseId !== null) {
      const draggedCase = casesRef.current.find((c) => c.id === draggingCaseId);
      if (!draggedCase) return;

      if (groupDragRef.current.active) {
        const pos = getDragPosition(event.clientX, event.clientY, draggedCase, draggedCase.zone || 'truck');
        if (!pos) return;

        const groupMove = getClampedGroupMove(pos.x, pos.y, pos.zone);
        applyGroupMove(groupMove.dx, groupMove.dy, groupMove.zone);

        setGhost({
          x: groupDragRef.current.bounds.minX + groupMove.dx,
          y: groupDragRef.current.bounds.minY + groupMove.dy,
          w: groupDragRef.current.bounds.maxX - groupDragRef.current.bounds.minX,
          h: groupDragRef.current.bounds.maxY - groupDragRef.current.bounds.minY,
          zone: groupMove.zone,
          isGroup: true,
        });
        return;
      }

      const pos = getDragPosition(event.clientX, event.clientY, draggedCase, draggedCase.zone || 'truck');
      setGhost(pos ? { ...draggedCase, ...pos } : null);
    }
  }

  function handleWaitingDragOver(event) {
    event.preventDefault();

    if (!selectedTruck) return;

    if (draggingTemplate) {
      const pos = getDragPosition(event.clientX, event.clientY, draggingTemplate, 'waiting');
      setGhost(pos ? { ...draggingTemplate, stackCount: 1, ...pos } : null);
      return;
    }

    if (draggingCaseId !== null) {
      const draggedCase = casesRef.current.find((c) => c.id === draggingCaseId);
      if (!draggedCase) return;

      if (groupDragRef.current.active) {
        const pos = getDragPosition(event.clientX, event.clientY, draggedCase, draggedCase.zone || 'truck');
        if (!pos) return;

        const groupMove = getClampedGroupMove(pos.x, pos.y, pos.zone);
        applyGroupMove(groupMove.dx, groupMove.dy, groupMove.zone);

        setGhost({
          x: groupDragRef.current.bounds.minX + groupMove.dx,
          y: groupDragRef.current.bounds.minY + groupMove.dy,
          w: groupDragRef.current.bounds.maxX - groupDragRef.current.bounds.minX,
          h: groupDragRef.current.bounds.maxY - groupDragRef.current.bounds.minY,
          zone: groupMove.zone,
          isGroup: true,
        });
        return;
      }

      const pos = getDragPosition(event.clientX, event.clientY, draggedCase, draggedCase.zone || 'truck');
      setGhost(pos ? { ...draggedCase, ...pos } : null);
    }
  }

  function handleDrop(e, dropZone = 'truck') {
    e.preventDefault();

    if (!selectedTruck) return;

    if (draggingTemplate) {
      const pos = getDragPosition(e.clientX, e.clientY, draggingTemplate, dropZone);
      if (pos) {
        finishTemplatePlacement(draggingTemplate, pos);
      }
    }

    if (draggingCaseId !== null) {
      const dragged = casesRef.current.find((c) => c.id === draggingCaseId);
      const pos = getDragPosition(e.clientX, e.clientY, dragged, dragged?.zone || dropZone);

      if (dragged && pos) {
        if (!groupDragRef.current.active) {
          const before = dragStartSnapshotRef.current || snapshotState();
          const updated = { ...dragged, x: pos.x, y: pos.y, zone: pos.zone };
          const target =
            pos.zone === 'truck' ? findStackTarget(updated, pos, draggingCaseId) : null;

          if (target) {
            setCases((prev) =>
              prev
                .map((c) =>
                  c.id === target.id
                    ? { ...c, stackCount: (c.stackCount || 1) + (dragged.stackCount || 1) }
                    : c
                )
                .filter((c) => c.id !== draggingCaseId)
            );
            setSelectedIds([target.id]);
          } else {
            updateCase(draggingCaseId, (c) => ({ ...c, x: pos.x, y: pos.y, zone: pos.zone }));
          }

          const after = snapshotState();
          if (!snapshotsEqual(before, after)) {
            pushHistorySnapshot(before);
          }
        } else if (dragStartSnapshotRef.current) {
          const after = snapshotState();
          if (!snapshotsEqual(dragStartSnapshotRef.current, after)) {
            pushHistorySnapshot(dragStartSnapshotRef.current);
          }
        }
      }
    }

    dragStartSnapshotRef.current = null;
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
  }

  function handleDragEnd() {
    dragStartSnapshotRef.current = null;
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);

    groupDragRef.current = {
      active: false,
      anchorId: null,
      startX: 0,
      startY: 0,
      startZone: 'truck',
      bounds: null,
      itemPositions: [],
    };
  }

  function handlePlacedCaseTouchStart(e, caseItem) {
    if (!selectedTruck) return;

    e.preventDefault();
    e.stopPropagation();

    dragStartSnapshotRef.current = snapshotState();

    const touch = e.touches[0];
    if (!touch) return;

    const rect = e.currentTarget.getBoundingClientRect();

    touchCaseDragRef.current = {
      active: true,
      caseId: caseItem.id,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };

    const shouldGroupDrag =
      selectedIdsRef.current.includes(caseItem.id) &&
      selectedIdsRef.current.length > 1;

    if (!selectedIdsRef.current.includes(caseItem.id)) {
      setSelectedIds([caseItem.id]);
    }

    setDraggingCaseId(caseItem.id);

    if (shouldGroupDrag) {
      beginGroupDrag(caseItem);
    } else {
      groupDragRef.current = {
        active: false,
        anchorId: null,
        startX: 0,
        startY: 0,
        bounds: null,
        itemPositions: [],
      };
    }
  }

  function finishTouchCaseDrag(caseId) {
    const before = dragStartSnapshotRef.current;
    const dragged = casesRef.current.find((c) => c.id === caseId);
    finishCaseMove(caseId, dragged);

    if (before) {
      const after = snapshotState();
      if (!snapshotsEqual(before, after)) {
        pushHistorySnapshot(before);
      }
    }

    dragStartSnapshotRef.current = null;
  }

  const displayedCases = [...cases].sort((a, b) => a.z - b.z);
  const truckCases = displayedCases.filter((c) => (c.zone || 'truck') === 'truck');
  const waitingCases = displayedCases.filter((c) => (c.zone || 'truck') === 'waiting');


  function getCaseLabel(caseItem) {
    return `${caseItem.name}${caseItem.stackCount > 1 ? ` x${caseItem.stackCount}` : ''}`;
  }

  function getOverlapAmount(a, b) {
    const left = Math.max(a.x, b.x);
    const top = Math.max(a.y, b.y);
    const right = Math.min(a.x + a.w, b.x + b.w);
    const bottom = Math.min(a.y + a.h, b.y + b.h);

    if (right <= left || bottom <= top) return 0;
    return (right - left) * (bottom - top);
  }

  function shouldTreatAsOverlay(a, b) {
    if (!a || !b || a.id === b.id) return false;
    if ((a.zone || 'truck') !== (b.zone || 'truck')) return false;

    const overlapArea = getOverlapAmount(a, b);
    if (overlapArea <= 0) return false;

    const smallerArea = Math.max(0.001, Math.min(a.w * a.h, b.w * b.h));
    return overlapArea / smallerArea >= 0.45;
  }

  function getOverlayGroup(caseItem, zoneCases) {
    if (!caseItem) return [];

    const directOverlaps = zoneCases.filter(
      (other) => other.id === caseItem.id || shouldTreatAsOverlay(caseItem, other)
    );

    return directOverlaps.sort((a, b) => {
      const zDiff = (b.z || 0) - (a.z || 0);
      if (zDiff !== 0) return zDiff;
      return String(b.id).localeCompare(String(a.id));
    });
  }

  function estimateWrappedLineCount(label, fontSize, widthPx) {
    const safeFontSize = Math.max(1, fontSize);
    const safeWidth = Math.max(8, widthPx);
    const approxCharsPerLine = Math.max(2, Math.floor(safeWidth / (safeFontSize * 0.68)));
    return Math.max(1, Math.ceil(label.length / approxCharsPerLine));
  }

  function getFittedLabelMetrics(label, widthPx, heightPx, overlayCount = 1) {
    const isOverlayed = overlayCount > 1;
    const maxLines = heightPx < 14 ? 1 : isOverlayed ? 2 : heightPx < 30 ? 1 : 2;
    const maxSize = isOverlayed ? 8.5 : 13;
    const minSize = 2.5;

    for (let fontSize = maxSize; fontSize >= minSize; fontSize -= 0.5) {
      const lineCount = estimateWrappedLineCount(label, fontSize, widthPx);
      const clampedLineCount = Math.max(1, Math.min(maxLines, lineCount));
      const usedHeight = clampedLineCount * fontSize * 1.04;
      if (lineCount <= maxLines && usedHeight <= heightPx) {
        return {
          fontSize,
          lineCount: clampedLineCount,
        };
      }
    }

    return {
      fontSize: minSize,
      lineCount: maxLines,
    };
  }

  function clampLabelRectToArea(caseItem, rect) {
    const area = getAreaSize(caseItem.zone || 'truck');
    const maxW = Math.max(1, area.width * scale);
    const maxH = Math.max(1, area.height * scale);

    const width = Math.min(Math.max(4, rect.width), maxW);
    const height = Math.min(Math.max(4, rect.height), maxH);

    return {
      ...rect,
      left: clamp(rect.left, 0, Math.max(0, maxW - width)),
      top: clamp(rect.top, 0, Math.max(0, maxH - height)),
      width,
      height,
    };
  }

  function getFloatingLabelStyle(caseItem, zoneCases) {
    const group = getOverlayGroup(caseItem, zoneCases);
    const overlayIndex = Math.max(0, group.findIndex((item) => item.id === caseItem.id));
    const overlayCount = Math.max(1, group.length);
    const isOverlayed = overlayCount > 1;
    const pixelW = Math.max(1, caseItem.w * scale);
    const pixelH = Math.max(1, caseItem.h * scale);
    const label = getCaseLabel(caseItem);

    if (!isOverlayed) {
      const rawRect = clampLabelRectToArea(caseItem, {
        left: caseItem.x * scale,
        top: caseItem.y * scale,
        width: Math.max(6, pixelW),
        height: Math.max(6, pixelH),
      });

      const metrics = getFittedLabelMetrics(
        label,
        Math.max(4, rawRect.width - 4),
        Math.max(4, rawRect.height - 3),
        overlayCount
      );

      return {
        ...rawRect,
        fontSize: metrics.fontSize,
        lineCount: metrics.lineCount,
        zIndex: 10000 + (caseItem.z || 0),
        isOverlayed: false,
      };
    }

    const visibleBandCount = Math.max(1, Math.min(overlayCount, 4));
    const gap = pixelH < 22 ? 0 : 2;
    const maxUsableHeight = Math.max(6, pixelH - gap * (visibleBandCount - 1));
    const bandHeight = Math.max(4, maxUsableHeight / visibleBandCount);
    const stackHeight = bandHeight * visibleBandCount + gap * (visibleBandCount - 1);
    const centeredStackTop = Math.max(0, (pixelH - stackHeight) / 2);
    const topOffset = clamp(
      centeredStackTop + overlayIndex * (bandHeight + gap),
      0,
      Math.max(0, pixelH - bandHeight)
    );

    const rawRect = clampLabelRectToArea(caseItem, {
      left: caseItem.x * scale,
      top: caseItem.y * scale + topOffset,
      width: Math.max(6, pixelW),
      height: bandHeight,
    });

    const metrics = getFittedLabelMetrics(
      label,
      Math.max(4, rawRect.width - 4),
      Math.max(4, rawRect.height - 2),
      overlayCount
    );

    return {
      ...rawRect,
      fontSize: metrics.fontSize,
      lineCount: metrics.lineCount,
      zIndex: 10000 + (caseItem.z || 0) + overlayIndex,
      isOverlayed: true,
    };
  }

  function renderFloatingCaseLabel(caseItem, zoneCases) {
    const styleInfo = getFloatingLabelStyle(caseItem, zoneCases);

    return (
      <div
        key={`${caseItem.id}-floating-label`}
        className="truck-print-label absolute pointer-events-none flex items-center justify-center overflow-visible rounded [px-1] text-center font-semibold"
        style={{
          left: styleInfo.left,
          top: styleInfo.top,
          width: styleInfo.width,
          height: styleInfo.height,
          fontSize: styleInfo.fontSize,
          lineHeight: 1.04,
          zIndex: styleInfo.zIndex,
          color: 'white',
          backgroundColor: styleInfo.isOverlayed
            ? 'rgba(15, 23, 42, 0.84)'
            : 'rgba(15, 23, 42, 0.18)',
          border: styleInfo.isOverlayed && styleInfo.height >= 10 ? '1px solid rgba(255,255,255,0.42)' : '0',
          textShadow: '0 1px 2px rgba(0, 0, 0, 0.95)',
          boxShadow: styleInfo.isOverlayed && styleInfo.height >= 10 ? '0 1px 2px rgba(0,0,0,0.35)' : 'none',
          overflowWrap: 'normal',
          wordBreak: 'normal',
        }}
        title={getCaseLabel(caseItem)}
      >
        <span
  className="block w-full text-center whitespace-normal"
  style={{
    display: '-webkit-box',
WebkitBoxOrient: 'vertical',
WebkitLineClamp: styleInfo.lineCount,
overflow: 'hidden',
maxHeight: '100%',
whiteSpace: styleInfo.lineCount > 1 ? 'normal' : 'nowrap',
wordBreak: 'normal',
overflowWrap: 'normal',
lineHeight: 1,
  }}
>
  {getCaseLabel(caseItem)}
</span>
      </div>
    );
  }

  function getCasesAtPoint(clientX, clientY, zoneCases, zone) {
    const rect = getAreaRect(zone);
    if (!rect) return [];

    const x = (clientX - rect.left) / scale;
    const y = (clientY - rect.top) / scale;

    return zoneCases
      .filter((item) => x >= item.x && x <= item.x + item.w && y >= item.y && y <= item.y + item.h)
      .sort((a, b) => {
        const zDiff = (b.z || 0) - (a.z || 0);
        if (zDiff !== 0) return zDiff;
        return String(b.id).localeCompare(String(a.id));
      });
  }

  function handleLayeredCaseClick(event, clickedCase, zoneCases, zone) {
    event.stopPropagation();

    const hitCases = getCasesAtPoint(event.clientX, event.clientY, zoneCases, zone);
    if (hitCases.length <= 1) {
      handleCaseSelection(clickedCase.id, event.ctrlKey || event.metaKey);
      return;
    }

    const hitIds = hitCases.map((item) => item.id);
    const currentlySelectedHitIndex = hitIds.findIndex((id) => selectedIdsRef.current.includes(id));
    const nextCase =
      currentlySelectedHitIndex >= 0
        ? hitCases[(currentlySelectedHitIndex + 1) % hitCases.length]
        : hitCases[0];

    if (event.ctrlKey || event.metaKey) {
      setSelectedIds((prev) =>
        prev.includes(nextCase.id) ? prev.filter((id) => id !== nextCase.id) : [...prev, nextCase.id]
      );
      return;
    }

    setSelectedIds([nextCase.id]);
  }

  const filteredTemplates = selectedTemplateCategory === 'All'
    ? templates
    : templates.filter((template) => getTemplateCategory(template) === selectedTemplateCategory);

  const templateCategoryCounts = allTemplateCategories.reduce((counts, category) => {
    counts[category] =
      category === 'All'
        ? templates.length
        : templates.filter((template) => getTemplateCategory(template) === category).length;
    return counts;
  }, {});


  function printTruckGrid() {
    window.print();
  }

useEffect(() => {
  const element = appScrollRef.current;
  if (!element) return;

  function getDistance(touches) {
    return Math.hypot(
      touches[1].clientX - touches[0].clientX,
      touches[1].clientY - touches[0].clientY
    );
  }

  function handleTouchStart(event) {
    if (event.touches.length !== 2) return;

    event.preventDefault();

    pinchStartDistanceRef.current = getDistance(event.touches);
    pinchStartScaleRef.current = appScale;
  }

  function handleTouchMove(event) {
    if (
      event.touches.length !== 2 ||
      pinchStartDistanceRef.current === null
    ) {
      return;
    }

    event.preventDefault();

    const currentDistance = getDistance(event.touches);
    const ratio =
      currentDistance / pinchStartDistanceRef.current;

    const nextScale =
      pinchStartScaleRef.current * ratio;

    setAppScale(
      Math.min(1.5, Math.max(0.4, nextScale))
    );
  }

  function handleTouchEnd(event) {
    if (event.touches.length < 2) {
      pinchStartDistanceRef.current = null;
    }
  }

  element.addEventListener('touchstart', handleTouchStart, {
    passive: false,
  });

  element.addEventListener('touchmove', handleTouchMove, {
    passive: false,
  });

  element.addEventListener('touchend', handleTouchEnd);
  element.addEventListener('touchcancel', handleTouchEnd);

  return () => {
    element.removeEventListener('touchstart', handleTouchStart);
    element.removeEventListener('touchmove', handleTouchMove);
    element.removeEventListener('touchend', handleTouchEnd);
    element.removeEventListener('touchcancel', handleTouchEnd);
  };
}, [appScale]);

  return (
  <div
  ref={appScrollRef}
  className="min-h-screen w-full bg-slate-950 text-white p-6 overflow-x-auto overflow-y-auto"
  style={{
    zoom: appScale,
  }}
>
    {touchTemplatePreview && (
      <div
        className="fixed pointer-events-none border-2 border-yellow-300 bg-yellow-500/20 rounded"
        style={{
  left:
  (touchTemplatePreview.clientX -
    (appScrollRef.current?.getBoundingClientRect().left || 0)) /
    appScale -
  touchTemplatePreview.template.w *
  scale *
  touchTemplatePreview.grabRatioX,

top:
  (touchTemplatePreview.clientY -
    (appScrollRef.current?.getBoundingClientRect().top || 0)) /
    appScale -
  touchTemplatePreview.template.h *
  scale *
  touchTemplatePreview.grabRatioY,
  width:
  touchTemplatePreview.template.w * scale,
height:
  touchTemplatePreview.template.h * scale,
  zIndex: 99999,
  boxSizing: 'border-box',
}}
      />
    )}
      <style>{`
        html,
  body,
  #root {
    margin: 0;
    min-height: 100%;
    background: rgb(2, 6, 23);
  }
        @media print {
          @page {
          margin: 0.25in;
          }

          html, body, #root {
            background: white !important;
            color: black !important;
          }

          body * {
            visibility: hidden !important;
          }

          .truck-print-area,
          .truck-print-area * {
            visibility: visible !important;
          }

          .truck-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            margin: 0 !important;
            overflow: hidden !important;
            padding-bottom: 0 !important;
            box-sizing: border-box !important;
            background-color: white !important;
            background-image:
              linear-gradient(to right, rgba(0,0,0,0.18) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(0,0,0,0.18) 1px, transparent 1px) !important;
            border: 2px solid black !important;
            color: black !important;
            -webkit-print-color-adjust: economy !important;
            print-color-adjust: economy !important;
          }

          .truck-print-area * {
            color: black !important;
            text-shadow: none !important;
            box-shadow: none !important;
          }

          .truck-print-area > div {
            border-color: black !important;
          }

          .truck-print-label {
  color: white !important;
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  text-shadow: 0 1px 2px rgba(0, 0, 0, 0.95) !important;
  overflow: visible !important;
  padding: 0 1px !important;
  line-height: 1.1 !important;
  font-size: 14px !important;
  font-weight: 700 !important;
}

.truck-print-label span {
  color: white !important;
  background-color: rgba(15, 23, 42, 0.85) !important;
  background-image: none !important;
  display: inline-block !important;
  font-weight: 700 !important;
  padding: 2px 6px !important;
  border-radius: 3px !important;
  -webkit-line-clamp: unset !important;
  overflow: visible !important;
  max-height: none !important;
  white-space: normal !important;
  line-height: 1.1 !important;
  font-size: 14px !important;
  -webkit-print-color-adjust: exact !important;
  print-color-adjust: exact !important;
  -webkit-box-decoration-break: clone !important;
  box-decoration-break: clone !important;
}

          .truck-print-area button,
          .truck-print-hide {
            display: none !important;
          }
        }
      `}</style>
      <div className="flex gap-6 items-start min-w-max">
        <div className="truck-print-hide w-[240px] space-y-4 shrink-0">
          <div className="bg-slate-800 p-3 rounded">
            <h3 className="text-lg font-semibold mb-2">Pack</h3>

            <input
              placeholder="Pack Name"
              value={packName}
              onChange={(e) => setPackName(e.target.value)}
              className="w-full mb-2 p-2 bg-slate-900 rounded"
            />

            <select
              value={selectedPackId}
              onChange={(e) => {
                setSelectedPackId(e.target.value);
                if (e.target.value) loadPack(e.target.value);
              }}
              className="w-full mb-2 bg-slate-900 p-2 rounded"
            >
              <option value="">Select Saved Pack</option>
              {packs.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>

            <div className="grid grid-cols-2 gap-2">
              <button onClick={newPack} className="bg-slate-700 p-2 rounded">
                New
              </button>
              <button onClick={() => savePack(false)} className="bg-sky-700 p-2 rounded">
                Save
              </button>
              <button onClick={() => savePack(true)} className="bg-slate-700 p-2 rounded">
                Save As
              </button>
              <button onClick={deletePack} className="bg-rose-700 p-2 rounded">
                Delete
              </button>
              <button
                onClick={printTruckGrid}
                className="col-span-2 bg-emerald-700 p-2 rounded"
              >
                Print Truck Grid
              </button>
            </div>
          </div>

          <div className="bg-slate-800 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Truck Size</h3>
              <button
                onClick={fetchTruckPresets}
                className="rounded bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600"
              >
                Refresh
              </button>
            </div>

            <select
              value={selectedTruckId}
              onChange={(e) => {
                setSelectedTruckId(e.target.value);
                clearTruck();
              }}
              className="w-full bg-slate-900 p-2 rounded"
            >
              {truckPresets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({Number(t.length_ft)} ft x {Number(t.width_ft)} ft)
                </option>
              ))}
            </select>

            <button
              onClick={deleteSelectedTruck}
              className="mt-2 w-full bg-rose-700 p-1 rounded text-sm"
            >
              Delete Selected Truck
            </button>
          </div>

          <div className="bg-slate-800 p-3 rounded">
            <h3 className="mb-2 text-lg font-semibold">Add Truck</h3>
            <input
              placeholder="Truck Name"
              value={customTruckName}
              onChange={(e) => setCustomTruckName(e.target.value)}
              className="w-full mb-1 p-2 bg-slate-900 rounded"
            />
            <input
              placeholder="Length (ft)"
              value={customTruckLength}
              onChange={(e) => setCustomTruckLength(e.target.value)}
              className="w-full mb-1 p-2 bg-slate-900 rounded"
            />
            <input
              placeholder="Width (ft)"
              value={customTruckWidth}
              onChange={(e) => setCustomTruckWidth(e.target.value)}
              className="w-full mb-2 p-2 bg-slate-900 rounded"
            />
            <button onClick={addTruckPreset} className="w-full bg-sky-700 p-2 rounded">
              Add
            </button>
          </div>

          <div className="bg-slate-800 p-3 rounded">
            <h3 className="mb-2 text-lg font-semibold">Add Case</h3>
            <input
              placeholder="Name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              className="w-full mb-1 p-2 bg-slate-900 rounded"
            />
            <input
              placeholder="Length (in)"
              value={newW}
              onChange={(e) => setNewW(e.target.value)}
              className="w-full mb-1 p-2 bg-slate-900 rounded"
            />
            <input
              placeholder="Width (in)"
              value={newH}
              onChange={(e) => setNewH(e.target.value)}
              className="w-full mb-1 p-2 bg-slate-900 rounded"
            />
            <select
              value={newTemplateCategory}
              onChange={(e) => setNewTemplateCategory(e.target.value)}
              className="w-full mb-2 p-2 bg-slate-900 rounded"
            >
              {templateCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            <button onClick={addTemplate} className="w-full bg-sky-700 p-2 rounded">
              Add
            </button>
          </div>

          <div className="bg-slate-800 p-3 rounded">
            <h3 className="mb-2 text-lg font-semibold">Instructions</h3>
            <div className="text-sm text-slate-300 space-y-1">
              <p>Drag cases into the truck grid.</p>
              <p>Drag a matching case onto the same spot to stack it.</p>
              <p>Double-click a case in the truck to rotate it.</p>
              <p>Tap or click a case to select it.</p>
              <p>To select more than one, press and hold on an empty area, then drag around the cases you want.</p>
              <p></p>
            </div>
          </div>
        </div>

        <div
  className="flex-1 min-w-0"
  style={{ minWidth: truckPixelWidth + waitingPixelWidth + 24 }}
>
          <div className="space-y-4">
            <div className="flex items-start gap-6">
            <div
              ref={truckRef}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget || e.button !== 0) return;
                startBoxSelection('truck', e.clientX, e.clientY, e.ctrlKey || e.metaKey);
              }}
              onTouchStart={(e) => beginTouchSelectionHold('truck', e)}
              onTouchMove={(e) => {
                if (touchSelectionRef.current.pending || touchSelectionRef.current.active) {
                  e.preventDefault();
                }
              }}
              onTouchEnd={(e) => {
                if (justFinishedBoxSelectRef.current) return;
                if (touchSelectionRef.current.pending || touchSelectionRef.current.active) return;
                if (e.target === e.currentTarget) {
                  setSelectedIds([]);
                }
              }}
              onClick={(e) => {
                if (justFinishedBoxSelectRef.current) return;

                if (e.target === e.currentTarget && !selectionDragRef.current.active) {
                  setSelectedIds([]);
                }
              }}
              onDragOver={handleTruckDragOver}
              onDrop={(e) => handleDrop(e, 'truck')}
              className="truck-print-area relative border border-slate-500 bg-slate-950 overflow-hidden rounded"
              style={{
                width: truckPixelWidth,
                height: truckPixelHeight,
                boxSizing: 'border-box',
                touchAction: 'none',
                backgroundImage: `
                  linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)
                `,
                backgroundSize: `${scale}px ${scale}px`,
              }}
            >
              {truckCases.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const hideDuringDrag =
                  draggingCaseId !== null &&
                  (c.id === draggingCaseId ||
                    (groupDragRef.current.active && selectedIds.includes(c.id)));

                return (
                  <div
                    key={c.id}
                    draggable
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleLayeredCaseClick(e, c, truckCases, 'truck')}
                    onDragStart={(e) => handlePlacedCaseDragStart(e, c)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handlePlacedCaseTouchStart(e, c)}
                    onDoubleClick={() => rotateSelected()}
                    className={`absolute border-2 flex items-center justify-center overflow-hidden ${
                      draggingCaseId === c.id ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    style={{
                      left: c.x * scale,
                      top: c.y * scale,
                      width: c.w * scale,
                      height: c.h * scale,
                      zIndex: isSelected ? 9000 + (c.z || 0) : c.z,
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      backgroundColor: c.color || DEFAULT_CASE_COLOR.value,
                      borderColor: isSelected ? '#facc15' : c.borderColor || DEFAULT_CASE_COLOR.border,
                      boxShadow: isSelected ? '0 0 0 2px rgba(250, 204, 21, 0.25)' : 'none',
                      opacity: hideDuringDrag ? 0.08 : 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    {isSelected && (
                      <button
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const before = snapshotState();
                        setCases((prev) => prev.filter((item) => item.id !== c.id));
                        setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                        pushHistorySnapshot(before);
                      }}
                      className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
                      style={{ zIndex: 20000 }}
                    >
                      X
                    </button>
                    )}
                  </div>
                );
              })}

              {truckCases.map((c) => renderFloatingCaseLabel(c, truckCases))}

              {ghost && ghost.zone !== 'waiting' && (
                <div
                  className="absolute border border-dashed border-yellow-300 bg-yellow-500/20 pointer-events-none"
                  style={{
                    left: ghost.x * scale,
                    top: ghost.y * scale,
                    width: ghost.w * scale,
                    height: ghost.h * scale,
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {selectionBox && selectionBox.zone !== 'waiting' && (
                <div
                  className="absolute pointer-events-none border border-dashed border-sky-300 bg-sky-400/15"
                  style={{
                    left: selectionBox.left,
                    top: selectionBox.top,
                    width: selectionBox.width,
                    height: selectionBox.height,
                    zIndex: 1000,
                  }}
                />
              )}
            </div>

            <div
              ref={waitingRef}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget || e.button !== 0) return;
                startBoxSelection('waiting', e.clientX, e.clientY, e.ctrlKey || e.metaKey);
              }}
              onTouchStart={(e) => beginTouchSelectionHold('waiting', e)}
              onTouchMove={(e) => {
                if (touchSelectionRef.current.pending || touchSelectionRef.current.active) {
                  e.preventDefault();
                }
              }}
              onTouchEnd={(e) => {
                if (justFinishedBoxSelectRef.current) return;
                if (touchSelectionRef.current.pending || touchSelectionRef.current.active) return;
                if (e.target === e.currentTarget) {
                  setSelectedIds([]);
                }
              }}
              onClick={(e) => {
                if (justFinishedBoxSelectRef.current) return;

                if (e.target === e.currentTarget && !selectionDragRef.current.active) {
                  setSelectedIds([]);
                }
              }}
              onDragOver={handleWaitingDragOver}
              onDrop={(e) => handleDrop(e, 'waiting')}
              className="truck-print-hide relative border border-slate-500 bg-slate-950 overflow-hidden rounded"
              style={{
                width: waitingPixelWidth,
                height: waitingPixelHeight,
                boxSizing: 'border-box',
                touchAction: 'none',
                backgroundImage: `
                  linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)
                `,
                backgroundSize: `${scale}px ${scale}px`,
              }}
            >
              <div className="absolute left-2 top-2 text-xs font-semibold uppercase tracking-wide text-slate-400 pointer-events-none">
                Waiting Area
              </div>

              {waitingCases.map((c) => {
                const isSelected = selectedIds.includes(c.id);
                const hideDuringDrag = draggingCaseId !== null && c.id === draggingCaseId;

                return (
                  <div
                    key={c.id}
                    draggable
                    onMouseDown={(e) => e.stopPropagation()}
                    onClick={(e) => handleLayeredCaseClick(e, c, waitingCases, 'waiting')}
                    onDragStart={(e) => handlePlacedCaseDragStart(e, c)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handlePlacedCaseTouchStart(e, c)}
                    onDoubleClick={() => rotateSelected()}
                    className={`absolute border-2 flex items-center justify-center overflow-hidden ${
                      draggingCaseId === c.id ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    style={{
                      left: c.x * scale,
                      top: c.y * scale,
                      width: c.w * scale,
                      height: c.h * scale,
                      zIndex: isSelected ? 9000 + (c.z || 0) : c.z,
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      backgroundColor: c.color || DEFAULT_CASE_COLOR.value,
                      borderColor: isSelected ? '#facc15' : c.borderColor || DEFAULT_CASE_COLOR.border,
                      boxShadow: isSelected ? '0 0 0 2px rgba(250, 204, 21, 0.25)' : 'none',
                      opacity: hideDuringDrag ? 0.08 : 1,
                      pointerEvents: 'auto',
                    }}
                  >
                    {isSelected && (
                      <button
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        const before = snapshotState();
                        setCases((prev) => prev.filter((item) => item.id !== c.id));
                        setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                        pushHistorySnapshot(before);
                      }}
                      className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
                      style={{ zIndex: 20000 }}
                    >
                      X
                    </button>
                    )}
                  </div>
                );
              })}

              {waitingCases.map((c) => renderFloatingCaseLabel(c, waitingCases))}

              {ghost && ghost.zone === 'waiting' && (
                <div
                  className="absolute border border-dashed border-yellow-300 bg-yellow-500/20 pointer-events-none"
                  style={{
                    left: ghost.x * scale,
                    top: ghost.y * scale,
                    width: ghost.w * scale,
                    height: ghost.h * scale,
                    boxSizing: 'border-box',
                  }}
                />
              )}

              {selectionBox && selectionBox.zone === 'waiting' && (
                <div
                  className="absolute pointer-events-none border border-dashed border-sky-300 bg-sky-400/15"
                  style={{
                    left: selectionBox.left,
                    top: selectionBox.top,
                    width: selectionBox.width,
                    height: selectionBox.height,
                    zIndex: 1000,
                  }}
                />
              )}
            </div>
            </div>

           <div className="truck-print-hide flex flex-col gap-6">
              <div
  className="bg-slate-800 p-3 rounded min-w-0"
style={{
  width: 'fit-content',
  maxWidth: 'calc(100vw - 250px)',
}}
>
                <div className="flex items-center justify-between mb-3 gap-2">
                  <h3 className="text-lg font-semibold">Case Selection</h3>
                  <div className="flex gap-2">
                  <button
  onClick={addTemplateCategory}
  className="rounded bg-emerald-700 px-2 py-1 text-sm hover:bg-emerald-600"
>
  + Category
</button>
<button
  onClick={deleteTemplateCategory}
  className="rounded bg-rose-700 px-2 py-1 text-sm hover:bg-rose-600"
>
  Delete Category
</button>
                    <button
                      onClick={fetchTemplates}
                      className="rounded bg-slate-700 px-2 py-1 text-sm hover:bg-slate-600"
                    >
                      Refresh
                    </button>
                    <button
                      onClick={clearTruck}
                      className="bg-rose-700 px-2 py-1 rounded text-sm"
                    >
                      Clear Truck
                    </button>
                  </div>
                </div>

                <div className="mb-3 grid grid-cols-1 gap-2 sm:grid-cols-[180px_1fr]">
                  <select
                    value={selectedTemplateCategory}
                    onChange={(e) => setSelectedTemplateCategory(e.target.value)}
                    className="rounded bg-slate-900 p-2 text-sm"
                  >
                    {allTemplateCategories.map((category) => (
                      <option key={category} value={category}>
                        {category} ({templateCategoryCounts[category] || 0})
                      </option>
                    ))}
                  </select>
                  <div className="text-xs text-slate-400 self-center">
                    Assign existing cases with the category dropdown on each card. More categories can be added later.
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {filteredTemplates.map((t) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleTemplateDragStart(e, t)}
                      onDragEnd={handleDragEnd}
                      onTouchStart={(e) => handleTemplateTouchStart(e, t)}
                      className="relative p-2 bg-slate-700 rounded cursor-grab"
                      style={{
                        width: '220px',
                        touchAction: 'none',
                        userSelect: 'none',
                        WebkitUserSelect: 'none',
                      }}
                    >
                      <input
                        value={t.name}
                        onChange={(e) => renameTemplate(t.id, e.target.value)}
                        className="w-full bg-slate-900 p-1 rounded mb-1"
                      />
                      <div className="text-sm text-slate-300 mb-1">
                        {Number(t.length_in).toFixed(2)} L × {Number(t.width_in).toFixed(2)} W in
                      </div>
                      <select
                        value={getTemplateCategory(t)}
                        onPointerDown={(e) => e.stopPropagation()}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onChange={(e) => updateTemplateCategory(t.id, e.target.value)}
                        className="w-full rounded bg-slate-900 p-1 text-xs text-slate-200"
                      >
                        {templateCategories.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>

                      <button
                        onTouchStart={(e) => e.stopPropagation()}
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteTemplate(t.id);
                        }}
                        className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
                      >
                        X
                      </button>
                    </div>
                  ))}
                  {filteredTemplates.length === 0 && (
                    <div className="rounded bg-slate-900 p-3 text-sm text-slate-400">
                      No cases in this category yet. Switch to All, then assign cases to {selectedTemplateCategory}.
                    </div>
                  )}
                </div>
              </div>

              <div className="bg-slate-800 p-3 rounded space-y-2" style={{ width: waitingPixelWidth }}>
                <h3 className="text-lg font-semibold">
                  {selectedCases.length === 1 ? 'Selected Case' : 'Selected Cases'}
                </h3>

                {hasSelection ? (
                  <>
                    {selectedCase ? (
                      <input
                        value={selectedCase.name}
                        onChange={(e) => renameSelected(e.target.value)}
                        className="w-full bg-slate-900 p-1 rounded"
                      />
                    ) : (
                      <div className="rounded bg-slate-900 p-2 text-sm text-slate-300">
                        {selectedCases.length} cases selected
                      </div>
                    )}

                    <div className="text-sm text-slate-400">
                      {selectedCase
                        ? `Stack qty: ${selectedCase.stackCount || 1}`
                        : `Bulk actions will apply to all ${selectedCases.length} selected cases.`}
                    </div>

                    <div>
                      <div className="mb-1 text-sm text-slate-300">Case Color</div>
                      <div className="flex flex-wrap gap-2">
                        {CASE_COLORS.map((color) => {
                          const isActive =
                            selectedCases.length > 0 &&
                            selectedCases.every((item) => (item.color || DEFAULT_CASE_COLOR.value) === color.value);

                          return (
                            <button
                              key={color.label}
                              onClick={() => recolorSelected(color.value)}
                              title={color.label}
                              className={`h-8 w-8 rounded border ${isActive ? 'border-white' : 'border-slate-500'}`}
                              style={{ backgroundColor: color.value }}
                            />
                          );
                        })}
                      </div>
                    </div>

<button
  type="button"
  onClick={rotateSelected}
  className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
>
  Rotate
</button>

<button
  onClick={duplicateSelected}
  className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
>
  Duplicate
</button>

{selectedCase && (selectedCase.stackCount || 1) > 1 && (
  <>
    <button
      type="button"
      onClick={splitSelectedStack}
      className="rounded bg-slate-700 px-2 py-1 hover:bg-amber-600"
    >
      Split Stack
    </button>

    <button
      type="button"
      onClick={deleteOneFromSelectedStack}
      className="rounded bg-slate-700 px-2 py-1 hover:bg-orange-600"
    >
      Delete One
    </button>
  </>
)}

<button
  type="button"
  onClick={duplicateSelected}
  className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
>
 
  Clear Selection
</button>

<button
  type="button"
  onClick={removeSelected}
  className="rounded bg-rose-700 px-2 py-1 hover:bg-rose-600"
>
  Delete
</button>
                    </>
                ) : (
                  <div className="rounded bg-slate-900 p-3 text-sm text-slate-400">
                    Select one or more cases from the truck or waiting area to edit them here.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
