// src/FloatBox.js
import React from "react";
import { openGithubEvent } from "./utils";
import PropTypes from "prop-types";

const FloatBox = ({ position, info, visible }) => {
  if (!visible) return null;

  return (
    <div
      className="fixed z-[9999] pointer-events-auto"
      style={{
        left: position.x,
        top: position.y,
      }}
    >
      <div
        className="box is-unselectable bg-white text-black shadow-xl rounded-md border border-gray-300 p-4 max-w-xs"
        role="tooltip"
      >
        <h4 className="font-bold text-sm mb-2">
          {info.name || "Elemento"} [{info.type}]
        </h4>
        {info.type !== "ROOT" && (
          <div className="text-xs space-y-1">
            <p>
              <b>Lines:</b> {info.NOL ?? "..."}
            </p>
            <p>
              <b>Methods:</b> {info.NOM ?? "..."}
            </p>
            <p>
              <b>Functions:</b> {info.NOA ?? "..."}
            </p>
            <p>
              <b>Coverage:</b> {info.coverage?.toFixed(1) ?? "..."}%
            </p>
          </div>
        )}
        {info.url && (
          <a
            href={info.url}
            className="button mt-3 is-dark flex items-center gap-2 text-xs px-3 py-1 rounded hover:bg-gray-800"
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => openGithubEvent(info.url)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 
                   5.47 7.59.4.07.55-.17.55-.38 
                   0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94
                   -.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53
                   .63-.01 1.08.58 1.23.82.72 1.21 
                   1.87.87 2.33.66.07-.52.28-.87.51-1.07
                   -1.78-.2-3.64-.89-3.64-3.95 
                   0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12
                   0 0 .67-.21 2.2.82.64-.18 1.32-.27 
                   2-.27.68 0 1.36.09 2 .27 1.53-1.04 
                   2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12
                   .51.56.82 1.27.82 2.15 
                   0 3.07-1.87 3.75-3.65 3.95
                   .29.25.54.73.54 1.48 
                   0 1.07-.01 1.93-.01 2.2 
                   0 .21.15.46.55.38A8.013 8.013 
                   0 0 0 16 8c0-4.42-3.58-8-8-8z"
              />
            </svg>
            Open on Github
          </a>
        )}
      </div>
    </div>
  );
};

FloatBox.displayName = "FloatBox";

FloatBox.propTypes = {
  position: PropTypes.shape({
    x: PropTypes.number,
    y: PropTypes.number,
  }),
  info: PropTypes.shape({
    NOA: PropTypes.number,
    NOL: PropTypes.number,
    NOM: PropTypes.number,
    name: PropTypes.string,
    type: PropTypes.string,
    url: PropTypes.string,
    coverage: PropTypes.number,
    path: PropTypes.string,
  }),
  visible: PropTypes.bool,
};

export default FloatBox;
