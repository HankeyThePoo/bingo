(function polyfill() {
	const relList = document.createElement("link").relList;
	if (relList && relList.supports && relList.supports("modulepreload")) return;
	for (const link of document.querySelectorAll("link[rel=\"modulepreload\"]")) processPreload(link);
	new MutationObserver((mutations) => {
		for (const mutation of mutations) {
			if (mutation.type !== "childList") continue;
			for (const node of mutation.addedNodes) if (node.tagName === "LINK" && node.rel === "modulepreload") processPreload(node);
		}
	}).observe(document, {
		childList: true,
		subtree: true
	});
	function getFetchOpts(link) {
		const fetchOpts = {};
		if (link.integrity) fetchOpts.integrity = link.integrity;
		if (link.referrerPolicy) fetchOpts.referrerPolicy = link.referrerPolicy;
		if (link.crossOrigin === "use-credentials") fetchOpts.credentials = "include";
		else if (link.crossOrigin === "anonymous") fetchOpts.credentials = "omit";
		else fetchOpts.credentials = "same-origin";
		return fetchOpts;
	}
	function processPreload(link) {
		if (link.ep) return;
		link.ep = true;
		const fetchOpts = getFetchOpts(link);
		fetch(link.href, fetchOpts);
	}
})();
var FRIDAY_ID = "its-friday";
var BINGO_LINES = [
	...Array.from({ length: 5 }, (_, row) => ({
		id: `row-${row}`,
		positions: Array.from({ length: 5 }, (_, column) => row * 5 + column)
	})),
	...Array.from({ length: 5 }, (_, column) => ({
		id: `column-${column}`,
		positions: Array.from({ length: 5 }, (_, row) => row * 5 + column)
	})),
	{
		id: "diagonal-down",
		positions: [
			0,
			6,
			12,
			18,
			24
		]
	},
	{
		id: "diagonal-up",
		positions: [
			4,
			8,
			12,
			16,
			20
		]
	}
];
function parseCatalog(value) {
	if (!Array.isArray(value)) throw new Error("The tile catalog must be an array.");
	const tiles = [];
	const ids = /* @__PURE__ */ new Set();
	for (const candidate of value) {
		if (!isRecord$1(candidate) || !hasExactKeys$1(candidate, ["id", "label"])) throw new Error("Every tile must contain exactly an id and label.");
		const { id, label } = candidate;
		if (typeof id !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(id) || ids.has(id)) throw new Error("Tile IDs must be unique, lowercase slugs.");
		if (typeof label !== "string" || label.trim() !== label || label.length === 0 || label.length > 60) throw new Error("Tile labels must contain between 1 and 60 characters.");
		ids.add(id);
		tiles.push({
			id,
			label
		});
	}
	if (tiles.filter(({ id }) => id !== "its-friday").length < 24) throw new Error("The catalog needs at least 24 ordinary tiles.");
	const friday = tiles.find(({ id }) => id === FRIDAY_ID);
	if (!friday || friday.label !== "It's Friday") throw new Error("The catalog needs one It's Friday free tile.");
	return tiles;
}
function generateBoard(catalog, random = Math.random) {
	const ordinary = catalog.filter(({ id }) => id !== FRIDAY_ID).map(({ id }) => id);
	if (ordinary.length < 24) throw new Error("There are not enough ordinary tiles to create a board.");
	for (let index = ordinary.length - 1; index > 0; index -= 1) {
		const sample = random();
		if (!Number.isFinite(sample) || sample < 0 || sample >= 1) throw new Error("The random source must return a number from 0 up to 1.");
		const swapIndex = Math.floor(sample * (index + 1));
		[ordinary[index], ordinary[swapIndex]] = [ordinary[swapIndex], ordinary[index]];
	}
	const layout = ordinary.slice(0, 24);
	layout.splice(12, 0, FRIDAY_ID);
	return layout;
}
function createState(layout) {
	const marked = /* @__PURE__ */ new Set([12]);
	return {
		layout: [...layout],
		marked,
		completedLines: completedLineIds(marked)
	};
}
function restoreState(layout, marked) {
	const restoredMarked = new Set(marked);
	restoredMarked.add(12);
	return {
		layout: [...layout],
		marked: restoredMarked,
		completedLines: completedLineIds(restoredMarked)
	};
}
function toggleTile(state, index) {
	if (!Number.isInteger(index) || index < 0 || index >= 25 || index === 12) return {
		state,
		newlyCompletedLineIds: []
	};
	const marked = new Set(state.marked);
	if (marked.has(index)) marked.delete(index);
	else marked.add(index);
	marked.add(12);
	const completedLines = completedLineIds(marked);
	return {
		state: {
			layout: state.layout,
			marked,
			completedLines
		},
		newlyCompletedLineIds: [...completedLines].filter((lineId) => !state.completedLines.has(lineId))
	};
}
function completedLineIds(marked) {
	return new Set(BINGO_LINES.filter(({ positions }) => positions.every((position) => marked.has(position))).map(({ id }) => id));
}
function winningOpportunityPositions(marked) {
	const positions = /* @__PURE__ */ new Set();
	for (const line of BINGO_LINES) {
		const missing = line.positions.filter((position) => !marked.has(position));
		if (missing.length === 1) positions.add(missing[0]);
	}
	return positions;
}
function positionsForLines(lineIds) {
	const requested = new Set(lineIds);
	const positions = /* @__PURE__ */ new Set();
	for (const line of BINGO_LINES) {
		if (!requested.has(line.id)) continue;
		for (const position of line.positions) positions.add(position);
	}
	return positions;
}
function hasManualMarks(state) {
	return [...state.marked].some((index) => index !== 12);
}
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
var MAX_MARKED_MASK = 2 ** 25 - 1;
var COMPACT_LAYOUT_CELLS = 24;
var COMPACT_MARK_BITS = BigInt(COMPACT_LAYOUT_CELLS);
var COMPACT_MARK_MASK = (1n << COMPACT_MARK_BITS) - 1n;
var CATALOG_FINGERPRINT_MODULUS = 4096;
function stateToSnapshot(state) {
	let marked = 0;
	for (const position of state.marked) marked += 2 ** position;
	return {
		layout: [...state.layout],
		marked
	};
}
function parseSnapshot(value, catalog) {
	if (!isRecord(value) || !hasExactKeys(value, ["layout", "marked"])) return null;
	if (!Array.isArray(value.layout) || value.layout.length !== 25 || !Number.isSafeInteger(value.marked) || Number(value.marked) < 0 || Number(value.marked) > MAX_MARKED_MASK) return null;
	const catalogIds = new Set(catalog.map(({ id }) => id));
	const layout = [];
	const seen = /* @__PURE__ */ new Set();
	for (const id of value.layout) {
		if (typeof id !== "string" || !catalogIds.has(id) || seen.has(id)) return null;
		seen.add(id);
		layout.push(id);
	}
	if (layout[12] !== "its-friday" || layout.filter((id) => id === "its-friday").length !== 1) return null;
	const mask = Number(value.marked);
	if (Math.floor(mask / 2 ** 12) % 2 !== 1) return null;
	const marked = /* @__PURE__ */ new Set();
	for (let index = 0; index < 25; index += 1) if (Math.floor(mask / 2 ** index) % 2 === 1) marked.add(index);
	return restoreState(layout, marked);
}
function encodeState(state, catalog) {
	const ordinaryIds = compactCatalogIds(catalog);
	const available = [...ordinaryIds];
	let layoutRank = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		const id = state.layout[index];
		const digit = id ? available.indexOf(id) : -1;
		if (digit < 0) throw new Error("The board cannot be encoded with this catalog.");
		layoutRank = layoutRank * BigInt(available.length) + BigInt(digit);
		available.splice(digit, 1);
	}
	let marked = 0n;
	let markedBit = 0n;
	for (let index = 0; index < 25; index += 1) {
		if (index === 12) continue;
		if (state.marked.has(index)) marked |= 1n << markedBit;
		markedBit += 1n;
	}
	const permutations = permutationCount(ordinaryIds.length, COMPACT_LAYOUT_CELLS);
	return encodeBigInt(BigInt(catalogFingerprint(ordinaryIds)) * permutations + layoutRank << COMPACT_MARK_BITS | marked);
}
function decodeState(payload, catalog) {
	try {
		const ordinaryIds = compactCatalogIds(catalog);
		const permutations = permutationCount(ordinaryIds.length, COMPACT_LAYOUT_CELLS);
		const packed = decodeBigInt(payload);
		if (packed === null) return null;
		const markedMask = packed & COMPACT_MARK_MASK;
		const catalogAndLayout = packed >> COMPACT_MARK_BITS;
		if (Number(catalogAndLayout / permutations) !== catalogFingerprint(ordinaryIds)) return null;
		let layoutRank = catalogAndLayout % permutations;
		const digits = new Array(COMPACT_LAYOUT_CELLS);
		for (let index = COMPACT_LAYOUT_CELLS - 1; index >= 0; index -= 1) {
			const radix = BigInt(ordinaryIds.length - index);
			digits[index] = Number(layoutRank % radix);
			layoutRank /= radix;
		}
		if (layoutRank !== 0n) return null;
		const available = [...ordinaryIds];
		const layout = digits.map((digit) => available.splice(digit, 1)[0]);
		layout.splice(12, 0, FRIDAY_ID);
		const marked = /* @__PURE__ */ new Set();
		let markedBit = 0n;
		for (let index = 0; index < 25; index += 1) {
			if (index === 12) marked.add(index);
			else if ((markedMask & 1n << markedBit) !== 0n) marked.add(index);
			if (index !== 12) markedBit += 1n;
		}
		return restoreState(layout, marked);
	} catch {
		return null;
	}
}
function readBoardHash(hash, catalog) {
	const params = new URLSearchParams(hash.startsWith("#") ? hash.slice(1) : hash);
	if (!params.has("board")) return { kind: "none" };
	const state = decodeState(params.get("board") ?? "", catalog);
	return state ? {
		kind: "valid",
		state
	} : { kind: "invalid" };
}
function compactCatalogIds(catalog) {
	const ids = catalog.filter(({ id }) => id !== FRIDAY_ID).map(({ id }) => id).sort();
	if (ids.length < COMPACT_LAYOUT_CELLS || new Set(ids).size !== ids.length) throw new Error("The catalog cannot be used for compact board identifiers.");
	return ids;
}
function permutationCount(size, count) {
	let result = 1n;
	for (let index = 0; index < count; index += 1) result *= BigInt(size - index);
	return result;
}
function catalogFingerprint(ids) {
	let hash = 2166136261;
	for (const character of ids.join("\0")) hash = Math.imul(hash ^ character.charCodeAt(0), 16777619);
	return (hash >>> 0) % CATALOG_FINGERPRINT_MODULUS;
}
function encodeBigInt(value) {
	const bytes = [];
	do {
		bytes.unshift(Number(value & 255n));
		value >>= 8n;
	} while (value > 0n);
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
function decodeBigInt(payload) {
	if (payload.length === 0 || payload.length > 64 || !/^[A-Za-z0-9_-]+$/u.test(payload)) return null;
	const base64 = payload.replaceAll("-", "+").replaceAll("_", "/");
	const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
	let value = 0n;
	for (const character of atob(padded)) value = value << 8n | BigInt(character.charCodeAt(0));
	return value;
}
function isRecord(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
var BingoController = class {
	catalogSource;
	storage;
	location;
	clipboard;
	view;
	random;
	catalog = [];
	state = null;
	persistenceFailureAnnounced = false;
	constructor(catalogSource, storage, location, clipboard, view, random = Math.random) {
		this.catalogSource = catalogSource;
		this.storage = storage;
		this.location = location;
		this.clipboard = clipboard;
		this.view = view;
		this.random = random;
	}
	start() {
		this.view.bind({
			shuffle: () => this.requestShuffle(),
			confirmShuffle: () => this.shuffleBoard(),
			share: () => void this.shareBoard(),
			toggleTile: (index) => this.markTile(index)
		});
		this.location.subscribe(() => this.restoreSharedBoard());
		this.bootstrap();
	}
	async bootstrap() {
		try {
			this.catalog = await this.catalogSource.load();
		} catch {
			this.view.showFailure();
			return;
		}
		const shared = this.location.read(this.catalog);
		let announcement = "";
		if (shared.kind === "valid") {
			this.state = shared.state;
			announcement = "A shared Release Radar board was loaded.";
		} else {
			const saved = this.storage.load(this.catalog);
			this.state = saved ?? createState(generateBoard(this.catalog, this.random));
			if (shared.kind === "invalid") {
				announcement = saved ? "The shared board link was invalid. Your saved board was restored." : "The shared board link was invalid. A new board was created.";
				this.location.clearBoardHash();
			}
		}
		announcement = this.saveWithAnnouncement(announcement);
		this.view.showReady(this.catalog, this.state);
		if (announcement) this.view.announce(announcement);
	}
	requestShuffle() {
		if (!this.state) return;
		if (hasManualMarks(this.state)) this.view.showShuffleConfirmation();
		else this.shuffleBoard();
	}
	markTile(index) {
		if (!this.state) return;
		if (index === 12) {
			this.view.announceFreeTile(this.state);
			return;
		}
		const tile = this.catalog.find(({ id }) => id === this.state?.layout[index]);
		if (!tile) return;
		const result = toggleTile(this.state, index);
		this.state = result.state;
		this.view.updateState(this.state, result.newlyCompletedLineIds);
		const marked = this.state.marked.has(index);
		const announcement = result.newlyCompletedLineIds.length ? `Bingo! ${result.newlyCompletedLineIds.length === 1 ? "One line" : `${result.newlyCompletedLineIds.length} lines`} completed.` : `${tile.label} ${marked ? "marked" : "unmarked"}.`;
		this.view.announce(this.saveWithAnnouncement(announcement));
	}
	shuffleBoard() {
		if (!this.state) return;
		this.state = createState(generateBoard(this.catalog, this.random));
		this.view.renderBoard(this.state, true);
		this.view.announce(this.saveWithAnnouncement("A new Release Radar board was shuffled."));
	}
	async shareBoard() {
		if (!this.state) return;
		const copied = await this.clipboard.copy(encodeState(this.state, this.catalog));
		if (copied) this.view.showShareCopied();
		this.view.announce(copied ? "The board identifier was copied." : "The board identifier could not be copied.");
	}
	restoreSharedBoard() {
		if (!this.state || this.catalog.length === 0) return;
		const shared = this.location.read(this.catalog);
		if (shared.kind === "none") return;
		if (shared.kind === "invalid") {
			this.location.clearBoardHash();
			this.view.announce("The shared board link was invalid. Your current board was kept.");
			return;
		}
		this.state = shared.state;
		this.view.renderBoard(this.state, true);
		this.view.announce(this.saveWithAnnouncement("A shared Release Radar board was loaded."));
	}
	saveWithAnnouncement(announcement) {
		if (!this.state || this.storage.save(this.state) || this.persistenceFailureAnnounced) return announcement;
		this.persistenceFailureAnnounced = true;
		return [announcement, "Board changes cannot be saved in this browser."].filter(Boolean).join(" ");
	}
};
var BoardLocation = class {
	target;
	constructor(target = window) {
		this.target = target;
	}
	read(catalog) {
		return readBoardHash(this.target.location.hash, catalog);
	}
	clearBoardHash() {
		try {
			const url = new URL(this.target.location.href);
			const params = new URLSearchParams(url.hash.slice(1));
			params.delete("board");
			url.hash = params.toString();
			this.target.history.replaceState(null, "", url);
		} catch {}
	}
	subscribe(listener) {
		this.target.addEventListener("hashchange", listener);
	}
};
var STORAGE_KEY = "release-radar-bingo:board";
function browserStorage() {
	try {
		return window.localStorage;
	} catch {
		return null;
	}
}
var BoardStorage = class {
	storage;
	constructor(storage = browserStorage()) {
		this.storage = storage;
	}
	load(catalog) {
		try {
			const stored = this.storage?.getItem(STORAGE_KEY);
			return stored ? parseSnapshot(JSON.parse(stored), catalog) : null;
		} catch {
			return null;
		}
	}
	save(state) {
		try {
			if (!this.storage) return false;
			this.storage.setItem(STORAGE_KEY, JSON.stringify(stateToSnapshot(state)));
			return true;
		} catch {
			return false;
		}
	}
};
var CatalogSource = class {
	url;
	request;
	constructor(url, request = (...args) => fetch(...args)) {
		this.url = url;
		this.request = request;
	}
	async load() {
		const response = await this.request(this.url, { cache: "no-cache" });
		if (!response.ok) throw new Error(`Tile catalog request failed: ${response.status}`);
		return parseCatalog(await response.json());
	}
};
var ShareClipboard = class {
	target;
	constructor(target = navigator) {
		this.target = target;
	}
	async copy(text) {
		try {
			if (!this.target.clipboard) return false;
			await this.target.clipboard.writeText(text);
			return true;
		} catch {
			return false;
		}
	}
};
var browserAnimationScheduler = {
	requestFrame: (callback) => window.requestAnimationFrame(callback),
	cancelFrame: (handle) => window.cancelAnimationFrame(handle),
	setTimer: (callback, delayMs) => window.setTimeout(callback, delayMs),
	clearTimer: (handle) => window.clearTimeout(handle)
};
var BOARD_CENTER = Math.floor(5 / 2);
var BLACKOUT_WAVE_POSITIONS = Array.from({ length: 25 }, (_, position) => position).sort((left, right) => {
	return Math.abs(Math.floor(left / 5) - BOARD_CENTER) + Math.abs(left % 5 - BOARD_CENTER) - (Math.abs(Math.floor(right / 5) - BOARD_CENTER) + Math.abs(right % 5 - BOARD_CENTER)) || left - right;
});
var BingoView = class {
	root;
	scheduler;
	actions;
	shuffleButton;
	shareButton;
	shareLabel;
	boardCard;
	board;
	boardStatus;
	confirmation;
	confirmationCancel;
	confirmationConfirm;
	liveRegion;
	tilesById = /* @__PURE__ */ new Map();
	announcementFrame = 0;
	fitFrame = 0;
	shareFeedbackTimer = 0;
	shareFeedbackGeneration = 0;
	freeLabelTimer = 0;
	freeLabelTarget = "It's Friday";
	lastBoardWidth = 0;
	confirmationOpen = false;
	constructor(root, scheduler = browserAnimationScheduler) {
		this.root = root;
		this.scheduler = scheduler;
		root.innerHTML = markup();
		this.actions = this.required(".actions");
		this.shuffleButton = this.required(".shuffle-button");
		this.shareButton = this.required(".share-button");
		this.shareLabel = this.required(".share-label");
		this.boardCard = this.required(".board-card");
		this.board = this.required(".board");
		this.boardStatus = this.required(".board-status");
		this.confirmation = this.required(".shuffle-confirmation");
		this.confirmationCancel = this.required(".confirmation-cancel");
		this.confirmationConfirm = this.required(".confirmation-confirm");
		this.liveRegion = this.required(".live-region");
		if (typeof ResizeObserver !== "undefined") new ResizeObserver(([entry]) => {
			const width = entry?.contentRect.width ?? 0;
			if (width <= 0 || Math.abs(width - this.lastBoardWidth) < .5) return;
			this.lastBoardWidth = width;
			this.requestLabelFit();
		}).observe(this.board);
		else window.addEventListener("resize", () => this.requestLabelFit());
		document.fonts?.ready.then(() => this.requestLabelFit());
	}
	bind(handlers) {
		this.shuffleButton.addEventListener("click", handlers.shuffle);
		this.shareButton.addEventListener("click", handlers.share);
		this.board.addEventListener("click", (event) => {
			const target = event.target instanceof Element ? event.target.closest(".tile") : null;
			if (!target) return;
			handlers.toggleTile(Number(target.dataset.index));
		});
		this.confirmationCancel.addEventListener("click", () => {
			this.hideShuffleConfirmation(true);
		});
		this.confirmationConfirm.addEventListener("click", () => {
			this.hideShuffleConfirmation(true);
			handlers.confirmShuffle();
		});
		this.root.addEventListener("keydown", (event) => this.handleKeydown(event), true);
		this.root.addEventListener("pointerdown", () => {
			this.root.classList.remove("keyboard-input");
		});
		this.board.addEventListener("animationend", (event) => {
			if (!(event instanceof AnimationEvent)) return;
			const tile = event.target instanceof Element ? event.target.closest(".tile") : null;
			if (event.animationName === "bingo-deal" && tile?.dataset.index === String(24)) this.board.querySelectorAll(".is-dealing").forEach((element) => {
				element.classList.remove("is-dealing");
			});
			if (event.animationName === "bingo-winning-tile") tile?.classList.remove("is-celebrating");
		});
		this.boardCard.addEventListener("animationend", (event) => {
			if (event instanceof AnimationEvent && event.animationName === "bingo-card-glow") this.boardCard.classList.remove("is-celebrating");
		});
	}
	showReady(catalog, state, deal = true) {
		this.tilesById.clear();
		for (const tile of catalog) this.tilesById.set(tile.id, tile);
		this.boardStatus.hidden = true;
		this.board.hidden = false;
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = false;
		this.shareButton.disabled = false;
		this.renderBoard(state, deal);
	}
	showFailure() {
		this.board.hidden = true;
		this.boardStatus.hidden = false;
		this.boardStatus.textContent = "COULD NOT LOAD THE TILE CATALOG";
		this.boardCard.setAttribute("aria-busy", "false");
		this.shuffleButton.disabled = true;
		this.shareButton.disabled = true;
		this.announce("The tile catalog could not be loaded.");
	}
	renderBoard(state, deal) {
		if (this.freeLabelTimer) this.scheduler.clearTimer(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		this.freeLabelTarget = this.freeTileLabel(state);
		const fragment = document.createDocumentFragment();
		state.layout.forEach((id, index) => {
			const tile = this.tilesById.get(id);
			if (!tile) return;
			const label = index === 12 ? this.freeLabelTarget : tile.label;
			const button = document.createElement("button");
			button.type = "button";
			button.className = "tile";
			button.dataset.index = String(index);
			button.style.setProperty("--deal-order", String(index));
			if (deal) button.classList.add("is-dealing");
			if (index === 12) {
				button.classList.add("free");
				button.setAttribute("aria-disabled", "true");
			}
			const inner = document.createElement("span");
			inner.className = "tile-inner";
			inner.setAttribute("aria-hidden", "true");
			inner.append(this.createFace("tile-face tile-front", label), this.createFace("tile-face tile-back", label));
			button.append(inner);
			fragment.append(button);
		});
		this.board.replaceChildren(fragment);
		this.updateState(state, []);
		this.requestLabelFit();
	}
	updateState(state, newlyCompletedLineIds) {
		const completedPositions = positionsForLines(state.completedLines);
		const winningPositions = winningOpportunityPositions(state.marked);
		this.board.querySelectorAll(".tile").forEach((button, index) => {
			const tile = this.tilesById.get(state.layout[index] ?? "");
			if (!tile) return;
			const marked = state.marked.has(index);
			const winningOpportunity = winningPositions.has(index);
			button.classList.toggle("marked", marked);
			button.classList.toggle("in-completed-line", completedPositions.has(index));
			button.classList.toggle("winning-opportunity", winningOpportunity);
			button.setAttribute("aria-pressed", String(marked));
			button.setAttribute("aria-label", index === 12 ? this.freeTileAriaLabel(state) : `${tile.label}, ${marked ? "marked" : "not marked"}${winningOpportunity ? ", completes bingo" : ""}`);
		});
		this.updateFreeTileLabel(state);
		if (newlyCompletedLineIds.length) this.celebrate(newlyCompletedLineIds, state);
	}
	showShuffleConfirmation() {
		if (this.confirmationOpen) return;
		this.confirmationOpen = true;
		this.confirmation.hidden = false;
		this.confirmation.setAttribute("aria-hidden", "false");
		this.actions.inert = true;
		this.board.inert = true;
		this.confirmationCancel.focus({ preventScroll: true });
	}
	hideShuffleConfirmation(returnFocus) {
		if (!this.confirmationOpen) return;
		this.confirmationOpen = false;
		this.confirmation.hidden = true;
		this.confirmation.setAttribute("aria-hidden", "true");
		this.actions.inert = false;
		this.board.inert = false;
		if (returnFocus) this.shuffleButton.focus({ preventScroll: true });
	}
	showShareCopied() {
		if (this.shareFeedbackTimer) this.scheduler.clearTimer(this.shareFeedbackTimer);
		const generation = ++this.shareFeedbackGeneration;
		this.shareLabel.classList.remove("fading");
		this.shareLabel.textContent = "COPIED";
		this.shareFeedbackTimer = this.scheduler.setTimer(() => {
			this.shareFeedbackTimer = 0;
			this.swapShareLabel("SHARE", generation);
		}, 680);
	}
	announce(message) {
		this.scheduler.cancelFrame(this.announcementFrame);
		this.announcementFrame = 0;
		this.liveRegion.textContent = "";
		if (!message) return;
		this.announcementFrame = this.scheduler.requestFrame(() => {
			this.announcementFrame = 0;
			this.liveRegion.textContent = message;
		});
	}
	announceFreeTile(state) {
		this.announce(`${this.freeTileAriaLabel(state)}.`);
	}
	createFace(className, label) {
		const face = document.createElement("span");
		face.className = className;
		const text = document.createElement("span");
		text.className = "tile-label";
		text.textContent = label;
		face.append(text);
		return face;
	}
	swapShareLabel(text, generation) {
		if (this.shareLabel.textContent === text || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			this.shareLabel.textContent = text;
			return;
		}
		this.shareLabel.classList.remove("fading");
		this.shareLabel.offsetWidth;
		this.shareLabel.classList.add("fading");
		this.scheduler.setTimer(() => {
			if (generation !== this.shareFeedbackGeneration) return;
			this.shareLabel.textContent = text;
			this.shareLabel.classList.remove("fading");
		}, 200);
	}
	updateFreeTileLabel(state) {
		const text = this.freeTileLabel(state);
		if (text === this.freeLabelTarget) return;
		this.freeLabelTarget = text;
		if (this.freeLabelTimer) this.scheduler.clearTimer(this.freeLabelTimer);
		this.freeLabelTimer = 0;
		const labels = this.board.querySelectorAll(".tile.free .tile-label");
		if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
			labels.forEach((label) => {
				label.textContent = text;
				label.classList.remove("fading");
			});
			this.requestLabelFit();
			return;
		}
		labels.forEach((label) => label.classList.add("fading"));
		this.freeLabelTimer = this.scheduler.setTimer(() => {
			this.freeLabelTimer = 0;
			labels.forEach((label) => {
				label.textContent = text;
				label.classList.remove("fading");
			});
			this.requestLabelFit();
		}, 180);
	}
	freeTileLabel(state) {
		if (state.marked.size === 25) return "BLACKOUT";
		return state.completedLines.size > 0 ? "BINGO" : "It's Friday";
	}
	freeTileAriaLabel(state) {
		if (state.marked.size === 25) return "Blackout, full board, free space";
		const lines = state.completedLines.size;
		return lines > 0 ? `Bingo, ${lines} completed ${lines === 1 ? "line" : "lines"}, free space` : "It's Friday, free space";
	}
	celebrate(lineIds, state) {
		const blackout = state.marked.size === 25;
		const winningPositions = blackout ? BLACKOUT_WAVE_POSITIONS : [...positionsForLines(lineIds)].sort((left, right) => left - right);
		const progress = Math.max(0, state.completedLines.size - 1) / (BINGO_LINES.length - 1);
		const intensity = Math.sqrt(progress);
		const scaled = (start, end) => Math.round(start + (end - start) * intensity);
		this.boardCard.style.setProperty("--celebration-lift", `${-scaled(26, 60)}px`);
		this.boardCard.style.setProperty("--celebration-cyan-glow", `${scaled(34, 100)}px`);
		this.boardCard.style.setProperty("--celebration-purple-glow", `${scaled(38, 104)}px`);
		this.boardCard.style.setProperty("--celebration-cyan-color", `rgba(73, 241, 250, ${(.34 + intensity * .24).toFixed(2)})`);
		this.boardCard.style.setProperty("--celebration-purple-color", `rgba(141, 100, 245, ${(.36 + intensity * .24).toFixed(2)})`);
		this.boardCard.style.setProperty("--celebration-tile-duration", `${scaled(900, 1350)}ms`);
		this.boardCard.style.setProperty("--celebration-card-duration", `${scaled(1700, 2600)}ms`);
		this.boardCard.classList.remove("is-celebrating");
		this.board.querySelectorAll(".tile.is-celebrating").forEach((tile) => {
			tile.classList.remove("is-celebrating");
		});
		this.boardCard.offsetWidth;
		winningPositions.forEach((position, order) => {
			const tile = this.board.querySelector(`[data-index="${position}"]`);
			if (!tile) return;
			tile.style.setProperty("--win-delay", `${order * (blackout ? 35 : 80)}ms`);
			tile.classList.add("is-celebrating");
		});
		this.boardCard.classList.add("is-celebrating");
	}
	handleKeydown(event) {
		if (event.key === "Tab" || event.key.startsWith("Arrow")) this.root.classList.add("keyboard-input");
		if (event.key.startsWith("Arrow")) {
			event.preventDefault();
			this.moveBoardFocus(event.key);
		}
		if (!this.confirmationOpen) return;
		if (event.key === "Escape") {
			event.preventDefault();
			this.hideShuffleConfirmation(true);
			return;
		}
		if (event.key !== "Tab") return;
		const first = this.confirmationCancel;
		const last = this.confirmationConfirm;
		if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
	requestLabelFit() {
		this.scheduler.cancelFrame(this.fitFrame);
		this.fitFrame = this.scheduler.requestFrame(() => {
			this.fitFrame = 0;
			this.fitLabels();
		});
	}
	moveBoardFocus(key) {
		const active = document.activeElement instanceof HTMLElement ? document.activeElement.closest(".tile") : null;
		if (!active || !this.board.contains(active)) return;
		const current = Number(active.dataset.index);
		const row = Math.floor(current / 5);
		const column = current % 5;
		const next = key === "ArrowLeft" ? column > 0 ? current - 1 : current : key === "ArrowRight" ? column < 4 ? current + 1 : current : key === "ArrowUp" ? row > 0 ? current - 5 : current : key === "ArrowDown" && row < 4 ? current + 5 : current;
		this.board.querySelector(`[data-index="${next}"]`)?.focus({ preventScroll: true });
	}
	fitLabels() {
		const buttons = this.board.querySelectorAll(".tile");
		for (const button of buttons) {
			const face = button.querySelector(".tile-front");
			const labels = button.querySelectorAll(".tile-label");
			const measure = labels[0];
			if (!face || !measure || face.clientWidth <= 0 || face.clientHeight <= 0) continue;
			const styles = getComputedStyle(face);
			const availableWidth = face.clientWidth - (Number.parseFloat(styles.paddingLeft) || 0) - (Number.parseFloat(styles.paddingRight) || 0);
			const availableHeight = face.clientHeight - (Number.parseFloat(styles.paddingTop) || 0) - (Number.parseFloat(styles.paddingBottom) || 0);
			let low = 6;
			let high = Math.min(availableWidth, availableHeight);
			labels.forEach((label) => {
				label.style.width = `${availableWidth}px`;
			});
			for (let attempt = 0; attempt < 10; attempt += 1) {
				const candidate = (low + high) / 2;
				measure.style.fontSize = `${candidate}px`;
				if (measure.scrollWidth <= availableWidth + .5 && measure.scrollHeight <= availableHeight + .5) low = candidate;
				else high = candidate;
			}
			const fitted = `${Math.floor(low * 10) / 10}px`;
			labels.forEach((label) => {
				label.style.fontSize = fitted;
			});
		}
	}
	required(selector) {
		const element = this.root.querySelector(selector);
		if (!element) throw new Error(`Missing Bingo element: ${selector}`);
		return element;
	}
};
function markup() {
	return `
    <main class="bingo-shell">
      <h1>RELEASE RADAR&#10022;</h1>
      <div class="actions" aria-label="Board actions">
        <button class="button shuffle-button" type="button" disabled>SHUFFLE</button>
        <button class="button share-button" type="button" disabled><span class="share-label">SHARE</span></button>
      </div>
      <div class="board-stage">
        <section class="board-card glass" aria-busy="true">
          <p class="board-status" role="status">LOADING TILES&hellip;</p>
          <div class="board" role="group" aria-label="Release Radar bingo board" hidden></div>
          <div class="shuffle-confirmation" role="dialog" aria-modal="true" aria-labelledby="bingo-shuffle-title" aria-describedby="bingo-shuffle-warning" aria-hidden="true" hidden>
            <div class="confirmation-panel glass">
              <strong id="bingo-shuffle-title">SHUFFLE YOUR BOARD?</strong>
              <span id="bingo-shuffle-warning">YOUR CURRENT MARKS WILL BE LOST.</span>
              <div class="confirmation-actions">
                <button class="button confirmation-cancel" type="button">CANCEL</button>
                <button class="button confirmation-confirm" type="button">SHUFFLE</button>
              </div>
            </div>
          </div>
        </section>
      </div>
      <p class="sr-only live-region" aria-live="polite" aria-atomic="true"></p>
    </main>
  `;
}
var root = document.querySelector("#release-radar-bingo");
if (root && !root.dataset.bingoReady) {
	root.dataset.bingoReady = "true";
	const moduleUrl = new URL(import.meta.url);
	const catalogUrl = new URL("tiles.json", moduleUrl);
	catalogUrl.search = moduleUrl.search;
	new BingoController(new CatalogSource(catalogUrl), new BoardStorage(), new BoardLocation(), new ShareClipboard(), new BingoView(root)).start();
}
