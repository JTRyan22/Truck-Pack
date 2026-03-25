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

export default function App() {
  const [truckPresets, setTruckPresets] = useState([]);
  const [selectedTruckId, setSelectedTruckId] = useState('');
  const [customTruckName, setCustomTruckName] = useState('');
  const [customTruckLength, setCustomTruckLength] = useState('');
  const [customTruckWidth, setCustomTruckWidth] = useState('');

  const [cases, setCases] = useState([]);
  const [selectedIds, setSelectedIds] = useState([]);
  const [draggingTemplate, setDraggingTemplate] = useState(null);
  const [draggingCaseId, setDraggingCaseId] = useState(null);
  const [ghost, setGhost] = useState(null);
  const [selectionBox, setSelectionBox] = useState(null);

  const truckRef = useRef(null);
  const justFinishedBoxSelectRef = useRef(false);

  const [templates, setTemplates] = useState([]);

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
  });

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function snapHalf(value) {
    return Math.round(value * 2) / 2;
  }

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
  const truckPixelWidth = Math.max(truck.width * scale, 300);
  const truckPixelHeight = Math.max(truck.height * scale, 120);

  const selectedCases = cases.filter((c) => selectedIds.includes(c.id));
  const selectedCase = selectedCases.length === 1 ? selectedCases[0] : null;
  const hasSelection = selectedCases.length > 0;

  useEffect(() => {
    fetchTruckPresets();
    fetchTemplates();
    fetchPacks();
  }, []);

  useEffect(() => {
    function handleWindowTouchMove(e) {
      const touch = e.touches[0];
      if (!touch) return;

      if (touchCaseDragRef.current.active) {
        e.preventDefault();

        const dragged = cases.find((c) => c.id === touchCaseDragRef.current.caseId);
        if (!dragged) return;

        const pos = getTruckPositionFromTopLeft(
          touch.clientX,
          touch.clientY,
          dragged,
          touchCaseDragRef.current.offsetX,
          touchCaseDragRef.current.offsetY
        );

        if (!pos) return;

        setCases((prev) =>
          prev.map((c) =>
            c.id === dragged.id
              ? {
                  ...c,
                  x: pos.x,
                  y: pos.y,
                }
              : c
          )
        );
        return;
      }

      if (touchTemplateDragRef.current.active) {
        e.preventDefault();

        const template = touchTemplateDragRef.current.template;
        if (!template) return;

        const pos = getTruckPositionFromTopLeft(
          touch.clientX,
          touch.clientY,
          template,
          touchTemplateDragRef.current.offsetX,
          touchTemplateDragRef.current.offsetY
        );

        touchTemplateDragRef.current.lastPos = pos;
        setGhost(pos ? { ...template, stackCount: 1, ...pos } : null);
      }
    }

    function handleWindowTouchEnd() {
      if (touchCaseDragRef.current.active) {
        finishTouchCaseDrag(touchCaseDragRef.current.caseId);
      }

      if (touchTemplateDragRef.current.active) {
        finishTouchTemplateDrag();
      }
    }

    window.addEventListener('touchmove', handleWindowTouchMove, { passive: false });
    window.addEventListener('touchend', handleWindowTouchEnd, { passive: false });
    window.addEventListener('touchcancel', handleWindowTouchEnd, { passive: false });

    return () => {
      window.removeEventListener('touchmove', handleWindowTouchMove);
      window.removeEventListener('touchend', handleWindowTouchEnd);
      window.removeEventListener('touchcancel', handleWindowTouchEnd);
    };
  }, [cases, selectedTruckId]);

  useEffect(() => {
    function handleWindowMouseMove(e) {
      if (!selectionDragRef.current.active || !truckRef.current) return;

      const rect = truckRef.current.getBoundingClientRect();
      const currentX = clamp(e.clientX - rect.left, 0, rect.width);
      const currentY = clamp(e.clientY - rect.top, 0, rect.height);

      const nextBox = buildSelectionBox(
        selectionDragRef.current.startX,
        selectionDragRef.current.startY,
        currentX,
        currentY
      );

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
  }, [cases, selectedTruckId, truckPresets]);

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

  function getIdsInsideSelectionBox(box) {
    if (!box) return [];

    return cases
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
    const hitIds = getIdsInsideSelectionBox(box);

    if (selectionDragRef.current.additive) {
      setSelectedIds(Array.from(new Set([...selectionDragRef.current.baseSelection, ...hitIds])));
      return;
    }

    setSelectedIds(hitIds);
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
    updateCase(selectedCase.id, (c) => ({ ...c, name: newNameValue }));
  }

  function recolorSelected(colorValue) {
    if (!hasSelection) return;
    const nextColor = CASE_COLORS.find((color) => color.value === colorValue) || DEFAULT_CASE_COLOR;
    updateSelectedCases((c) => ({
      ...c,
      color: nextColor.value,
      borderColor: nextColor.border,
    }));
  }

  function rotateSelected() {
    if (!hasSelection || !selectedTruck) return;

    setCases((prev) =>
      prev.map((c) => {
        if (!selectedIds.includes(c.id)) return c;

        const rotated = { ...c, w: c.h, h: c.w };
        return {
          ...rotated,
          x: clamp(rotated.x, 0, truck.width - rotated.w),
          y: clamp(rotated.y, 0, truck.height - rotated.h),
        };
      })
    );
  }

  function duplicateSelected() {
    if (!hasSelection || !selectedTruck) return;

    const duplicated = selectedCases.map((item, index) => ({
      ...item,
      id: makeLocalCaseId(),
      name: `${item.name} copy`,
      x: clamp(item.x + 1 + index * 0.5, 0, truck.width - item.w),
      y: clamp(item.y + 1 + index * 0.5, 0, truck.height - item.h),
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
  }

  function removeSelected() {
    if (!hasSelection) return;
    setCases((prev) => prev.filter((c) => !selectedIds.includes(c.id)));
    setSelectedIds([]);
  }

  function clearTruck() {
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
    };
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

    newPack();
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
    };

    const { error } = await supabase.from('case_templates').insert([newTemplate]);

    if (error) {
      console.error('Error adding template:', error);
      return;
    }

    setNewName('');
    setNewW('');
    setNewH('');
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

  function addCaseFromTemplate(template, x = 1, y = 1) {
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
        x: clamp(snapHalf(x), 0, truck.width - w),
        y: clamp(snapHalf(y), 0, truck.height - h),
        z: nextZ(prev),
        stackCount: 1,
        color: DEFAULT_CASE_COLOR.value,
        borderColor: DEFAULT_CASE_COLOR.border,
      },
    ]);
    setSelectedIds([newId]);
  }

  function getTruckPosition(clientX, clientY, item) {
    const rect = truckRef.current?.getBoundingClientRect();
    if (!rect || !item || !selectedTruck) return null;

    const rawX = (clientX - rect.left) / scale - item.w / 2;
    const rawY = (clientY - rect.top) / scale - item.h / 2;

    return {
      x: clamp(snapHalf(rawX), 0, truck.width - item.w),
      y: clamp(snapHalf(rawY), 0, truck.height - item.h),
    };
  }

  function getTruckPositionFromTopLeft(clientX, clientY, item, offsetX, offsetY) {
    const rect = truckRef.current?.getBoundingClientRect();
    if (!rect || !item || !selectedTruck) return null;

    const rawX = (clientX - rect.left - offsetX) / scale;
    const rawY = (clientY - rect.top - offsetY) / scale;

    return {
      x: clamp(snapHalf(rawX), 0, truck.width - item.w),
      y: clamp(snapHalf(rawY), 0, truck.height - item.h),
    };
  }

  function findStackTarget(item, pos, ignoreId = null) {
    return (
      cases.find((c) => {
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
    const dragged = caseSnapshot || cases.find((c) => c.id === caseId);

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
  }

  function finishTemplatePlacement(templateSnapshot, pos) {
    if (!templateSnapshot || !pos) return;

    const target = findStackTarget(templateSnapshot, pos);
    if (target) {
      updateCase(target.id, (c) => ({
        ...c,
        stackCount: (c.stackCount || 1) + 1,
      }));
      setSelectedIds([target.id]);
    } else {
      addCaseFromTemplate(templateSnapshot, pos.x, pos.y);
    }
  }

  function handleTemplateDragStart(template) {
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
    const pos = getTruckPositionFromTopLeft(
      touch.clientX,
      touch.clientY,
      dragTemplate,
      offsetX,
      offsetY
    );

    touchTemplateDragRef.current = {
      active: true,
      template: dragTemplate,
      offsetX,
      offsetY,
      lastPos: pos,
    };

    setDraggingTemplate(dragTemplate);
    setGhost(pos ? { ...dragTemplate, stackCount: 1, ...pos } : null);
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

  function handlePlacedCaseDragStart(caseItem) {
    setDraggingCaseId(caseItem.id);
    setDraggingTemplate(null);
    if (!selectedIds.includes(caseItem.id)) {
      setSelectedIds([caseItem.id]);
    }
    setGhost({ ...caseItem });
  }

  function handleTruckDragOver(event) {
    event.preventDefault();

    if (!selectedTruck) return;

    if (draggingTemplate) {
      const pos = getTruckPosition(event.clientX, event.clientY, draggingTemplate);
      setGhost(pos ? { ...draggingTemplate, stackCount: 1, ...pos } : null);
      return;
    }

    if (draggingCaseId !== null) {
      const draggedCase = cases.find((c) => c.id === draggingCaseId);
      if (!draggedCase) return;
      const pos = getTruckPosition(event.clientX, event.clientY, draggedCase);
      setGhost(pos ? { ...draggedCase, ...pos } : null);
    }
  }

  function handleDrop(e) {
    e.preventDefault();

    if (!selectedTruck) return;

    if (draggingTemplate) {
      const pos = getTruckPosition(e.clientX, e.clientY, draggingTemplate);
      if (pos) {
        finishTemplatePlacement(draggingTemplate, pos);
      }
    }

    if (draggingCaseId !== null) {
      const dragged = cases.find((c) => c.id === draggingCaseId);
      const pos = getTruckPosition(e.clientX, e.clientY, dragged);

      if (dragged && pos) {
        const updated = { ...dragged, x: pos.x, y: pos.y };
        const target = findStackTarget(updated, pos, draggingCaseId);

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
          updateCase(draggingCaseId, (c) => ({ ...c, x: pos.x, y: pos.y }));
        }
      }
    }

    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
  }

  function handleDragEnd() {
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
  }

  function handlePlacedCaseTouchStart(e, caseItem) {
    if (!selectedTruck) return;

    const touch = e.touches[0];
    if (!touch) return;

    const rect = e.currentTarget.getBoundingClientRect();

    touchCaseDragRef.current = {
      active: true,
      caseId: caseItem.id,
      offsetX: touch.clientX - rect.left,
      offsetY: touch.clientY - rect.top,
    };

    setSelectedIds([caseItem.id]);
    setDraggingCaseId(caseItem.id);
  }

  function finishTouchCaseDrag(caseId) {
    const dragged = cases.find((c) => c.id === caseId);
    finishCaseMove(caseId, dragged);
  }

  const displayedCases = [...cases].sort((a, b) => a.z - b.z);

  return (
    <div className="min-h-screen w-full bg-slate-950 text-white p-6 overflow-x-auto overflow-y-auto">
      <div className="flex gap-6 items-start min-w-max">
        <div className="w-[240px] space-y-4 shrink-0">
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
              className="w-full mb-2 p-2 bg-slate-900 rounded"
            />
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
              <p>Ctrl-click or Cmd-click cases to multi-select.</p>
              <p>Drag on empty truck space to box-select cases.</p>
            </div>
          </div>
        </div>

        <div className="shrink-0" style={{ width: truckPixelWidth }}>
          <div className="space-y-4">
            <div
              ref={truckRef}
              onMouseDown={(e) => {
                if (e.target !== e.currentTarget || draggingCaseId !== null || draggingTemplate) {
                  return;
                }

                const rect = truckRef.current?.getBoundingClientRect();
                if (!rect) return;

                const startX = clamp(e.clientX - rect.left, 0, rect.width);
                const startY = clamp(e.clientY - rect.top, 0, rect.height);
                const additive = e.ctrlKey || e.metaKey;

                selectionDragRef.current = {
                  active: true,
                  startX,
                  startY,
                  additive,
                  baseSelection: additive ? [...selectedIds] : [],
                };

                const initialBox = buildSelectionBox(startX, startY, startX, startY);
                setSelectionBox(initialBox);

                if (!additive) {
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
              onDrop={handleDrop}
              className="relative border border-slate-500 bg-slate-950 overflow-hidden rounded"
              style={{
                width: truckPixelWidth,
                height: truckPixelHeight,
                touchAction: 'none',
                backgroundImage: `
                  linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)
                `,
                backgroundSize: `${scale}px ${scale}px`,
              }}
            >
              {displayedCases.map((c) => {
                const isSelected = selectedIds.includes(c.id);

                return (
                  <div
                    key={c.id}
                    draggable
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCaseSelection(c.id, e.ctrlKey || e.metaKey);
                    }}
                    onDragStart={() => handlePlacedCaseDragStart(c)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={(e) => handlePlacedCaseTouchStart(e, c)}
                    onDoubleClick={() => {
                      if (!selectedTruck) return;

                      setCases((prev) =>
                        prev.map((item) => {
                          if (item.id !== c.id) return item;

                          const rotated = { ...item, w: item.h, h: item.w };
                          return {
                            ...rotated,
                            x: Math.min(rotated.x, truck.width - rotated.w),
                            y: Math.min(rotated.y, truck.height - rotated.h),
                          };
                        })
                      );
                    }}
                    className={`absolute border-2 text-xs flex items-center justify-center ${
                      draggingCaseId === c.id ? 'cursor-grabbing' : 'cursor-move'
                    }`}
                    style={{
                      left: c.x * scale,
                      top: c.y * scale,
                      width: c.w * scale,
                      height: c.h * scale,
                      zIndex: c.z,
                      touchAction: 'none',
                      userSelect: 'none',
                      WebkitUserSelect: 'none',
                      backgroundColor: c.color || DEFAULT_CASE_COLOR.value,
                      borderColor: isSelected ? '#facc15' : c.borderColor || DEFAULT_CASE_COLOR.border,
                      boxShadow: isSelected ? '0 0 0 2px rgba(250, 204, 21, 0.25)' : 'none',
                    }}
                  >
                    {c.name}
                    {c.stackCount > 1 ? ` x${c.stackCount}` : ''}

                    <button
                      onTouchStart={(e) => e.stopPropagation()}
                      onClick={(e) => {
                        e.stopPropagation();
                        setCases((prev) => prev.filter((item) => item.id !== c.id));
                        setSelectedIds((prev) => prev.filter((id) => id !== c.id));
                      }}
                      className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
                    >
                      X
                    </button>
                  </div>
                );
              })}

              {ghost && (
                <div
                  className="absolute border border-dashed border-yellow-300 bg-yellow-500/20 pointer-events-none"
                  style={{
                    left: ghost.x * scale,
                    top: ghost.y * scale,
                    width: ghost.w * scale,
                    height: ghost.h * scale,
                  }}
                />
              )}

              {selectionBox && (
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

            <div className="bg-slate-800 p-3 rounded" style={{ width: truckPixelWidth }}>
              <div className="flex items-center justify-between mb-3 gap-2">
                <h3 className="text-lg font-semibold">Case Selection</h3>
                <div className="flex gap-2">
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

              <div className="flex flex-wrap gap-2">
                {templates.map((t) => (
                  <div
                    key={t.id}
                    draggable
                    onDragStart={() => handleTemplateDragStart(t)}
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
                    <div className="text-sm text-slate-300">
                      {Number(t.length_in).toFixed(2)} L × {Number(t.width_in).toFixed(2)} W in
                    </div>

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
              </div>
            </div>

            {hasSelection && (
              <div className="bg-slate-800 p-3 rounded space-y-2" style={{ width: truckPixelWidth }}>
                <h3 className="text-lg font-semibold">
                  {selectedCases.length === 1 ? 'Selected Case' : 'Selected Cases'}
                </h3>

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

                <div className="flex flex-wrap gap-2">
                  <button
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
                  <button
                    onClick={() => setSelectedIds([])}
                    className="rounded bg-slate-700 px-2 py-1 hover:bg-slate-600"
                  >
                    Clear Selection
                  </button>
                  <button
                    onClick={removeSelected}
                    className="rounded bg-rose-700 px-2 py-1 hover:bg-rose-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}