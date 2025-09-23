import React, { useState, useMemo } from "react";
import { Line } from "react-chartjs-2";
import "chart.js/auto";
import PropTypes from "prop-types";
import "chartjs-adapter-date-fns";

SidePanel.propTypes = {
  coverageGlobal: PropTypes.number.isRequired,
  coverageRoot: PropTypes.number.isRequired,
  timelineData: PropTypes.arrayOf(
    PropTypes.shape({
      date: PropTypes.string.isRequired,
      coverage: PropTypes.number.isRequired,
    })
  ).isRequired,
  onClose: PropTypes.func.isRequired,
};

function groupByDayKeepLast(data) {
  const map = new Map();
  data.forEach((d) => {
    const dayKey = new Date(d.date).toISOString().split("T")[0];
    map.set(dayKey, d);
  });
  return [...map.values()];
}

export default function SidePanel({
  coverageGlobal,
  coverageRoot,
  timelineData,
  onClose,
}) {
  const [range, setRange] = useState("all");

  const filteredData = useMemo(() => {
    if (range === "all") return timelineData;
    const now = Date.now();
    let days = 0;
    switch (range) {
      case "day":
        days = 1;
        break;
      case "7d":
        days = 7;
        break;
      case "month":
        days = 30;
        break;
      case "3m":
        days = 90;
        break;
      case "6m":
        days = 180;
        break;
      case "1y":
        days = 365;
        break;
      default:
        return timelineData;
    }
    const cutoff = now - days * 24 * 60 * 60 * 1000;
    return timelineData.filter((d) => Date.parse(d.date) >= cutoff);
  }, [range, timelineData]);

  const dynamicIncrease = useMemo(() => {
    if (filteredData.length < 2) return 0;
    const first = filteredData[0].coverage;
    const last = filteredData[filteredData.length - 1].coverage;
    return +(last - first).toFixed(1);
  }, [filteredData]);

  const extendedData = useMemo(() => {
    const nowISO = new Date().toISOString();

    if (filteredData.length === 0) {
      if (timelineData.length === 0) return [];
      const lastAll = timelineData[timelineData.length - 1];
      return [lastAll, { date: nowISO, coverage: lastAll.coverage }];
    }

    let data = [...filteredData];

    if (range !== "all") {
      const now = new Date();
      let days = 0;
      switch (range) {
        case "day":
          days = 1;
          break;
        case "7d":
          days = 7;
          break;
        case "month":
          days = 30;
          break;
        case "3m":
          days = 90;
          break;
        case "6m":
          days = 180;
          break;
        case "1y":
          days = 365;
          break;
        default:
          days = 0;
      }

      if (days > 0) {
        const minDate = new Date(now - days * 24 * 60 * 60 * 1000);
        const beforeMin = [...timelineData]
          .filter((d) => Date.parse(d.date) <= minDate)
          .pop();

        if (beforeMin) {
          data = [
            { date: minDate.toISOString(), coverage: beforeMin.coverage },
            ...data,
          ];
        } else {
          data = [{ date: minDate.toISOString(), coverage: 0 }, ...data];
        }
      }
    }

    const monthlyRanges = ["month", "3m", "6m", "1y"];
    if (
      monthlyRanges.includes(range) ||
      (range === "all" &&
        timelineData.length > 1 &&
        Date.parse(timelineData[timelineData.length - 1].date) -
          Date.parse(timelineData[0].date) >
          30 * 24 * 60 * 60 * 1000)
    ) {
      data = groupByDayKeepLast(data);
    }

    const last = data[data.length - 1];
    const lastDate = Date.parse(last.date);
    const diffHours = (Date.now() - lastDate) / 3600000;

    return diffHours > 1
      ? [...data, { date: nowISO, coverage: last.coverage }]
      : data;
  }, [filteredData, timelineData, range]);

  const lineData = {
    labels: extendedData.map((d) => new Date(d.date)),
    datasets: [
      {
        label: "Cobertura (%)",
        data: extendedData.map((d) => d.coverage),
        borderColor: "#3b82f6",
        backgroundColor: "#3b82f6",
        tension: 0,
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: {
        min: 0,
        max: 100,
        ticks: { color: "#fff" },
        grid: { color: "rgba(255,255,255,0.1)" },
      },
      x: {
        type: "time",
        time: {
          unit: range === "day" ? "hour" : "day",
          tooltipFormat: "yyyy-MM-dd HH:mm",
          displayFormats: {
            hour: "HH:mm",
            day: "MMM d",
          },
        },
        ticks: {
          color: "#fff",
          autoSkip: range === "7d" ? false : true,
          stepSize: range === "7d" ? 1 : undefined,
          maxTicksLimit:
            range === "day"
              ? 24
              : range === "7d"
              ? 7
              : range === "month"
              ? 6
              : 8,
        },
        grid: { color: "rgba(255,255,255,0.1)" },
        // ⬅️ forzar min y max para 7d
        min:
          range === "7d"
            ? (() => {
                const now = new Date();
                const d = new Date(now);
                d.setDate(d.getDate() - 6);
                return d;
              })()
            : undefined,
        max: range === "7d" ? new Date() : undefined,
      },
    },
    plugins: {
      legend: { labels: { color: "#fff" } },
      tooltip: {
        callbacks: {
          label: (ctx) => `${ctx.parsed.y}% (${ctx.label})`,
        },
      },
    },
  };

  return (
    <div className="w-full h-full bg-gray-900 text-white p-4 overflow-y-auto">
      <h2 className="text-lg font-bold mb-4">Cobertura</h2>

      {/* Barras de cobertura */}
      <div className="flex items-start gap-6 mb-8">
        <div className="grid grid-cols-2 gap-4 flex-grow">
          {[
            ["Cobertura Global", coverageGlobal, "bg-green-500"],
            ["Cobertura Root", coverageRoot, "bg-blue-500"],
          ].map(([label, value, color]) => (
            <div key={label}>
              <div className="flex justify-between mb-1 text-sm">
                <p>{label}</p>
                <p className="font-semibold">{value}%</p>
              </div>
              <div className="w-full bg-gray-700 rounded h-4">
                <div
                  className={`${color} h-4 rounded`}
                  style={{ width: `${value}%` }}
                />
              </div>
            </div>
          ))}
        </div>

        {/* Trend */}
        <div className="flex flex-col items-end">
          <div className="flex items-center gap-2 mb-1">
            <select
              className="bg-gray-800 text-sm px-2 py-1 rounded border border-gray-700 focus:outline-none"
              value={range}
              onChange={(e) => setRange(e.target.value)}
            >
              <option value="day">Último día</option>
              <option value="7d">7 días</option>
              <option value="month">Mes</option>
              <option value="3m">3 meses</option>
              <option value="6m">6 meses</option>
              <option value="1y">1 año</option>
              <option value="all">All time</option>
            </select>
            <span className="text-sm">trend</span>
          </div>
          <p
            className={`text-xl font-bold ${
              dynamicIncrease >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {dynamicIncrease >= 0 ? "+" : ""}
            {dynamicIncrease}%
          </p>
        </div>
      </div>

      <h3 className="text-md font-semibold mb-2">Evolución en el tiempo</h3>
      <div className="h-64">
        <Line data={lineData} options={options} />
      </div>
    </div>
  );
}
