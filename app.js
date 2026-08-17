"use strict";

/*
 * =========================================================
 * CABANGILE DRAMA BUILDER
 * OMNIROUTE FRONTEND
 * =========================================================
 *
 * Browser frontend.
 *
 * IMPORTANT:
 * The browser does NOT import OmniRoute CLI files such as:
 *
 *   bin/cli/api.mjs
 *   bin/cli/runtime.mjs
 *   bin/cli/provider-store.mjs
 *
 * Those are server-side Node modules.
 *
 * This frontend communicates with the HTTP backend.
 *
 * Default API:
 *
 *   /api/health
 *   /v1/providers
 *   /api/create-drama
 *
 * If your backend uses a different public API path,
 * change the API_CONFIG values below.
 * =========================================================
 */


/* =========================================================
   CONFIGURATION
   ========================================================= */

const API_CONFIG = {

  /*
   * Empty string means:
   *
   *     use the same GitHub/backend origin
   *
   * This is correct when your frontend is served by
   * the same backend.
   *
   * If your backend is hosted elsewhere, set for example:
   *
   * API_BASE: "https://your-backend.example.com"
   */
  API_BASE: "",

  HEALTH: "/api/health",

  PROVIDERS: "/v1/providers",

  CREATE_DRAMA: "/api/create-drama",

  REQUEST_TIMEOUT: 120000

};


/* =========================================================
   STATE
   ========================================================= */

const state = {

  providers: [],

  selectedProvider: "",

  selectedModel: "",

  busy: false,

  health: null,

  lastResult: null,

  logs: []

};


/* =========================================================
   DOM HELPERS
   ========================================================= */

const $ = (id) => document.getElementById(id);

const elements = {

  backendStatus: $("backendStatus"),

  runtimeStatus: $("runtimeStatus"),

  idea: $("idea"),

  provider: $("provider"),

  model: $("model"),

  scenes: $("scenes"),

  createBtn: $("createBtn"),

  exampleBtn: $("exampleBtn"),

  resetBtn: $("resetBtn"),

  progressCard: $("progressCard"),

  progressBar: $("progressBar"),

  progressText: $("progressText"),

  resultCard: $("resultCard"),

  result: $("result"),

  providersList: $("providersList"),

  statusBackend: $("statusBackend"),

  statusOmniRoute: $("statusOmniRoute"),

  statusProviders: $("statusProviders"),

  statusRuntime: $("statusRuntime"),

  healthOutput: $("healthOutput"),

  console: $("console"),

  clearBtn: $("clearBtn")

};


/* =========================================================
   API URL
   ========================================================= */

function apiUrl(path) {

  const base = API_CONFIG.API_BASE.trim();

  if (!base) {
    return path;
  }

  return `${base.replace(/\/$/, "")}/${path.replace(/^\//, "")}`;

}


/* =========================================================
   LOGGING
   ========================================================= */

function log(message, type = "info") {

  const now = new Date();

  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });

  state.logs.push({
    time,
    message,
    type
  });

  if (state.logs.length > 300) {
    state.logs.shift();
  }

  renderConsole();

}


function renderConsole() {

  if (!elements.console) {
    return;
  }

  elements.console.innerHTML = "";

  for (const item of state.logs) {

    const line = document.createElement("div");

    line.className = `console-line ${item.type}`;

    const prefix = document.createElement("span");

    prefix.textContent = "›";

    const text = document.createElement("span");

    text.textContent =
      `[${item.time}] ${item.message}`;

    line.appendChild(prefix);
    line.appendChild(text);

    elements.console.appendChild(line);
  }

  elements.console.scrollTop =
    elements.console.scrollHeight;

}


/* =========================================================
   FETCH WITH TIMEOUT
   ========================================================= */

