import React, { useState, useEffect } from "react";
import { Minimize2, Maximize2, Move } from "lucide-react";

export default function ImportProgressWidget({ status, setStatus }) {
  const [position, setPosition] = useState({ x: window.innerWidth - 380, y: window.innerHeight - 280 });
  const [dragging, setDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Update position on window resize to keep it on screen
  useEffect(() => {
    const handleResize = () => {
      setPosition((prev) => {
        const width = status.isMinimized ? 340 : 360;
        const height = status.isMinimized ? 50 : 250;
        const x = Math.max(10, Math.min(window.innerWidth - width - 20, prev.x));
        const y = Math.max(10, Math.min(window.innerHeight - height - 20, prev.y));
        return { x, y };
      });
    };
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [status.isMinimized]);

  // Initial positioning
  useEffect(() => {
    if (status.importing) {
      const width = status.isMinimized ? 340 : 360;
      const height = status.isMinimized ? 50 : 250;
      setPosition({
        x: window.innerWidth - width - 30,
        y: window.innerHeight - height - 30
      });
    }
  }, [status.importing]);

  const handleMouseDown = (e) => {
    const dragHandle = e.target.closest(".drag-handle");
    if (dragHandle) {
      setDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (dragging) {
        let newX = e.clientX - dragOffset.x;
        let newY = e.clientY - dragOffset.y;

        const width = status.isMinimized ? 340 : 360;
        const height = status.isMinimized ? 50 : 250;

        // Boundary checks
        newX = Math.max(10, Math.min(window.innerWidth - width - 10, newX));
        newY = Math.max(10, Math.min(window.innerHeight - height - 10, newY));

        setPosition({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setDragging(false);
    };

    if (dragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
    }
    return () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [dragging, dragOffset, status.isMinimized]);

  if (!status.importing) return null;

  const totalProgress = status.totalFiles > 0
    ? Math.round(
        ((status.currentFileIndex) / status.totalFiles) * 100 +
        (status.currentFileProgress / status.totalFiles)
      )
    : 0;

  const toggleMinimize = (e) => {
    e.stopPropagation();
    setStatus((prev) => ({
      ...prev,
      isMinimized: !prev.isMinimized,
    }));
  };

  const containerStyle = {
    position: "fixed",
    left: `${position.x}px`,
    top: `${position.y}px`,
    width: status.isMinimized ? "340px" : "360px",
    background: "rgba(15, 23, 42, 0.95)",
    backdropFilter: "blur(12px)",
    WebkitBackdropFilter: "blur(12px)",
    border: "1px solid rgba(255, 255, 255, 0.15)",
    borderRadius: "12px",
    boxShadow: dragging
      ? "0 20px 25px -5px rgb(0 0 0 / 0.5), 0 8px 10px -6px rgb(0 0 0 / 0.5)"
      : "0 10px 15px -3px rgb(0 0 0 / 0.3), 0 4px 6px -4px rgb(0 0 0 / 0.3)",
    color: "#f8fafc",
    zIndex: 999999,
    fontFamily: "system-ui, -apple-system, sans-serif",
    userSelect: "none",
    transition: dragging ? "none" : "box-shadow 0.2s ease, width 0.3s ease",
  };

  const headerStyle = {
    padding: "10px 14px",
    borderBottom: status.isMinimized ? "none" : "1px solid rgba(255, 255, 255, 0.1)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    cursor: dragging ? "grabbing" : "grab",
  };

  if (status.isMinimized) {
    return (
      <div style={containerStyle} onMouseDown={handleMouseDown}>
        <div className="drag-handle" style={headerStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div className="import-spinner" style={{
              width: "14px",
              height: "14px",
              border: "2px solid #38bdf8",
              borderTopColor: "transparent",
              borderRadius: "50%",
              animation: "spin 1s linear infinite"
            }}></div>
            <span style={{ fontSize: "12px", fontWeight: "500" }}>
              Importing ({status.currentFileIndex + 1}/{status.totalFiles}): {totalProgress}%
            </span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
            <button
              onClick={toggleMinimize}
              style={{
                background: "none",
                border: "none",
                color: "#94a3b8",
                cursor: "pointer",
                padding: "2px",
                display: "flex",
                alignItems: "center"
              }}
              title="Expand"
            >
              <Maximize2 size={14} />
            </button>
          </div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  }

  return (
    <div style={containerStyle} onMouseDown={handleMouseDown}>
      {/* Header */}
      <div className="drag-handle" style={headerStyle}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Move size={14} style={{ color: "#94a3b8" }} />
          <span style={{ fontWeight: "600", fontSize: "13px" }}>Import Progress</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={toggleMinimize}
            style={{
              background: "none",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "2px",
              display: "flex",
              alignItems: "center"
            }}
            title="Minimize"
          >
            <Minimize2 size={14} />
          </button>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "14px" }}>
        {/* File status */}
        <div style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "4px" }}>
          File {status.currentFileIndex + 1} of {status.totalFiles}
        </div>
        <div style={{
          fontSize: "14px",
          fontWeight: "500",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
          marginBottom: "10px"
        }} title={status.currentFileName}>
          {status.currentFileName}
        </div>

        {/* Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
          <span>Current file progress</span>
          <span>{status.currentFileProgress}%</span>
        </div>
        <div style={{ width: "100%", height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden", marginBottom: "12px" }}>
          <div style={{ width: `${status.currentFileProgress}%`, height: "100%", background: "#0ea5e9", borderRadius: "3px", transition: "width 0.1s ease" }}></div>
        </div>

        {/* Total Progress Bar */}
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>
          <span>Total batch progress</span>
          <span>{totalProgress}%</span>
        </div>
        <div style={{ width: "100%", height: "6px", background: "#334155", borderRadius: "3px", overflow: "hidden", marginBottom: "16px" }}>
          <div style={{ width: `${totalProgress}%`, height: "100%", background: "#10b981", borderRadius: "3px", transition: "width 0.1s ease" }}></div>
        </div>

        {/* Stats */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          background: "#1e293b",
          padding: "10px",
          borderRadius: "8px",
          fontSize: "12px"
        }}>
          <div>
            <div style={{ color: "#94a3b8" }}>Imported</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#10b981" }}>{status.successCount}</div>
          </div>
          <div>
            <div style={{ color: "#94a3b8" }}>Skipped</div>
            <div style={{ fontSize: "16px", fontWeight: "600", color: "#f59e0b" }}>{status.skippedCount}</div>
          </div>
        </div>

        {/* Queue Preview */}
        {status.filesList && status.filesList.length > 1 && (
          <div style={{ marginTop: "12px" }}>
            <div style={{ fontSize: "11px", color: "#94a3b8", marginBottom: "4px" }}>Queue</div>
            <div style={{
              maxHeight: "60px",
              overflowY: "auto",
              fontSize: "11px",
              background: "#0f172a",
              padding: "6px",
              borderRadius: "4px"
            }}>
              {status.filesList.map((fName, idx) => (
                <div key={idx} style={{
                  color: idx === status.currentFileIndex ? "#38bdf8" : idx < status.currentFileIndex ? "#64748b" : "#94a3b8",
                  textDecoration: idx < status.currentFileIndex ? "line-through" : "none",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  padding: "2px 0"
                }}>
                  {idx === status.currentFileIndex ? "▶ " : ""} {fName}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
