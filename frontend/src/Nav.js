import React from "react";
import logo from "./img/logo.png";

const Nav = () => {
  return (
    <div className="level">
      <div className="level-left">
        <div className="level-item">
          <div className="control">
            <a href="/">
              <img
                className="m-r-10"
                width={50}
                src={logo}
                alt="GoTestCity: Source code visualization"
              />
            </a>
          </div>
          <a href="/">
            <h1 className="title"> GoTestCity</h1>
          </a>
        </div>
      </div>
      <div className="level-right">
        <div className="level-item is-hidden-mobile">
          <a href="https://github.com/ShinjiMC/GoTestCity">
            <img
              alt="GitHub stars"
              src="https://img.shields.io/github/stars/ShinjiMC/GoTestCity?style=flat&logo=github"
            />
          </a>
          <span className="m-l-10" />
          <a href="https://github.com/ShinjiMC/GoTestCity/fork">
            <img
              alt="GitHub forks"
              src="https://img.shields.io/github/forks/ShinjiMC/GoTestCity?label=Fork&style=flat&logo=github"
            />
          </a>
        </div>
      </div>
    </div>
  );
};

export default Nav;