async function request(path, options = {}) {

  const controller = new AbortController();

  const timeout = setTimeout(() => {
    controller.abort();
  }, API_CONFIG.REQUEST_TIMEOUT);

  try {

    const headers = {
      Accept: "application/json",
      ...(options.headers || {})
    };

    if (
      options.body &&
      !headers["Content-Type"]
    ) {
      headers["Content-Type"] =
        "application/json";
    }

    const response = await fetch(
      apiUrl(path),
      {
        ...options,
        headers,
        signal: controller.signal
      }
    );

    const contentType =
      response.headers.get("content-type") || "";

    let data;

    if (contentType.includes("application/json")) {

      data = await response.json();

    } else {

      const text = await response.text();

      try {
        data = JSON.parse(text);
      } catch {
        data = {
          text
        };
      }

    }

    if (!response.ok) {

      const message =
        data?.error ||
        data?.message ||
        data?.detail ||
        `HTTP ${response.status}`;

      const error = new Error(message);

      error.status = response.status;

      error.data = data;

      throw error;
    }

    return data;

  } catch (error) {

    if (error.name === "AbortError") {

      throw new Error(
        "Request timed out. The backend did not respond in time."
      );

    }

    throw error;

  } finally {

    clearTimeout(timeout);

  }

}


/* =========================================================
   HEALTH CHECK
   ========================================================= */

async function checkHealth() {

  setBackendStatus(
    "checking",
    "● Checking backend"
  );

  log(
    `Checking backend: ${API_CONFIG.HEALTH}`,
    "system"
  );

  try {

    const data =
      await request(API_CONFIG.HEALTH, {
        method: "GET"
      });

    state.health = data;

    setBackendStatus(
      "online",
      "● Backend online"
    );

    updateStatusCards(data);

    log(
      "Backend health check successful.",
      "success"
    );

    return data;

  } catch (error) {

    state.health = null;

    setBackendStatus(
      "offline",
      "● Backend offline"
    );

    if (elements.statusBackend) {
      elements.statusBackend.textContent =
        "Offline";
    }

    if (elements.statusOmniRoute) {
      elements.statusOmniRoute.textContent =
        "Unavailable";
    }

    if (elements.statusRuntime) {
      elements.statusRuntime.textContent =
        "Unavailable";
    }

    log(
      `Health check failed: ${error.message}`,
      "error"
    );

    return null;

  }

}


/* =========================================================
   BACKEND STATUS
   ========================================================= */

function setBackendStatus(type, text) {

  if (!elements.backendStatus) {
    return;
  }

  elements.backendStatus.className =
    `status ${type}`;

  elements.backendStatus.textContent =
    text;

}


/* =========================================================
   HEALTH STATUS PARSER
   ========================================================= */

function updateStatusCards(data) {

  if (!data) {
    return;
  }

  if (elements.statusBackend) {

    elements.statusBackend.textContent =
      data.status ||
      data.health ||
      "Online";

  }

  if (elements.statusOmniRoute) {

    const omni =
      data.omniroute ??
      data.omniRoute ??
      data.omni_route ??
      data.runtime ??
      null;

    if (typeof omni === "boolean") {

      elements.statusOmniRoute.textContent =
        omni ? "Connected" : "Unavailable";

    } else if (typeof omni === "string") {

      elements.statusOmniRoute.textContent =
        omni;

    } else {

      elements.statusOmniRoute.textContent =
        "Connected";

    }

  }

  if (elements.statusRuntime) {

    const runtime =
      data.runtime ||
      data.mode ||
      data.kind ||
      "HTTP";

    elements.statusRuntime.textContent =
      String(runtime);

    if (elements.runtimeStatus) {

      elements.runtimeStatus.textContent =
        `Runtime: ${runtime}`;

    }

  }

  if (elements.healthOutput) {

    elements.healthOutput.textContent =
      JSON.stringify(
        data,
        null,
        2
      );

  }

}


/* =========================================================
   LOAD PROVIDERS
   ========================================================= */

