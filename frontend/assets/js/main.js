(() => {
  const apiBase = "/api";
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const factorDefinitions = [
    { key: "aqi", label: "AQI", group: "aqi" },
    { key: "pm25", label: "PM2.5", group: "pollutants" },
    { key: "pm10", label: "PM10", group: "pollutants" },
    { key: "no2", label: "NO2", group: "pollutants" },
    { key: "so2", label: "SO2", group: "pollutants" },
    { key: "co", label: "CO", group: "pollutants" },
    { key: "o3", label: "O3", group: "pollutants" },
    { key: "nh3", label: "NH3", group: "pollutants" },
    { key: "temperature", label: "Temperature", group: "weather" },
    { key: "humidity", label: "Humidity", group: "weather" },
    { key: "wind_speed", label: "Wind Speed", group: "weather" },
    { key: "rainfall", label: "Rainfall", group: "weather" },
    { key: "visibility", label: "Visibility", group: "weather" },
  ];

  const phrasePool = [
    "Analysing pollution patterns",
    "Mapping environmental factors",
    "Evaluating weather influence",
    "Assessing demographic impact",
    "Identifying key contributors",
    "Understanding AQI relationships",
    "Projecting health risks",
    "Optimizing public policy",
  ];

  const introPhraseAnchors = [
    [0.09, 0.18],
    [0.24, 0.72],
    [0.42, 0.22],
    [0.62, 0.78],
    [0.82, 0.24],
    [0.15, 0.56],
    [0.5, 0.88],
    [0.88, 0.62],
  ];

  const state = {
    cities: [],
    selectedCityId: null,
    cityData: null,
    featureImportance: null,
    correlation: null,
    historicalChart: null,
    compareChart: null,
    forecastChart: null,
    fullscreenChart: null,
    factorChart: null,
    map: null,
    markerLayer: null,
    markerByCityId: new Map(),
    selectedFactors: ["aqi"],
    filters: {
      yearStart: null,
      yearEnd: null,
      monthStart: 1,
      monthEnd: 12,
    },
    compareFilters: {
      yearStart: null,
      yearEnd: null,
      monthStart: 1,
      monthEnd: 12,
    },
    modalFilters: {
      yearStart: null,
      yearEnd: null,
      monthStart: 1,
      monthEnd: 12,
    },
    modelIssues: {
      random_forest: null,
      xgboost: null,
    },
    intro: {
      done: false,
      dataReady: false,
      startedAt: 0,
      minMs: 1700,
      maxMs: 3600,
      phraseCursor: 0,
      phraseTicker: null,
      phraseTimeout: null,
    },
  };

  const elements = {
    heroMainTitle: document.getElementById("heroMainTitle"),
    heroStatus: document.getElementById("heroStatus"),
    citySearch: document.getElementById("citySearch"),
    cityOptions: document.getElementById("cityOptions"),
    searchBtn: document.getElementById("searchBtn"),
    quickCityCards: document.getElementById("quickCityCards"),
    dashboard: document.getElementById("dashboard"),
    selectedCityName: document.getElementById("selectedCityName"),
    selectedCityCountry: document.getElementById("selectedCityCountry"),
    dataTill: document.getElementById("dataTill"),
    aqiBadge: document.getElementById("aqiBadge"),
    factorDropdownBtn: document.getElementById("factorDropdownBtn"),
    factorDropdownPanel: document.getElementById("factorDropdownPanel"),
    factorChecklist: document.getElementById("factorChecklist"),
    yearStartValue: document.getElementById("yearStartValue"),
    yearEndValue: document.getElementById("yearEndValue"),
    yearStartRange: document.getElementById("yearStartRange"),
    yearEndRange: document.getElementById("yearEndRange"),
    monthStartValue: document.getElementById("monthStartValue"),
    monthEndValue: document.getElementById("monthEndValue"),
    monthStartRange: document.getElementById("monthStartRange"),
    monthEndRange: document.getElementById("monthEndRange"),
    historicalStatus: document.getElementById("historicalStatus"),
    historicalSkeleton: document.getElementById("historicalSkeleton"),
    historicalChartWrap: document.getElementById("historicalChartWrap"),
    historicalChart: document.getElementById("historicalChart"),
    chartExpandFab: document.getElementById("chartExpandFab"),
    factorTopPollutant: document.getElementById("factorTopPollutant"),
    factorContribution: document.getElementById("factorContribution"),
    factorChart: document.getElementById("factorChart"),
    influenceSubtitle: document.getElementById("influenceSubtitle"),
    positiveInfluenceList: document.getElementById("positiveInfluenceList"),
    negativeInfluenceList: document.getElementById("negativeInfluenceList"),
    toggleCompareBtn: document.getElementById("toggleCompareBtn"),
    compareChartWrap: document.getElementById("compareChartWrap"),
    compareChart: document.getElementById("compareChart"),
    compareYearStartValue: document.getElementById("compareYearStartValue"),
    compareYearEndValue: document.getElementById("compareYearEndValue"),
    compareYearStartRange: document.getElementById("compareYearStartRange"),
    compareYearEndRange: document.getElementById("compareYearEndRange"),
    compareMonthStartValue: document.getElementById("compareMonthStartValue"),
    compareMonthEndValue: document.getElementById("compareMonthEndValue"),
    compareMonthStartRange: document.getElementById("compareMonthStartRange"),
    compareMonthEndRange: document.getElementById("compareMonthEndRange"),
    metricGauges: document.getElementById("metricGauges"),
    predictBtn: document.getElementById("predictBtn"),
    forecastSkeleton: document.getElementById("forecastSkeleton"),
    forecastChartWrap: document.getElementById("forecastChartWrap"),
    forecastChart: document.getElementById("forecastChart"),
    forecastStatus: document.getElementById("forecastStatus"),
    forecastAlerts: document.getElementById("forecastAlerts"),
    chartModal: document.getElementById("chartModal"),
    closeModalBtn: document.getElementById("closeModalBtn"),
    fullscreenChart: document.getElementById("fullscreenChart"),
    modalYearStartValue: document.getElementById("modalYearStartValue"),
    modalYearEndValue: document.getElementById("modalYearEndValue"),
    modalYearStart: document.getElementById("modalYearStart"),
    modalYearEnd: document.getElementById("modalYearEnd"),
    modalMonthStartValue: document.getElementById("modalMonthStartValue"),
    modalMonthEndValue: document.getElementById("modalMonthEndValue"),
    modalMonthStart: document.getElementById("modalMonthStart"),
    modalMonthEnd: document.getElementById("modalMonthEnd"),
    scrollUpBtn: document.getElementById("scrollUpBtn"),
    scrollDownBtn: document.getElementById("scrollDownBtn"),
    citySelectionSection: document.getElementById("citySelectionSection"),
    forecastSection: document.getElementById("forecastSection"),
    modelIssuePopup: document.getElementById("modelIssuePopup"),
    modelIssueList: document.getElementById("modelIssueList"),
    introOverlay: document.getElementById("introOverlay"),
    introTitle: document.getElementById("introTitle"),
    introPhrases: document.getElementById("introPhrases"),
    introCenter: document.querySelector(".intro-center"),
    skipIntroBtn: document.getElementById("skipIntroBtn"),
  };

  function setStatus(node, message) {
    if (node) node.textContent = message;
  }

  function destroyChart(chart) {
    if (chart) chart.destroy();
  }

  function getColorForIndex(index) {
    const palette = ["#1d8a8c", "#c44839", "#3d5a99", "#a98313", "#2f9d6f", "#6b7280", "#0077b6"];
    return palette[index % palette.length];
  }

  function safeCategory(value) {
    if (!value) return "Unknown";
    return String(value);
  }

  function normalizeCategory(category) {
    const value = safeCategory(category).toLowerCase();
    if (value.includes("good")) return "theme-good";
    if (value.includes("moderate")) return "theme-moderate";
    if (value.includes("unhealthy") && !value.includes("very")) return "theme-unhealthy";
    if (value.includes("hazard") || value.includes("very unhealthy")) return "theme-hazardous";
    return "theme-neutral";
  }

  function categoryColor(category) {
    const value = safeCategory(category).toLowerCase();
    if (value.includes("good")) return "#2f9d6f";
    if (value.includes("moderate")) return "#c39a1e";
    if (value.includes("unhealthy") && !value.includes("very")) return "#d27a1d";
    if (value.includes("hazard") || value.includes("very unhealthy")) return "#c44839";
    return "#1d8a8c";
  }

  function applyTheme(category) {
    document.body.classList.remove("theme-good", "theme-moderate", "theme-unhealthy", "theme-hazardous", "theme-neutral");
    document.body.classList.add(normalizeCategory(category));
  }

  async function fetchJson(path) {
    const response = await fetch(path);
    if (!response.ok) {
      const text = await response.text();
      throw new Error(text || `Request failed: ${response.status}`);
    }
    return response.json();
  }

  function updateModelIssue(featureKey, message) {
    if (!Object.prototype.hasOwnProperty.call(state.modelIssues, featureKey)) return;
    state.modelIssues[featureKey] = message || null;
    renderModelPopup();
  }

  function clearAllModelIssues() {
    Object.keys(state.modelIssues).forEach((key) => {
      state.modelIssues[key] = null;
    });
    renderModelPopup();
  }

  function renderModelPopup() {
    const issueMessages = Object.values(state.modelIssues).filter(Boolean);
    if (!issueMessages.length) {
      elements.modelIssuePopup.classList.remove("show");
      elements.modelIssuePopup.classList.add("hidden");
      elements.modelIssueList.innerHTML = "";
      return;
    }

    elements.modelIssueList.innerHTML = "";
    issueMessages.forEach((message) => {
      const item = document.createElement("li");
      item.textContent = message;
      elements.modelIssueList.appendChild(item);
    });

    elements.modelIssuePopup.classList.remove("hidden");
    requestAnimationFrame(() => elements.modelIssuePopup.classList.add("show"));
  }

  function spawnPhrase() {
    if (state.intro.done) return;
    const phrase = document.createElement("span");
    phrase.className = "intro-phrase";
    phrase.textContent = phrasePool[Math.floor(Math.random() * phrasePool.length)];

    state.intro.phraseCursor += 1;
    const x = 0.05 + Math.random() * 0.9;
    const y = 0.08 + Math.random() * 0.84;

    phrase.style.left = `${(x * 100).toFixed(2)}%`;
    phrase.style.top = `${(y * 100).toFixed(2)}%`;
    phrase.style.animationDuration = `${2.4 + Math.random() * 1.5}s`;
    elements.introPhrases.appendChild(phrase);
    setTimeout(() => phrase.remove(), 4400);
  }

  function maybeFinishIntroEarly() {
    if (state.intro.done) return;
    const elapsed = performance.now() - state.intro.startedAt;
    if (elapsed >= state.intro.minMs) {
      completeIntro();
      return;
    }
    setTimeout(() => {
      if (state.intro.dataReady && !state.intro.done) completeIntro();
    }, state.intro.minMs - elapsed);
  }

  function startIntroAnimation() {
    state.intro.startedAt = performance.now();
    spawnPhrase();
    spawnPhrase();
    state.intro.phraseTicker = setInterval(spawnPhrase, 360);
    state.intro.phraseTimeout = setTimeout(() => completeIntro(), state.intro.maxMs);
  }

  function completeIntro() {
    if (state.intro.done) return;
    state.intro.done = true;
    clearInterval(state.intro.phraseTicker);
    clearTimeout(state.intro.phraseTimeout);
    document.body.classList.add("intro-phrases-locked");

    const introRect = elements.introTitle.getBoundingClientRect();
    const targetRect = elements.heroMainTitle.getBoundingClientRect();
    const shiftX = targetRect.left - introRect.left;
    const shiftY = targetRect.top - introRect.top;
    const scale = introRect.width > 0 ? targetRect.width / introRect.width : 1;

    document.body.style.setProperty("--intro-shift-x", `${shiftX}px`);
    document.body.style.setProperty("--intro-shift-y", `${shiftY}px`);
    document.body.style.setProperty("--intro-scale", `${scale}`);
    document.body.classList.add("intro-transitioning");

    setTimeout(() => {
      document.body.classList.remove("app-loading");
      document.body.classList.remove("intro-transitioning");
      document.body.classList.remove("intro-phrases-locked");
      document.body.classList.add("intro-complete");
      if (elements.introOverlay) elements.introOverlay.style.display = "none";
    }, 720);
  }

  function parseMonthInput(raw) {
    const text = String(raw || "").trim().toLowerCase();
    if (!text) return NaN;
    const maybeNum = Number(text);
    if (Number.isFinite(maybeNum)) return maybeNum;

    const idx = monthNames.findIndex((m) => {
      const lower = m.toLowerCase();
      return lower === text || lower.startsWith(text) || lower.slice(0, 3) === text;
    });
    return idx >= 0 ? idx + 1 : NaN;
  }

  function titleCaseWords(text) {
    return String(text || "")
      .replace(/[_-]+/g, " ")
      .trim()
      .split(/\s+/)
      .filter(Boolean)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(" ");
  }

  function initMap() {
    state.map = L.map("cityMap", {
      minZoom: 1,
      maxZoom: 8,
      worldCopyJump: true,
      preferCanvas: true,
    }).setView([20, 10], 2);

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(state.map);

    state.markerLayer = L.layerGroup().addTo(state.map);
  }

  function parseCoordinate(lat, lng) {
    const normalize = (value) => {
      if (typeof value === "number") return value;
      if (typeof value !== "string") return Number(value);
      return Number(value.replace(/,/g, ".").replace(/[^0-9+\-.]/g, "").trim());
    };

    let latNum = normalize(lat);
    let lngNum = normalize(lng);

    if (!Number.isFinite(latNum) || !Number.isFinite(lngNum)) return null;

    if (Math.abs(latNum) > 90 && Math.abs(lngNum) <= 90) {
      const temp = latNum;
      latNum = lngNum;
      lngNum = temp;
    }

    if (Math.abs(latNum) > 90 || Math.abs(lngNum) > 180) return null;
    return { lat: latNum, lng: lngNum };
  }

  function renderMapMarkers(cities) {
    state.markerLayer.clearLayers();
    state.markerByCityId.clear();

    const bounds = [];

    cities.forEach((city) => {
      const coord = parseCoordinate(city.lat, city.lng);
      if (!coord) return;

      const marker = L.circleMarker([coord.lat, coord.lng], {
        radius: 3.6,
        color: "#ffffff",
        weight: 0.8,
        fillColor: categoryColor(city.latest_category),
        fillOpacity: 0.85,
      });

      marker.bindTooltip(`<strong>${city.city_name}</strong><br/>${city.country_name || "Unknown"}<br/>AQI: ${city.latest_aqi ?? "N/A"}`);
      marker.on("click", () => selectCity(city.city_id));
      marker.addTo(state.markerLayer);

      state.markerByCityId.set(city.city_id, marker);
      bounds.push([coord.lat, coord.lng]);
    });

    if (bounds.length) {
      state.map.fitBounds(bounds, { padding: [18, 18], maxZoom: 3 });
    }
  }

  function zoomToCity(cityId) {
    const marker = state.markerByCityId.get(cityId);
    if (!marker) return;
    const latLng = marker.getLatLng();
    state.map.flyTo(latLng, Math.max(state.map.getZoom(), 5), { duration: 0.8 });
    marker.openTooltip();
  }

  function renderCityOptions(cities) {
    elements.cityOptions.innerHTML = "";
    const fragment = document.createDocumentFragment();
    cities.forEach((city) => {
      const option = document.createElement("option");
      option.value = `${city.city_name}, ${city.country_name}`;
      fragment.appendChild(option);
    });
    elements.cityOptions.appendChild(fragment);
  }

  function renderQuickCards(cities) {
    elements.quickCityCards.innerHTML = "";
    const normalized = (text) => String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const cityPool = [...cities].filter((x) => typeof x.latest_aqi === "number");

    const findCity = (cityName, countryName = null) => {
      const cityKey = normalized(cityName);
      const countryKey = countryName ? normalized(countryName) : null;
      return cityPool.find((row) => {
        const rowCity = normalized(row.city_name);
        if (rowCity !== cityKey) return false;
        if (!countryKey) return true;
        return normalized(row.country_name) === countryKey;
      }) || null;
    };

    const picked = [];
    const seen = new Set();
    const pushUnique = (row) => {
      if (!row || seen.has(row.city_id)) return;
      picked.push(row);
      seen.add(row.city_id);
    };

    ["Delhi", "Mumbai", "Pune", "Ghaziabad"].forEach((name) => pushUnique(findCity(name)));
    pushUnique(findCity("Kuwait City"));
    pushUnique(findCity("Colombo", "Sri Lanka"));

    const fallback = cityPool
      .filter((row) => !seen.has(row.city_id))
      .sort((a, b) => {
        const aIntl = normalized(a.country_name) === "india" ? 1 : 0;
        const bIntl = normalized(b.country_name) === "india" ? 1 : 0;
        if (aIntl !== bIntl) return aIntl - bIntl;
        return (b.latest_aqi || 0) - (a.latest_aqi || 0);
      });

    fallback.forEach((row) => {
      if (picked.length < 8) pushUnique(row);
    });

    const cards = picked.slice(0, 8);

    cards.forEach((city) => {
      const node = document.createElement("article");
      node.className = "city-card";
      node.innerHTML = `<h4>${city.city_name}</h4><p>${city.country_name || "Unknown"}</p><p>AQI ${Math.round(city.latest_aqi)} • ${city.latest_category || "Unknown"}</p>`;
      node.addEventListener("click", () => selectCity(city.city_id));
      elements.quickCityCards.appendChild(node);
    });
  }

  function renderFactorChecklist() {
    elements.factorChecklist.innerHTML = "";

    factorDefinitions.forEach((factor) => {
      const label = document.createElement("label");
      label.className = "factor-item";

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = factor.key;
      input.checked = state.selectedFactors.includes(factor.key);
      input.addEventListener("change", () => {
        if (input.checked) {
          if (!state.selectedFactors.includes(factor.key)) state.selectedFactors.push(factor.key);
        } else {
          state.selectedFactors = state.selectedFactors.filter((x) => x !== factor.key);
          if (!state.selectedFactors.length) {
            state.selectedFactors = ["aqi"];
            input.checked = true;
          }
        }
        updateFactorButtonText();
        renderHistoricalChart();
      });

      const txt = document.createElement("span");
      txt.textContent = factor.label;
      label.appendChild(input);
      label.appendChild(txt);
      elements.factorChecklist.appendChild(label);
    });

    updateFactorButtonText();
  }

  function updateFactorButtonText() {
    const count = state.selectedFactors.length;
    elements.factorDropdownBtn.textContent = `Factors Selected: ${count}`;
  }

  function positionFactorDropdown() {
    const rect = elements.factorDropdownBtn.getBoundingClientRect();
    const panelWidth = Math.min(420, window.innerWidth - 24);
    const left = Math.max(12, Math.min(rect.left, window.innerWidth - panelWidth - 12));
    elements.factorDropdownPanel.style.left = `${left}px`;
    elements.factorDropdownPanel.style.top = `${rect.bottom + 8}px`;
  }

  function bindDualRange(config) {
    const {
      startEl,
      endEl,
      startValueEl,
      endValueEl,
      min,
      max,
      onChange,
      format = (v) => String(v),
      parse = (raw) => Number(raw),
    } = config;

    startEl.min = String(min);
    startEl.max = String(max);
    endEl.min = String(min);
    endEl.max = String(max);

    startEl.value = String(min);
    endEl.value = String(max);

    const clamp = (value) => Math.max(min, Math.min(max, value));

    const bringHandleToFront = (handle) => {
      if (handle === "start") {
        startEl.style.zIndex = "3";
        endEl.style.zIndex = "2";
      } else {
        startEl.style.zIndex = "2";
        endEl.style.zIndex = "3";
      }
    };

    const sync = (activeHandle = "start") => {
      let s = Number(startEl.value);
      let e = Number(endEl.value);
      if (s > e) {
        if (activeHandle === "start") {
          e = s;
          endEl.value = String(e);
        } else {
          s = e;
          startEl.value = String(s);
        }
      }
      startValueEl.value = format(s);
      endValueEl.value = format(e);
      onChange(s, e);
    };

    const commitValueInput = (target) => {
      const input = target === "start" ? startValueEl : endValueEl;
      const parsed = parse(input.value);
      if (!Number.isFinite(parsed)) {
        sync(target);
        return;
      }

      const value = Math.round(clamp(parsed));
      if (target === "start") {
        startEl.value = String(value);
      } else {
        endEl.value = String(value);
      }
      sync(target);
    };

    const liveValueInput = (target) => {
      const input = target === "start" ? startValueEl : endValueEl;
      const parsed = parse(input.value);
      if (!Number.isFinite(parsed)) return;

      const value = Math.round(clamp(parsed));
      if (target === "start") {
        startEl.value = String(value);
      } else {
        endEl.value = String(value);
      }
      sync(target);
    };

    startEl.addEventListener("input", () => {
      bringHandleToFront("start");
      sync("start");
    });
    endEl.addEventListener("input", () => {
      bringHandleToFront("end");
      sync("end");
    });

    ["mousedown", "touchstart", "focus"].forEach((evt) => {
      startEl.addEventListener(evt, () => bringHandleToFront("start"), { passive: true });
      endEl.addEventListener(evt, () => bringHandleToFront("end"), { passive: true });
    });

    ["change", "blur"].forEach((evt) => {
      startValueEl.addEventListener(evt, () => commitValueInput("start"));
      endValueEl.addEventListener(evt, () => commitValueInput("end"));
    });

    startValueEl.addEventListener("input", () => liveValueInput("start"));
    endValueEl.addEventListener("input", () => liveValueInput("end"));

    const isMonthParser = parse === parseMonthInput;

    [startValueEl, endValueEl].forEach((input) => {
      if (!isMonthParser) input.setAttribute("inputmode", "numeric");
      input.setAttribute("autocomplete", "off");
      input.setAttribute("spellcheck", "false");
      input.addEventListener("focus", () => input.select());
    });

    startValueEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitValueInput("start");
      }
    });

    endValueEl.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        commitValueInput("end");
      }
    });

    bringHandleToFront("end");
    sync("start");
  }

  function getDemographicByYear() {
    const map = new Map();
    (state.cityData?.demographics || []).forEach((row) => {
      if (Number.isFinite(row.year)) map.set(Number(row.year), row);
    });
    return map;
  }

  function getFactorLabel(key) {
    return factorDefinitions.find((f) => f.key === key)?.label || key;
  }

  function getFactorValue(row, factorKey) {
    if (!row) return null;
    if (factorKey === "aqi") return Number.isFinite(row.aqi) ? row.aqi : null;

    if (["pm25", "pm10", "no2", "so2", "co", "o3", "nh3"].includes(factorKey)) {
      const val = row.pollutants?.[factorKey];
      return Number.isFinite(val) ? val : null;
    }

    const weatherVal = row.weather?.[factorKey];
    return Number.isFinite(weatherVal) ? weatherVal : null;
  }

  function getHistoricalFilteredRows() {
    let rows = [...(state.cityData?.historical || [])];
    rows = rows.filter((row) => {
      if (!Number.isFinite(row.year) || !Number.isFinite(row.month_number)) return false;
      if (row.year < state.filters.yearStart || row.year > state.filters.yearEnd) return false;
      if (row.month_number < state.filters.monthStart || row.month_number > state.filters.monthEnd) return false;
      return true;
    });
    rows.sort((a, b) => (a.year - b.year) || (a.month_number - b.month_number));
    return rows;
  }

  function renderHistoricalChart() {
    const rows = getHistoricalFilteredRows();
    if (!rows.length) {
      setStatus(elements.historicalStatus, "No data available for selected range.");
      return;
    }

    elements.historicalSkeleton.classList.add("hidden");
    elements.historicalChartWrap.classList.remove("hidden");

    const labels = rows.map((row) => `${monthNames[(row.month_number || 1) - 1].slice(0, 3)} ${row.year}`);
    const datasets = state.selectedFactors.map((factor, idx) => ({
      label: getFactorLabel(factor),
      data: rows.map((row) => getFactorValue(row, factor)),
      borderColor: getColorForIndex(idx),
      backgroundColor: "transparent",
      fill: false,
      borderWidth: 2.2,
      pointRadius: 1.7,
      tension: 0.26,
    }));

    if (!datasets.length || datasets.every((d) => d.data.every((v) => v == null))) {
      setStatus(elements.historicalStatus, "No values for selected factors in this range.");
      return;
    }

    destroyChart(state.historicalChart);
    state.historicalChart = new Chart(elements.historicalChart, {
      type: "line",
      data: { labels, datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        scales: {
          x: {
            ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 12 },
          },
        },
      },
    });

    setStatus(elements.historicalStatus, "Historical chart updated.");
  }

  function renderHeader() {
    const city = state.cityData?.city || {};
    const latestAqi = state.cityData?.latest_aqi;
    const latestCategory = safeCategory(state.cityData?.latest_category);

    elements.selectedCityName.textContent = city.city_name || "Unknown city";
    elements.selectedCityCountry.textContent = `${city.country_name || "Unknown country"}${city.state ? ` • ${city.state}` : ""}`;
    elements.aqiBadge.textContent = `AQI ${latestAqi != null ? Math.round(latestAqi) : "-"} • ${latestCategory}`;
    elements.dataTill.textContent = `Data available till ${state.cityData?.meta?.data_available_till || "-"}`;
    applyTheme(latestCategory);
  }

  function renderFactorAnalysis() {
    const payload = state.featureImportance;
    if (!payload?.feature_importance?.length) {
      elements.factorTopPollutant.textContent = "Not available";
      elements.factorContribution.textContent = "Run Notebook 1 to generate feature importance artifacts.";
      destroyChart(state.factorChart);
      return;
    }

    const top = payload.feature_importance[0];
    const topVal = Number(top.importance);
    const pct = Number.isFinite(topVal) ? (topVal <= 1 ? topVal * 100 : topVal) : 0;

    elements.factorTopPollutant.textContent = top.pollutant;
    elements.factorContribution.textContent = `Contribution score: ${pct.toFixed(2)}%`;

    const rows = payload.feature_importance.slice(0, 8);
    const labels = rows.map((r) => r.pollutant);
    const values = rows.map((r) => {
      const n = Number(r.importance);
      return Number.isFinite(n) ? (n <= 1 ? n * 100 : n) : 0;
    });

    destroyChart(state.factorChart);
    state.factorChart = new Chart(elements.factorChart, {
      type: "pie",
      data: {
        labels,
        datasets: [
          {
            data: values,
            backgroundColor: labels.map((_, idx) => getColorForIndex(idx)),
            borderColor: "#ffffff",
            borderWidth: 1,
            hoverOffset: 16,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: true,
            position: "bottom",
            labels: { boxWidth: 12 },
          },
          tooltip: {
            callbacks: {
              label(ctx) {
                const label = ctx.label || "";
                const val = Number(ctx.raw || 0);
                return `${label}: ${val.toFixed(2)}%`;
              },
            },
          },
        },
      },
    });
  }

  function renderInfluenceList(node, data) {
    node.innerHTML = "";
    if (!Array.isArray(data) || !data.length) {
      const item = document.createElement("li");
      item.textContent = "No strong signal found.";
      node.appendChild(item);
      return;
    }

    data.slice(0, 8).forEach((row) => {
      const item = document.createElement("li");
      item.textContent = `${titleCaseWords(row.factor)}: ${row.correlation.toFixed(3)}`;
      node.appendChild(item);
    });
  }

  function renderCorrelation() {
    const payload = state.correlation;
    if (!payload) {
      elements.influenceSubtitle.textContent = "Correlation data not available.";
      renderInfluenceList(elements.positiveInfluenceList, []);
      renderInfluenceList(elements.negativeInfluenceList, []);
      return;
    }

    elements.influenceSubtitle.textContent = `Selected pollutant: ${payload.selected_pollutant || "-"}`;
    renderInfluenceList(elements.positiveInfluenceList, payload.positive_influence || []);
    renderInfluenceList(elements.negativeInfluenceList, payload.negative_influence || []);
  }

  function getComparisonRows() {
    return [...(state.correlation?.comparison_trends || [])]
      .filter((row) => {
        if (!Number.isFinite(row.year) || !Number.isFinite(row.month_number)) return false;
        if (row.year < state.compareFilters.yearStart || row.year > state.compareFilters.yearEnd) return false;
        if (row.month_number < state.compareFilters.monthStart || row.month_number > state.compareFilters.monthEnd) return false;
        return true;
      })
      .sort((a, b) => (a.year - b.year) || (a.month_number - b.month_number));
  }

  function renderComparisonChart() {
    const rows = getComparisonRows();
    if (!rows.length) {
      setStatus(elements.historicalStatus, "No comparison trend data in selected range.");
      return;
    }

    const labels = rows.map((row) => `${monthNames[(row.month_number || 1) - 1].slice(0, 3)} ${row.year}`);
    const factorKeys = Object.keys(rows[0].factors || {});

    const datasets = [
      {
        label: state.correlation?.selected_pollutant || "Selected Pollutant",
        data: rows.map((row) => row.pollutant),
        borderColor: "#1d8a8c",
        fill: false,
        tension: 0.25,
      },
    ];

    factorKeys.forEach((key, idx) => {
      datasets.push({
        label: titleCaseWords(key),
        data: rows.map((row) => row.factors[key]),
        borderColor: getColorForIndex(idx + 1),
        fill: false,
        tension: 0.25,
      });
    });

    const minWidth = Math.max(760, labels.length * 54);
    elements.compareChart.width = minWidth;
    elements.compareChart.height = 330;

    destroyChart(state.compareChart);
    state.compareChart = new Chart(elements.compareChart, {
      type: "line",
      data: { labels, datasets },
      options: { responsive: false, maintainAspectRatio: false },
    });
  }

  function animateGauge(track, pct) {
    const target = Math.max(0, Math.min(100, pct));
    let current = 0;
    function step() {
      current += (target - current) * 0.14;
      track.style.setProperty("--value", current.toFixed(2));
      if (Math.abs(target - current) > 0.25) {
        requestAnimationFrame(step);
      } else {
        track.style.setProperty("--value", target.toFixed(2));
      }
    }
    requestAnimationFrame(step);
  }

  function compactNum(value) {
    if (!Number.isFinite(value)) return "-";
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(2)}K`;
    return `${Math.round(value)}`;
  }

  function gaugeColorFromRatio(ratio) {
    const pct = Math.max(0, Math.min(100, ratio));
    const hue = 192 - pct * 0.55;
    const sat = 45 + pct * 0.2;
    const light = 66 - pct * 0.12;
    return `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${light.toFixed(0)}%)`;
  }

  function renderGauges() {
    elements.metricGauges.innerHTML = "";

    const demoRows = [...(state.cityData?.demographics || [])]
      .filter((r) => Number.isFinite(r.year))
      .sort((a, b) => a.year - b.year);

    const latestDemo = demoRows[demoRows.length - 1];

    if (!latestDemo) return;

    const maxFromRows = (key) => {
      const vals = demoRows.map((r) => Number(r[key])).filter(Number.isFinite);
      return vals.length ? Math.max(...vals) : 0;
    };

    const withHeadroom = (value) => {
      if (!Number.isFinite(value) || value <= 0) return 1;
      return value * 1.12;
    };

    const gauges = [
      {
        key: "urbanization_pct",
        label: "Urbanization",
        max: 100,
        fmt: (v) => `${v.toFixed(2)}%`,
        scaleFmt: (v) => `${Math.round(v)}%`,
        unit: "Percent",
      },
      {
        key: "population",
        label: "Population",
        max: withHeadroom(maxFromRows("population")),
        fmt: compactNum,
        scaleFmt: compactNum,
        unit: "Residents",
      },
      {
        key: "population_density",
        label: "Population Density",
        max: withHeadroom(maxFromRows("population_density")),
        fmt: compactNum,
        scaleFmt: compactNum,
        unit: "per sq km",
      },
      {
        key: "industrial_area_pct",
        label: "Industrial Area",
        max: 100,
        fmt: (v) => `${v.toFixed(2)}%`,
        scaleFmt: (v) => `${Math.round(v)}%`,
        unit: "Percent",
      },
      {
        key: "vehicle_count",
        label: "Vehicle Count",
        max: withHeadroom(maxFromRows("vehicle_count")),
        fmt: compactNum,
        scaleFmt: compactNum,
        unit: "Vehicles",
      },
    ];

    gauges.forEach((g, idx) => {
      const val = Number(latestDemo[g.key]);
      const safe = Number.isFinite(val) ? val : 0;
      const ratio = (safe / g.max) * 100;
      const card = document.createElement("div");
      card.className = "gauge-card";
      card.innerHTML = `
        <p class="gauge-label">${g.label}</p>
        <div class="gauge">
          <div class="gauge-fill" style="--value: 0; background: conic-gradient(from 270deg, ${Number.isFinite(val) ? gaugeColorFromRatio(ratio + idx * 4) : "#d8e1eb"} calc(var(--value) * 1.8deg), transparent 0);"></div>
          <div class="gauge-cover">
            <span class="gauge-value">${Number.isFinite(val) ? g.fmt(safe) : "-"}</span>
          </div>
        </div>
      `;
      elements.metricGauges.appendChild(card);
      const fillEl = card.querySelector(".gauge-fill");
      animateGauge(fillEl, ratio);
    });
  }

  function configureMainRanges() {
    const years = [...new Set((state.cityData?.historical || []).map((r) => r.year).filter(Number.isFinite))].sort((a, b) => a - b);
    if (!years.length) return;

    state.filters.yearStart = years[0];
    state.filters.yearEnd = years[years.length - 1];
    state.filters.monthStart = 1;
    state.filters.monthEnd = 12;

    bindDualRange({
      startEl: elements.yearStartRange,
      endEl: elements.yearEndRange,
      startValueEl: elements.yearStartValue,
      endValueEl: elements.yearEndValue,
      min: years[0],
      max: years[years.length - 1],
      format: (v) => String(v),
      parse: (raw) => Number.parseInt(String(raw).trim(), 10),
      onChange: (s, e) => {
        state.filters.yearStart = s;
        state.filters.yearEnd = e;
        renderHistoricalChart();
      },
    });

    bindDualRange({
      startEl: elements.monthStartRange,
      endEl: elements.monthEndRange,
      startValueEl: elements.monthStartValue,
      endValueEl: elements.monthEndValue,
      min: 1,
      max: 12,
      format: (v) => monthNames[v - 1],
      parse: parseMonthInput,
      onChange: (s, e) => {
        state.filters.monthStart = s;
        state.filters.monthEnd = e;
        renderHistoricalChart();
      },
    });

    state.compareFilters.yearStart = years[0];
    state.compareFilters.yearEnd = years[years.length - 1];
    state.compareFilters.monthStart = 1;
    state.compareFilters.monthEnd = 12;

    bindDualRange({
      startEl: elements.compareYearStartRange,
      endEl: elements.compareYearEndRange,
      startValueEl: elements.compareYearStartValue,
      endValueEl: elements.compareYearEndValue,
      min: years[0],
      max: years[years.length - 1],
      format: (v) => String(v),
      parse: (raw) => Number.parseInt(String(raw).trim(), 10),
      onChange: (s, e) => {
        state.compareFilters.yearStart = s;
        state.compareFilters.yearEnd = e;
        if (!elements.compareChartWrap.classList.contains("hidden")) renderComparisonChart();
      },
    });

    bindDualRange({
      startEl: elements.compareMonthStartRange,
      endEl: elements.compareMonthEndRange,
      startValueEl: elements.compareMonthStartValue,
      endValueEl: elements.compareMonthEndValue,
      min: 1,
      max: 12,
      format: (v) => monthNames[v - 1],
      parse: parseMonthInput,
      onChange: (s, e) => {
        state.compareFilters.monthStart = s;
        state.compareFilters.monthEnd = e;
        if (!elements.compareChartWrap.classList.contains("hidden")) renderComparisonChart();
      },
    });

    state.modalFilters.yearStart = years[0];
    state.modalFilters.yearEnd = years[years.length - 1];
    state.modalFilters.monthStart = 1;
    state.modalFilters.monthEnd = 12;

    bindDualRange({
      startEl: elements.modalYearStart,
      endEl: elements.modalYearEnd,
      startValueEl: elements.modalYearStartValue,
      endValueEl: elements.modalYearEndValue,
      min: years[0],
      max: years[years.length - 1],
      format: (v) => String(v),
      parse: (raw) => Number.parseInt(String(raw).trim(), 10),
      onChange: (s, e) => {
        state.modalFilters.yearStart = s;
        state.modalFilters.yearEnd = e;
        if (!elements.chartModal.classList.contains("hidden")) renderFullscreenChart();
      },
    });

    bindDualRange({
      startEl: elements.modalMonthStart,
      endEl: elements.modalMonthEnd,
      startValueEl: elements.modalMonthStartValue,
      endValueEl: elements.modalMonthEndValue,
      min: 1,
      max: 12,
      format: (v) => monthNames[v - 1],
      parse: parseMonthInput,
      onChange: (s, e) => {
        state.modalFilters.monthStart = s;
        state.modalFilters.monthEnd = e;
        if (!elements.chartModal.classList.contains("hidden")) renderFullscreenChart();
      },
    });
  }

  function renderFullscreenChart() {
    const rows = [...(state.cityData?.historical || [])]
      .filter((row) => {
        if (!Number.isFinite(row.year) || !Number.isFinite(row.month_number)) return false;
        if (row.year < state.modalFilters.yearStart || row.year > state.modalFilters.yearEnd) return false;
        if (row.month_number < state.modalFilters.monthStart || row.month_number > state.modalFilters.monthEnd) return false;
        return true;
      })
      .sort((a, b) => (a.year - b.year) || (a.month_number - b.month_number));

    if (!rows.length) return;

    const labels = rows.map((r) => `${monthNames[(r.month_number || 1) - 1].slice(0, 3)} ${r.year}`);
    const datasets = state.selectedFactors.map((factor, idx) => ({
      label: getFactorLabel(factor),
      data: rows.map((r) => getFactorValue(r, factor)),
      borderColor: getColorForIndex(idx),
      fill: false,
      tension: 0.25,
      pointRadius: 1.5,
    }));

    destroyChart(state.fullscreenChart);
    state.fullscreenChart = new Chart(elements.fullscreenChart, {
      type: "line",
      data: { labels, datasets },
      options: { responsive: true, maintainAspectRatio: false },
    });
  }

  async function loadDashboard(cityId) {
    state.selectedCityId = cityId;
    clearAllModelIssues();

    elements.dashboard.classList.remove("hidden");
    elements.historicalSkeleton.classList.remove("hidden");
    elements.historicalChartWrap.classList.add("hidden");
    elements.forecastChartWrap.classList.add("hidden");
    elements.forecastSkeleton.classList.add("hidden");
    elements.forecastAlerts.innerHTML = "";

    setStatus(elements.historicalStatus, "Fetching environmental data...");
    setStatus(elements.forecastStatus, "");

    try {
      const [cityData, featureImportance, correlation] = await Promise.all([
        fetchJson(`${apiBase}/get_city_data?city_id=${cityId}`),
        fetchJson(`${apiBase}/get_feature_importance?city_id=${cityId}`),
        fetchJson(`${apiBase}/get_pollutant_correlation?city_id=${cityId}`),
      ]);

      state.cityData = cityData;
      state.featureImportance = featureImportance;
      state.correlation = correlation;

      const rfStatus = featureImportance?.model_status;
      if (rfStatus?.fallback_used || rfStatus?.model_unavailable) {
        const reason = rfStatus?.unavailable_reason || featureImportance?.fallback_reason || "using global default contribution values.";
        updateModelIssue("random_forest", `Random Forest fallback active; ${reason}`);
      }

      renderHeader();
      configureMainRanges();
      renderHistoricalChart();
      renderFactorAnalysis();
      renderCorrelation();
      renderGauges();
      setStatus(elements.heroStatus, `Loaded dashboard for ${cityData.city.city_name}.`);
    } catch (error) {
      setStatus(elements.historicalStatus, "Failed to load dashboard data.");
      setStatus(elements.heroStatus, `Error: ${error.message}`);
    }
  }

  async function selectCity(cityId) {
    const city = state.cities.find((row) => row.city_id === cityId);
    if (city) {
      elements.citySearch.value = `${city.city_name}, ${city.country_name || ""}`;
      setStatus(elements.heroStatus, `Loading ${city.city_name} dashboard...`);
      zoomToCity(city.city_id);
    }

    await loadDashboard(cityId);
    const dashboardTop = elements.dashboard.getBoundingClientRect().top + window.scrollY - 20;
    window.scrollTo({ top: dashboardTop, behavior: "smooth" });
  }

  async function loadForecast() {
    if (!state.selectedCityId) return;

    elements.forecastSkeleton.classList.remove("hidden");
    elements.forecastChartWrap.classList.add("hidden");
    elements.forecastAlerts.innerHTML = "";
    setStatus(elements.forecastStatus, "Analyzing future trends using ML...");

    try {
      const payload = await fetchJson(`${apiBase}/predict_aqi?city_id=${state.selectedCityId}&horizon=12`);
      const predictions = payload.predictions || [];

      if (!predictions.length) {
        setStatus(elements.forecastStatus, "Prediction data unavailable for this city.");
        return;
      }

      const labels = predictions.map((p) => `${String(p.month).slice(0, 3)} ${p.year}`);
      const values = predictions.map((p) => p.predicted_aqi);

      destroyChart(state.forecastChart);
      state.forecastChart = new Chart(elements.forecastChart, {
        type: "line",
        data: {
          labels,
          datasets: [
            {
              label: "Predicted AQI",
              data: values,
              borderColor: "#c44839",
              backgroundColor: "rgba(196, 72, 57, 0.13)",
              borderWidth: 2.4,
              fill: true,
              tension: 0.26,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              onClick: () => {},
            },
          },
        },
      });

      elements.forecastSkeleton.classList.add("hidden");
      elements.forecastChartWrap.classList.remove("hidden");

      const xgbStatus = payload?.model_status;
      if (xgbStatus?.fallback_used || xgbStatus?.model_unavailable || payload.model_unavailable || payload.source === "precomputed") {
        const reason = xgbStatus?.unavailable_reason || payload.warning || "using notebook precomputed forecast values.";
        updateModelIssue("xgboost", `XGBoost fallback active; ${reason}`);
      } else {
        updateModelIssue("xgboost", null);
      }

      setStatus(
        elements.forecastStatus,
        payload.source === "live_model"
          ? "Forecast generated using live XGBoost model."
          : "Forecast generated from precomputed notebook values."
      );

      (payload.alerts || []).slice(0, 4).forEach((alert) => {
        const item = document.createElement("div");
        item.className = "alert-item";
        item.textContent = `Alert: ${alert.month} ${alert.year} may reach AQI ${Math.round(alert.predicted_aqi)} (${alert.predicted_category}).`;
        elements.forecastAlerts.appendChild(item);
      });
    } catch (_error) {
      elements.forecastSkeleton.classList.add("hidden");
      setStatus(elements.forecastStatus, "Failed to generate forecast.");
      updateModelIssue("xgboost", "XGBoost forecast is unavailable; live model and fallback predictions are missing.");
    }
  }

  function openFullscreenChart() {
    if (!state.cityData?.historical?.length) return;
    elements.chartModal.classList.remove("hidden");
    elements.chartModal.setAttribute("aria-hidden", "false");
    renderFullscreenChart();
  }

  function closeFullscreenChart() {
    elements.chartModal.classList.add("hidden");
    elements.chartModal.setAttribute("aria-hidden", "true");
  }

  function getCityFromSearch() {
    const query = elements.citySearch.value.trim().toLowerCase();
    if (!query) return null;

    const exact = state.cities.find((city) => `${city.city_name}, ${city.country_name || ""}`.toLowerCase() === query);
    if (exact) return exact;

    return state.cities.find(
      (city) => city.city_name.toLowerCase().includes(query) || (city.country_name || "").toLowerCase().includes(query)
    );
  }

  function updateScrollButtons() {
    if (window.scrollY > 240) {
      elements.scrollUpBtn.classList.remove("hidden");
      elements.scrollDownBtn.classList.remove("hidden");
    } else {
      elements.scrollUpBtn.classList.add("hidden");
      elements.scrollDownBtn.classList.add("hidden");
    }
  }

  function attachEvents() {
    elements.searchBtn.addEventListener("click", () => {
      const city = getCityFromSearch();
      if (!city) {
        setStatus(elements.heroStatus, "City not found in loaded index.");
        return;
      }
      selectCity(city.city_id);
    });

    elements.citySearch.addEventListener("keydown", (event) => {
      if (event.key === "Enter") {
        event.preventDefault();
        elements.searchBtn.click();
      }
    });

    elements.factorDropdownBtn.addEventListener("click", () => {
      const willOpen = elements.factorDropdownPanel.classList.contains("hidden");
      if (willOpen) {
        positionFactorDropdown();
        elements.factorDropdownPanel.classList.remove("hidden");
      } else {
        elements.factorDropdownPanel.classList.add("hidden");
      }
    });

    document.addEventListener("click", (event) => {
      const clickedButton = event.target === elements.factorDropdownBtn;
      const clickedInsidePanel = elements.factorDropdownPanel.contains(event.target);
      if (!clickedButton && !clickedInsidePanel) {
        elements.factorDropdownPanel.classList.add("hidden");
      }
    });

    window.addEventListener("resize", () => {
      if (!elements.factorDropdownPanel.classList.contains("hidden")) {
        positionFactorDropdown();
      }
    });

    elements.toggleCompareBtn.addEventListener("click", () => {
      const hidden = elements.compareChartWrap.classList.contains("hidden");
      if (hidden) {
        elements.compareChartWrap.classList.remove("hidden");
        renderComparisonChart();
        elements.toggleCompareBtn.textContent = "Hide Comparison";
      } else {
        elements.compareChartWrap.classList.add("hidden");
        elements.toggleCompareBtn.textContent = "Compare Trends";
      }
    });

    elements.predictBtn.addEventListener("click", loadForecast);

    elements.chartExpandFab.addEventListener("click", openFullscreenChart);
    elements.closeModalBtn.addEventListener("click", closeFullscreenChart);
    elements.chartModal.addEventListener("click", (event) => {
      if (event.target === elements.chartModal) closeFullscreenChart();
    });

    elements.scrollUpBtn.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });

    elements.scrollDownBtn.addEventListener("click", () => {
      const target = elements.forecastSection.getBoundingClientRect().top + window.scrollY - 20;
      window.scrollTo({ top: target, behavior: "smooth" });
    });

    window.addEventListener("scroll", updateScrollButtons, { passive: true });

    elements.skipIntroBtn.addEventListener("click", () => {
      state.intro.dataReady = true;
      completeIntro();
    });
  }

  async function loadCities() {
    try {
      setStatus(elements.heroStatus, "Loading city index and map markers...");
      const payload = await fetchJson(`${apiBase}/cities?limit=2200`);
      state.cities = payload.cities || [];

      renderCityOptions(state.cities);
      renderQuickCards(state.cities);
      renderMapMarkers(state.cities);

      setStatus(elements.heroStatus, `Loaded ${state.cities.length} cities. Search or click a marker/card to continue.`);
    } catch (_error) {
      setStatus(elements.heroStatus, "Failed to load city list. Start Flask server and retry.");
    } finally {
      state.intro.dataReady = true;
      maybeFinishIntroEarly();
    }
  }

  async function boot() {
    startIntroAnimation();
    initMap();
    attachEvents();
    renderFactorChecklist();
    await loadCities();
    updateScrollButtons();
  }

  boot();
})();
