// src/HomePage.js
import React, { useState } from "react";
import { withRouter } from "react-router-dom";
import PropTypes from "prop-types";
import axios from "axios";
import Navbar from "./Nav";
import Loading from "./Loading";

const API_URL = "http://localhost:4000";

const HomePage = ({ history }) => {
  const [repository, setRepository] = useState(
    "github.com/kubernetes/kubernetes"
  );
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [loadingCommits, setLoadingCommits] = useState(false);
  const [error, setError] = useState("");

  const [availableRefs, setAvailableRefs] = useState(null); // { branches: [], tags: [] }
  const [selectionType, setSelectionType] = useState("branches"); // 'branches' o 'tags'
  const [selectionName, setSelectionName] = useState("");

  const handleFetchRefs = async () => {
    setLoadingRefs(true);
    setError("");
    setAvailableRefs(null);
    setSelectionName("");

    try {
      const response = await axios.post(`${API_URL}/github/refs`, {
        repoUrl: repository,
      });
      setAvailableRefs(response.data);
      // Selecciona la primera rama por defecto
      if (response.data.branches && response.data.branches.length > 0) {
        setSelectionType("branches");
        setSelectionName(response.data.branches[0]);
      }
    } catch (err) {
      console.error("Error fetching refs:", err);
      setError("No se pudo obtener la lista de ramas/tags.");
    }
    setLoadingRefs(false);
  };

  const handleAnalyze = async () => {
    setLoadingCommits(true);
    setError("");

    try {
      const response = await axios.post(`${API_URL}/github/history`, {
        repoUrl: repository,
        selectionType: selectionType, // 'branches' o 'tags'
        selectionName: selectionName, // 'master' o 'v1.0.0'
      });

      const commitsToProcess = response.data.commits;

      if (!commitsToProcess || commitsToProcess.length === 0) {
        setError("No se encontraron commits para analizar en ese rango.");
        setLoadingCommits(false);
        return;
      }

      history.push("/process", {
        repo: repository,
        branch: selectionName, // 'branch' es el nombre (ej: "master")
        commits: commitsToProcess,
        selectionType: selectionType, // <-- AÑADIR ESTO
      });
    } catch (err) {
      console.error("Error fetching commit history:", err);
      setError("No se pudo obtener el historial de commits.");
      setLoadingCommits(false);
    }
  };

  const selectionOptions = availableRefs
    ? availableRefs[selectionType] || []
    : [];

  return (
    <main>
      <header className="header">
        <div className="container">
          <Navbar />
          <p>
            Selecciona el repositorio, branch/tag y el rango de commits que
            deseas analizar.
          </p>

          {/* --- PASO 1: Input del Repositorio --- */}
          <div className="field">
            <label className="label" htmlFor="repository-input">
              Repositorio de GitHub
            </label>
            <div className="control">
              <input
                className="input"
                type="text"
                placeholder="eg: github.com/kubernetes/kubernetes"
                value={repository}
                onChange={(e) => setRepository(e.target.value)}
                id="repository-input"
              />
            </div>
          </div>

          <div className="control m-t-10">
            <button
              className={`button is-link ${loadingRefs ? "is-loading" : ""}`}
              onClick={handleFetchRefs}
              disabled={loadingRefs || !repository}
            >
              Buscar Ramas y Tags
            </button>
          </div>

          {/* --- PASO 2: Selección de Branch/Tag (Condicional) --- */}
          {loadingRefs && <Loading message="Buscando referencias..." />}

          {availableRefs && (
            <>
              <div className="field is-grouped m-t-10">
                <div className="control">
                  <label className="label" htmlFor="type-select">
                    Tipo
                  </label>
                  <div className="select">
                    <select
                      id="type-select"
                      value={selectionType}
                      onChange={(e) => {
                        setSelectionType(e.target.value);
                        // Resetea la selección al cambiar de tipo
                        const newOptions = availableRefs[e.target.value] || [];
                        setSelectionName(newOptions[0] || "");
                      }}
                    >
                      <option value="branches">Branch</option>
                      <option value="tags">Tag</option>
                    </select>
                  </div>
                </div>

                <div className="field" style={{ flex: 1, marginLeft: "10px" }}>
                  <label className="label" htmlFor="selection-select">
                    Selección
                  </label>
                  <div className="control" style={{ width: "100%" }}>
                    <div className="select" style={{ width: "100%" }}>
                      <select
                        id="selection-select"
                        value={selectionName}
                        onChange={(e) => setSelectionName(e.target.value)}
                        style={{ width: "100%" }}
                        disabled={selectionOptions.length === 0}
                      >
                        {selectionOptions.length === 0 && (
                          <option>No se encontraron {selectionType}</option>
                        )}
                        {selectionOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              {/* --- PASO 3: Analizar --- */}
              <div className="control m-t-10">
                <button
                  className={`button is-info ${
                    loadingCommits ? "is-loading" : ""
                  }`}
                  onClick={handleAnalyze}
                  disabled={loadingCommits || !selectionName}
                >
                  Comenzar Análisis
                </button>
              </div>
            </>
          )}

          {error && <p className="has-text-danger m-t-10">{error}</p>}
          {loadingCommits && (
            <Loading message="Obteniendo historial de commits..." />
          )}
        </div>
      </header>
    </main>
  );
};

HomePage.propTypes = {
  history: PropTypes.shape({
    push: PropTypes.func.isRequired,
  }).isRequired,
};

export default withRouter(HomePage);