async function loadProviders() {

  log(
    `Loading OmniRoute providers: ${API_CONFIG.PROVIDERS}`,
    "system"
  );

  if (elements.provider) {

    elements.provider.innerHTML = "";

    const loading =
      document.createElement("option");

    loading.value = "";

    loading.textContent =
      "Loading providers...";

    elements.provider.appendChild(
      loading
    );

  }

  try {

    const data =
      await request(API_CONFIG.PROVIDERS, {
        method: "GET"
      });

    const providers =
      normalizeProviders(data);

    state.providers = providers;

    renderProviderSelect();

    renderProvidersPage();

    updateProviderCount();

    log(
      `${providers.length} provider(s) received from OmniRoute.`,
      "success"
    );

    return providers;

  } catch (error) {

    state.providers = [];

    renderProviderSelectError();

    renderProvidersError(
      error.message
    );

    log(
      `Provider request failed: ${error.message}`,
      "error"
    );

    return [];

  }

}


/* =========================================================
   NORMALIZE PROVIDERS
   ========================================================= */

function normalizeProviders(data) {

  let raw = data;

  /*
   * Common API response shapes:
   *
   * [ ... ]
   *
   * { providers: [...] }
   *
   * { data: [...] }
   *
   * { items: [...] }
   */

  if (Array.isArray(data)) {

    raw = data;

  } else if (Array.isArray(data?.providers)) {

    raw = data.providers;

  } else if (Array.isArray(data?.data)) {

    raw = data.data;

  } else if (Array.isArray(data?.items)) {

    raw = data.items;

  } else {

    raw = [];

  }

  return raw.map((item) => {

    if (typeof item === "string") {

      return {
        id: item,
        name: item,
        models: []
      };

    }

    const id =
      item.id ||
      item.slug ||
      item.name ||
      item.provider ||
      item.key ||
      "";

    const name =
      item.name ||
      item.label ||
      item.displayName ||
      id;

    let models =
      item.models ||
      item.model ||
      [];

    if (!Array.isArray(models)) {
      models = [models];
    }

    models = models
      .map((model) => {

        if (typeof model === "string") {
          return {
            id: model,
            name: model
          };
        }

        return {
          id:
            model.id ||
            model.name ||
            model.model ||
            "",
          name:
            model.name ||
            model.label ||
            model.id ||
            model.model ||
            ""
        };

      })
      .filter(
        model => model.id
      );

    return {
      id: String(id),
      name: String(name),
      models
    };

  }).filter(
    provider => provider.id
  );

}


/* =========================================================
   PROVIDER SELECT
   ========================================================= */

function renderProviderSelect() {

  if (!elements.provider) {
    return;
  }

  elements.provider.innerHTML = "";

  if (!state.providers.length) {

    const option =
      document.createElement("option");

    option.value = "";

    option.textContent =
      "No providers available";

    elements.provider.appendChild(
      option
    );

    if (elements.model) {

      elements.model.innerHTML = "";

      const modelOption =
        document.createElement("option");

      modelOption.value = "";

      modelOption.textContent =
        "No models available";

      elements.model.appendChild(
        modelOption
      );

    }

    return;
  }

  for (const provider of state.providers) {

    const option =
      document.createElement("option");

    option.value =
      provider.id;

    option.textContent =
      provider.name;

    elements.provider.appendChild(
      option
    );

  }

  const preferred =
    state.providers.find(
      provider =>
        provider.id.toLowerCase() ===
        "gemini"
    );

  const first =
    preferred ||
    state.providers[0];

  elements.provider.value =
    first.id;

  state.selectedProvider =
    first.id;

  populateModels(first);

}


/* =========================================================
   PROVIDER ERROR
   ========================================================= */

function renderProviderSelectError() {

  if (!elements.provider) {
    return;
  }

  elements.provider.innerHTML = "";

  const option =
    document.createElement("option");

  option.value = "";

  option.textContent =
    "Unable to load providers";

  elements.provider.appendChild(
    option
  );

  if (elements.model) {

    elements.model.innerHTML = "";

    const modelOption =
      document.createElement("option");

    modelOption.value = "";

    modelOption.textContent =
      "Backend unavailable";

    elements.model.appendChild(
      modelOption
    );

  }

}


