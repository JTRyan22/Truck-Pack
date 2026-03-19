import React, { useRef, useState, useEffect } from 'react';

const STORAGE_KEY = 'truck-pack-app-state-v3';

const DEFAULT_TRUCKS = [
  { id: '24', name: '24 ft', lengthFt: 24, widthFt: 8.5 },
  { id: '26', name: '26 ft', lengthFt: 26, widthFt: 8.5 },
  { id: '27', name: '27 ft', lengthFt: 27, widthFt: 8.5 },
];

function loadSavedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export default function App() {
  const saved = loadSavedState();

  const [truckPresets, setTruckPresets] = useState(
    saved?.truckPresets?.length ? saved.truckPresets : DEFAULT_TRUCKS
  );
  const [selectedTruckId, setSelectedTruckId] = useState(
    saved?.selectedTruckId || '26'
  );
  const [cases, setCases] = useState(
    Array.isArray(saved?.cases) ? saved.cases : []
  );
  const [templates, setTemplates] = useState(
    Array.isArray(saved?.templates) ? saved.templates : []
  );
  const [selectedId, setSelectedId] = useState(
    saved?.selectedId ?? null
  );

  const [customTruckName, setCustomTruckName] = useState('');
  const [customTruckLength, setCustomTruckLength] = useState('');
  const [customTruckWidth, setCustomTruckWidth] = useState('');

  const [newName, setNewName] = useState('');
  const [newW, setNewW] = useState('');
  const [newH, setNewH] = useState('');

  const [draggingTemplate, setDraggingTemplate] = useState(null);
  const [draggingCaseId, setDraggingCaseId] = useState(null);
  const [ghost, setGhost] = useState(null);

  const truckRef = useRef(null);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          truckPresets,
          selectedTruckId,
          cases,
          templates,
          selectedId,
        })
      );
    } catch (err) {
      console.error('Save failed:', err);
    }
  }, [truckPresets, selectedTruckId, cases, templates, selectedId]);

  const selectedTruck =
    truckPresets.find((t) => t.id === selectedTruckId) || truckPresets[0];

  const truck = {
    width: (selectedTruck.lengthFt * 12) / 6,
    height: (selectedTruck.widthFt * 12) / 6,
  };

  const scale = 14;
  const selectedCase = cases.find((c) => c.id === selectedId) ?? null;

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function snapHalf(value) {
    return Math.round(value * 2) / 2;
  }

  function nextZ(prevCases) {
    return Math.max(...prevCases.map((c) => c.z || 0), 0) + 1;
  }

  function updateCase(id, updater) {
    setCases((prev) => prev.map((c) => (c.id === id ? updater(c) : c)));
  }

  function renameTemplate(templateId, newNameValue) {
    setTemplates((prev) =>
      prev.map((template) =>
        template.id === templateId ? { ...template, name: newNameValue } : template
      )
    );
  }

  function renameSelected(newNameValue) {
    if (!selectedCase) return;
    updateCase(selectedCase.id, (c) => ({ ...c, name: newNameValue }));
  }

  function rotateSelected() {
    if (!selectedCase) return;
    updateCase(selectedCase.id, (c) => {
      const rotated = { ...c, w: c.h, h: c.w };
      return {
        ...rotated,
        x: clamp(rotated.x, 0, truck.width - rotated.w),
        y: clamp(rotated.y, 0, truck.height - rotated.h),
      };
    });
  }

  function duplicateSelected() {
    if (!selectedCase) return;
    const newId = Math.max(...cases.map((c) => c.id), 0) + 1;
    setCases((prev) => [
      ...prev,
      {
        ...selectedCase,
        id: newId,
        name: `${selectedCase.name} copy`,
        x: clamp(selectedCase.x + 1, 0, truck.width - selectedCase.w),
        y: clamp(selectedCase.y + 1, 0, truck.height - selectedCase.h),
        z: nextZ(prev),
        stackCount: selectedCase.stackCount || 1,
      },
    ]);
    setSelectedId(newId);
  }

  function removeSelected() {
    if (!selectedCase) return;
    setCases((prev) => prev.filter((c) => c.id !== selectedCase.id));
    setSelectedId(null);
  }

  function clearTruck() {
    setCases([]);
    setSelectedId(null);
    setDraggingTemplate(null);
    setDraggingCaseId(null);
    setGhost(null);
  }

  function addTemplate() {
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

    setTemplates((prev) => [
      ...prev,
      {
        id: `t${Date.now()}`,
        name: newName.trim(),
        w: lengthIn / 6,
        h: widthIn / 6,
      },
    ]);

    setNewName('');
    setNewW('');
    setNewH('');
  }

  function addTruckPreset() {
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
      lengthFt,
      widthFt,
    };

    setTruckPresets((prev) => [...prev, newTruck]);
    setSelectedTruckId(newTruck.id);
    setCustomTruckName('');
    setCustomTruckLength('');
    setCustomTruckWidth('');
  }

  function deleteSelectedTruck() {
    if (truckPresets.length <= 1) return;
    const remaining = truckPresets.filter((t) => t.id !== selectedTruckId);
    setTruckPresets(remaining);
    setSelectedTruckId(remaining[0].id);
  }

  function addCaseFromTemplate(template, x = 1, y = 1) {
    const newId = Math.max(...cases.map((c) => c.id), 0) + 1;
    setCases((prev) => [
      ...prev,
      {
        ...template,
        id: newId,
        x: clamp(snapHalf(x), 0, truck.width - template.w),
        y: clamp(snapHalf(y), 0, truck.height - template.h),
        z: nextZ(prev),
        stackCount: 1,
      },
    ]);
    setSelectedId(newId);
  }

  function getTruckPosition(clientX, clientY, item) {
    const rect = truckRef.current?.getBoundingClientRect();
    if (!rect || !item) return null;

    const rawX = (clientX - rect.left) / scale - item.w / 2;
    const rawY = (clientY - rect.top) / scale - item.h / 2;

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

  function handleTemplateDragStart(template) {
    setDraggingTemplate(template);
    setDraggingCaseId(null);
  }

  function handlePlacedCaseDragStart(caseItem) {
    setDraggingCaseId(caseItem.id);
    setDraggingTemplate(null);
    setSelectedId(caseItem.id);
    setGhost({ ...caseItem });
  }

  function handleTruckDragOver(event) {
    event.preventDefault();

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

    if (draggingTemplate) {
      const pos = getTruckPosition(e.clientX, e.clientY, draggingTemplate);
      if (pos) {
        const target = findStackTarget(draggingTemplate, pos);
        if (target) {
          updateCase(target.id, (c) => ({
            ...c,
            stackCount: (c.stackCount || 1) + 1,
          }));
          setSelectedId(target.id);
        } else {
          addCaseFromTemplate(draggingTemplate, pos.x, pos.y);
        }
      }
    }

    if (draggingCaseId !== null) {
      const dragged = cases.find((c) => c.id === draggingCaseId);
      const pos = getTruckPosition(e.clientX, e.clientY, dragged);

      if (dragged && pos) {
        const target = findStackTarget(dragged, pos, draggingCaseId);
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
          setSelectedId(target.id);
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

  const displayedCases = [...cases].sort((a, b) => a.z - b.z);

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <div className="grid lg:grid-cols-[320px_1fr] gap-6 items-start">
        <div className="space-y-4">
          <div className="bg-slate-800 p-3 rounded">
            <h3 className="mb-2 text-lg font-semibold">Truck Size</h3>
            <select
              value={selectedTruckId}
              onChange={(e) => setSelectedTruckId(e.target.value)}
              className="w-full bg-slate-900 p-2 rounded"
            >
              {truckPresets.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name} ({t.lengthFt} ft x {t.widthFt} ft)
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
            <h3 className="mb-2 text-lg font-semibold">Add Truck Size</h3>
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
              Add Truck
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
              <p>1. Add truck sizes or choose one from the dropdown.</p>
              <p>2. Add case types in inches.</p>
              <p>3. Drag cases into the truck grid.</p>
              <p>4. Drag a matching case onto the same spot to stack it.</p>
              <p>5. Double-click a case in the truck to rotate it.</p>
            </div>
          </div>

          <div className="bg-slate-800 p-3 rounded">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-lg font-semibold">Case Selection</h3>
              <button onClick={clearTruck} className="bg-rose-700 px-2 py-1 rounded text-sm">
                Clear Truck
              </button>
            </div>

            {templates.map((t) => (
              <div
                key={t.id}
                draggable
                onDragStart={() => handleTemplateDragStart(t)}
                onDragEnd={handleDragEnd}
                className="relative p-2 mb-2 bg-slate-700 rounded cursor-grab"
              >
                <input
                  value={t.name}
                  onChange={(e) => renameTemplate(t.id, e.target.value)}
                  className="w-full bg-slate-900 p-1 rounded mb-1"
                />
                <div className="text-sm text-slate-300">
                  {(t.w * 6).toFixed(2)} L × {(t.h * 6).toFixed(2)} W in
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    setTemplates((prev) => prev.filter((item) => item.id !== t.id));
                  }}
                  className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
                >
                  X
                </button>
              </div>
            ))}
          </div>

          {selectedCase && (
            <div className="bg-slate-800 p-3 rounded space-y-2">
              <h3 className="text-lg font-semibold">Selected Case</h3>
              <input
                value={selectedCase.name}
                onChange={(e) => renameSelected(e.target.value)}
                className="w-full bg-slate-900 p-1 rounded"
              />
              <div className="text-sm text-slate-400">
                Stack qty: {selectedCase.stackCount || 1}
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
                  onClick={removeSelected}
                  className="rounded bg-rose-700 px-2 py-1 hover:bg-rose-600"
                >
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>

        <div
          ref={truckRef}
          onDragOver={handleTruckDragOver}
          onDrop={handleDrop}
          className="relative border border-slate-500 bg-slate-950 overflow-auto rounded"
          style={{
            width: truck.width * scale,
            height: truck.height * scale,
            backgroundImage: `
              linear-gradient(to right, rgba(148,163,184,0.14) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(148,163,184,0.14) 1px, transparent 1px)
            `,
            backgroundSize: `${scale}px ${scale}px`,
          }}
        >
          {displayedCases.map((c) => (
            <div
              key={c.id}
              draggable
              onClick={() => setSelectedId(c.id)}
              onDragStart={() => handlePlacedCaseDragStart(c)}
              onDragEnd={handleDragEnd}
              onDoubleClick={() => {
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
              className={`absolute bg-sky-500/40 border text-xs flex items-center justify-center cursor-move ${
                selectedId === c.id ? 'border-yellow-400' : 'border-sky-300'
              }`}
              style={{
                left: c.x * scale,
                top: c.y * scale,
                width: c.w * scale,
                height: c.h * scale,
                zIndex: c.z,
              }}
            >
              {c.name}
              {c.stackCount > 1 ? ` x${c.stackCount}` : ''}
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setCases((prev) => prev.filter((item) => item.id !== c.id));
                  if (selectedId === c.id) setSelectedId(null);
                }}
                className="absolute top-0 right-0 text-[10px] bg-rose-700 px-1 rounded"
              >
                X
              </button>
            </div>
          ))}

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
        </div>
      </div>
    </div>
  );
}