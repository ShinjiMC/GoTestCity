// src/VisualizationPage.js
import React, { Component } from "react";
import FloatBox from "./FloatBox";
import axios from "axios";
import Legend from "./Legend";
import swal from "sweetalert2";
import PropTypes from "prop-types";
import CityView from "./CityView";
const endpoint = "http://localhost:3000/api/layout";
const METRICS_ENDPOINT = "http://localhost:3000/api/metrics";

class VisualizationPage extends Component {
  canvas = null;
  lastData = null;

  constructor(props) {
    super(props);
    const { repository, branch, commit } = this.getParamsFromURL();
    this.state = {
      loading: true,
      isNightMode: false,
      sidePanelOpen: false,
      repository: repository || "github.com/kubernetes/kubernetes",
      branch: branch || "master",
      commit: commit || "f779cf6381917267aa54460b7e66b9a7cc165677",
      parentStack: [],
      currentPath: "/",
      rootInfo: null,
      rootChildren: [],
      analyticsData: {
        coverageGlobal: 0,
        coverageRoot: 0,
        coverageIncrease: 0,
        timelineData: [], // Inicia vacío
      },
      criticalityFilter: "none",
      infoVisible: false,
      infoData: null,
      infoPosition: { x: 0, y: 0 },
    };
    this.toggleMode = this.toggleMode.bind(this);
    this.openSidePanel = this.openSidePanel.bind(this);
    this.closeSidePanel = this.closeSidePanel.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.saveAsPng = this.saveAsPng.bind(this);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.handleMeshClick = this.handleMeshClick.bind(this);
    this.onSceneMount = this.onSceneMount.bind(this);
    this.goBackLevel = this.goBackLevel.bind(this);
    this.handleFilterChange = this.handleFilterChange.bind(this);
  }
  getParamsFromURL = () => {
    const { repository } = this.props.match.params;
    const hashParts = this.props.location.hash.split("/");
    const branch = hashParts[1];
    const commit = hashParts[2];
    return { repository, branch, commit };
  };
  componentDidMount() {
    if (this.state.repository) {
      this.process(this.state.repository, this.state.branch, this.state.commit);
    }
  }
  loadAnalyticsData = async (pathKey, commitSha) => {
    try {
      let timelineURL;
      if (pathKey === "/") {
        timelineURL = `${METRICS_ENDPOINT}/timeline/global`;
        console.log("Ruta para obtener timeline GLOBAL:", timelineURL);
      } else {
        timelineURL = `${METRICS_ENDPOINT}/timeline/path?p=${encodeURIComponent(
          pathKey
        )}`;
        console.log("Ruta para obtener timeline de PATH:", timelineURL);
      }
      const [timelineRes, globalMetricsRes] = await Promise.all([
        axios.get(timelineURL),
        axios.get(`${METRICS_ENDPOINT}/global`, { params: { c: commitSha } }),
      ]);
      const timelineData = timelineRes.data;
      console.log(
        `Datos del timeline obtenidos para '${pathKey}':`,
        timelineData
      );
      const globalMetrics = globalMetricsRes.data;

      let coverageIncrease = 0;
      if (timelineData.length >= 2) {
        const last = timelineData[timelineData.length - 1].coverage;
        const first = timelineData[0].coverage;
        coverageIncrease = +(last - first).toFixed(1);
      }
      const coverageGlobal = globalMetrics.avg_coverage || 0;
      const currentRootInfo = this.state.rootInfo;
      const coverageRoot = currentRootInfo
        ? currentRootInfo.coverage || 0
        : coverageGlobal;
      this.setState({
        analyticsData: {
          timelineData: timelineData,
          coverageGlobal: coverageGlobal,
          coverageRoot: coverageRoot,
          coverageIncrease: coverageIncrease,
        },
      });
    } catch (err) {
      console.error("Error cargando datos del SidePanel:", err);
    }
  };
  onMouseMove(e) {
    this.mouse_x = e.pageX;
    this.mouse_y = e.pageY;
  }
  toggleMode() {
    this.setState((prev) => ({ isNightMode: !prev.isNightMode }));
  }
  openSidePanel = () => {
    this.setState({ sidePanelOpen: true });
  };
  closeSidePanel = () => {
    this.setState({ sidePanelOpen: false });
  };

  handleFilterChange = (newFilter) => {
    this.setState({ criticalityFilter: newFilter });
  };
  showTooltip = (info) => {
    setTimeout(() => {
      this.setState({
        infoVisible: true,
        infoData: info, // Usar 'info' directamente
        infoPosition: { x: this.mouse_x, y: this.mouse_y },
      });
    }, 100); // Mantenemos el timeout para evitar parpadeo
  };

