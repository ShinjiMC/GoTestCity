import React from "react";
import PropTypes from "prop-types";

const MetricItem = ({ label, value }) => (
  <div className="flex justify-between border-b border-gray-700 pb-1">
    <span className="text-gray-300">{label}</span>
    <span className="font-semibold">{value ?? 0}</span>
  </div>
);

const Datos = ({ info, childrenNodes }) => {
  if (!info) return null;
  const formatFixed = (val) => (val != null ? val.toFixed(2) : 0);
  // Objeto de métricas principales
  const mainMetrics = [
    { label: "Lines of Code (LOC)", value: info.NOL },
    { label: "Complexity (Total)", value: info.total_complexity },
    { label: "Funciones", value: info.NOA },
    { label: "Métodos", value: info.NOM },
  ];

  // Objeto de métricas de evolución (Churn)
  const evolutionMetrics = [
    { label: "Churn (Total)", value: info.total_churn },
    { label: "Frecuencia (Commits)", value: info.total_frequency },
    { label: "Autores", value: info.total_authors },
  ];

  // Métricas de Halstead
  const halsteadMetrics = [
    { label: "Volumen", value: formatFixed(info.total_halstead_volume) },
    { label: "Dificultad", value: formatFixed(info.total_halstead_difficulty) },
    { label: "Esfuerzo", value: formatFixed(info.total_halstead_effort) },
    { label: "Bugs (Estimados)", value: formatFixed(info.total_halstead_bugs) },
  ];

  // Métricas de Acoplamiento y Cobertura
  const qualityMetrics = [
    { label: "Acoplamiento (Deps)", value: info.total_coupling_deps },
    { label: "Issues (Lint)", value: info.total_issues },
    { label: "Coverage", value: `${formatFixed(info.coverage)}%` },
  ];

  return (
    <div className="bg-gray-900 text-white rounded-bl-xl shadow-inner p-4 w-full h-full overflow-y-auto">
      {/* --- Encabezado --- */}
      <h2 className="text-xl font-bold mb-3">
        {info.name || "Root"}
        <span className="ml-2 text-gray-400">[{info.type}]</span>
      </h2>

      {/* --- Contenedor de Métricas --- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 text-sm">
        {/* Columna 1: Métricas Principales */}
        <div>
          <h3 className="font-semibold text-gray-400 mb-2">Principales</h3>
          <div className="space-y-2">
            {mainMetrics.map((m) => (
              <MetricItem key={m.label} {...m} />
            ))}
          </div>
        </div>

        {/* Columna 2: Calidad */}
        <div>
          <h3 className="font-semibold text-gray-400 mb-2">
            Calidad y Acoplamiento
          </h3>
          <div className="space-y-2">
            {qualityMetrics.map((m) => (
              <MetricItem key={m.label} {...m} />
            ))}
          </div>
        </div>

        {/* Columna 3: Evolución */}
        <div>
          <h3 className="font-semibold text-gray-400 mb-2">Evolución</h3>
          <div className="space-y-2">
            {evolutionMetrics.map((m) => (
              <MetricItem key={m.label} {...m} />
            ))}
          </div>
        </div>

        {/* Columna 4: Halstead */}
        <div>
          <h3 className="font-semibold text-gray-400 mb-2">Halstead</h3>
          <div className="space-y-2">
            {halsteadMetrics.map((m) => (
              <MetricItem key={m.label} {...m} />
            ))}
          </div>
        </div>
      </div>

      {childrenNodes && childrenNodes.length > 0 && (
        <div className="mt-3">
          <h3 className="text-md font-semibold mb-2 text-gray-300">
            Contenido del Directorio
          </h3>
          <div
            className="flex-1 overflow-y-auto max-h-48 border border-gray-700 rounded-lg
                       scrollbar-thin scrollbar-thumb-gray-700 scrollbar-track-gray-800"
          >
            <ul className="divide-y divide-gray-700 text-sm">
              {childrenNodes.map((child, idx) => (
                <li key={idx} className="flex justify-between px-3 py-2">
                  <span className="truncate">
                    <span className="font-medium">{child.name}</span>{" "}
                    <span className="text-gray-400">[{child.type}]</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
};

Datos.propTypes = {
  info: PropTypes.shape({
    NOL: PropTypes.number,
    NOM: PropTypes.number,
    NOA: PropTypes.number,
    name: PropTypes.string,
    type: PropTypes.string,
    url: PropTypes.string,
    total_issues: PropTypes.number,
    total_complexity: PropTypes.number,
    total_churn: PropTypes.number,
    total_coupling_deps: PropTypes.number,
    coverage: PropTypes.number,
    total_frequency: PropTypes.number,
    total_authors: PropTypes.number,
    total_halstead_volume: PropTypes.number,
    total_halstead_difficulty: PropTypes.number,
    total_halstead_effort: PropTypes.number,
    total_halstead_bugs: PropTypes.number,
  }),
  childrenNodes: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.string,
    })
  ),
};

MetricItem.propTypes = {
  label: PropTypes.string.isRequired,
  value: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
};
export default Datos;
