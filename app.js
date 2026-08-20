var tiles_default = { tiles: [
	"(Undecisive)",
	"4rt1st",
	"5 Is a Crowd",
	"<3",
	">4:20",
	"Acid 303",
	"Amen Break",
	"Anime Artwork",
	"Artist Tries New Genre",
	"Awful Mixdown",
	"Beep Boop",
	"Chiptune",
	"Collab?",
	"Color Bass",
	"Compilation",
	"Cover With New Lyrics",
	"Cringe Lyrics",
	"DMCA Risk",
	"Dirty Workz",
	"Donk Bass",
	"Dope Artwork",
	"Explicit Lyrics",
	"Fake Song",
	"Foreign Language",
	"Good Vibes Bad Drop",
	"Homies",
	"Idea Doesn't Work",
	"Label Records",
	"Lazy Cover",
	"Limiter Doing Overtime",
	"Mainstream Artist",
	"Monster Tok",
	"Monstercat",
	"NCS",
	"No Canvas",
	"Peak Depression",
	"Playlist Add",
	"Proper Canvas",
	"Sample Pack Vocals",
	"Self-Released",
	"Skip",
	"Stupid Artist Name",
	"Stutter",
	"Switchup",
	"T-Pain Vocals",
	"Weird Letter",
	"Youtuber",
	"ZzZzZ",
	"It's Friday"
] };
var CENTER_INDEX = Math.floor(25 / 2);
var FREE_TILE = "It's Friday";
var WINNING_LINES = [
	...Array.from({ length: 5 }, (_, row) => Array.from({ length: 5 }, (_, column) => row * 5 + column)),
	...Array.from({ length: 5 }, (_, column) => Array.from({ length: 5 }, (_, row) => row * 5 + column)),
	[
		0,
		6,
		12,
		18,
		24
	],
	[
		4,
		8,
		12,
		16,
		20
	]
];
function normalizeTiles(data) {
	if (!data || typeof data !== "object" || !("tiles" in data)) throw new Error("Tile data is invalid");
	const source = data.tiles;
	if (!Array.isArray(source)) throw new Error("Tile data is invalid");
	if (source.some((tile) => typeof tile !== "string" || !tile.trim())) throw new Error("Tile data contains an invalid entry");
	const tiles = source.map((tile) => tile.trim());
	if (new Set(tiles).size !== tiles.length) throw new Error("Tile data contains duplicates");
	if (tiles.filter((tile) => tile !== "It's Friday").length < 24) throw new Error("Not enough unique tiles");
	return tiles.includes("It's Friday") ? tiles : [...tiles, FREE_TILE];
}
function shuffled(values, random = Math.random) {
	const result = [...values];
	for (let index = result.length - 1; index > 0; index -= 1) {
		const swapIndex = Math.floor(random() * (index + 1));
		const current = result[index];
		const swap = result[swapIndex];
		if (current === void 0 || swap === void 0) continue;
		result[index] = swap;
		result[swapIndex] = current;
	}
	return result;
}
function createBoard(tiles, random = Math.random) {
	const pool = tiles.filter((tile) => tile !== FREE_TILE);
	if (pool.length < 24) throw new Error("Not enough unique tiles");
	const layout = shuffled(pool, random).slice(0, 24);
	layout.splice(CENTER_INDEX, 0, FREE_TILE);
	return layout;
}
function startingMarks(marked = []) {
	return /* @__PURE__ */ new Set([CENTER_INDEX, ...marked]);
}
function winningLineKeys(marked) {
	const markedSet = new Set(marked);
	return new Set(WINNING_LINES.filter((line) => line.every((index) => markedSet.has(index))).map((line) => line.join(",")));
}
function tilesToBingo(marked) {
	const markedSet = new Set(marked);
	return Math.min(...WINNING_LINES.map((line) => line.filter((index) => !markedSet.has(index)).length));
}
function encodeSnapshot(layout, marked, tiles) {
	if (layout.length !== 25) throw new Error("Board is not ready");
	const tileIndexes = layout.map((tile) => tiles.indexOf(tile));
	if (tileIndexes.some((index) => index < 0)) throw new Error("Unknown tile");
	const payload = {
		version: 1,
		tiles: tileIndexes,
		marked: [...startingMarks(marked)].sort((left, right) => left - right)
	};
	return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function decodeSnapshot(code, tiles) {
	const normalized = code.trim().replaceAll("-", "+").replaceAll("_", "/");
	const padding = "=".repeat((4 - normalized.length % 4) % 4);
	const data = JSON.parse(atob(normalized + padding));
	if (data.version !== 1) throw new Error("Snapshot version is invalid");
	if (!Array.isArray(data.tiles) || data.tiles.length !== 25) throw new Error("Snapshot tiles are invalid");
	if (!Array.isArray(data.marked)) throw new Error("Snapshot marks are invalid");
	if (data.tiles.some((index) => !Number.isInteger(index) || index < 0 || index >= tiles.length)) throw new Error("Snapshot tile index is invalid");
	if (new Set(data.tiles).size !== 25) throw new Error("Snapshot contains duplicate tiles");
	if (data.marked.some((index) => !Number.isInteger(index) || index < 0 || index >= 25)) throw new Error("Snapshot mark is invalid");
	const layout = data.tiles.map((index) => tiles[index]);
	if (layout.some((tile) => tile === void 0)) throw new Error("Snapshot contains an unknown tile");
	if (layout[CENTER_INDEX] !== "It's Friday") throw new Error("Snapshot free tile is invalid");
	return {
		layout,
		marked: [...startingMarks(data.marked)].sort((left, right) => left - right)
	};
}
//#endregion
//#region src/main.ts
var STORAGE_KEY = "release-radar-bingo:card:v1";
var rootElement = document.querySelector("#release-radar-bingo");
if (!rootElement) throw new Error("Release Radar Bingo root is missing");
var root = rootElement;
root.innerHTML = markup();
var required = (selector) => {
	const element = root.querySelector(selector);
	if (!element) throw new Error(`Missing required element: ${selector}`);
	return element;
};
var ui = {
	boardCard: required(".board-card"),
	board: required(".board"),
	distance: required(".distance"),
	markedCount: required(".marked-count"),
	progress: required(".progress-fill"),
	status: required("#bingo-status"),
	toast: required(".toast"),
	newCard: required("[data-action=\"new-card\"]"),
	share: required("[data-action=\"share\"]")
};
var state = {
	tiles: [],
	layout: [],
	marked: startingMarks(),
	completed: /* @__PURE__ */ new Set(),
	ready: false,
	fitFrame: 0,
	toastTimer: 0
};
function markup() {
	return `
    <div class="ambient ambient-left" aria-hidden="true"></div>
    <div class="ambient ambient-right" aria-hidden="true"></div>

    <main class="app-shell">
      <header class="hero">
        <p class="eyebrow">NEW MUSIC. SAME PREDICTABLE CHAOS.</p>
        <h1>RELEASE <span>RADAR</span> BINGO&#10022;</h1>
        <p class="tagline">A fresh card for your Friday discoveries.</p>
      </header>

      <div id="bingo-status" class="sr-only" aria-live="polite"></div>

      <section class="board-card glass" aria-labelledby="board-title">
        <div class="card-header">
          <div>
            <span class="card-kicker">YOUR CARD</span>
            <h2 id="board-title" class="distance">Loading…</h2>
          </div>
          <span class="marked-count">— / 25 marked</span>
        </div>

        <div class="progress-track" aria-hidden="true">
          <span class="progress-fill"></span>
        </div>

        <div class="radar-heading" aria-hidden="true">
          <span>R</span><span>A</span><span>D</span><span>A</span><span>R</span>
        </div>

        <div class="board" aria-label="Release Radar bingo board" aria-busy="true">
          <div class="board-message">DEALING YOUR CARD…</div>
        </div>
      </section>

      <div class="actions" aria-label="Board actions">
        <button class="button primary" type="button" data-action="new-card" disabled>
          New card
        </button>
        <button class="button secondary" type="button" data-action="share" disabled>
          Share card
        </button>
      </div>

      <p class="game-note">The middle space is always free. The opinions are all yours.</p>
      <div class="toast glass" role="status" aria-live="polite" hidden></div>
    </main>
  `;
}
function announce(message) {
	ui.status.textContent = "";
	requestAnimationFrame(() => {
		ui.status.textContent = message;
	});
}
function showToast(message) {
	window.clearTimeout(state.toastTimer);
	ui.toast.textContent = message;
	ui.toast.hidden = false;
	ui.toast.classList.remove("showing");
	ui.toast.offsetWidth;
	ui.toast.classList.add("showing");
	state.toastTimer = window.setTimeout(() => {
		ui.toast.hidden = true;
		ui.toast.classList.remove("showing");
	}, 1800);
}
function createElement(tagName, options = {}) {
	const element = document.createElement(tagName);
	if (options.className) element.className = options.className;
	if (options.text !== void 0) element.textContent = options.text;
	for (const [name, value] of Object.entries(options.attributes ?? {})) element.setAttribute(name, value);
	return element;
}
function createTile(text, index) {
	const isFree = index === CENTER_INDEX;
	const marked = state.marked.has(index);
	const tile = createElement("button", {
		className: `tile${isFree ? " free-tile" : ""}`,
		attributes: {
			type: "button",
			"data-index": String(index),
			"aria-label": isFree ? `${text}, free space, marked` : `${text}, ${marked ? "marked" : "not marked"}`,
			"aria-pressed": String(marked),
			...isFree ? { "aria-disabled": "true" } : {}
		}
	});
	tile.style.setProperty("--deal-delay", `${index * 13}ms`);
	if (isFree) tile.append(createElement("span", {
		className: "tile-badge",
		text: "FREE"
	}));
	tile.append(createElement("span", {
		className: "tile-mark",
		text: "✦",
		attributes: { "aria-hidden": "true" }
	}), createElement("span", {
		className: "tile-copy",
		text
	}));
	return tile;
}
function scheduleLabelFit() {
	cancelAnimationFrame(state.fitFrame);
	state.fitFrame = requestAnimationFrame(() => {
		state.fitFrame = 0;
		for (const tile of ui.board.querySelectorAll(".tile")) {
			const label = tile.querySelector(".tile-copy");
			if (!label) continue;
			let low = 7;
			let high = Math.max(low, Math.min(13.5, tile.clientWidth * .2));
			let best = low;
			for (let attempt = 0; attempt < 7; attempt += 1) {
				const size = (low + high) / 2;
				tile.style.setProperty("--tile-font", `${size}px`);
				const verticalAllowance = tile.classList.contains("free-tile") ? 30 : 18;
				if (label.scrollWidth <= tile.clientWidth - 18 && label.scrollHeight <= tile.clientHeight - verticalAllowance) {
					best = size;
					low = size;
				} else high = size;
			}
			tile.style.setProperty("--tile-font", `${best}px`);
		}
	});
}
function renderBoard(layout, marked) {
	if (layout.length !== 25) throw new Error("Invalid board layout");
	state.layout = [...layout];
	state.marked = startingMarks(marked);
	state.completed.clear();
	const fragment = document.createDocumentFragment();
	layout.forEach((text, index) => fragment.append(createTile(text, index)));
	ui.board.replaceChildren(fragment);
	ui.board.setAttribute("aria-busy", "false");
	updateProgress(false);
	scheduleLabelFit();
}
function updateProgress(celebrate) {
	const wins = winningLineKeys(state.marked);
	const newWins = [...wins].filter((key) => !state.completed.has(key));
	state.completed = wins;
	const remaining = tilesToBingo(state.marked);
	const closestLineProgress = (5 - remaining) / 5 * 100;
	const markedTotal = state.marked.size;
	ui.distance.textContent = remaining === 0 ? "Bingo!" : `${remaining} ${remaining === 1 ? "tile" : "tiles"} to Bingo`;
	ui.markedCount.textContent = `${markedTotal} / 25 marked`;
	ui.progress.style.width = `${closestLineProgress}%`;
	ui.boardCard.classList.toggle("has-bingo", wins.size > 0);
	const winningIndexes = /* @__PURE__ */ new Set();
	for (const key of wins) key.split(",").forEach((index) => winningIndexes.add(Number(index)));
	ui.board.querySelectorAll(".tile").forEach((tile, index) => {
		tile.classList.toggle("winning-line", winningIndexes.has(index));
	});
	if (celebrate && newWins.length > 0) {
		showToast(newWins.length === 1 ? "BINGO — LINE COMPLETE ✦" : `${newWins.length} NEW LINES ✦`);
		announce(newWins.length === 1 ? "Bingo! One line completed." : `Bingo! ${newWins.length} lines completed.`);
	}
}
function setTileMarked(tile) {
	const index = Number(tile.dataset.index);
	if (index === CENTER_INDEX) return;
	const marked = !state.marked.has(index);
	if (marked) state.marked.add(index);
	else state.marked.delete(index);
	const text = state.layout[index] ?? "Tile";
	tile.setAttribute("aria-pressed", String(marked));
	tile.setAttribute("aria-label", `${text}, ${marked ? "marked" : "not marked"}`);
	if (marked) {
		tile.classList.remove("just-marked");
		tile.offsetWidth;
		tile.classList.add("just-marked");
		tile.addEventListener("animationend", () => tile.classList.remove("just-marked"), { once: true });
	}
	updateProgress(true);
	saveCard();
}
function saveCard() {
	if (!state.ready || state.layout.length !== 25) return;
	try {
		localStorage.setItem(STORAGE_KEY, encodeSnapshot(state.layout, state.marked, state.tiles));
	} catch {}
}
function loadSavedCard() {
	try {
		const code = localStorage.getItem(STORAGE_KEY);
		return code ? decodeSnapshot(code, state.tiles) : null;
	} catch {
		return null;
	}
}
function newCard() {
	if (!state.ready) return;
	renderBoard(createBoard(state.tiles), startingMarks());
	saveCard();
	showToast("FRESH CARD DEALT ✦");
	announce("A fresh Release Radar card was dealt.");
}
async function copyText(text) {
	if (navigator.clipboard?.writeText) try {
		await navigator.clipboard.writeText(text);
		return true;
	} catch {}
	const field = createElement("textarea", {
		className: "sr-only",
		text,
		attributes: { readonly: "" }
	});
	root.append(field);
	field.select();
	let copied = false;
	try {
		copied = document.execCommand("copy");
	} catch {
		copied = false;
	}
	field.remove();
	return copied;
}
async function shareCard() {
	if (!state.ready) return;
	ui.share.disabled = true;
	try {
		const url = new URL(location.href);
		url.search = "";
		url.searchParams.set("snap", encodeSnapshot(state.layout, state.marked, state.tiles));
		url.hash = "";
		const copied = await copyText(url.href);
		showToast(copied ? "CARD LINK COPIED ✦" : "COULD NOT COPY LINK");
		announce(copied ? "A link to this card was copied." : "The card link could not be copied.");
	} catch {
		showToast("COULD NOT CREATE LINK");
		announce("The card link could not be created.");
	} finally {
		ui.share.disabled = false;
	}
}
function setReady(ready) {
	state.ready = ready;
	ui.newCard.disabled = !ready;
	ui.share.disabled = !ready;
}
function showLoadError() {
	ui.board.setAttribute("aria-busy", "false");
	ui.board.replaceChildren(createElement("div", {
		className: "board-message",
		text: "COULD NOT LOAD THE TILE CATALOG"
	}));
	ui.distance.textContent = "Board unavailable";
	ui.markedCount.textContent = "Please refresh";
	announce("The Release Radar tile catalog could not be loaded. Please refresh.");
}
function loadTiles() {
	try {
		state.tiles = normalizeTiles(tiles_default);
		setReady(true);
		const sharedCode = new URLSearchParams(location.search).get("snap");
		if (sharedCode) try {
			const shared = decodeSnapshot(sharedCode, state.tiles);
			renderBoard(shared.layout, shared.marked);
			saveCard();
			return;
		} catch {
			showToast("SHARED CARD WAS INVALID");
		}
		const saved = loadSavedCard();
		if (saved) renderBoard(saved.layout, saved.marked);
		else renderBoard(createBoard(state.tiles), startingMarks());
		saveCard();
	} catch {
		setReady(false);
		showLoadError();
	}
}
root.addEventListener("click", (event) => {
	const target = event.target instanceof Element ? event.target.closest("button") : null;
	if (!(target instanceof HTMLButtonElement) || !root.contains(target)) return;
	if (target.matches(".tile")) setTileMarked(target);
	if (target.dataset.action === "new-card") newCard();
	if (target.dataset.action === "share") shareCard();
});
document.addEventListener("keydown", (event) => {
	if (event.key === "Tab") root.classList.add("keyboard-input");
});
document.addEventListener("pointerdown", () => root.classList.remove("keyboard-input"));
var BoardResizeObserver = globalThis.ResizeObserver;
if (BoardResizeObserver) new BoardResizeObserver(scheduleLabelFit).observe(ui.board);
else window.addEventListener("resize", scheduleLabelFit, { passive: true });
loadTiles();
//#endregion