/* =========================================================
   MODEL SELECT
   ========================================================= */

function populateModels(provider) {

  if (!elements.model) {
    return;
  }

  elements.model.innerHTML = "";

  const models =
    provider?.models || [];

  if (!models.length) {

    /*
     * Do not invent a model.
     *
     * The input is left available so a backend
     * that accepts a manually supplied model can
     * still be used.
     */

    const option =
      document.createElement("option");

    option.value = "";

    option.textContent =
      "Enter model in backend configuration";

    elements.model.appendChild(
      option
    );

    state.selectedModel = "";

    return;
  }

  for (const model of models) {

    const option =
      document.createElement("option");

    option.value =
      model.id;

    option.textContent =
      model.name;

    elements.model.appendChild(
      option
    );

  }

  const preferred =
    models.find(
      model =>
        model.id ===
        "gemini-3.6-flash"
    ) ||
    models[0];

  elements.model.value =
    preferred.id;

  state.selectedModel =
    preferred.id;

}


/* =========================================================
   RENDER PROVIDERS PAGE
   ========================================================= */

function renderProvidersPage() {

  if (!elements.providersList) {
    return;
  }

  elements.providersList.innerHTML = "";

  if (!state.providers.length) {

    renderProvidersError(
      "No providers were returned by the backend."
    );

    return;
  }

  for (const provider of state.providers) {

    const wrapper =
      document.createElement("div");

    wrapper.className =
      "provider";

    const main =
      document.createElement("div");

    main.className =
      "provider-main";

    const icon =
      document.createElement("div");

    icon.className =
      "provider-icon";

    icon.textContent =
      "🤖";

    const info =
      document.createElement("div");

    const name =
      document.createElement("div");

    name.className =
      "provider-name";

    name.textContent =
      provider.name;

    const id =
      document.createElement("div");

    id.className =
      "provider-id";

    id.textContent =
      provider.id;

    info.appendChild(name);
    info.appendChild(id);

    main.appendChild(icon);
    main.appendChild(info);

    const status =
      document.createElement("span");

    status.className =
      "provider-status";

    status.textContent =
      "AVAILABLE";

    wrapper.appendChild(main);
    wrapper.appendChild(status);

    elements.providersList.appendChild(
      wrapper
    );

    /*
     * Show models below the provider when available.
     */

    if (provider.models.length) {

      const models =
        document.createElement("div");

      models.style.gridColumn = "1 / -1";

      models.style.marginTop = "8px";

      models.style.color = "#8995a8";

      models.style.fontSize = "11px";

      models.textContent =
        `${provider.models.length} model(s) available`;

      /*
       * Keep provider structure compatible with
       * the existing CSS while providing model
       * information.
       */

      wrapper.style.flexWrap = "wrap";

      wrapper.appendChild(models);

    }

  }

}


/* =========================================================
   PROVIDERS ERROR
   ========================================================= */

function renderProvidersError(message) {

  if (!elements.providersList) {
    return;
  }

  elements.providersList.innerHTML = "";

  const box =
    document.createElement("div");

  box.className =
    "error-result";

  const title =
    document.createElement("h4");

  title.textContent =
    "Unable to load OmniRoute providers";

  const text =
    document.createElement("p");

  text.textContent =
    message;

  box.appendChild(title);
  box.appendChild(text);

  elements.providersList.appendChild(
    box
  );

}


/* =========================================================
   PROVIDER COUNT
   ========================================================= */

function updateProviderCount() {

  if (!elements.statusProviders) {
    return;
  }

  elements.statusProviders.textContent =
    String(state.providers.length);

}


/* =========================================================
   PROVIDER CHANGE
   ========================================================= */

function handleProviderChange() {

  const providerId =
    elements.provider.value;

  state.selectedProvider =
    providerId;

  const provider =
    state.providers.find(
      item =>
        item.id === providerId
    );

  populateModels(provider);

  log(
    `Provider selected: ${providerId || "none"}`,
    "info"
  );

}


