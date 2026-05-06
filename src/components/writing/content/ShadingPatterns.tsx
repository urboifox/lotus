import React from "react";

interface ShadingPatternsProps {
  onSelectPattern: (pattern: string) => void;
  onClose: () => void;
}

const ShadingPatterns: React.FC<ShadingPatternsProps> = ({
  onSelectPattern,
  onClose,
}) => {
  // Define diagonal pattern to be reused
  const diagonalPattern = (
    <defs>
      <pattern
        id="preview-diag"
        patternUnits="userSpaceOnUse"
        width="4"
        height="4"
      >
        <path
          d="M-1,3 l2,2 M0,0 l4,4 M3,-1 l2,2"
          stroke="#000"
          strokeWidth="0.5"
        />
      </pattern>
    </defs>
  );

  const patterns = [
    {
      id: "pattern-0",
      name: "0-None",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
        </svg>
      ),
    },
    {
      id: "pattern-1",
      name: "1-Top Left",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-2",
      name: "2-Top Right",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="25" y="0" width="25" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-3",
      name: "3-Top Half",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="50" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-4",
      name: "4-Bottom Left",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="25" width="25" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-5",
      name: "5-All Except Bottom Right",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="25" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="0" y="25" width="25" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-6",
      name: "6-Bottom Right",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect
            x="25"
            y="25"
            width="25"
            height="25"
            fill="url(#preview-diag)"
          />
        </svg>
      ),
    },
    {
      id: "pattern-7",
      name: "7-Right Half",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="25" y="0" width="25" height="50" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-8",
      name: "8-Top Left + Bottom Right",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect
            x="25"
            y="25"
            width="25"
            height="25"
            fill="url(#preview-diag)"
          />
        </svg>
      ),
    },
    {
      id: "pattern-9",
      name: "9-Top Right + Bottom Left",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="25" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="0" y="25" width="25" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-A",
      name: "A-All Except Bottom Left",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="25" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect
            x="25"
            y="25"
            width="25"
            height="25"
            fill="url(#preview-diag)"
          />
        </svg>
      ),
    },
    {
      id: "pattern-B",
      name: "B-Bottom Half",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="25" width="50" height="25" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-C",
      name: "C-All Except Top Left",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="25" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="0" y="25" width="25" height="25" fill="url(#preview-diag)" />
          <rect
            x="25"
            y="25"
            width="25"
            height="25"
            fill="url(#preview-diag)"
          />
        </svg>
      ),
    },
    {
      id: "pattern-D",
      name: "D-All Except Top Right",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="25" fill="url(#preview-diag)" />
          <rect x="0" y="25" width="25" height="25" fill="url(#preview-diag)" />
          <rect
            x="25"
            y="25"
            width="25"
            height="25"
            fill="url(#preview-diag)"
          />
        </svg>
      ),
    },
    {
      id: "pattern-E",
      name: "E-Left Half",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect
            width="50"
            height="50"
            fill="none"
            stroke="#d1d5db"
            strokeWidth="1"
          />
          <rect x="0" y="0" width="25" height="50" fill="url(#preview-diag)" />
        </svg>
      ),
    },
    {
      id: "pattern-F",
      name: "F-Full",
      svg: (
        <svg width="50" height="50" viewBox="0 0 50 50">
          {diagonalPattern}
          <rect width="50" height="50" fill="url(#preview-diag)" />
        </svg>
      ),
    },
  ];

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(0, 0, 0, 0.5)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "white",
          borderRadius: 12,
          padding: 24,
          maxWidth: 600,
          width: "90%",
          maxHeight: "80vh",
          overflowY: "auto",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h3
          style={{
            marginTop: 0,
            marginBottom: 16,
            fontSize: 20,
            fontWeight: 600,
          }}
        >
          Choose Shading Pattern (JSesh Standard)
        </h3>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 12,
          }}
        >
          {patterns.map((pattern) => (
            <div
              key={pattern.id}
              onClick={() => onSelectPattern(pattern.id)}
              style={{
                border: "2px solid #FAE5C8",
                borderRadius: 6,
                padding: 10,
                cursor: "pointer",
                textAlign: "center",
                transition: "all 0.2s",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: 6,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "#ccaa83";
                e.currentTarget.style.backgroundColor = "#FBF2E6";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "#FAE5C8";
                e.currentTarget.style.backgroundColor = "white";
              }}
            >
              <div
                style={{
                  width: 50,
                  height: 50,
                  border: "1px solid #d1d5db",
                  borderRadius: 4,
                  overflow: "hidden",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <div style={{ width: "100%", height: "100%" }}>
                  {pattern.svg}
                </div>
              </div>
              <div
                style={{
                  fontSize: 10,
                  color: "#6b7280",
                  fontWeight: 500,
                  lineHeight: 1.2,
                }}
              >
                {pattern.name}
              </div>
            </div>
          ))}
        </div>

        <button
          onClick={onClose}
          style={{
            marginTop: 20,
            width: "100%",
            padding: "8px 16px",
            backgroundColor: "#ccaa83",
            color: "#ffffff",
            border: "none",
            borderRadius: 8,
            cursor: "pointer",
            fontWeight: 500,
          }}
        >
          Cancel
        </button>
      </div>
    </div>
  );
};

export default ShadingPatterns;
