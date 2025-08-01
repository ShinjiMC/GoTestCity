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
import Cookies from "js-cookie";
import PropTypes from "prop-types";

const URLRegexp = new RegExp(/^(?:https:\/\/?)?(github\.com\/.*)/i);

const endpoint = Cookies.get("gocity_api") || process.env.REACT_APP_API_URL;

// TODO: isolate in the constants file
const colors = {
  PACKAGE: {
    start: { r: 255, g: 207, b: 64 }, // Amarillo mostaza (más llamativo)
    end: { r: 200, g: 160, b: 50 },
  },
  FILE: {
    start: { r: 120, g: 190, b: 32 }, // Verde lima (papel = ecológico)
    end: { r: 80, g: 150, b: 30 },
  },
  STRUCT: {
    start: { r: 100, g: 143, b: 255 }, // Azul (estructuras metálicas/vidrio)
    end: { r: 60, g: 100, b: 200 },
  },
  ROOT: {
    start: { r: 160, g: 160, b: 160 }, // Cemento base
    end: { r: 100, g: 100, b: 100 },
  },
};

const mirrorColors = {
  PACKAGE: new BABYLON.Color3(0.6, 0.4, 0.1), // Marrón/ámbar oscuro
  FILE: new BABYLON.Color3(0.2, 0.4, 0.2), // Verde oscuro
  STRUCT: new BABYLON.Color3(0.3, 0.4, 0.7), // Azul noche
  ROOT: new BABYLON.Color3(0.2, 0.2, 0.2), // Asfalto
  DEFAULT: new BABYLON.Color3(0.3, 0.3, 0.3),
};