/* =========================================================
   MODEL CHANGE
   ========================================================= */

function handleModelChange() {

  state.selectedModel =
    elements.model.value;

  log(
    `Model selected: ${state.selectedModel || "none"}`,
    "info"
  );

}


/* =========================================================
   CREATE DRAMA
   ========================================================= */

async function createDrama() {

  if (state.busy) {
    return;
  }

  const idea =
    elements.idea.value.trim();

  const provider =
    elements.provider.value.trim();

  const model =
    elements.model.value.trim();

  const scenes =
    Number(elements.scenes.value);


  /* -----------------------------------------------
     VALIDATION
  ------------------------------------------------ */

  if (!idea) {

    showError(
      "Please enter a drama idea."
    );

    elements.idea.focus();

    return;
  }


  if (!provider) {

    showError(
      "No AI provider is available."
    );

    return;
  }


  if (!Number.isInteger(scenes) || scenes < 1) {

    showError(
      "Please select a valid number of scenes."
    );

    return;
  }


  state.busy = true;

  setCreateButtonBusy(true);

  hideResult();

  showProgress();

  resetProductionSteps();


  log(
    "Starting Cabangile Drama Builder.",
    "system"
  );

  log(
    `Provider: ${provider}`,
    "info"
  );

  if (model) {

    log(
      `Model: ${model}`,
      "info"
    );

  } else {

    log(
      "No model explicitly selected.",
      "warning"
    );

  }

  log(
    `Scenes requested: ${scenes}`,
    "info"
  );


  try {

    /* ---------------------------------------------
       STEP 1
    ---------------------------------------------- */

    setStep(
      1,
      "active"
    );

    setProgress(
      10,
      "Sending AI request through OmniRoute..."
    );

    log(
      "Sending drama request to backend.",
      "info"
    );


    /* ---------------------------------------------
       REQUEST
    ---------------------------------------------- */

    const payload = {

      idea,

      provider,

      model: model || undefined,

      scenes

    };


    /*
     * Remove undefined values.
     */

    Object.keys(payload).forEach(key => {

      if (payload[key] === undefined) {
        delete payload[key];
      }

    });


    /* ---------------------------------------------
       BACKEND REQUEST
    ---------------------------------------------- */

    const data =
      await request(
        API_CONFIG.CREATE_DRAMA,
        {
          method: "POST",

          body: JSON.stringify(payload)
        }
      );


    /* ---------------------------------------------
       STEP 1 COMPLETE
    ---------------------------------------------- */

    setStep(
      1,
      "complete"
    );


    /* ---------------------------------------------
       STEP 2
    ---------------------------------------------- */

    setStep(
      2,
      "active"
    );

    setProgress(
      35,
      "Generating drama..."
    );

    log(
      "Backend accepted the drama request.",
      "success"
    );


    /*
     * If the backend response explicitly contains
     * a production status, respect it.
     */

    if (
      data &&
      typeof data === "object"
    ) {

      if (
        data.status === "error" ||
        data.success === false
      ) {

        throw new Error(
          data.error ||
          data.message ||
          "Drama generation failed."
        );

      }

    }


    setStep(
      2,
      "complete"
    );


    /* ---------------------------------------------
       STEP 3
    ---------------------------------------------- */

    setStep(
      3,
      "active"
    );

    setProgress(
      60,
      "Preparing scenes..."
    );

    log(
      "Processing scene data returned by backend.",
      "info"
    );


    await wait(250);


    setStep(
      3,
      "complete"
    );


    /* ---------------------------------------------
       STEP 4
    ---------------------------------------------- */

    setStep(
      4,
      "active"
    );

    setProgress(
      85,
      "Preparing production result..."
    );

    log(
      "Preparing final production result.",
      "info"
    );


    await wait(250);


    setStep(
      4,
      "complete"
    );

    setProgress(
      100,
      "Production completed."
    );


    state.lastResult =
      data;


    renderDramaResult(
      data
    );


    log(
      "Drama request completed successfully.",
      "success"
    );


  } catch (error) {

    log(
      `Drama generation failed: ${error.message}`,
      "error"
    );

    setProgress(
      100,
      "Production failed."
    );

    markActiveStepError();

    showError(
      error.message
    );

  } finally {

    state.busy = false;

    setCreateButtonBusy(false);

  }

}