  hideTooltip() {
    this.setState({ infoVisible: false });
  }

  handleMeshClick = (info) => {
    if (
      (info.type === "PACKAGE" || info.type === "FILE") &&
      info.path !== "/"
    ) {
      this.setState(
        (prev) => ({
          parentStack: [...prev.parentStack, prev.currentPath],
          currentPath: info.path,
        }),
        () => {
          const { repository, branch, commit } = this.state;
          this.loadAndPlotProject(info.path, repository, branch, commit);
        }
      );
    }
  };

  onSceneMount = (e) => {
    this.canvas = e.canvas;
  };

  loadAndPlotProject = (pathKey, repositoryName, branch, commit) => {
    if (!pathKey) return;
    this.setState({ loading: true });

    const layoutURL = `${endpoint}/hierarchical`;
    const metricsURL = `${METRICS_ENDPOINT}/path`;
    axios
      .all([
        axios.get(layoutURL, {
          params: {
            q: repositoryName,
            b: branch,
            c: commit,
            key: pathKey,
          },
        }),
        axios.get(metricsURL, { params: { c: commit, p: pathKey } }),
      ])
      .then(
        axios.spread((layoutRes, metricsRes) => {
          const hierarchicalData = layoutRes.data;
          const metricsData = metricsRes.data;

          if (!hierarchicalData || !hierarchicalData.type) {
            this.setState({ loading: false });
            swal("Invalid project", "No layout data found.", "error");
            return;
          }
          const root = hierarchicalData;

          const rootInfo = {
            ...metricsData,
            name: root.name || "Root",
            type: root.type || "PACKAGE",
            url: root.url || "",
          };

          const childrenNodes =
            root.children?.map((c) => ({
              name: c.name,
              type: c.type,
              path: c.path,
            })) || [];

          this.lastData = hierarchicalData;

          this.setState(
            {
              loading: false,
              rootInfo,
              rootChildren: childrenNodes,
            },
            () => {
              this.loadAnalyticsData(pathKey, commit);
            }
          );
        })
      )
      .catch((e) => {
        this.setState({ loading: false });
        swal("Error during plot", e.message, "error");
        console.error(e);
      });
  };

  goBackLevel = () => {
    const stack = [...this.state.parentStack];
    if (stack.length === 0) return;
    const parentPath = stack.pop();

    this.setState({ parentStack: stack, currentPath: parentPath }, () => {
      const { repository, branch, commit } = this.state;
      this.loadAndPlotProject(parentPath, repository, branch, commit);
    });
  };

  process(repository, branch, commit) {
    if (!repository) {
      this.props.history.push("/");
      return;
    }
    this.setState({
      repository,
      branch,
      commit,
      loading: true,
      currentPath: "/",
    });
    this.loadAndPlotProject("/", repository, branch, commit);
  }

  saveAsPng() {
    if (this.canvas) {
      const image = this.canvas
        .toDataURL("image/png")
        .replace("image/png", "image/octet-stream");
      const link = document.createElement("a");
      link.setAttribute(
        "download",
        `gotestcity-${this.state.repository}-${this.state.branch}.png`
      );
      link.setAttribute("href", image);
      link.click();
    } else {
      console.error("No se puede guardar la imagen: el canvas no está listo.");
    }
  }

  render() {
    return (
      <main onMouseMove={this.onMouseMove}>
        <FloatBox
          position={this.state.infoPosition}
          info={this.state.infoData}
          visible={this.state.infoVisible}
        />

        <CityView
          loading={this.state.loading}
          parentStack={this.state.parentStack}
          isNightMode={this.state.isNightMode}
          sidePanelOpen={this.state.sidePanelOpen}
          rootInfo={this.state.rootInfo}
          rootChildren={this.state.rootChildren}
          analyticsData={this.state.analyticsData}
          plotData={this.lastData}
          criticalityFilter={this.state.criticalityFilter}
          onFilterChange={this.handleFilterChange}
          onGoBack={this.goBackLevel}
          onToggleMode={this.toggleMode}
          onToggleAnalytics={
            this.state.sidePanelOpen ? this.closeSidePanel : this.openSidePanel
          }
          onSceneMount={this.onSceneMount}
          onMeshClick={this.handleMeshClick}
          onMeshHover={this.showTooltip}
          onMeshOut={this.hideTooltip}
        />

        <Legend />
      </main>
    );
  }
}

VisualizationPage.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      repository: PropTypes.string,
    }),
  }),
  location: PropTypes.shape({
    hash: PropTypes.string,
  }),
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
};

export default VisualizationPage;
