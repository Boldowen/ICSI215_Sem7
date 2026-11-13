const searchInput = document.getElementById("searchInput");
const suggestionsEl = document.getElementById("suggestions");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");

let debounceTimer = null;
let currentResults = [];
let activeIndex = -1;
let lastQuery = "";

// OpenWeatherMap цаг агаарын код -> монгол тайлбар, дүрс (өдөр, шөнө)
// https://openweathermap.org/weather-conditions
const WEATHER_CODES = {
  200: ["Аянга, бага зэргийн бороо", "⛈️", "⛈️"],
  201: ["Аянга, бороотой", "⛈️", "⛈️"],
  202: ["Аянга, аадар бороо", "⛈️", "⛈️"],
  210: ["Сул аянга", "🌩️", "🌩️"],
  211: ["Аянга цахилгаантай", "🌩️", "🌩️"],
  212: ["Хүчтэй аянга", "🌩️", "🌩️"],
  221: ["Үе үе аянга", "🌩️", "🌩️"],
  300: ["Сул шиврээ бороо", "🌦️", "🌧️"],
  301: ["Шиврээ бороо", "🌦️", "🌧️"],
  302: ["Ширүүн шиврээ бороо", "🌧️", "🌧️"],
  500: ["Бага зэргийн бороо", "🌦️", "🌧️"],
  501: ["Бороотой", "🌧️", "🌧️"],
  502: ["Ширүүн бороо", "🌧️", "🌧️"],
  503: ["Маш ширүүн бороо", "🌧️", "🌧️"],
  504: ["Аадар бороо", "🌧️", "🌧️"],
  511: ["Хүйтэн бороо", "🌧️", "🌧️"],
  520: ["Түр зуурын бага бороо", "🌦️", "🌧️"],
  521: ["Түр зуурын бороо", "🌦️", "🌧️"],
  522: ["Түр зуурын ширүүн бороо", "🌧️", "🌧️"],
  600: ["Бага зэргийн цас", "🌨️", "🌨️"],
  601: ["Цас орно", "🌨️", "🌨️"],
  602: ["Их цас", "❄️", "❄️"],
  611: ["Нойтон цас", "🌨️", "🌨️"],
  615: ["Бороо, цас холилдсон", "🌨️", "🌨️"],
  616: ["Бороо, цас холилдсон", "🌨️", "🌨️"],
  620: ["Түр зуурын бага цас", "🌨️", "🌨️"],
  621: ["Түр зуурын цас", "🌨️", "🌨️"],
  622: ["Түр зуурын их цас", "❄️", "❄️"],
  701: ["Манантай", "🌫️", "🌫️"],
  711: ["Утаатай", "🌫️", "🌫️"],
  721: ["Будантай", "🌫️", "🌫️"],
  731: ["Шороон шуурга", "🌪️", "🌪️"],
  741: ["Өтгөн манан", "🌫️", "🌫️"],
  751: ["Элсэн шуурга", "🌪️", "🌪️"],
  761: ["Тоостой", "🌫️", "🌫️"],
  762: ["Галт уулын үнс", "🌋", "🌋"],
  771: ["Хүчтэй салхи", "💨", "💨"],
  781: ["Хуй салхи", "🌪️", "🌪️"],
  800: ["Цэлмэг", "☀️", "🌙"],
  801: ["Голдуу цэлмэг", "🌤️", "🌙"],
  802: ["Багавтар үүлтэй", "⛅", "☁️"],
  803: ["Үүлшинэ", "🌥️", "☁️"],
  804: ["Үүлэрхэг", "☁️", "☁️"]
};

// Жагсаалтад байхгүй код ирвэл бүлгээр нь (2xx, 3xx, ...) тайлбарлана
const WEATHER_GROUPS = {
  2: ["Аянга цахилгаантай", "⛈️", "⛈️"],
  3: ["Шиврээ бороо", "🌦️", "🌧️"],
  5: ["Бороотой", "🌧️", "🌧️"],
  6: ["Цастай", "🌨️", "🌨️"],
  7: ["Манантай", "🌫️", "🌫️"],
  8: ["Үүлэрхэг", "☁️", "☁️"]
};

// icon: "04d" / "04n" -> сүүлийн үсгээр өдөр, шөнийг ялгана
function describe(weather) {
  const item = WEATHER_CODES[weather.id]
    || WEATHER_GROUPS[Math.floor(weather.id / 100)]
    || ["Тодорхойгүй", "❔", "❔"];
  const isDay = !weather.icon || weather.icon.endsWith("d");
  return { text: item[0], icon: isDay ? item[1] : item[2] };
}

// Монгол кирилл -> латин (кирилл нэрээр олдохгүй хотуудад туслах)
const CYR_TO_LAT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "yo", ж: "j", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", ө: "o", п: "p",
  р: "r", с: "s", т: "t", у: "u", ү: "u", ф: "f", х: "kh", ц: "ts", ч: "ch",
  ш: "sh", щ: "sh", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya"
};

function hasCyrillic(text) {
  return /[Ѐ-ӿ]/.test(text);
}

