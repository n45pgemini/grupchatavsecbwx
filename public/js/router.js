// router.js
// Mengarahkan hash dari index.html ke file HTML aktual.

(function () {
  const base = "/";

  const p = location.pathname;
  const isIndex = p === "/" || p.endsWith("/index.html");
  if (!isIndex) return;

  if (!location.hash || location.hash === "#" || location.hash === "#/") return;

  let hash = location.hash.slice(1);
  while (hash.startsWith("/")) hash = hash.slice(1);

  let extraHash = "";
  const idxHashInside = hash.indexOf("#");
  if (idxHashInside >= 0) {
    extraHash = hash.slice(idxHashInside);
    hash = hash.slice(0, idxHashInside);
  }

  let routePath = hash;
  let routeQuery = "";
  const qPos = routePath.indexOf("?");
  if (qPos >= 0) {
    routeQuery = routePath.slice(qPos + 1);
    routePath = routePath.slice(0, qPos);
  }

  const ROUTE_MAP = {
    "": "home.html",
    "home": "home.html",
    "login": "index.html",
    "chatbot": "chatbot.html",
    "bot": "chatbot.html",
    "plotting": "plotting.html",
    "rotation": "plotting.html",
    "sop": "sop-view.html",
    "viewer": "sop-view.html",
    "pdf": "sop-view.html",
    "fuel": "fuel.html",
    "bbm": "fuel.html",
    "geotagweb": "geotagweb.html",
    "geo-web": "geotagweb.html",
  };

  function resolveTarget(path) {
    if (!path) return ROUTE_MAP[""];
    if (/\.(html?)$/i.test(path)) return path;
    const seg = path.split("/")[0].toLowerCase();
    if (ROUTE_MAP[seg]) return ROUTE_MAP[seg];
    return ROUTE_MAP[""];
  }

  const targetFile = resolveTarget(routePath);

  const params = new URLSearchParams();
  if (routeQuery) new URLSearchParams(routeQuery).forEach((v, k) => params.append(k, v));

  const queryString = params.toString();
  const finalURL =
    base + targetFile +
    (queryString ? `?${queryString}` : "") +
    (extraHash || "");

  location.replace(finalURL);
})();
