import { useState } from "react";

export function useGraphLayoutState() {
  const [showAside, setShowAside] = useState(true);
  const [showTable, setShowTable] = useState(true);
  const [asideWidth, setAsideWidth] = useState(440);
  const [tableHeight, setTableHeight] = useState(440);

  const quickFiltersRight = showAside ? asideWidth + 12 : 12;
  const controlsRight = showAside ? asideWidth + 8 : 8;
  const rendererToggleRight = controlsRight + 88;

  function startAsideResize(e: React.MouseEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = asideWidth;

    function onMove(ev: MouseEvent) {
      const delta = startX - ev.clientX;
      setAsideWidth(Math.max(220, Math.min(700, startWidth + delta)));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  function startTableResize(e: React.MouseEvent) {
    e.preventDefault();
    const startY = e.clientY;
    const startHeight = tableHeight;

    function onMove(ev: MouseEvent) {
      const delta = startY - ev.clientY;
      setTableHeight(Math.max(120, Math.min(700, startHeight + delta)));
    }

    function onUp() {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  }

  return {
    showAside,
    setShowAside,
    showTable,
    setShowTable,
    asideWidth,
    tableHeight,
    quickFiltersRight,
    controlsRight,
    rendererToggleRight,
    startAsideResize,
    startTableResize,
  };
}