function transliterate(text) {
  return text.split("").map(ch => {
    const lower = ch.toLowerCase();
    if (!(lower in CYR_TO_LAT)) return ch;
    const lat = CYR_TO_LAT[lower];
    return ch === lower ? lat : lat.charAt(0).toUpperCase() + lat.slice(1);
  }).join("");
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function setStatus(message, isError = false) {
  statusEl.textContent = message;
  statusEl.classList.toggle("error", isError);
}

// Улсын код -> монгол нэр ("MN" -> "Монгол")
let countryNames = null;
try { countryNames = new Intl.DisplayNames(["mn"], { type: "region" }); } catch (e) {}

function countryName(code) {
  try { return (countryNames && countryNames.of(code)) || code; } catch (e) { return code; }
}

async function apiGet(url) {
  const res = await fetch(url);
  if (res.status === 401) throw new Error("API key буруу эсвэл идэвхжээгүй байна");
  if (res.status === 429) throw new Error("API-н хүсэлтийн хязгаар хэтэрлээ, түр хүлээнэ үү");
  if (!res.ok) throw new Error("API алдаа өглөө");
  return res.json();
}

// ---------- Хот хайх ----------
function geocode(name) {
  return apiGet(`https://api.openweathermap.org/geo/1.0/direct?q=${encodeURIComponent(name)}&limit=5&appid=${APP_CONFIG.weatherApiKey}`);
}

async function searchCities(query) {
  const queries = [query];
  if (hasCyrillic(query)) queries.push(transliterate(query));

  const lists = await Promise.all(queries.map(geocode));

  // Давхардлыг арилгах (ижил нэр, аймаг, улс)
  const byKey = new Map();
  lists.flat().forEach(r => {
    const key = `${r.name}|${r.state || ""}|${r.country}`;
    if (!byKey.has(key)) byKey.set(key, r);
  });

  // Монголын хотуудыг эхэнд (бусдын дараалал хэвээр)
  const results = [...byKey.values()];
  results.sort((a, b) => (b.country === "MN") - (a.country === "MN"));

  return results.slice(0, 8).map(r => ({
    name: r.name,
    localName: r.local_names?.mn || r.name,
    state: r.state || "",
    country: countryName(r.country),
    lat: r.lat,
    lon: r.lon
  }));
}

function renderSuggestions(results) {
  currentResults = results;
  activeIndex = -1;

  if (!results.length) {
    suggestionsEl.innerHTML = `<li class="empty">Хот олдсонгүй</li>`;
    return;
  }

  suggestionsEl.innerHTML = results.map((r, i) => {
    const region = [r.state, r.country].filter(Boolean).join(", ");
    const title = r.localName !== r.name ? `${r.localName} (${r.name})` : r.name;
    return `<li data-index="${i}">
              <div class="city">${escapeHtml(title)}</div>
              <div class="region">${escapeHtml(region)}</div>
            </li>`;
  }).join("");
}

function clearSuggestions() {
  suggestionsEl.innerHTML = "";
  currentResults = [];
  activeIndex = -1;
}

function highlight(index) {
  const items = suggestionsEl.querySelectorAll("li[data-index]");
  items.forEach(li => li.classList.remove("active"));
  if (items[index]) {
    items[index].classList.add("active");
    items[index].scrollIntoView({ block: "nearest" });
  }
  activeIndex = index;
}

searchInput.addEventListener("input", () => {
  const query = searchInput.value.trim();
  clearTimeout(debounceTimer);

  if (query.length < 2) {
    clearSuggestions();
    return;
  }

  debounceTimer = setTimeout(async () => {
    lastQuery = query;
    try {
      const results = await searchCities(query);
      if (query !== lastQuery) return; // хуучин хариуг үл тоох
      setStatus("");
      renderSuggestions(results);
    } catch (err) {
      setStatus(`Хайлт хийхэд алдаа гарлаа: ${err.message}`, true);
    }
  }, 300);
});

searchInput.addEventListener("keydown", e => {
  const count = currentResults.length;
  if (e.key === "ArrowDown" && count) {
    e.preventDefault();
    highlight((activeIndex + 1) % count);
  } else if (e.key === "ArrowUp" && count) {
    e.preventDefault();
    highlight((activeIndex - 1 + count) % count);
  } else if (e.key === "Enter") {
    e.preventDefault();
    if (count) selectCity(currentResults[Math.max(activeIndex, 0)]);
  } else if (e.key === "Escape") {
    clearSuggestions();
  }
});

suggestionsEl.addEventListener("click", e => {
  const li = e.target.closest("li[data-index]");
  if (li) selectCity(currentResults[Number(li.dataset.index)]);
});

document.addEventListener("click", e => {
  if (!e.target.closest(".search")) clearSuggestions();
});

// ---------- Цаг агаар татах ----------
async function selectCity(city) {
  clearSuggestions();
  searchInput.value = city.localName;
  setStatus("Цаг агаарын мэдээ татаж байна...");

  try {
    const [current, forecast] = await Promise.all([
      apiGet(`https://api.openweathermap.org/data/2.5/weather?lat=${city.lat}&lon=${city.lon}&units=metric&appid=${APP_CONFIG.weatherApiKey}`),
      // cnt=8: 8 x 3 цаг = 24 цаг
      apiGet(`https://api.openweathermap.org/data/2.5/forecast?lat=${city.lat}&lon=${city.lon}&units=metric&cnt=8&appid=${APP_CONFIG.weatherApiKey}`)
    ]);
    renderWeather(city, current, forecast);
    setStatus("");
  } catch (err) {
    resultEl.classList.add("hidden");
    setStatus(`Цаг агаарын мэдээ татахад алдаа гарлаа: ${err.message}`, true);
  }
}

function windDirection(deg) {
  const dirs = ["Х", "ЗХ", "З", "ЗӨ", "Ө", "БӨ", "Б", "БХ"]; // Хойд, Зүүн хойд ...
  return dirs[Math.round(deg / 45) % 8];
}

// Unix хугацаа + хотын цагийн бүс (секунд) -> орон нутгийн цаг.
// UTC getter-ээр уншина, тэгэхгүй бол хэрэглэгчийн компьютерийн бүс нэмэгдэнэ.
function localDate(unix, tz) {
  return new Date((unix + tz) * 1000);
}

function timeOnly(unix, tz) {
  const d = localDate(unix, tz);
  const pad = n => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

function formatDate(unix, tz) {
  const d = localDate(unix, tz);
  return `${d.getUTCFullYear()} оны ${d.getUTCMonth() + 1}-р сарын ${d.getUTCDate()}`;
}

function renderWeather(city, c, f) {
  const tz = c.timezone;
  const now = describe(c.weather[0]);
  const list = f.list;

  // Ойрын 24 цагийн дээд/доод темп., хур тунадас, бороо орох магадлал
  const temps = [c.main.temp, ...list.map(x => x.main.temp)];
  const maxTemp = Math.max(...temps);
  const minTemp = Math.min(...temps);
  const precip = list.reduce((sum, x) => sum + (x.rain?.["3h"] || 0) + (x.snow?.["3h"] || 0), 0);
  const pop = Math.round(Math.max(0, ...list.map(x => x.pop || 0)) * 100);

  const region = [city.state, city.country].filter(Boolean).join(", ");
  document.getElementById("placeName").textContent = city.localName;
  document.getElementById("placeMeta").textContent =
    `${region} · ${formatDate(c.dt, tz)} · Орон нутгийн цаг ${timeOnly(c.dt, tz)}`;

  document.getElementById("nowIcon").textContent = now.icon;
  document.getElementById("nowTemp").textContent = `${c.main.temp.toFixed(2)}°`;
  document.getElementById("nowDesc").textContent = now.text;
  document.getElementById("nowMinMax").textContent =
    `Дээд ${maxTemp.toFixed(2)}° · Доод ${minTemp.toFixed(2)}° (24 цаг)`;

  const wind = `${c.wind.speed.toFixed(1)} м/с ${windDirection(c.wind.deg)}`
    + (c.wind.gust ? ` (шуурга ${c.wind.gust.toFixed(1)})` : "");

  const details = [
    ["Мэдрэгдэх темп.", `${Math.round(c.main.feels_like)}°C`],
    ["Чийгшил", `${c.main.humidity}%`],
    ["Салхи", wind],
    ["Агаарын даралт", `${c.main.pressure} гПа`],
    ["Үүлшил", `${c.clouds.all}%`],
    ["Харагдац", c.visibility != null ? `${(c.visibility / 1000).toFixed(1)} км` : "—"],
    ["Хур тунадас (24ц)", `${precip.toFixed(1)} мм`],
    ["Бороо орох магадлал", `${pop}%`],
    ["Нар мандах", timeOnly(c.sys.sunrise, tz)],
    ["Нар жаргах", timeOnly(c.sys.sunset, tz)]
  ];

  document.getElementById("details").innerHTML = details.map(([label, value]) => `
    <div class="detail">
      <div class="label">${label}</div>
      <div class="value">${escapeHtml(value)}</div>
    </div>`).join("");

  // Эхэнд "Одоо", дараа нь 3 цаг тутмын таамаг
  const hours = [
    { label: "Одоо", w: now, temp: c.main.temp, pop: null, current: true },
    ...list.map(x => ({
      label: timeOnly(x.dt, tz),
      w: describe(x.weather[0]),
      temp: x.main.temp,
      pop: Math.round((x.pop || 0) * 100),
      current: false
    }))
  ];

  document.getElementById("hourly").innerHTML = hours.map(h => `
      <div class="hour ${h.current ? "current" : ""}" title="${escapeHtml(h.w.text)}">
        <div class="h-time">${h.label}</div>
        <div class="h-icon">${h.w.icon}</div>
        <div class="h-temp">${h.temp.toFixed(2)}°</div>
        <div class="h-rain">${h.pop == null ? "&nbsp;" : `💧${h.pop}%`}</div>
      </div>`).join("");

  resultEl.classList.remove("hidden");
  document.getElementById("hourly").scrollLeft = 0;
}
