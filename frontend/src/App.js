// App.js
import React, { Component } from "react";
import FloatBox from "./FloatBox";
import * as BABYLON from "babylonjs";
import BabylonScene from "./Scene";
import axios from "axios";
import Navbar from "./Nav";
import Legend from "./Legend";
import Loading from "./Loading";
import {
  feedbackEvent,
  getProportionalColor,
  searchEvent,
  logoBase64,
} from "./utils";
import swal from "sweetalert2";
// import Cookies from "js-cookie"; // Ya no es necesario para el endpoint
import PropTypes from "prop-types";
import SidePanel from "./SidePanel";
import Datos from "./Datos";

const URLRegexp = new RegExp(/^(?:https:\/\/?)?(github\.com\/.*)/i);

const endpoint = "http://localhost:3000/api/layout";

// TODO: isolate in the constants file
const colors = {
  PACKAGE: { start: { r: 255, g: 207, b: 64 }, end: { r: 200, g: 160, b: 50 } },
  FILE: { start: { r: 120, g: 190, b: 32 }, end: { r: 80, g: 150, b: 30 } },
  STRUCT: { start: { r: 100, g: 143, b: 255 }, end: { r: 60, g: 100, b: 200 } },
  ROOT: { start: { r: 160, g: 160, b: 160 }, end: { r: 100, g: 100, b: 100 } },
};
// === Datos de ejemplo (dos años de cobertura) ===
const timelineData2 = [
  // --- 2 años de datos cada 2-3 semanas ---
  { date: "2023-09-10T12:00:00Z", coverage: 20 },
  { date: "2023-09-28T15:00:00Z", coverage: 24 },
  { date: "2023-10-15T10:00:00Z", coverage: 18 },
  { date: "2023-11-02T14:00:00Z", coverage: 30 },
  { date: "2023-11-18T18:00:00Z", coverage: 35 },
  { date: "2023-12-05T12:00:00Z", coverage: 28 },
  { date: "2023-12-23T09:00:00Z", coverage: 40 },
  { date: "2024-01-08T16:00:00Z", coverage: 42 },
  { date: "2024-01-25T11:00:00Z", coverage: 38 },
  { date: "2024-02-12T13:00:00Z", coverage: 45 },
  { date: "2024-03-01T15:00:00Z", coverage: 50 },
  { date: "2024-03-20T09:00:00Z", coverage: 47 },
  { date: "2024-04-08T14:00:00Z", coverage: 55 },
  { date: "2024-04-25T12:00:00Z", coverage: 60 },
  { date: "2024-05-12T17:00:00Z", coverage: 52 },
  { date: "2024-05-30T10:00:00Z", coverage: 65 },
  { date: "2024-06-16T14:00:00Z", coverage: 63 },
  { date: "2024-07-04T12:00:00Z", coverage: 70 },
  { date: "2024-07-21T16:00:00Z", coverage: 66 },
  { date: "2024-08-08T15:00:00Z", coverage: 72 },
  { date: "2024-08-26T11:00:00Z", coverage: 74 },
  { date: "2024-09-12T13:00:00Z", coverage: 68 },
  { date: "2024-09-29T14:00:00Z", coverage: 78 },
  { date: "2024-10-17T12:00:00Z", coverage: 82 },
  { date: "2024-11-03T16:00:00Z", coverage: 76 },
  { date: "2024-11-21T09:00:00Z", coverage: 84 },
  { date: "2024-12-08T15:00:00Z", coverage: 87 },
  { date: "2024-12-26T12:00:00Z", coverage: 81 },
  { date: "2025-01-13T14:00:00Z", coverage: 88 },
  { date: "2025-01-31T10:00:00Z", coverage: 92 },
  { date: "2025-02-17T16:00:00Z", coverage: 85 },
  { date: "2025-03-06T12:00:00Z", coverage: 90 },
  { date: "2025-03-23T14:00:00Z", coverage: 94 },
  { date: "2025-04-10T15:00:00Z", coverage: 89 },
  { date: "2025-04-28T11:00:00Z", coverage: 96 },
  { date: "2025-05-15T13:00:00Z", coverage: 92 },
  { date: "2025-06-02T15:00:00Z", coverage: 97 },
  { date: "2025-06-20T09:00:00Z", coverage: 93 },
  { date: "2025-07-07T14:00:00Z", coverage: 98 },
  { date: "2025-07-25T12:00:00Z", coverage: 95 },
  { date: "2025-08-11T16:00:00Z", coverage: 99 },
  { date: "2025-08-29T10:00:00Z", coverage: 97 },
  { date: "2025-09-15T12:00:00Z", coverage: 99 },
  { date: "2025-09-22T06:30:00Z", coverage: 95 },
  { date: "2025-09-22T12:00:00Z", coverage: 97 },
  { date: "2025-09-22T18:45:00Z", coverage: 92 },
  { date: "2025-09-22T23:15:00Z", coverage: 96 },
];

