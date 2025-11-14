// src/CityPlotter.js
import React, { Component } from "react";
import * as BABYLON from "babylonjs";
import BabylonScene from "./Scene"; // Asumo que Scene.js está en la misma carpeta
import PropTypes from "prop-types";
import { getProportionalColor } from "./utils"; // Importa tus utils

// Las constantes de color que necesita el ploteo
const colors = {
  PACKAGE: { start: { r: 255, g: 207, b: 64 }, end: { r: 200, g: 160, b: 50 } },
  FILE: { start: { r: 120, g: 190, b: 32 }, end: { r: 80, g: 150, b: 30 } },
  STRUCT: { start: { r: 100, g: 143, b: 255 }, end: { r: 60, g: 100, b: 200 } },
  ROOT: { start: { r: 160, g: 160, b: 160 }, end: { r: 100, g: 100, b: 100 } },
};

class CityPlotter extends Component {
  scene = null;
  engine = null;
  canvas = null;
  camera = null;
  light = null;

  static propTypes = {
    data: PropTypes.object, // Los datos jerárquicos para plotear
    isNightMode: PropTypes.bool,
    criticalityFilter: PropTypes.string,
    onMeshClick: PropTypes.func.isRequired, // Callback para manejar clics
    onMeshHover: PropTypes.func.isRequired,
    onMeshOut: PropTypes.func.isRequired,
    onSceneMount: PropTypes.func.isRequired, // Pasa el handler de App.js
  };

  componentDidUpdate(prevProps) {
    // Si los datos cambian (ej. se navega a un subdirectorio)
    // O si cambia el modo de color, replotear.
    if (
      (this.props.data && this.props.data !== prevProps.data) ||
      this.props.isNightMode !== prevProps.isNightMode ||
      this.props.criticalityFilter !== prevProps.criticalityFilter
    ) {
      this.plotData();
    }
  }

  plotData = () => {
    if (!this.props.data) return;

    this.reset();
    const plotData = [this.props.data]; // El nodo ROOT
    // TODO: Mover 'assignCoverageColorsRecursive' de App.js aquí si se desea
    this.plot(plotData, null); // Inicia el ploteo sin padre
    this.updateCamera(this.props.data.width, this.props.data.depth);
  };

  reset = () => {
    if (this.scene) {
      this.scene.dispose();
    }
    this.scene = new BABYLON.Scene(this.engine);
    this.initScene();
  };

  initScene = () => {
    const isNight = this.props.isNightMode;
    this.scene.clearColor = isNight
      ? new BABYLON.Color3(0.05, 0.05, 0.1)
      : new BABYLON.Color3(0.7, 0.7, 0.7);

    this.camera = new BABYLON.ArcRotateCamera(
      "camera",
      -Math.PI / 4,
      Math.PI / 4,
      1000,
      BABYLON.Vector3.Zero(),
      this.scene
    );
    this.camera.attachControl(this.canvas, true);
    this.camera.lowerRadiusLimit = 50;
    this.camera.upperRadiusLimit = 5000;
    this.camera.wheelDeltaPercentage = 0.01;

    const light = new BABYLON.HemisphericLight(
      "global_light",
      new BABYLON.Vector3(0, 1, 0),
      this.scene
    );
    light.intensity = 0.8;
  };

  onSceneMount = (e) => {
    this.scene = e.scene;
    this.canvas = e.canvas;
    this.engine = e.engine;

    // Pasa el evento al padre (App.js) para que pueda guardar el canvas
    this.props.onSceneMount(e);

    this.initScene();

    // Si ya hay datos cuando se monta, plotearlos
    if (this.props.data) {
      this.plotData();
    }

    this.engine.runRenderLoop(() => {
      if (this.scene) {
        this.scene.render();
      }
    });
  };

  updateCamera = (width, depth) => {
    if (!this.camera) return;
    const maxDimension = Math.max(width, depth);
    const radius = maxDimension * 1.5;

    this.camera.setTarget(BABYLON.Vector3.Zero());
    this.camera.alpha = -Math.PI / 4;
    this.camera.beta = Math.PI / 4;
    this.camera.radius = radius;
    this.camera.minZ = 1;
    this.camera.maxZ = radius * 10;
    this.camera.lowerRadiusLimit = maxDimension * 0.5;
    this.camera.upperRadiusLimit = maxDimension * 5;
  };

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
    bar.info = data.info; // Pasa toda la info