const examples = [
  {
    branch: "master",
    name: "sirupsen/logrus",
    link: "github.com/sirupsen/logrus",
  },
  {
    branch: "master",
    name: "gin-gonic/gin",
    link: "github.com/gin-gonic/gin",
  },
  {
    branch: "master",
    name: "spf13/cobra",
    link: "github.com/spf13/cobra",
  },
  {
    branch: "master",
    name: "gohugoio/hugo",
    link: "github.com/gohugoio/hugo",
  },
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
      branch: this.props.match.params.branch || "main",
      modalActive: false,
      commit: "", // también puedes inicializarlo si usas un value
      commits: [], // <--- agrega esto
      selectedCommitDate: null,
    };

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

  dimUnfocusedBars = () => {
    const { focusedBarName } = this.state;

    this.bars.forEach((bar) => {
      if (!bar.material) return;

      const isFocused = bar.info?.name === focusedBarName;
      bar.material.alpha = isFocused || !focusedBarName ? 1.0 : 0.3;
    });
  };

  reset() {
    this.scene.dispose();
    this.scene = new BABYLON.Scene(this.engine);
    this.bars = [];
    this.initScene();
  }

  cloneChildrenRecursively(source, target, mirrorParent) {
    source.getChildren().forEach((child) => {
      const childMirror = child.clone(child.name + "_mirror", null, false);
      // Reflejar posición local (NO absoluta)
      const centerY = source.getBoundingInfo().boundingBox.center.y;
      const offsetY = child.position.y - centerY;

      childMirror.position = new BABYLON.Vector3(
        child.position.x,
        centerY - offsetY,
        child.position.z
      );

      // Copiar escala completa y reflejar Y con factor
      childMirror.scaling = child.scaling.clone();
      childMirror.scaling.y *= -1;

      // Asignar parent espejo
      childMirror.parent = target;

      const type = (child.info?.type || "DEFAULT").toUpperCase();
      const mirrorColor =
        child.info?.name !== ""
          ? mirrorColors[type] || mirrorColors.DEFAULT
          : mirrorColors.ROOT;

      const mat = new BABYLON.StandardMaterial(
        childMirror.name + "_mat",
        this.scene
      );
      mat.diffuseColor = mirrorColor;
      childMirror.material = mat;

      childMirror.info = {
        ...child.info,
        isMirror: true,
      };

      childMirror.actionManager = new BABYLON.ActionManager(this.scene);
      childMirror.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOverTrigger,
          () => {
            this.showTooltip(childMirror.info);
          }
        )
      );
      childMirror.actionManager.registerAction(
        new BABYLON.ExecuteCodeAction(
          BABYLON.ActionManager.OnPointerOutTrigger,
          this.hideTooltip
        )
      );

      // Clonar recursivamente
      this.cloneChildrenRecursively(child, childMirror, mirrorParent);
    });
  }

  addBlock = (data) => {
    const name = data.label || "unnamed";
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
    bar.info = {
      ...data.info,
      isMirror: data.isMirror || false, // marcar si es espejo o no
    };

    bar.actionManager = new BABYLON.ActionManager(this.scene);
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => {
          this.showTooltip(bar.info);
        }
      )
    );

    // Manejar CLICK aquí
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
        this.handleBarClick(bar.info);
      })
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        this.hideTooltip
      )
    );

    // Material
    bar.material = new BABYLON.StandardMaterial(name + "mat", this.scene);
    bar.material.diffuseColor = data.color;

    bar.freezeWorldMatrix();
    if (!this.bars) this.bars = [];
    if (!data.isMirror) {
      this.bars.push(bar);
    }
    return bar;
  };

  plot(children, parent) {
    if (!children) {
      return;
    }
    if (!parent) {
      this.bars = [];
    }

    children.forEach((data) => {
      var color = getProportionalColor(
        colors.ROOT.start,
        colors.ROOT.end,
        Math.min(100, data.numberOfLines / 2000.0)
      );
      if (data.name !== "") {
        color = getProportionalColor(
          colors[data.type].start,
          colors[data.type].end,
          Math.min(100, data.numberOfLines / 2000.0)
        );
      }
      const commitDate = new Date(this.state.selectedCommitDate);
      const thresholdDate = new Date("2023-09-30T00:00:00Z");

      let coverage = "100%";
      if (commitDate < thresholdDate) {
        const maxDays = 365 * 5; // límite de 5 años hacia atrás
        const daysDifference = Math.min(
          Math.floor((thresholdDate - commitDate) / (1000 * 60 * 60 * 24)),
          maxDays
        );

        const decayFactor = 1 - daysDifference / maxDays; // más antiguo = más chico
        const minCov = 30;
        const maxCov = 80;

        const adjustedMax = minCov + (maxCov - minCov) * decayFactor;

        const randomCoverage = Math.floor(
          minCov + Math.random() * (adjustedMax - minCov)
        );

        coverage = `${randomCoverage}%`;
      }

      var mesh = this.addBlock({
        x: data.position.x,
        y: data.position.y,
        width: data.width,
        depth: data.depth,
        height: data.numberOfMethods,
        color: new BABYLON.Color3(color.r / 255, color.g / 255, color.b / 255),
        parent: parent,
        info: {
          name: data.name,
          url: data.url,
          type: data.type,
          NOM: data.numberOfMethods,
          NOL: data.numberOfLines,
          NOA: data.numberOfAttributes,
          test: Math.floor(Math.random() * 10) + 1,
          coverage: coverage,
          commitDate: this.state.selectedCommitDate,
        },
      });

      if (parent) {
        mesh.parent = parent;
      }

      if (data.children && data.children.length > 0) {
        this.plot(data.children, mesh);
      }
    });
  }

  updateCamera(width, height) {
    if (width > 1000) {
      this.camera.useAutoRotationBehavior = false;
    } else {
      this.camera.useAutoRotationBehavior = true;
    }
    width = Math.min(width, 1000);
    height = Math.min(height, 1000);
    this.camera.setPosition(
      new BABYLON.Vector3(width / 2, width, (width + height) / 2)
    );
  }

  initScene() {
    this.scene.clearColor = new BABYLON.Color3(0.7, 0.7, 0.7);
    // This creates and positions a free camera (non-mesh)
    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      0,
      0,
      10,
      BABYLON.Vector3.Zero(),
      this.scene
    );

    // This targets the camera to scene origin
    this.camera.setTarget(BABYLON.Vector3.Zero());

    // This attaches the camera to the canvas
    this.camera.attachControl(this.canvas, true);

    this.camera.setPosition(new BABYLON.Vector3(500, 400, -100));
    this.camera.useAutoRotationBehavior = true;

    // This creates a light, aiming 0,1,0 - to the sky (non-mesh)
    var light = new BABYLON.HemisphericLight(
      "global_light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );

    light.intensity = 0.8;
    const underLight = new BABYLON.DirectionalLight(
      "underLight",
      new BABYLON.Vector3(0, 1, 0), // de abajo hacia arriba
      this.scene
    );
    underLight.position = new BABYLON.Vector3(0, -500, 0); // debajo de la ciudad
    underLight.intensity = 0.7;
  }
  handleBarClick = (info) => {
    const selectedName = info?.name;

    if (!selectedName || info?.type === "FILE" || info?.type === "PACKAGE") {
      this.resetBarTransparency();
      return;
    }

    this.setState({ focusedBarName: selectedName }, () => {
      this.scene.meshes.forEach((mesh) => {
        if (!mesh.material || !mesh.info) return;

        const isSameName = mesh.info?.name === selectedName;
        mesh.material.alpha = isSameName ? 1.0 : 0.3;
      });
    });
  };
  resetBarTransparency = () => {
    this.scene.meshes.forEach((mesh) => {
      if (mesh.material) {
        mesh.material.alpha = 1.0;
      }
    });
    this.setState({ focusedBarName: null });
  };

  onSceneMount(e) {
    this.scene = e.scene;
    this.canvas = e.canvas;
    this.engine = e.engine;

    this.initScene();
    this.scene.onPointerObservable.add((pointerInfo) => {
      if (pointerInfo.type === BABYLON.PointerEventTypes.POINTERDOWN) {
        const pickResult = this.scene.pick(
          this.scene.pointerX,
          this.scene.pointerY
        );
        if (!pickResult.hit || !pickResult.pickedMesh?.info) {
          this.resetBarTransparency();
        }
      }
    });
    this.engine.runRenderLoop(() => {
      if (this.scene) {
        // this.dimUnfocusedBars();
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
    if (e.target.id === "repository") {
      this.setState({ repository: e.target.value });
    }
    if (e.target.id === "branch") {
      this.setState({ branch: e.target.value });
    }
    if (e.target.id === "commit") {
      const selectedCommit = e.target.value;
      this.setState({ commit: selectedCommit }, () => {
        this.process(this.state.repository, "", this.state.branch);
      });
    }
  }

  process(repository, json, branch) {
    if (!BABYLON.Engine.isSupported()) {
      return;
    }

    let repositoryName;
    if (repository === "local") {
      repositoryName = "local";
    } else {
      const match = URLRegexp.exec(repository);
      if (!match) {
        swal("Invalid URL", "Please inform a valid Github URL.", "error");
        return;
      }

      if (
        match !== this.props.match.params.repository ||
        branch !== this.props.match.params.branch
      ) {
        this.props.history.push(`/${match[1]}/#/${branch}`);
      }

      repositoryName = match[1];
    }

    this.setState({
      repository: repositoryName,
      loading: true,
    });

    // Cargar commits desde GitHub
    const [user, repo] = repositoryName.replace("github.com/", "").split("/");
    axios
      .get(`https://api.github.com/repos/${user}/${repo}/commits`, {
        params: { sha: branch },
      })
      .then((res) => {
        this.setState({ commits: res.data });
        const selectedCommit = this.state.commit;
        const commitInfo = res.data.find((c) =>
          c.sha.startsWith(selectedCommit)
        );
        const commitDate = commitInfo ? commitInfo.commit.author.date : null;

        this.setState({ selectedCommitDate: commitDate });
      })
      .catch((err) => {
        console.warn("Could not fetch commits:", err);
        this.setState({ commits: [] });
      });

    let request = null;
    if (json) {
      request = axios.get(json);
    } else {
      request = axios.get(endpoint, {
        params: {
          q: repositoryName,
          b: branch,
          c: this.state.commit,
        },
      });
    }

    request
      .then((response) => {
        this.setState({ loading: false });
        this.reset();

        if (response.data.children && response.data.children.length === 0) {
          swal("Invalid project", "Only Go projects are allowed.", "error");
        }

        this.plot(response.data.children);

        const mirrorParent = new BABYLON.TransformNode(
          "mirrorParent",
          this.scene
        );
        mirrorParent.position.y = -1;
        if (this.bars) {
          this.bars
            .filter((bar) => !bar.info?.isMirror && !bar.parent) // solo nodos raíz
            .forEach((bar) => {
              const mirror = BABYLON.MeshBuilder.CreateBox(
                bar.name + "_mirror",
                {
                  width:
                    bar.scaling.x *
                    bar.getBoundingInfo().boundingBox.extendSize.x *
                    2,
                  depth:
                    bar.scaling.z *
                    bar.getBoundingInfo().boundingBox.extendSize.z *
                    2,
                  height:
                    bar.scaling.y *
                    bar.getBoundingInfo().boundingBox.extendSize.y *
                    2,
                },
                this.scene
              );
              const absolute = bar.getAbsolutePosition();
              mirror.position = new BABYLON.Vector3(
                absolute.x,
                -absolute.y,
                absolute.z
              );
              let scaleY = -1;
              const type2 = (bar.info?.type || "DEFAULT").toUpperCase();
              if (type2 !== "ROOT") {
                const rawCoverage = bar.info?.coverage || "100%";
                const numericCoverage = parseFloat(
                  rawCoverage.replace("%", "")
                );
                const normalizedScale = Math.max(
                  0.0,
                  Math.min(1.0, numericCoverage / 100)
                );
                scaleY *= normalizedScale;
              } else {
                scaleY *= 1.0;
              }
              mirror.scaling.y = scaleY;
              mirror.parent = mirrorParent;

              mirror.info = bar.info;

              const type = (bar.info?.type || "DEFAULT").toUpperCase();
              let mirrorColor = mirrorColors.ROOT;
              if (bar.info?.name !== "")
                mirrorColor = mirrorColors[type] || mirrorColors.DEFAULT;

              const mat = new BABYLON.StandardMaterial(
                mirror.name + "_mat",
                this.scene
              );
              mat.diffuseColor = mirrorColor;
              mirror.material = mat;

              mirror.info = {
                ...bar.info,
                isMirror: true,
              };

              mirror.actionManager = new BABYLON.ActionManager(this.scene);
              mirror.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPointerOverTrigger,
                  () => {
                    this.showTooltip(mirror.info);
                  }
                )
              );
              mirror.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPointerOverTrigger,
                  () => {
                    this.handleBarClick(mirror.info);
                  }
                )
              );
              mirror.actionManager.registerAction(
                new BABYLON.ExecuteCodeAction(
                  BABYLON.ActionManager.OnPointerOutTrigger,
                  this.hideTooltip
                )
              );
              this.cloneChildrenRecursively(bar, mirror, mirrorParent);
            });
        }
        this.updateCamera(response.data.width, response.data.depth);
      })
      .catch((e) => {
        this.setState({ loading: false });
        swal(
          "Error during plot",
          "Something went wrong during the plot. Try again later",
          "error"
        );
        console.error(e);
      });

    // this.scene.freezeActiveMeshes();
    this.scene.autoClear = false; // Color buffer
    this.scene.autoClearDepthAndStencil = false; // Depth and stencil, obviously
    this.scene.blockfreeActiveMeshesAndRenderingGroups = true;
    this.scene.blockfreeActiveMeshesAndRenderingGroups = false;
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
        <FloatBox
          position={this.state.infoPosition}
          info={this.state.infoData}
          visible={this.state.infoVisible}
        />
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

            <div className="level">
              <small className="level-left">
                Examples:{" "}
                {examples.map((example) => (
                  <button
                    className="m-l-10 link-like-button"
                    key={example.link}
                    onClick={() => {
                      this.process(example.link, example.json, example.branch);
                    }}
                  >
                    {example.name}
                  </button>
                ))}
              </small>
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
        <section className="canvas">
          {this.state.loading ? (
            <Loading message="Fetching repository..." />
          ) : (
            <BabylonScene
              width={window.innerWidth}
              engineOptions={{ preserveDrawingBuffer: true, stencil: true }}
              onSceneMount={this.onSceneMount}
            />
          )}
        </section>
        <div className="footer-warning notification is-danger is-hidden-tablet is-paddingless is-marginless is-unselectable">
          GoTestCity is best viewed on Desktop
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
