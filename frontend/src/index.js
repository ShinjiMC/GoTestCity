// src/index.js
import React from "react";
import ReactDOM from "react-dom";
import "./index.css";
import { BrowserRouter, Route, Switch } from "react-router-dom";

import HomePage from "./HomePage";
import ProcessingPage from "./ProcessingPage";
import VisualizationPage from "./VisualizationPage";

const Root = () => (
  <BrowserRouter basename={process.env.PUBLIC_URL}>
    <Switch>
      <Route path="/view/:repository*" component={VisualizationPage} />
      <Route exact path="/process" component={ProcessingPage} />
      <Route exact path="/" component={HomePage} />
    </Switch>
  </BrowserRouter>
);

ReactDOM.render(<Root />, document.getElementById("root"));
