// src/ProcessingPage.js
import React, { useState, useEffect, useRef } from "react";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios"; // <-- 1. IMPORTAR AXIOS
import Navbar from "./Nav";
import Loading from "./Loading";

const WS_URL = "ws://localhost:4000";
const SQL_API_URL = "http://localhost:3000/api";

const ScriptStatus = ({ status }) => {
  let icon = "⏳";
  let color = "#aaa";
  if (status === "success") {
    icon = "✅";
    color = "#2ecc71";
  } else if (status === "error") {
    icon = "❌";
    color = "#e74c3c";
  } else if (status === "pending") {
    icon = "📋";
    color = "#ccc";
  }
  return (
    <span style={{ color, marginRight: "5px", fontWeight: "bold" }}>
      {icon}
    </span>
  );
};
ScriptStatus.propTypes = { status: PropTypes.string };

const ProcessingPage = ({ history, location }) => {
  const {
    repo,
    branch,
    commits: initialCommits,
    selectionType,
  } = location.state || {};

  const [commits, setCommits] = useState([]); // Inicia como null
  const [currentAnalysis, setCurrentAnalysis] = useState(null);
  const [isRepoReady, setIsRepoReady] = useState(false);
  const [prepStatus, setPrepStatus] = useState("Verificando base de datos..."); // Estado inicial
  const [prepError, setPrepError] = useState(null);
  const [overallStatus, setOverallStatus] = useState("Listo para analizar.");
  const [error, setError] = useState(null);
  const ws = useRef(null);

  useEffect(() => {
    if (!initialCommits || initialCommits.length === 0) {
      history.push("/");
      return;
    }

    const connectToWebSocket = (checkedCommits) => {
      ws.current = new WebSocket(WS_URL);
      ws.current.onopen = () => {
        console.log("WebSocket Conectado.");
        setPrepStatus("Conectado. Preparando repositorio (fetch 9 meses)...");
        ws.current.send(
          JSON.stringify({
            type: "prepare_repository",
            repoUrl: repo,
            tagName: branch,
            selectionType: selectionType,
            commits: checkedCommits,
          })
        );
      };

      ws.current.onclose = () => {
        console.log("WebSocket Desconectado.");
      };

      ws.current.onerror = (err) => {
        console.error("Error de WebSocket:", err);
        setError("No se pudo conectar al servidor de análisis.");
      };

      ws.current.onmessage = (event) => {
        const message = JSON.parse(event.data);
        console.log("[WSS] Mensaje recibido:", message);

        switch (message.type) {
          case "prep_start":
          case "prep_running":
            setPrepStatus(message.data.message);
            break;
          case "prep_success":
            setPrepStatus("Repositorio listo. Puede iniciar el análisis.");
            setIsRepoReady(true);
            break;
          case "prep_error":
            setPrepStatus("Error al preparar el repositorio.");
            setPrepError(message.data.error);
            break;
          case "commit_start": {
            const { sha, scripts } = message.data;
            setCurrentAnalysis({
              sha,
              scriptNames: scripts,
              scriptStatuses: scripts.reduce((acc, script) => {
                acc[script] = "pending";
                return acc;
              }, {}),
            });
            setOverallStatus(`Analizando commit ${sha.slice(0, 7)}...`);
            setCommits((prev) =>
              prev.map((c) => (c.sha === sha ? { ...c, status: "running" } : c))
            );
            break;
          }
          case "script_start":
          case "script_success":
          case "script_error": {
            const status = message.type.replace("script_", "");
            setCurrentAnalysis((prev) => {
              if (!prev) return null;
              return {
                ...prev,
                scriptStatuses: {
                  ...prev.scriptStatuses,
                  [message.data.script]: status,
                },
              };
            });
            break;
          }
          case "commit_complete": {
            setCommits((prev) =>
              prev.map((c) =>
                c.sha === message.data.sha ? { ...c, status: "success" } : c
              )
            );
            setCurrentAnalysis(null);
            setOverallStatus("Análisis de commit completado.");
            break;
          }
          case "commit_error": {
            setCommits((prev) =>
              prev.map((c) =>
                c.sha === message.data.sha ? { ...c, status: "error" } : c
              )
            );
            setCurrentAnalysis(null);
            setError(
              `Error en commit ${message.data.sha}: ${message.data.error}`
            );
            setOverallStatus("Error en el análisis del commit.");
            break;
          }
          case "error":
            setError(message.message);
            setOverallStatus("Error del servidor.");
            break;
          default:
            console.warn("Unhandled message type:", message.type);
            break;
        }
      };
    };

    const checkDatabaseAndConnect = async () => {
      try {
        const shas = initialCommits.map((c) => c.sha);
        const response = await axios.post(`${SQL_API_URL}/sha/check`, { shas });
        const existingCommits = new Set(response.data.existingCommits || []);
        const newCommitState = initialCommits.map((c) => ({
          ...c,
          status: existingCommits.has(c.sha) ? "success" : "pending",
        }));
        setCommits(newCommitState);
        setPrepStatus("Conectando al servidor de análisis...");
        connectToWebSocket(newCommitState); // <-- Ahora 'connectToWebSocket' está definida
      } catch (err) {
        console.error("Error al verificar la BD SQL:", err);
        setPrepStatus(
          "Error al verificar la BD. Conectando de todas formas..."
        );
        const newCommitState = initialCommits.map((c) => ({
          ...c,
          status: "pending",
        }));
        setCommits(newCommitState);
        connectToWebSocket(newCommitState); // <-- Ahora 'connectToWebSocket' está definida
      }
    };

    checkDatabaseAndConnect();

    return () => {
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [initialCommits, repo, branch, history, selectionType]);

  const handleAnalyzeCommit = (commit) => {
    if (ws.current.readyState !== ws.current.OPEN) {
      setError("No hay conexión con el servidor. Recarga la página.");
      return;
    }
    if (currentAnalysis) {
      setError("Ya hay un análisis en progreso. Por favor, espera.");
      return;
    }
    setError(null);
    ws.current.send(
      JSON.stringify({
        type: "start_analysis_single",
        repoUrl: repo,
        commit: commit,
      })
    );
  };

  const handleGoToVisualization = () => {
    const latestProcessedCommit = commits.find((c) => c.status === "success");
    if (!latestProcessedCommit) {
      setError("No hay ningún commit procesado para visualizar.");
      return;
    }
    history.push(`/view/${repo}/#/${branch}/${latestProcessedCommit.sha}`);
  };
  const commitsDone = commits.filter((c) => c.status === "success").length || 0;
  const getButtonOpacity = (commit) => {
    if (commit.status === "success") {
      return { opacity: 1 };
    }
    if (currentAnalysis) {
      return {};
    }
    return {};
  };
  if (commits.length === 0 && initialCommits && initialCommits.length > 0) {
    return (
      <main>
        <header className="header">
          <div className="container">
            <Navbar />
            <h2 className="title is-4">Preparando Repositorio</h2>
            <p>{repo}</p>
          </div>
        </header>
        <section className="canvas bg-black flex flex-col items-center justify-center w-full flex-1 rounded-xl">
          <Loading message="Verificando base de datos..." />
        </section>
      </main>
    );
  }

  if (!isRepoReady) {
    return (
      <main>
        <header className="header">
          <div className="container">
            <Navbar />
            <h2 className="title is-4">Preparando Repositorio</h2>
            <p>{repo}</p>
          </div>
        </header>
        <section className="canvas bg-black flex flex-col items-center justify-center w-full flex-1 rounded-xl">
          <Loading message={prepStatus} />
          {prepError && (
            <div
              className="notification is-danger"
              style={{ width: "50%", marginTop: "20px" }}
            >
              <strong>Error:</strong> {prepError}
            </div>
          )}
        </section>
      </main>
    );
  }

  return (
    <main>
      <header className="header">
        <div className="container">
          <Navbar />
          <h2 className="title is-4">Selección de Commits</h2>
          <div className="tags are-medium">
            <span className="tag is-dark">{repo}</span>
            <span className="tag is-info">{branch}</span>
          </div>
        </div>
      </header>

      <section className="container p-4">
        <div className="columns">
          <div className="column is-two-thirds">
            <h3 className="title is-5">Commits a Analizar</h3>
            <p className="subtitle is-6">
              Haz clic en Analizar para cada commit que quieras procesar.
            </p>

            <div
              className="commit-list-container"
              style={{
                maxHeight: "500px",
                overflowY: "auto",
                border: "1px solid #dbdbdb",
                borderRadius: "4px",
                backgroundColor: "#ffffff",
              }}
            >
              {commits.map((commit) => (
                <div
                  key={commit.sha}
                  className="flex justify-between items-center p-3"
                  style={{ borderBottom: "1px solid #eee" }}
                >
                  <div>
                    <p className="font-bold">{commit.sha.slice(0, 9)}</p>
                    <p className="text-sm" style={{ color: "#555" }}>
                      {commit.name || "(Sin mensaje)"}
                    </p>
                  </div>
                  <button
                    className={`button is-small ${
                      commit.status === "success" ? "is-success" : "is-info"
                    }`}
                    onClick={() => handleAnalyzeCommit(commit)}
                    disabled={
                      currentAnalysis ||
                      commit.status === "running" ||
                      commit.status === "success"
                    }
                    style={getButtonOpacity(commit)}
                  >
                    {commit.status === "running" && "Procesando..."}
                    {commit.status === "pending" && "Analizar"}
                    {commit.status === "success" && "Completado"}
                    {commit.status === "error" && "Reintentar"}
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="column is-one-third">
            <h3 className="title is-5">Estado del Análisis</h3>
            <div
              className="p-4"
              style={{
                backgroundColor: "#222",
                color: "white",
                borderRadius: "8px",
                minHeight: "250px",
              }}
            >
              {currentAnalysis ? (
                <div>
                  <p className="font-bold">Procesando:</p>
                  <p
                    className="text-sm"
                    style={{ color: "#aaa", marginBottom: "15px" }}
                  >
                    {currentAnalysis.sha.slice(0, 9)}
                  </p>
                  <div
                    style={{
                      fontFamily: "monospace",
                      fontSize: "14px",
                    }}
                  >
                    {currentAnalysis.scriptNames.map((script) => (
                      <div key={script}>
                        <ScriptStatus
                          status={currentAnalysis.scriptStatuses[script]}
                        />
                        {script}
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div>
                  <p className="font-bold">{overallStatus}</p>
                  {error && (
                    <p
                      className="text-sm"
                      style={{ color: "#e74c3c", marginTop: "10px" }}
                    >
                      {error}
                    </p>
                  )}
                </div>
              )}
            </div>
            <div className="control m-t-10">
              <button
                className="button is-link is-fullwidth"
                onClick={handleGoToVisualization}
                disabled={commitsDone === 0}
              >
                Ir a Visualización ({commitsDone} procesados)
              </button>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
};

ProcessingPage.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
  location: PropTypes.shape({
    state: PropTypes.shape({
      repo: PropTypes.string,
      branch: PropTypes.string,
      commits: PropTypes.array,
      selectionType: PropTypes.string,
    }),
  }).isRequired,
};

export default withRouter(ProcessingPage);
