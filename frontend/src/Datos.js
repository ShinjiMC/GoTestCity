import React from "react";
import PropTypes from "prop-types";

const Datos = ({ info, childrenNodes }) => {
  if (!info) return null;

  const coverage =
    info.coverage !== undefined && info.coverage !== null
      ? `${info.coverage}%`
      : "N/A";

  return (
    <div className="bg-gray-900 text-white rounded-bl-xl shadow-inner p-4 w-full h-full">
      <div className="flex flex-col md:flex-row gap-6">
        {/* ==================== LADO IZQUIERDO (1/4) ==================== */}
        <div className="w-1/4 flex-shrink-0">
          {/* --- Nombre y tipo --- */}
          <h2 className="text-xl font-bold mb-3">
            {info.name || "Root"}
            <span className="ml-2 text-gray-400">[{info.type}]</span>
          </h2>

          {/* --- Métricas principales --- */}
          {info.type && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between border-b border-gray-700 pb-1">
                <span className="text-gray-300">Lines</span>
                <span className="font-semibold">{info.NOL ?? 0}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-1">
                <span className="text-gray-300">Methods</span>
                <span className="font-semibold">{info.NOM ?? 0}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-1">
                <span className="text-gray-300">Attributes</span>
                <span className="font-semibold">{info.NOA ?? 0}</span>
              </div>
              <div className="flex justify-between border-b border-gray-700 pb-1">
                <span className="text-gray-300">Tests</span>
                <span className="font-semibold">{info.test ?? 0}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-300">Coverage</span>
                <span className="font-semibold">{coverage}</span>
              </div>
            </div>
          )}
        </div>

        {/* ==================== LADO DERECHO (3/4) ==================== */}
        <div className="w-3/4 flex flex-col">
          {/* --- Directorio de hijos --- */}
          {childrenNodes && childrenNodes.length > 0 && (
            <div
              className="flex-1 
                       overflow-y-auto max-h-64
                       scrollbar-thin 
                       scrollbar-thumb-gray-700 
                       scrollbar-track-gray-800 
                       rounded-lg"
            >
              <h3 className="text-sm font-semibold mb-2 text-gray-300">
                {/* Puedes mostrar url o título */}
              </h3>
              <div className="border border-gray-700 rounded overflow-y-auto">
                <ul className="divide-y divide-gray-700 text-sm">
                  {childrenNodes.map((child, idx) => (
                    <li
                      key={idx}
                      className="flex justify-between px-3 py-2 hover:bg-gray-800 transition"
                    >
                      <span className="truncate">
                        <span className="font-medium">{child.name}</span>{" "}
                        <span className="text-gray-400">[{child.type}]</span>
                      </span>
                      <span className="text-gray-300">
                        {child.coverage !== undefined
                          ? `${child.coverage}%`
                          : "—"}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

Datos.propTypes = {
  info: PropTypes.shape({
    NOA: PropTypes.number,
    NOL: PropTypes.number,
    NOM: PropTypes.number,
    name: PropTypes.string,
    type: PropTypes.string,
    url: PropTypes.string,
    test: PropTypes.number,
    coverage: PropTypes.number,
  }),
  childrenNodes: PropTypes.arrayOf(
    PropTypes.shape({
      name: PropTypes.string,
      type: PropTypes.string,
      coverage: PropTypes.number,
    })
  ),
};

export default Datos;