class App extends Component {
  canvas = null;
  scene = null;
  engine = null;
  camera = null;
  light = null;

  constructor(props) {
    super(props);
    this.state = {
      feedbackFormActive: false,
      loading: false,
      repository:
        this.props.match.params.repository ||
        "github.com/ShinjiMC/Golang_Exercises_Course",
      branch: this.props.match.params.branch || "master",
      modalActive: false,
      commit: "f779cf6381917267aa54460b7e66b9a7cc165677",
      commits: [],
      selectedCommitDate: null,
      isNightMode: false,
      sidePanelOpen: false,
      coverageGlobal: 0,
      coverageRoot: 0,
      coverageIncrease: 0,
      timelineData: [],
      rootInfo: null,
      rootChildren: [],
      parentStack: [],
      currentPath: "/",
    };
    this.toggleMode = this.toggleMode.bind(this);
    this.addBlock = this.addBlock.bind(this);
    this.onInputChange = this.onInputChange.bind(this);
    this.onClick = this.onClick.bind(this);
    this.showTooltip = this.showTooltip.bind(this);
    this.hideTooltip = this.hideTooltip.bind(this);
    this.plot = this.plot.bind(this);
    this.process = this.process.bind(this);
    this.reset = this.reset.bind(this);
    this.initScene = this.initScene.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
    this.updateCamera = this.updateCamera.bind(this);
    this.onSceneMount = this.onSceneMount.bind(this);
    this.onFeedBackFormClose = this.onFeedBackFormClose.bind(this);
    this.openFeedBackForm = this.openFeedBackForm.bind(this);
    this.openModal = this.openModal.bind(this);
    this.closeModal = this.closeModal.bind(this);
    this.getBadgeValue = this.getBadgeValue.bind(this);
    this.saveAsPng = this.saveAsPng.bind(this);
    this.bars = [];
  }
  toggleMode() {
    this.setState(
      (prev) => ({ isNightMode: !prev.isNightMode }),
      () => {
        // Replotear la ciudad cuando cambia el modo
        if (this.lastData) {
          this.reset();
          this.plot([this.lastData]);
          this.updateCamera(this.lastData.width, this.lastData.depth);
        }
      }
    );
  }

  openSidePanel = () => {
    // Aquí podrías calcular datos reales
    const randomGlobal = Math.floor(Math.random() * 100);
    const randomRoot = Math.floor(Math.random() * 100);
    const increase = randomGlobal - randomRoot;

    this.setState({
      sidePanelOpen: true,
      coverageGlobal: randomGlobal,
      coverageRoot: randomRoot,
      coverageIncrease: increase,
      timelineData: timelineData2,
    });
  };
  closeSidePanel = () => {
    this.setState({ sidePanelOpen: false });
  };
  componentDidMount() {
    if (this.state.repository) {
      this.process(this.state.repository, "", this.state.branch);
    }
  }

  onMouseMove(e) {
    this.mouse_x = e.pageX;
    this.mouse_y = e.pageY;
  }

  showTooltip(info) {
    setTimeout(() => {
      this.setState({
        infoVisible: true,
        infoData: info,
        infoPosition: { x: this.mouse_x, y: this.mouse_y },
        focusedBarName: info.name,
      });
    }, 100);
  }

  hideTooltip() {
    this.setState({
      infoVisible: false,
      focusedBarName: null,
    });
  }
  reset() {
    this.scene.dispose();
    this.scene = new BABYLON.Scene(this.engine);
    this.initScene();
  }