/* =========================================================
   PROGRESS
   ========================================================= */

function showProgress() {

  if (!elements.progressCard) {
    return;
  }

  elements.progressCard.classList.remove(
    "hidden"
  );

}


function setProgress(
  percentage,
  text
) {

  if (elements.progressBar) {

    elements.progressBar.style.width =
      `${percentage}%`;

  }

  if (elements.progressText) {

    elements.progressText.textContent =
      text;

  }

}


/* =========================================================
   PRODUCTION STEP
   ========================================================= */

function setStep(
  number,
  stateName
) {

  const step =
    $(`step${number}`);

  if (!step) {
    return;
  }

  step.classList.remove(
    "active",
    "complete",
    "error"
  );

  step.classList.add(
    stateName
  );

}


/* =========================================================
   RESET STEPS
   ========================================================= */

function resetProductionSteps() {

  for (let i = 1; i <= 4; i++) {

    const step =
      $(`step${i}`);

    if (step) {

      step.classList.remove(
        "active",
        "complete",
        "error"
      );

    }

  }

}


/* =========================================================
   ERROR STEP
   ========================================================= */

function markActiveStepError() {

  for (let i = 1; i <= 4; i++) {

    const step =
      $(`step${i}`);

    if (
      step &&
      step.classList.contains("active")
    ) {

      step.classList.remove(
        "active"
      );

      step.classList.add(
        "error"
      );

      return;
    }

  }

}


/* =========================================================
   RESULT
   ========================================================= */

function renderDramaResult(data) {

  if (!elements.resultCard ||
      !elements.result) {
    return;
  }

  elements.result.innerHTML = "";

  elements.resultCard.classList.remove(
    "hidden"
  );


  /*
   * The backend may return:
   *
   * title
   * name
   * drama
   * story
   * description
   * scenes
   * video
   * videoUrl
   * output
   *
   * We display what actually exists.
   */


  const title =
    data?.title ||
    data?.name ||
    data?.drama?.title ||
    "Generated Drama";


  const description =
    data?.description ||
    data?.summary ||
    data?.drama?.description ||
    data?.story ||
    "Drama generated by the Cabangile backend.";


  const titleElement =
    document.createElement("h3");

  titleElement.className =
    "result-title";

  titleElement.textContent =
    title;


  const descriptionElement =
    document.createElement("p");

  descriptionElement.className =
    "result-description";

  descriptionElement.textContent =
    typeof description === "string"
      ? description
      : JSON.stringify(description);


  elements.result.appendChild(
    titleElement
  );

  elements.result.appendChild(
    descriptionElement
  );


  /* ---------------------------------------------
     SCENES
  ---------------------------------------------- */

  const scenes =
    findScenes(data);

  if (scenes.length) {

    const sceneList =
      document.createElement("div");

    sceneList.className =
      "scene-list";


    scenes.forEach(
      (scene, index) => {

        const sceneElement =
          document.createElement("div");

        sceneElement.className =
          "scene";


        const number =
          document.createElement("div");

        number.className =
          "scene-number";

        number.textContent =
          String(
            scene.number ||
            scene.scene ||
            scene.id ||
            index + 1
          );


        const content =
          document.createElement("div");

        content.className =
          "scene-content";


        const sceneTitle =
          document.createElement("strong");

        sceneTitle.textContent =
          scene.title ||
          scene.name ||
          `Scene ${index + 1}`;


        const sceneDescription =
          document.createElement("p");

        sceneDescription.textContent =
          scene.description ||
          scene.summary ||
          scene.action ||
          scene.prompt ||
          scene.text ||
          "";


        content.appendChild(
          sceneTitle
        );

        content.appendChild(
          sceneDescription
        );


        sceneElement.appendChild(
          number
        );

        sceneElement.appendChild(
          content
        );


        sceneList.appendChild(
          sceneElement
        );

      }
    );


    elements.result.appendChild(
      sceneList
    );

  }


  /* ---------------------------------------------
     VIDEO
  ---------------------------------------------- */

  const videoUrl =
    findVideoUrl(data);

  if (videoUrl) {

    renderVideo(
      videoUrl
    );

  }


  /* ---------------------------------------------
     RAW RESPONSE
  ---------------------------------------------- */

  const details =
    document.createElement("details");

  const summary =
    document.createElement("summary");

  summary.textContent =
    "View backend response";


  const pre =
    document.createElement("pre");

  pre.textContent =
    JSON.stringify(
      data,
      null,
      2
    );


  details.appendChild(
    summary
  );

  details.appendChild(
    pre
  );

  elements.result.appendChild(
    details
  );

}


