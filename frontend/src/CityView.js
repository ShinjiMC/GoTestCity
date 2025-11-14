// src/CityView.js
import React from "react";
import PropTypes from "prop-types";
import Loading from "./Loading";
import CityPlotter from "./CityPlotter"; // Importa el plotter
import Datos from "./Datos";
import SidePanel from "./SidePanel";

// --- Iconos para los botones (extraídos para limpieza) ---
const BackIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <path d="M15 18l-6-6 6-6" />
  </svg>
);
const SunIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <circle cx="12" cy="12" r="5" />
    <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
  </svg>
);
const MoonIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={2}
    strokeLinecap="round"
    strokeLinejoin="round"
    className="w-6 h-6"
  >
    <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
  </svg>
);
const AnalyticsIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
    strokeWidth={2}
    stroke="currentColor"
    className="w-5 h-5"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      d="M3 3v18h18M7 13h10M7 9h10M7 17h10"
    />
  </svg>
);

const CRITICALITY_FILTERS = [
  { key: "none", label: "None" },
  { key: "overall", label: "Overall" },
  { key: "complexity", label: "Complexity" },
  { key: "coupling", label: "Coupling" },
  { key: "issues", label: "Issues" },
  { key: "churn", label: "Churn" },
  { key: "authors", label: "Authors" },
  { key: "halstead", label: "Halstead" },
];

const CriticalityFilter = ({ currentFilter, onChange }) => (
  <select
    id="crit-filter"
    value={currentFilter}
    onChange={(e) => onChange(e.target.value)}
    className="z-50 bg-gray-800 text-white text-sm rounded-lg px-3 py-3 border border-gray-600 focus:outline-none focus:ring-2 focus:ring-blue-500 shadow-lg"
    aria-label="Highlight criticality filter"
  >
    {CRITICALITY_FILTERS.map((f) => (
      <option key={f.key} value={f.key}>
        {f.label}
      </option>
    ))}
  </select>
);
CriticalityFilter.propTypes = {
  currentFilter: PropTypes.string.isRequired,
  onChange: PropTypes.func.isRequired,
};

// --- Componente de Vista ---
const CityView = ({
  // Estado
  loading,
  parentStack,
  isNightMode,
  sidePanelOpen,
  rootInfo,
  rootChildren,
  analyticsData,
  plotData, // El objeto de datos para el plotter
  // Handlers
  criticalityFilter,
  onGoBack,
  onToggleMode,
  onToggleAnalytics,
  onFilterChange,
  onSceneMount, // Pasa el handler de App.js a CityPlotter
  onMeshClick,
  onMeshHover,
  onMeshOut,
}) => {
  return (
    <div className="relative h-screen p-2 bg-gray-200">
      {/* --- Botón de Volver --- */}
      {parentStack && parentStack.length > 0 && (
        <button
          onClick={onGoBack}
          className="absolute top-20 left-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition"
          title="Volver al nivel anterior"
          aria-label="Volver al nivel anterior"
        >
          <BackIcon />
        </button>
      )}

      {/* --- Botón Modo Día/Noche --- */}
      <button
        onClick={onToggleMode}
        className="absolute top-6 left-6 z-50 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-full shadow-lg flex items-center justify-center transition"
        title={isNightMode ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
        aria-label={isNightMode ? "Cambiar a modo Día" : "Cambiar a modo Noche"}
      >
        {isNightMode ? <SunIcon /> : <MoonIcon />}
      </button>
      {isNightMode && (
        <div className="absolute top-6 left-24 z-50">
          <CriticalityFilter
            currentFilter={criticalityFilter}
            onChange={onFilterChange}
          />
        </div>
      )}

      {/* --- Botón de Analytics --- */}
      <button
        onClick={onToggleAnalytics}
        className="absolute top-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition"
      >
        <AnalyticsIcon />
        {sidePanelOpen ? "Hide Analytics" : "Show Analytics"}
      </button>

      {/* --- Contenedor principal (Canvas y Paneles) --- */}
      <div className="flex flex-row h-full bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-500 ease-in-out">
        {/* --- Sección izquierda (Canvas + Datos) --- */}
        <div
          className={`flex flex-col flex-[1] min-w-0 h-full gap-0 transition-all duration-500 ease-in-out ${
            sidePanelOpen ? "flex-[1]" : "flex-[1] w-full"
          }`}
        >
          {/* --- Canvas de Babylon --- */}
          <section
            className={`canvas bg-black flex items-center justify-center w-full transition-all duration-500 ease-in-out ${
              sidePanelOpen ? "flex-1 rounded-tl-xl" : "flex-1 rounded-xl"
            }`}
          >
            {loading ? (
              <Loading message="Fetching repository..." />
            ) : (
              <CityPlotter
                data={plotData}
                isNightMode={isNightMode}
                criticalityFilter={criticalityFilter}
                onMeshClick={onMeshClick}
                onMeshHover={onMeshHover}
                onMeshOut={onMeshOut}
                onSceneMount={onSceneMount} // Pasa el handler de App.js
              />
            )}
          </section>

          {/* --- Panel de Datos (inferior) --- */}
          {sidePanelOpen && (
            <section className="flex-1 overflow-y-auto bg-gray-100 w-full rounded-bl-xl transition-opacity duration-300">
              <Datos info={rootInfo} childrenNodes={rootChildren} />
            </section>
          )}
        </div>

        {/* --- Panel lateral (Analytics) --- */}
        {sidePanelOpen && (
          <aside className="flex-[1] min-w-[50%] bg-gray-900 text-white p-4 overflow-y-auto border-gray-300 transition-opacity duration-300">
            <SidePanel
              coverageGlobal={analyticsData.coverageGlobal}
              coverageRoot={analyticsData.coverageRoot}
              coverageIncrease={analyticsData.coverageIncrease}
              timelineData={analyticsData.timelineData}
              onClose={onToggleAnalytics} // Reutiliza el toggle para cerrar
            />
          </aside>
        )}
      </div>
    </div>
  );
};

// Definir los tipos de las props para un buen control
CityView.propTypes = {
  loading: PropTypes.bool.isRequired,
  parentStack: PropTypes.array.isRequired,
  isNightMode: PropTypes.bool.isRequired,
  sidePanelOpen: PropTypes.bool.isRequired,
  rootInfo: PropTypes.object,
  rootChildren: PropTypes.array.isRequired,
  analyticsData: PropTypes.object.isRequired,
  plotData: PropTypes.object,
  criticalityFilter: PropTypes.string.isRequired,
  onFilterChange: PropTypes.func.isRequired,
  onGoBack: PropTypes.func.isRequired,
  onToggleMode: PropTypes.func.isRequired,
  onToggleAnalytics: PropTypes.func.isRequired,
  onSceneMount: PropTypes.func.isRequired,
  onMeshClick: PropTypes.func.isRequired,
  onMeshHover: PropTypes.func.isRequired,
  onMeshOut: PropTypes.func.isRequired,
};

export default CityView;