  addBlock = (data) => {
    const bar = BABYLON.MeshBuilder.CreateBox(
      data.label,
      { width: data.width, depth: data.depth, height: data.height },
      this.scene
    );
    bar.receiveShadows = false;

    if (data.parent) {
      bar.parent = data.parent;
      var bounds = data.parent.getBoundingInfo();
      bar.position.y = bounds.maximum.y + data.height / 2.0;
    }

    bar.position.x = data.x || 0;
    bar.position.z = data.y || 0;
    bar.relevantUrl = data.info.path;
    bar.info = data.info;

    bar.actionManager = new BABYLON.ActionManager(this.scene);
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => {
          this.showTooltip(bar.info);
        }
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        this.hideTooltip
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
        if (bar.info.type === "PACKAGE" && bar.relevantUrl !== "/") {
          this.setState(
            (prev) => ({
              parentStack: [...prev.parentStack, prev.currentPath],
              currentPath: bar.relevantUrl, // El nuevo path es el 'relevantUrl'
            }),
            () => {
              const { repository, branch, commit } = this.state;
              this.loadAndPlotProject(
                bar.relevantUrl, // Pasamos el pathKey
                repository,
                branch,
                commit
              );
            }
          );
        }
      })
    );
    bar.material = new BABYLON.StandardMaterial(data.label + "mat", this.scene);
    bar.material.diffuseColor = data.color;
    bar.freezeWorldMatrix();
    return bar;
  };

  coverageToColor(coverage) {
    // coverage: 0-100 → normalizado [0,1]
    const t = Math.max(0, Math.min(coverage, 100)) / 100;

    let r, g, b;

    if (t < 1 / 3) {
      // 🔴 rojo → 🟠 naranja
      r = 255;
      g = Math.round(128 * (t * 3)); // de 0 a ~128
      b = 0;
    } else if (t < 2 / 3) {
      // 🟠 naranja → 🟡 amarillo
      r = 255;
      g = Math.round(128 + 127 * ((t - 1 / 3) * 3)); // de ~128 a 255
      b = 0;
    } else {
      // 🟡 amarillo → ⚪ blanco
      r = 255;
      g = 255;
      b = Math.round(255 * ((t - 2 / 3) * 3));
    }

    return { r, g, b };
  }

  assignCoverageColorsRecursive(nodes, parentTarget = null) {
    if (!nodes || nodes.length === 0) return;

    // Nivel raíz: hijos directos del root
    if (parentTarget === null) {
      nodes.forEach((node) => {
        // coverage random base para hijos de root (40–100)
        node.coverage = Math.floor(Math.random() * 61) + 40;
        if (node.children) {
          this.assignCoverageColorsRecursive(node.children, node.coverage);
        }
      });
      return;
    }

    // ⚡ Si el padre es 100 → todos los hijos y su descendencia también
    if (parentTarget === 100) {
      nodes.forEach((node) => {
        node.coverage = 100;
        if (node.children) {
          this.assignCoverageColorsRecursive(node.children, 100);
        }
      });
      return;
    }

    // Caso normal: ajustar para que el promedio ≈ parentTarget
    const count = nodes.length;
    const baseTarget = parentTarget;

    // Generar valores aleatorios iniciales (0–100)
    let raw = nodes.map(() => Math.floor(Math.random() * 101));

    // Calcular factor de escala para que el promedio ≈ baseTarget
    const currentAvg = raw.reduce((sum, v) => sum + v, 0) / Math.max(1, count);
    const factor = currentAvg === 0 ? 0 : baseTarget / currentAvg;

    // Ajustar y asignar
    raw = raw.map((v) => Math.max(0, Math.min(100, Math.round(v * factor))));

    nodes.forEach((node, i) => {
      node.coverage = raw[i];
      if (node.children) {
        this.assignCoverageColorsRecursive(node.children, node.coverage);
      }
    });
  }

  plot(children, parent, inheritedCoverage = null) {
    if (!children) return;

    children.forEach((data) => {
      let color;
      if (this.state.isNightMode) {
        const covVal = data.coverage ?? inheritedCoverage ?? 50;
        color = this.coverageToColor(covVal);
      } else {
        if (data.type === "ROOT") {
          color = colors[data.type].start;
        } else {
          color = getProportionalColor(
            colors[data.type].start,
            colors[data.type].end,
            Math.min(100, data.numberOfLines / 2000.0)
          );
        }
      }
      var minHeight = 10;
      var height =
        data.type === "ROOT"
          ? 0
          : Math.max(data.numberOfMethods / 10, minHeight / 2);
      if (data.type === "PACKAGE")
        height = Math.max(data.height ?? 10, minHeight);

      var mesh = this.addBlock({
        x: data.position.x,
        y: data.position.y,
        width: data.width,
        depth: data.depth,
        height: height,
        color: new BABYLON.Color3(color.r / 255, color.g / 255, color.b / 255),
        parent: parent,
        info: {
          name: data.name,
          path: data.path,
          url: data.url,
          type: data.type,
          NOM: data.numberOfMethods,
          NOL: data.numberOfLines,
          NOA: data.numberOfAttributes,
          test: data.test,
          coverage: data.coverage,
        },
      });

      if (parent) {
        mesh.parent = parent;
      }

      if (data.children && data.children.length > 0) {
        this.plot(data.children, mesh, data.coverage);
      }
    });
  }

  updateCamera(width, depth) {
    if (!this.camera) return;
    const centerX = 0;
    const centerZ = 0;
    const maxDimension = Math.max(width, depth);
    const radius = maxDimension * 1.5;
    this.camera.setTarget(new BABYLON.Vector3(centerX, 0, centerZ));
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 4;
    this.camera.radius = radius;
    this.camera.minZ = 1; // cercano
    this.camera.maxZ = radius * 10; // o un valor mayor que tu radio máximo
    this.camera.lowerRadiusLimit = maxDimension * 0.5; // zoom mínimo
    this.camera.upperRadiusLimit = maxDimension * 5; // zoom máximo
  }

  initScene() {
    const isNight = this.state?.isNightMode;
    this.scene.clearColor = isNight
      ? new BABYLON.Color3(0.05, 0.05, 0.1) // noche oscuro
      : new BABYLON.Color3(0.7, 0.7, 0.7); // día gris claro
    // this.scene.clearColor = new BABYLON.Color3(0.7, 0.7, 0.7);

    // Crear ArcRotateCamera con ángulos iniciales
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 4, // alpha: rotación horizontal
      Math.PI / 4, // beta: altura inicial
      1000, // radio inicial
      BABYLON.Vector3.Zero(), // target
      this.scene
    );

    // Permitir controlar la cámara con mouse/touch
    this.camera.attachControl(this.canvas, true);

    // Ajustes de zoom y límites
    this.camera.lowerRadiusLimit = 50; // zoom cercano
    this.camera.upperRadiusLimit = 5000; // zoom lejano
    this.camera.wheelDeltaPercentage = 0.01; // suaviza el zoom

    // Luz general
    const light = new BABYLON.HemisphericLight(
      "global_light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    light.intensity = 0.8;
  }

  onSceneMount(e) {
    this.scene = e.scene;
    this.canvas = e.canvas;
    this.engine = e.engine;

    this.initScene();

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });
  }

  handleKeyPress = (event) => {
    if (event.key === "Enter") {
      this.onClick();
    }
  };

  onInputChange(e) {
    if (e.target.id === "repository")
      this.setState({ repository: e.target.value });
    if (e.target.id === "branch") this.setState({ branch: e.target.value });
    if (e.target.id === "commit") {
      const selectedCommit = e.target.value;
      this.setState({ commit: selectedCommit }, () => {
        this.process(this.state.repository, "", this.state.branch);
      });
    }
  }

  loadAndPlotProject = (pathKey, repositoryName, branch, commit) => {
    if (!pathKey) return;

    this.setState({ loading: true });

    // Llama al nuevo endpoint /hierarchical
    const hierarchicalURL = `${endpoint}/hierarchical`;
    const params = {
      q: repositoryName,
      b: branch,
      c: commit,
      key: pathKey,
    };
    const fullURL = `${hierarchicalURL}?c=${params.c}&key=${params.key}&q=${params.q}&b=${params.b}`;
    console.log("[DEBUG] Petición GET a:", fullURL);
    axios
      .get(hierarchicalURL, { params })
      .then((response) => {
        this.setState({ loading: false });
        this.reset();

        const hierarchicalData = response.data;
        if (
          !hierarchicalData ||
          !hierarchicalData.type // Verificar si es un nodo válido
        ) {
          swal("Invalid project", "No layout data found.", "error");
          return;
        }

        const root = hierarchicalData;
        const rootInfo = {
          name: root.name || "Root",
          type: root.type || "PACKAGE",
          NOL: root.numberOfLines ?? 0,
          NOM: root.numberOfMethods ?? 0,
          NOA: root.numberOfAttributes ?? 0,
          test: root.test ?? 0,
          coverage: root.coverage ?? 0,
          url: root.url || "", // url ahora es el path
        };
        const childrenNodes =
          root.children?.map((c) => ({
            name: c.name,
            type: c.type,
            coverage: c.coverage ?? 0,
          })) || [];

        this.setState({ rootInfo, rootChildren: childrenNodes });

        this.lastData = hierarchicalData;
        this.assignCoverageColorsRecursive([hierarchicalData]);
        this.plot([hierarchicalData]);
        this.updateCamera(hierarchicalData.width, hierarchicalData.depth);
      })
      .catch((e) => {
        this.setState({ loading: false });
        swal(
          "Error during plot",
          e.response?.data?.error ||
            "Something went wrong during the plot. Try again later",
          "error"
        );
        console.error(e);
      });
  };

  goBackLevel = () => {
    const stack = [...this.state.parentStack];
    if (stack.length === 0) return;

    const parentPath = stack.pop(); // Saca el path padre (ej: "/")
    console.log("stack after pop:", stack);
    console.log("Navigating back to:", parentPath);

    this.setState({ parentStack: stack, currentPath: parentPath }, () => {
      const { repository, branch, commit } = this.state;
      this.loadAndPlotProject(parentPath, repository, branch, commit);
    });
  };

  process(repository, json, branch) {
    if (!BABYLON.Engine.isSupported()) return;

    let repositoryName;
    if (repository === "local") repositoryName = "local";
    else {
      const match = URLRegexp.exec(repository);
      if (!match) {
        swal("Invalid URL", "Please inform a valid Github URL.", "error");
        return;
      }
      if (
        match[1] !== this.props.match.params.repository ||
        branch !== this.props.match.params.branch
      ) {
        this.props.history.push(`/${match[1]}/#/${branch}`);
      }
      repositoryName = match[1];
    }

    this.setState({
      repository: repositoryName,
      loading: true,
      currentPath: "/",
    });

    this.loadAndPlotProject(
      "/", // Cargar el path raíz
      repositoryName,
      branch,
      this.state.commit
    );

    this.scene.autoClear = false;
    this.scene.autoClearDepthAndStencil = false;
  }

  onClick() {
    searchEvent(this.state.repository);
    this.process(this.state.repository, "", this.state.branch);
  }
  onFeedBackFormClose() {
    this.setState({ feedbackFormActive: false });
  }

  openFeedBackForm() {
    this.setState({ feedbackFormActive: true });
    feedbackEvent();
  }

  openModal() {
    this.setState({ modalActive: true });
  }

  closeModal() {
    this.setState({ modalActive: false });
  }

  getBadgeValue(template) {
    const repo = this.state.repository;
    const baseUrl = `https://img.shields.io/static/v1?label=gocity&color=blue&style=for-the-badge&message=${repo}&logo=${logoBase64()}`;
    const templates = {
      md: `![](${baseUrl})`,
      html: `<img src="${baseUrl}" alt="checkout my repo on gocity"/>`,
    };
    return templates[template];
  }

  saveAsPng() {
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
  }

  render() {
    return (
      <main onMouseMove={this.onMouseMove}>
        <a
          href="https://github.com/ShinjiMC/GoTestCity"
          className="github-corner is-hidden-tablet"
          aria-label="View source on GitHub"
        >
          <svg
            width="80"
            height="80"
            viewBox="0 0 250 250"
            style={{ fill: "#151513", color: "#fff" }}
            aria-hidden="true"
          >
            <path d="M0,0 L115,115 L130,115 L142,142 L250,250 L250,0 Z" />
            <path
              d="M128.3,109.0 C113.8,99.7 119.0,89.6 119.0,89.6 C122.0,82.7 120.5,78.6 120.5,78.6 C119.2,72.0 123.4,76.3 123.4,76.3 C127.3,80.9 125.5,87.3 125.5,87.3 C122.9,97.6 130.6,101.9 134.4,103.2"
              fill="currentColor"
              style={{ transformOrigin: "130px 106px" }}
              className="octo-arm"
            />
            <path
              d="M115.0,115.0 C114.9,115.1 118.7,116.5 119.8,115.4 L133.7,101.6 C136.9,99.2 139.9,98.4 142.2,98.6 C133.8,88.0 127.5,74.4 143.8,58.0 C148.5,53.4 154.0,51.2 159.7,51.0 C160.3,49.4 163.2,43.6 171.4,40.1 C171.4,40.1 176.1,42.5 178.8,56.2 C183.1,58.6 187.2,61.8 190.9,65.4 C194.5,69.0 197.7,73.2 200.1,77.6 C213.8,80.2 216.3,84.9 216.3,84.9 C212.7,93.1 206.9,96.0 205.4,96.6 C205.1,102.4 203.0,107.8 198.3,112.5 C181.9,128.9 168.3,122.5 157.7,114.1 C157.9,116.9 156.7,120.9 152.7,124.9 L141.0,136.5 C139.8,137.7 141.6,141.9 141.8,141.8 Z"
              fill="currentColor"
              className="octo-body"
            />
          </svg>
        </a>
        {!this.state.sidePanelOpen && (
          <FloatBox
            position={this.state.infoPosition}
            info={this.state.infoData}
            visible={this.state.infoVisible}
          />
        )}
        <header className="header">
          <div className="container">
            <Navbar />
            <p>
              GoTestCity is an implementation of the Code City metaphor for
              visualizing Go source code. Visit our repository for{" "}
              <a href="https://github.com/ShinjiMC/GoTestCity">more details.</a>
            </p>
            <p>
              You can also add a custom badge for your go repository.{" "}
              <button
                className="link-like-button"
                onClick={this.openModal}
                href="#"
              >
                click here
              </button>{" "}
              to generate one. Or you can{" "}
              <button
                className="link-like-button"
                onClick={this.saveAsPng}
                href="#"
              >
                save the city as PNG
              </button>
              .
            </p>
            <div className="field has-addons">
              <div className="control is-expanded">
                <input
                  onKeyPress={this.handleKeyPress}
                  onChange={this.onInputChange}
                  className="input"
                  id="repository"
                  type="text"
                  placeholder="eg: github.com/golang/go"
                  value={this.state.repository}
                />
              </div>
              <div className="control">
                <input
                  onKeyPress={this.handleKeyPress}
                  onChange={this.onInputChange}
                  className="input"
                  id="branch"
                  type="text"
                  placeholder="eg: master"
                  value={this.state.branch}
                />
              </div>
              <div className="control">
                {/* eslint-disable-next-line jsx-a11y/no-onchange */}
                <select
                  id="commit"
                  className="select"
                  value={this.state.commit}
                  onChange={this.onInputChange.bind(this)} // permitido aquí
                >
                  <option value="">Select commit...</option>
                  {this.state.commits.map((commit) => (
                    <option key={commit.sha} value={commit.sha}>
                      {commit.commit.message.substring(0, 60)} (
                      {commit.sha.slice(0, 7)})
                    </option>
                  ))}
                </select>
              </div>
              <div className="control">
                <button
                  id="search"
                  onClick={this.onClick}
                  className="button is-info"
                >
                  Plot
                </button>
              </div>
            </div>
          </div>
          <div className={this.state.modalActive ? "modal is-active" : "modal"}>
            <div className="modal-background"></div>
            <div className="modal-card">
              <section className="modal-card-body">
                <div className="content">
                  <span>
                    Showing code for <strong>{this.state.repository}</strong>
                  </span>
                  <h3>Markdown format</h3>
                  <textarea className="textarea">
                    {this.getBadgeValue("md")}
                  </textarea>
                  <h3>HTML format</h3>
                  <textarea className="textarea">
                    {this.getBadgeValue("html")}
                  </textarea>
                </div>
              </section>
            </div>
            <button
              onClick={this.closeModal}
              className="modal-close is-large"
              aria-label="close"
            ></button>
          </div>
        </header>

        <div className="relative h-screen p-2 bg-gray-200">
          {this.state.parentStack && this.state.parentStack.length > 0 && (
            <button
              onClick={this.goBackLevel}
              className="absolute top-20 left-6 z-50
               bg-gray-800 hover:bg-gray-700
               text-white p-3 rounded-full shadow-lg
               flex items-center justify-center
               transition"
              title="Volver al nivel anterior"
              aria-label="Volver al nivel anterior"
            >
              {/* Icono de flecha hacia atrás */}
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
            </button>
          )}
          {/* --- Botón Modo Día/Noche --- */}
          <button
            onClick={this.toggleMode}
            className="absolute top-6 left-6 z-50
             bg-gray-800 hover:bg-gray-700
             text-white p-3 rounded-full shadow-lg
             flex items-center justify-center
             transition"
            title={
              this.state.isNightMode
                ? "Cambiar a modo Día"
                : "Cambiar a modo Noche"
            }
            aria-label={
              this.state.isNightMode
                ? "Cambiar a modo Día"
                : "Cambiar a modo Noche"
            }
          >
            {this.state.isNightMode ? (
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
            ) : (
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
            )}
          </button>
          {/* --- Botón flotante --- */}
          <button
            onClick={
              this.state.sidePanelOpen
                ? this.closeSidePanel
                : this.openSidePanel
            }
            className="absolute top-6 right-6 z-50 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-4 py-2 rounded-full shadow-lg flex items-center gap-2 transition"
          >
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
            {this.state.sidePanelOpen ? "Hide Analytics" : "Show Analytics"}
          </button>
          {/* --- Contenedor principal con transición --- */}
          <div className="flex flex-row h-full bg-white rounded-xl shadow-lg overflow-hidden transition-all duration-500 ease-in-out">
            {/* --- Sección izquierda (Babylon + Datos) --- */}
            <div
              className={`flex flex-col flex-[1] min-w-0 h-full gap-0 transition-all duration-500 ease-in-out ${
                this.state.sidePanelOpen ? "flex-[1]" : "flex-[1] w-full"
              }`}
            >
              {/* --- Babylon ocupa siempre el espacio --- */}
              <section
                className={`canvas bg-black flex items-center justify-center w-full transition-all duration-500 ease-in-out ${
                  this.state.sidePanelOpen
                    ? "flex-1 rounded-tl-xl"
                    : "flex-1 rounded-xl"
                }`}
              >
                {this.state.loading ? (
                  <Loading message="Fetching repository..." />
                ) : (
                  <BabylonScene
                    engineOptions={{
                      preserveDrawingBuffer: true,
                      stencil: true,
                    }}
                    onSceneMount={this.onSceneMount}
                  />
                )}
              </section>

              {/* --- Datos --- */}
              {this.state.sidePanelOpen && (
                <section className="flex-1 overflow-y-auto bg-gray-100 w-full rounded-bl-xl transition-opacity duration-300">
                  <Datos
                    info={this.state.rootInfo}
                    childrenNodes={this.state.rootChildren}
                  />
                </section>
              )}
            </div>

            {/* --- Panel lateral --- */}
            {this.state.sidePanelOpen && (
              <aside className="flex-[1] min-w-[50%] bg-gray-900 text-white p-4 overflow-y-auto  border-gray-300 transition-opacity duration-300">
                <SidePanel
                  coverageGlobal={this.state.coverageGlobal}
                  coverageRoot={this.state.coverageRoot}
                  coverageIncrease={this.state.coverageIncrease}
                  timelineData={this.state.timelineData}
                  onClose={this.closeSidePanel}
                />
              </aside>
            )}
          </div>
        </div>
        <Legend />
      </main>
    );
  }
}

App.propTypes = {
  match: PropTypes.shape({
    params: PropTypes.shape({
      repository: PropTypes.string,
      branch: PropTypes.string,
    }),
  }),
  history: PropTypes.shape({
    push: PropTypes.func,
  }),
};

export default App;