/* =========================================================
   FIND SCENES
   ========================================================= */

function findScenes(data) {

  const candidates = [

    data?.scenes,

    data?.drama?.scenes,

    data?.result?.scenes,

    data?.data?.scenes

  ];

  for (const candidate of candidates) {

    if (Array.isArray(candidate)) {
      return candidate;
    }

  }

  return [];

}


/* =========================================================
   FIND VIDEO URL
   ========================================================= */

function findVideoUrl(data) {

  const candidates = [

    data?.videoUrl,

    data?.video_url,

    data?.video,

    data?.output?.video,

    data?.output?.videoUrl,

    data?.result?.video,

    data?.result?.videoUrl,

    data?.data?.video,

    data?.data?.videoUrl

  ];

  for (const candidate of candidates) {

    if (
      typeof candidate === "string" &&
      candidate.trim()
    ) {

      return candidate;

    }

  }

  return null;

}


/* =========================================================
   VIDEO
   ========================================================= */

function renderVideo(url) {

  const wrapper =
    document.createElement("div");

  wrapper.className =
    "video-result";


  const heading =
    document.createElement("h4");

  heading.textContent =
    "🎥 Final Video";


  const video =
    document.createElement("video");

  video.controls = true;

  video.preload = "metadata";

  video.src = url;


  const link =
    document.createElement("a");

  link.href = url;

  link.target = "_blank";

  link.rel = "noopener";

  link.textContent =
    "Open Video";


  const path =
    document.createElement("div");

  path.className =
    "video-path";


  const code =
    document.createElement("code");

  code.textContent =
    url;


  path.appendChild(
    code
  );


  wrapper.appendChild(
    heading
  );

  wrapper.appendChild(
    video
  );

  wrapper.appendChild(
    link
  );

  wrapper.appendChild(
    path
  );


  elements.result.appendChild(
    wrapper
  );

}


/* =========================================================
   ERROR DISPLAY
   ========================================================= */

function showError(message) {

  if (!elements.resultCard ||
      !elements.result) {
    return;
  }

  elements.resultCard.classList.remove(
    "hidden"
  );

  elements.result.innerHTML = "";


  const box =
    document.createElement("div");

  box.className =
    "error-result";


  const heading =
    document.createElement("h4");

  heading.textContent =
    "⚠️ Production Error";


  const text =
    document.createElement("p");

  text.textContent =
    message;


  box.appendChild(
    heading
  );

  box.appendChild(
    text
  );


  elements.result.appendChild(
    box
  );

}


/* =========================================================
   HIDE RESULT
   ========================================================= */

function hideResult() {

  if (!elements.resultCard) {
    return;
  }

  elements.resultCard.classList.add(
    "hidden"
  );

}


/* =========================================================
   CREATE BUTTON STATE
   ========================================================= */

function setCreateButtonBusy(
  busy
) {

  if (!elements.createBtn) {
    return;
  }

  elements.createBtn.disabled =
    busy;

  elements.createBtn.textContent =
    busy
      ? "⏳ CREATING DRAMA..."
      : "🎬 CREATE DRAMA";

}


