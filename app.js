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
var FRIDAY_TILE = "It's Friday";
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
	return tiles.includes("It's Friday") ? tiles : [...tiles, FRIDAY_TILE];
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
	const pool = tiles.filter((tile) => tile !== FRIDAY_TILE);
	if (pool.length < 24) throw new Error("Not enough unique tiles");
	const layout = shuffled(pool, random).slice(0, 24);
	layout.splice(CENTER_INDEX, 0, FRIDAY_TILE);
	return layout;
}
function startingMarks(marked = []) {
	return new Set(marked);
}
function winningLineKeys(marked) {
	const markedSet = new Set(marked);
	return new Set(WINNING_LINES.filter((line) => line.every((index) => markedSet.has(index))).map((line) => line.join(",")));
}
function encodeSnapshot(layout, marked, tiles) {
	if (layout.length !== 25) throw new Error("Board is not ready");
	const tileIndexes = layout.map((tile) => tiles.indexOf(tile));
	if (tileIndexes.some((index) => index < 0)) throw new Error("Unknown tile");
	const payload = {
		version: 2,
		tiles: tileIndexes,
		marked: [...startingMarks(marked)].sort((left, right) => left - right)
	};
	return btoa(JSON.stringify(payload)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function decodeSnapshot(code, tiles) {
	const normalized = code.trim().replaceAll("-", "+").replaceAll("_", "/");
	const padding = "=".repeat((4 - normalized.length % 4) % 4);
	const data = JSON.parse(atob(normalized + padding));
	if (data.version !== 1 && data.version !== 2) throw new Error("Snapshot version is invalid");
	if (!Array.isArray(data.tiles) || data.tiles.length !== 25) throw new Error("Snapshot tiles are invalid");
	if (!Array.isArray(data.marked)) throw new Error("Snapshot marks are invalid");
	if (data.tiles.some((index) => !Number.isInteger(index) || index < 0 || index >= tiles.length)) throw new Error("Snapshot tile index is invalid");
	if (new Set(data.tiles).size !== 25) throw new Error("Snapshot contains duplicate tiles");
	if (data.marked.some((index) => !Number.isInteger(index) || index < 0 || index >= 25)) throw new Error("Snapshot mark is invalid");
	const layout = data.tiles.map((index) => tiles[index]);
	if (layout.some((tile) => tile === void 0)) throw new Error("Snapshot contains an unknown tile");
	if (layout[CENTER_INDEX] !== "It's Friday") throw new Error("Snapshot Friday tile is invalid");
	return {
		layout,
		marked: [...startingMarks(data.version === 1 ? data.marked.filter((index) => index !== CENTER_INDEX) : data.marked)].sort((left, right) => left - right)
	};
}
//#endregion
//#region src/main.ts
var STORAGE_KEY = "release-radar-bingo:card:v2";
var reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)");
var rootElement = document.querySelector("#bingo, #release-radar-bingo");
if (!rootElement) throw new Error("Release Radar Bingo root is missing");
var root = rootElement;
root.id = "bingo";
root.innerHTML = markup();
var required = (selector) => {
	const element = root.querySelector(selector);
	if (!element) throw new Error(`Missing required element: ${selector}`);
	return element;
};
var ui = {
	card: required(".card"),
	board: required(".board"),
	status: required("#bingo-status"),
	shuffle: required("[data-action=\"shuffle\"]"),
	share: required("[data-action=\"share\"]")
};
var state = {
	tiles: [],
	layout: [],
	marked: startingMarks(),
	completed: /* @__PURE__ */ new Set(),
	ready: false,
	fitFrame: 0,
	buttonTimer: 0,
	celebrationTimer: 0
};
function markup() {
	return `
    <main class="wrap">
      <h1>RELEASE RADAR&#10022;</h1>
      <div id="bingo-status" class="sr-only" aria-live="polite"></div>

      <div class="actions" aria-label="Board actions">
        <button class="button" type="button" data-action="shuffle" disabled>Shuffle</button>
        <button class="button" type="button" data-action="share" disabled>Share</button>
      </div>

      <section class="card glass" aria-label="Release Radar bingo card">
        <div class="board" aria-label="Release Radar bingo board" aria-busy="true">
          <div class="board-message">LOADING TILES…</div>
        </div>
      </section>
    </main>
  `;
}
function announce(message) {
	ui.status.textContent = "";
	requestAnimationFrame(() => {
		ui.status.textContent = message;
	});
}
function flashButton(button, text) {
	window.clearTimeout(state.buttonTimer);
	const original = button.dataset.label ?? button.textContent ?? "";
	button.dataset.label = original;
	button.textContent = text;
	state.buttonTimer = window.setTimeout(() => {
		button.textContent = original;
		delete button.dataset.label;
	}, 1400);
}
function createElement(tagName, options = {}) {
	const element = document.createElement(tagName);
	if (options.className) element.className = options.className;
	if (options.text !== void 0) element.textContent = options.text;
	for (const [name, value] of Object.entries(options.attributes ?? {})) element.setAttribute(name, value);
	return element;
}
function createFace(className, text) {
	const face = createElement("span", {
		className: `face ${className}`,
		attributes: { "aria-hidden": "true" }
	});
	face.append(createElement("span", {
		className: "label",
		text
	}));
	return face;
}
function createTile(text, index) {
	const marked = state.marked.has(index);
	const tile = createElement("button", {
		className: "tile",
		attributes: {
			type: "button",
			"data-index": String(index),
			"aria-label": `${text}, ${marked ? "marked" : "not marked"}`,
			"aria-pressed": String(marked)
		}
	});
	tile.style.setProperty("--deal-delay", `${index * 12}ms`);
	const inner = createElement("span", { className: "inner" });
	inner.append(createFace("front", text), createFace("back", text));
	tile.append(inner);
	return tile;
}
function scheduleLabelFit() {
	cancelAnimationFrame(state.fitFrame);
	state.fitFrame = requestAnimationFrame(() => {
		state.fitFrame = 0;
		for (const tile of ui.board.querySelectorAll(".tile")) {
			const face = tile.querySelector(".front");
			const label = tile.querySelector(".label");
			if (!face || !label) continue;
			let low = 8;
			let high = Math.max(low, Math.min(face.clientWidth, face.clientHeight) * .6);
			let best = low;
			for (let attempt = 0; attempt < 7; attempt += 1) {
				const size = (low + high) / 2;
				tile.style.setProperty("--size", `${size}px`);
				if (label.scrollWidth <= face.clientWidth - 12 && label.scrollHeight <= face.clientHeight - 12) {
					best = size;
					low = size;
				} else high = size;
			}
			tile.style.setProperty("--size", `${best}px`);
		}
	});
}
function clearCelebration() {
	window.clearTimeout(state.celebrationTimer);
	state.celebrationTimer = 0;
	ui.card.classList.remove("celebrating");
	for (const tile of ui.board.querySelectorAll(".win")) {
		tile.classList.remove("win");
		tile.style.removeProperty("--win-order");
	}
}
function celebrateBingo(newWins) {
	if (reducedMotion?.matches) return;
	clearCelebration();
	ui.card.offsetWidth;
	[...new Set(newWins.flatMap((key) => key.split(",").map(Number)))].forEach((index, order) => {
		const tile = ui.board.children[index];
		if (!(tile instanceof HTMLElement)) return;
		tile.style.setProperty("--win-order", String(order));
		tile.classList.add("win");
	});
	ui.card.classList.add("celebrating");
	state.celebrationTimer = window.setTimeout(clearCelebration, 1850);
}
function renderBoard(layout, marked) {
	if (layout.length !== 25) throw new Error("Invalid board layout");
	clearCelebration();
	state.layout = [...layout];
	state.marked = startingMarks(marked);
	state.completed.clear();
	const fragment = document.createDocumentFragment();
	layout.forEach((text, index) => fragment.append(createTile(text, index)));
	ui.board.replaceChildren(fragment);
	ui.board.setAttribute("aria-busy", "false");
	checkWins(false);
	scheduleLabelFit();
}
function checkWins(celebrate) {
	const wins = winningLineKeys(state.marked);
	const newWins = [...wins].filter((key) => !state.completed.has(key));
	state.completed = wins;
	const winningIndexes = /* @__PURE__ */ new Set();
	for (const key of wins) key.split(",").forEach((index) => winningIndexes.add(Number(index)));
	ui.board.querySelectorAll(".tile").forEach((tile, index) => {
		tile.classList.toggle("winning-line", winningIndexes.has(index));
	});
	if (!celebrate || newWins.length === 0) return;
	celebrateBingo(newWins);
	announce(newWins.length === 1 ? "Bingo! One line completed." : `Bingo! ${newWins.length} lines completed.`);
}
function setTileMarked(tile) {
	const index = Number(tile.dataset.index);
	const marked = !state.marked.has(index);
	if (marked) state.marked.add(index);
	else state.marked.delete(index);
	const text = state.layout[index] ?? "Tile";
	tile.setAttribute("aria-pressed", String(marked));
	tile.setAttribute("aria-label", `${text}, ${marked ? "marked" : "not marked"}`);
	checkWins(true);
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
function shuffleBoard() {
	if (!state.ready) return;
	renderBoard(createBoard(state.tiles), startingMarks());
	saveCard();
	announce("The Release Radar card was shuffled.");
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
		flashButton(ui.share, copied ? "Copied" : "Copy failed");
		announce(copied ? "A link to this card was copied." : "The card link could not be copied.");
	} catch {
		flashButton(ui.share, "Copy failed");
		announce("The card link could not be created.");
	} finally {
		ui.share.disabled = false;
	}
}
function setReady(ready) {
	state.ready = ready;
	ui.shuffle.disabled = !ready;
	ui.share.disabled = !ready;
}
function showLoadError() {
	ui.board.setAttribute("aria-busy", "false");
	ui.board.replaceChildren(createElement("div", {
		className: "board-message",
		text: "COULD NOT LOAD THE TILE CATALOG"
	}));
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
			announce("That shared card was invalid, so a new card was loaded.");
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
	if (target.dataset.action === "shuffle") shuffleBoard();
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