    bar.actionManager = new BABYLON.ActionManager(this.scene);
    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOverTrigger,
        () => {
          this.props.onMeshHover(bar.info); // Llama al callback del padre
        }
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(
        BABYLON.ActionManager.OnPointerOutTrigger,
        this.props.onMeshOut // Llama al callback del padre
      )
    );

    bar.actionManager.registerAction(
      new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, () => {
        // Llama al callback del padre para que él maneje la navegación
        this.props.onMeshClick(bar.info);
      })
    );

    bar.material = new BABYLON.StandardMaterial(data.label + "mat", this.scene);
    bar.material.diffuseColor = data.color;
    bar.freezeWorldMatrix();
    return bar;
  };

  coverageToColor = (coverage) => {
    const t = Math.max(0, Math.min(coverage, 100)) / 100;
    let r, g, b;
    if (t < 1 / 3) {
      r = 255;
      g = Math.round(128 * (t * 3));
      b = 0;
    } else if (t < 2 / 3) {
      r = 255;
      g = Math.round(128 + 127 * ((t - 1 / 3) * 3));
      b = 0;
    } else {
      r = 255;
      g = 255;
      b = Math.round(255 * ((t - 2 / 3) * 3));
    }
    return { r, g, b };
  };

  plot = (children, parent, inheritedCoverage = null) => {
    if (!children) return;

    children.forEach((data) => {
      let color;
      let isCritical = false;
      const filter = this.props.criticalityFilter;
      if (filter && filter !== "none") {
        const severityKey = `severity_${filter}`; // ej. severity_complexity
        const severityValue = data[severityKey]; // Leer datos del nodo
        if (severityValue === "CRITICAL" || severityValue === "HIGH") {
          isCritical = true;
        }
      }
      let emissiveColor = null;
      if (this.props.isNightMode) {
        if (data.type === "ROOT" || data.type === "STRUCT") {
          color = colors.ROOT.start;
        } else {
          const covVal = data.coverage ?? inheritedCoverage ?? 50;
          color = this.coverageToColor(covVal);
          if (isCritical) {
            emissiveColor = new BABYLON.Color3(
              color.r / 255,
              color.g / 255,
              color.b / 255
            );
          }
        }
      } else {
        if (data.type === "ROOT") {
          color = colors.ROOT.start;
        } else {
          color = getProportionalColor(
            colors[data.type].start,
            colors[data.type].end,
            Math.min(100, data.numberOfLines / 2000.0)
          );
        }
      }

      var minHeight = 10;
      var height;
      if (data.type === "ROOT") {
        height = 0;
      } else if (data.type === "FILE") {
        height = 0.1; // Hacer los archivos planos
      } else if (data.type === "STRUCT") {
        height = Math.max((data.height || 10) / 10, 1);
      } else if (data.type === "PACKAGE") {
        height = Math.max(data.height ?? 10, minHeight);
      } else {
        height = Math.max(data.numberOfMethods / 10, minHeight / 2);
      }

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
          overall_severity: data.overall_severity,
          severity_complexity: data.severity_complexity,
          severity_coupling: data.severity_coupling,
          severity_issues: data.severity_issues,
          severity_churn: data.severity_churn,
          severity_authors: data.severity_authors,
          severity_halstead: data.severity_halstead,
        },
      });

      if (emissiveColor) {
        mesh.material.emissiveColor = emissiveColor;
      }

      if (parent) {
        mesh.parent = parent;
      }

      if (data.children && data.children.length > 0) {
        this.plot(data.children, mesh, data.coverage);
      }
    });
  };

  render() {
    return (
      <BabylonScene
        engineOptions={{
          preserveDrawingBuffer: true,
          stencil: true,
        }}
        onSceneMount={this.onSceneMount}
      />
    );
  }
}

export default CityPlotter;