/* =========================================================
   EXAMPLE
   ========================================================= */

function loadExample() {

  elements.idea.value =
    "A young woman returns to her hometown after many years away. She discovers that her late mother left behind a secret that could change her family's future. As she investigates, she uncovers an old betrayal involving the people she trusted most.";

  log(
    "Example drama idea loaded.",
    "info"
  );

}


/* =========================================================
   RESET
   ========================================================= */

function resetForm() {

  if (state.busy) {
    return;
  }

  elements.idea.value =
    "A young woman returns to her hometown and discovers a hidden family secret.";

  elements.scenes.value =
    "6";

  hideResult();

  if (elements.progressCard) {

    elements.progressCard.classList.add(
      "hidden"
    );

  }

  if (elements.progressBar) {

    elements.progressBar.style.width =
      "0%";

  }

  if (elements.progressText) {

    elements.progressText.textContent =
      "Waiting for request...";

  }

  resetProductionSteps();

  log(
    "Drama form reset.",
    "info"
  );

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function setupNavigation() {

  const buttons =
    document.querySelectorAll(
      ".nav-button"
    );

  const sections =
    document.querySelectorAll(
      ".page-section"
    );


  buttons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        const target =
          button.dataset.section;

        buttons.forEach(item => {

          item.classList.remove(
            "active"
          );

        });

        sections.forEach(section => {

          section.classList.remove(
            "active-section"
          );

        });


        button.classList.add(
          "active"
        );


        const targetSection =
          $(target);

        if (targetSection) {

          targetSection.classList.add(
            "active-section"
          );

        }


        if (target === "providers") {

          loadProviders();

        }


        if (target === "status") {

          checkHealth();

        }

      }
    );

  });

}


/* =========================================================
   CLEAR CONSOLE
   ========================================================= */

function clearConsole() {

  state.logs = [];

  renderConsole();

  log(
    "Console cleared.",
    "system"
  );

}


/* =========================================================
   WAIT
   ========================================================= */

function wait(ms) {

  return new Promise(
    resolve =>
      setTimeout(resolve, ms)
  );

}


/* =========================================================
   EVENT LISTENERS
   ========================================================= */

function setupEvents() {

  if (elements.createBtn) {

    elements.createBtn.addEventListener(
      "click",
      createDrama
    );

  }


  if (elements.exampleBtn) {

    elements.exampleBtn.addEventListener(
      "click",
      loadExample
    );

  }


  if (elements.resetBtn) {

    elements.resetBtn.addEventListener(
      "click",
      resetForm
    );

  }


  if (elements.clearBtn) {

    elements.clearBtn.addEventListener(
      "click",
      clearConsole
    );

  }


  if (elements.provider) {

    elements.provider.addEventListener(
      "change",
      handleProviderChange
    );

  }


  if (elements.model) {

    elements.model.addEventListener(
      "change",
      handleModelChange
    );

  }


  /*
   * Allow Ctrl/Cmd + Enter to create.
   */

  if (elements.idea) {

    elements.idea.addEventListener(
      "keydown",
      event => {

        if (
          (event.ctrlKey ||
           event.metaKey) &&
          event.key === "Enter"
        ) {

          event.preventDefault();

          createDrama();

        }

      }
    );

  }

}


/* =========================================================
   INITIALIZATION
   ========================================================= */

async function initialize() {

  log(
    "Cabangile Drama Builder starting...",
    "system"
  );

  log(
    "Initializing OmniRoute connection...",
    "system"
  );

  setupNavigation();

  setupEvents();

  await checkHealth();

  await loadProviders();

  log(
    "Frontend initialization complete.",
    "success"
  );

}


/* =========================================================
   START
   ========================================================= */

if (
  document.readyState ===
  "loading"
) {

  document.addEventListener(
    "DOMContentLoaded",
    initialize
  );

} else {

  initialize();

}
