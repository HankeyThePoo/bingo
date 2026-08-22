//#region \0vite/modulepreload-polyfill.js
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
		if (!isRecord$3(candidate) || !hasExactKeys$1(candidate, ["id", "label"])) throw new Error("Every tile must contain exactly an id and label.");
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
function isRecord$3(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys$1(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/catalog-source.ts
async function loadCatalog(url, request = fetch) {
	const response = await request(url, { cache: "no-cache" });
	if (!response.ok) throw new Error(`Tile catalog request failed: ${response.status}`);
	return parseCatalog(await response.json());
}
//#endregion
//#region src/snapshot.ts
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
	if (!isRecord$2(value) || !hasExactKeys(value, ["layout", "marked"])) return null;
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
function isRecord$2(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function hasExactKeys(value, expected) {
	const actual = Object.keys(value).sort();
	const sortedExpected = [...expected].sort();
	return actual.length === sortedExpected.length && sortedExpected.every((key, index) => actual[index] === key);
}
//#endregion
//#region src/spotify-auth.ts
var SPOTIFY_CONFIG_KEY = "release-radar-bingo:spotify-config";
var SPOTIFY_TOKENS_KEY = "release-radar-bingo:spotify-tokens";
var SPOTIFY_TRANSACTION_KEY = "release-radar-bingo:spotify-auth-transaction";
var SPOTIFY_SCOPE = "user-read-currently-playing";
var RECORD_VERSION = 1;
var TOKEN_EXPIRY_MARGIN_MS = 3e4;
var SpotifyAuth = class {
	local;
	session;
	fetcher;
	now;
	constructor(local = browserStorage$1("localStorage"), session = browserStorage$1("sessionStorage"), fetcher = fetch, now = Date.now) {
		this.local = local;
		this.session = session;
		this.fetcher = fetcher;
		this.now = now;
	}
	loadConfig() {
		return readRecord(this.local, SPOTIFY_CONFIG_KEY, parseConfig);
	}
	saveConfig(clientId, redirectUri) {
		const previousConfig = this.loadConfig();
		const hadTokens = this.loadTokens() !== null;
		const config = parseConfig({
			version: RECORD_VERSION,
			clientId: clientId.trim(),
			redirectUri
		});
		if (!config || !writeRecord(this.local, "release-radar-bingo:spotify-config", config)) return null;
		if (hadTokens && (!previousConfig || previousConfig.clientId !== config.clientId || previousConfig.redirectUri !== config.redirectUri)) this.clearTokens();
		return config;
	}
	isConnected() {
		return this.loadConfig() !== null && this.loadTokens() !== null;
	}
	async createAuthorizationUrl(config) {
		try {
			const verifier = randomBase64Url(64);
			const challenge = await sha256Base64Url(verifier);
			const transaction = {
				version: RECORD_VERSION,
				state: randomBase64Url(24),
				verifier,
				redirectUri: config.redirectUri
			};
			if (!writeRecord(this.session, "release-radar-bingo:spotify-auth-transaction", transaction)) return null;
			const url = new URL("https://accounts.spotify.com/authorize");
			url.search = new URLSearchParams({
				client_id: config.clientId,
				response_type: "code",
				redirect_uri: config.redirectUri,
				state: transaction.state,
				scope: SPOTIFY_SCOPE,
				code_challenge_method: "S256",
				code_challenge: challenge
			}).toString();
			return url.toString();
		} catch {
			return null;
		}
	}
	async completeCallback(search) {
		const params = new URLSearchParams(search);
		const code = params.get("code");
		const error = params.get("error");
		if (!code && !error) return { kind: "none" };
		const transaction = readRecord(this.session, SPOTIFY_TRANSACTION_KEY, parseTransaction);
		removeRecord(this.session, SPOTIFY_TRANSACTION_KEY);
		if (error) return {
			kind: "error",
			message: "Spotify authorization was cancelled."
		};
		if (!transaction || params.get("state") !== transaction.state) return {
			kind: "error",
			message: "Spotify authorization could not be verified."
		};
		const config = this.loadConfig();
		if (!config || config.redirectUri !== transaction.redirectUri) return {
			kind: "error",
			message: "Spotify setup changed during authorization."
		};
		try {
			const response = await this.fetcher("https://accounts.spotify.com/api/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "authorization_code",
					code: code ?? "",
					redirect_uri: config.redirectUri,
					client_id: config.clientId,
					code_verifier: transaction.verifier
				})
			});
			if (!response.ok) return {
				kind: "error",
				message: "Spotify rejected the authorization code."
			};
			const token = parseTokenResponse(await response.json(), null, this.now());
			if (!token || !writeRecord(this.local, "release-radar-bingo:spotify-tokens", token)) return {
				kind: "error",
				message: "Spotify tokens could not be saved in this browser."
			};
			return { kind: "connected" };
		} catch {
			return {
				kind: "error",
				message: "Spotify could not be reached during authorization."
			};
		}
	}
	async accessToken(forceRefresh = false) {
		const tokens = this.loadTokens();
		if (!tokens) return null;
		if (!forceRefresh && tokens.expiresAt > this.now() + TOKEN_EXPIRY_MARGIN_MS) return tokens.accessToken;
		const config = this.loadConfig();
		if (!config) return null;
		try {
			const response = await this.fetcher("https://accounts.spotify.com/api/token", {
				method: "POST",
				headers: { "Content-Type": "application/x-www-form-urlencoded" },
				body: new URLSearchParams({
					grant_type: "refresh_token",
					refresh_token: tokens.refreshToken,
					client_id: config.clientId
				})
			});
			if (!response.ok) {
				if (response.status === 400 || response.status === 401) this.clearTokens();
				return null;
			}
			const refreshed = parseTokenResponse(await response.json(), tokens.refreshToken, this.now());
			if (!refreshed || !writeRecord(this.local, "release-radar-bingo:spotify-tokens", refreshed)) return null;
			return refreshed.accessToken;
		} catch {
			return null;
		}
	}
	disconnect() {
		this.clearTokens();
		removeRecord(this.session, SPOTIFY_TRANSACTION_KEY);
	}
	loadTokens() {
		return readRecord(this.local, SPOTIFY_TOKENS_KEY, parseTokens);
	}
	clearTokens() {
		removeRecord(this.local, SPOTIFY_TOKENS_KEY);
	}
};
function currentSpotifyRedirectUri(location = window.location) {
	const url = new URL(location.href);
	url.search = "";
	url.searchParams.set("gm", "1");
	url.hash = "";
	return url.toString();
}
function cleanSpotifyCallbackUrl(location = window.location) {
	const url = new URL(location.href);
	url.searchParams.delete("code");
	url.searchParams.delete("state");
	url.searchParams.delete("error");
	return url.toString();
}
function parseConfig(value) {
	if (!isExactRecord(value, [
		"version",
		"clientId",
		"redirectUri"
	]) || value.version !== RECORD_VERSION) return null;
	if (typeof value.clientId !== "string" || !/^[A-Za-z0-9]{16,64}$/u.test(value.clientId)) return null;
	if (typeof value.redirectUri !== "string" || !validRedirectUri(value.redirectUri)) return null;
	return {
		version: RECORD_VERSION,
		clientId: value.clientId,
		redirectUri: value.redirectUri
	};
}
function parseTokens(value) {
	if (!isExactRecord(value, [
		"version",
		"accessToken",
		"refreshToken",
		"expiresAt"
	]) || value.version !== RECORD_VERSION) return null;
	if (typeof value.accessToken !== "string" || value.accessToken.length < 8 || typeof value.refreshToken !== "string" || value.refreshToken.length < 8 || typeof value.expiresAt !== "number" || !Number.isSafeInteger(value.expiresAt) || value.expiresAt <= 0) return null;
	return {
		version: RECORD_VERSION,
		accessToken: value.accessToken,
		refreshToken: value.refreshToken,
		expiresAt: value.expiresAt
	};
}
function parseTransaction(value) {
	if (!isExactRecord(value, [
		"version",
		"state",
		"verifier",
		"redirectUri"
	]) || value.version !== RECORD_VERSION) return null;
	if (typeof value.state !== "string" || value.state.length < 16 || typeof value.verifier !== "string" || value.verifier.length < 43 || typeof value.redirectUri !== "string" || !validRedirectUri(value.redirectUri)) return null;
	return {
		version: RECORD_VERSION,
		state: value.state,
		verifier: value.verifier,
		redirectUri: value.redirectUri
	};
}
function parseTokenResponse(value, existingRefreshToken, now) {
	if (!isRecord$1(value)) return null;
	const accessToken = value.access_token;
	const refreshToken = value.refresh_token ?? existingRefreshToken;
	const expiresIn = value.expires_in;
	if (typeof accessToken !== "string" || accessToken.length < 8 || typeof refreshToken !== "string" || refreshToken.length < 8 || typeof expiresIn !== "number" || !Number.isFinite(expiresIn) || expiresIn <= 0) return null;
	return {
		version: RECORD_VERSION,
		accessToken,
		refreshToken,
		expiresAt: Math.round(now + expiresIn * 1e3)
	};
}
function validRedirectUri(value) {
	try {
		const url = new URL(value);
		if (url.hash || url.username || url.password) return false;
		if (url.protocol === "https:") return true;
		return url.protocol === "http:" && (url.hostname === "127.0.0.1" || url.hostname === "[::1]");
	} catch {
		return false;
	}
}
function browserStorage$1(kind) {
	try {
		return window[kind];
	} catch {
		return null;
	}
}
function readRecord(storage, key, parse) {
	try {
		if (!storage) return null;
		const raw = storage.getItem(key);
		return raw === null ? null : parse(JSON.parse(raw));
	} catch {
		return null;
	}
}
function writeRecord(storage, key, value) {
	try {
		if (!storage) return false;
		storage.setItem(key, JSON.stringify(value));
		return true;
	} catch {
		return false;
	}
}
function removeRecord(storage, key) {
	try {
		storage?.removeItem(key);
	} catch {}
}
function isRecord$1(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
function isExactRecord(value, keys) {
	if (!isRecord$1(value)) return false;
	const actual = Object.keys(value).sort();
	const expected = [...keys].sort();
	return actual.length === expected.length && expected.every((key, index) => actual[index] === key);
}
function randomBase64Url(bytes) {
	return bytesToBase64Url(crypto.getRandomValues(new Uint8Array(bytes)));
}
async function sha256Base64Url(value) {
	const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
	return bytesToBase64Url(new Uint8Array(digest));
}
function bytesToBase64Url(bytes) {
	let binary = "";
	for (const byte of bytes) binary += String.fromCharCode(byte);
	return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/u, "");
}
//#endregion
//#region src/spotify-api.ts
async function fetchCurrentlyPlaying(accessToken, fetcher = fetch) {
	try {
		const response = await fetcher("https://api.spotify.com/v1/me/player/currently-playing", { headers: { Authorization: `Bearer ${accessToken}` } });
		if (response.status === 204) return { kind: "empty" };
		if (response.status === 401) return { kind: "unauthorized" };
		if (response.status === 429) {
			const seconds = Number.parseFloat(response.headers.get("Retry-After") ?? "");
			return {
				kind: "rate-limited",
				retryAfterMs: Number.isFinite(seconds) && seconds > 0 ? Math.ceil(seconds * 1e3) : 3e3
			};
		}
		if (!response.ok) return { kind: "unavailable" };
		const track = parseCurrentlyPlaying(await response.json());
		return track ? {
			kind: "track",
			track
		} : { kind: "empty" };
	} catch {
		return { kind: "network-error" };
	}
}
function parseCurrentlyPlaying(value) {
	if (!isRecord(value) || !isRecord(value.item) || value.item.type !== "track") return null;
	const item = value.item;
	if (typeof item.id !== "string" || item.id.length === 0 || typeof item.name !== "string" || item.name.length === 0 || typeof item.duration_ms !== "number" || !Number.isFinite(item.duration_ms) || item.duration_ms <= 0 || !Array.isArray(item.artists) || !isRecord(item.album)) return null;
	const artists = item.artists.filter(isRecord).map((artist) => artist.name).filter((name) => typeof name === "string" && name.length > 0);
	if (!artists.length || typeof item.album.name !== "string") return null;
	const artworkUrl = (Array.isArray(item.album.images) ? item.album.images.filter(isRecord) : []).map((image) => image.url).find((url) => typeof url === "string" && /^https:\/\//u.test(url)) ?? null;
	const externalUrls = isRecord(item.external_urls) ? item.external_urls : null;
	const spotifyUrl = typeof externalUrls?.spotify === "string" ? externalUrls.spotify : null;
	const progress = typeof value.progress_ms === "number" && Number.isFinite(value.progress_ms) ? Math.max(0, Math.min(item.duration_ms, value.progress_ms)) : 0;
	return {
		id: item.id,
		title: item.name,
		artists: artists.join(", "),
		album: item.album.name,
		artworkUrl,
		spotifyUrl,
		explicit: item.explicit === true,
		durationMs: item.duration_ms,
		progressMs: progress,
		isPlaying: value.is_playing === true
	};
}
function isRecord(value) {
	return !!value && typeof value === "object" && !Array.isArray(value);
}
//#endregion
//#region src/spotify-monitor.ts
var POLL_INTERVAL_MS = 3e3;
var SpotifyMonitor = class {
	auth;
	onResult;
	page;
	loadCurrentlyPlaying;
	timer = 0;
	generation = 0;
	running = false;
	constructor(auth, onResult, page = document, loadCurrentlyPlaying = fetchCurrentlyPlaying) {
		this.auth = auth;
		this.onResult = onResult;
		this.page = page;
		this.loadCurrentlyPlaying = loadCurrentlyPlaying;
		this.page.addEventListener("visibilitychange", () => this.handleVisibility());
	}
	start() {
		if (this.running) return;
		this.running = true;
		this.generation += 1;
		if (!this.page.hidden) this.schedule(0, this.generation);
	}
	stop() {
		this.running = false;
		this.generation += 1;
		this.clearTimer();
	}
	handleVisibility() {
		if (!this.running) return;
		if (this.page.hidden) {
			this.clearTimer();
			this.generation += 1;
			return;
		}
		this.generation += 1;
		this.schedule(0, this.generation);
	}
	schedule(delay, generation) {
		this.clearTimer();
		this.timer = window.setTimeout(() => {
			this.timer = 0;
			this.poll(generation);
		}, delay);
	}
	async poll(generation) {
		if (!this.running || this.page.hidden || generation !== this.generation) return;
		let accessToken = await this.auth.accessToken();
		if (!this.current(generation)) return;
		if (!accessToken) {
			this.onResult({ kind: "auth-required" });
			this.stop();
			return;
		}
		let result = await this.loadCurrentlyPlaying(accessToken);
		if (!this.current(generation)) return;
		if (result.kind === "unauthorized") {
			accessToken = await this.auth.accessToken(true);
			if (!this.current(generation)) return;
			if (!accessToken) {
				this.onResult({ kind: "auth-required" });
				this.stop();
				return;
			}
			result = await this.loadCurrentlyPlaying(accessToken);
			if (!this.current(generation)) return;
		}
		this.onResult(result);
		if (result.kind === "unauthorized") {
			this.onResult({ kind: "auth-required" });
			this.stop();
			return;
		}
		this.schedule(result.kind === "rate-limited" ? result.retryAfterMs : POLL_INTERVAL_MS, generation);
	}
	current(generation) {
		return this.running && !this.page.hidden && generation === this.generation;
	}
	clearTimer() {
		if (this.timer) window.clearTimeout(this.timer);
		this.timer = 0;
	}
};
//#endregion
//#region src/gm-prototype.ts
var MODAL_TRANSITION_MS = 180;
var GmPrototype = class {
	root;
	playerBoard;
	shuffleButton;
	shareButton;
	verifyModeButton;
	verifier;
	verifierGrid;
	verifierForm;
	verifierInput;
	verifierStatus;
	calls;
	search;
	trackingButton;
	historyButton;
	historyModal;
	historyPanel;
	historyClose;
	spotifyStatus;
	artwork;
	artworkFallback;
	trackTitle;
	trackArtists;
	trackAlbum;
	explicitBadge;
	progressFill;
	progressCurrent;
	progressState;
	progressDuration;
	spotifyModal;
	spotifyPanel;
	spotifyForm;
	spotifyClientId;
	spotifyRedirectUri;
	spotifyError;
	spotifyCancel;
	spotifyDisconnect;
	spotifyAuth = new SpotifyAuth();
	spotifyMonitor;
	catalog = [];
	catalogById = /* @__PURE__ */ new Map();
	verifierOpen = false;
	historyOpen = false;
	spotifyOpen = false;
	tracking = false;
	modalCloseTimer = 0;
	lastTrack = null;
	constructor(root) {
		this.root = root;
		const shell = root.querySelector(".bingo-shell");
		if (!shell) throw new Error("The Bingo shell must exist before GM mode is enabled.");
		const actions = this.required(".actions");
		this.playerBoard = this.required(".board");
		this.shuffleButton = this.required(".shuffle-button");
		this.shareButton = this.required(".share-button");
		actions.insertAdjacentHTML("beforeend", actionMarkup());
		shell.insertAdjacentHTML("beforeend", panelMarkup());
		this.required(".board-card").insertAdjacentHTML("beforeend", verifierMarkup());
		root.insertAdjacentHTML("beforeend", `${historyMarkup()}${spotifyMarkup()}`);
		root.classList.add("gm-mode");
		this.verifyModeButton = this.required(".gm-verify-mode-button");
		this.verifier = this.required(".gm-verifier-stage");
		this.verifierGrid = this.required(".gm-verifier-grid");
		this.verifierForm = this.required(".gm-verifier-form");
		this.verifierInput = this.required(".gm-verifier-input");
		this.verifierStatus = this.required(".gm-verifier-status");
		this.calls = this.required(".gm-call-list");
		this.search = this.required(".gm-call-search");
		this.trackingButton = this.required(".gm-tracking-button");
		this.historyButton = this.required(".gm-history-button");
		this.historyModal = this.required(".gm-history-modal");
		this.historyPanel = this.required(".gm-history-panel");
		this.historyClose = this.required(".gm-history-close");
		this.spotifyStatus = this.required(".gm-spotify-status");
		this.artwork = this.required(".gm-artwork");
		this.artworkFallback = this.required(".gm-artwork-fallback");
		this.trackTitle = this.required(".gm-track-title");
		this.trackArtists = this.required(".gm-track-artists");
		this.trackAlbum = this.required(".gm-track-album");
		this.explicitBadge = this.required(".gm-explicit-badge");
		this.progressFill = this.required(".gm-progress-placeholder span");
		this.progressCurrent = this.required(".gm-progress-current");
		this.progressState = this.required(".gm-progress-state");
		this.progressDuration = this.required(".gm-progress-duration");
		this.spotifyModal = this.required(".gm-spotify-modal");
		this.spotifyPanel = this.required(".gm-spotify-panel");
		this.spotifyForm = this.required(".gm-spotify-form");
		this.spotifyClientId = this.required(".gm-spotify-client-id");
		this.spotifyRedirectUri = this.required(".gm-spotify-redirect-uri");
		this.spotifyError = this.required(".gm-spotify-error");
		this.spotifyCancel = this.required(".gm-spotify-cancel");
		this.spotifyDisconnect = this.required(".gm-spotify-disconnect");
		this.spotifyMonitor = new SpotifyMonitor(this.spotifyAuth, (result) => this.handleSpotifyResult(result));
		this.renderEmptyVerifier();
		this.bind();
		this.initializeSpotify();
	}
	setCatalog(catalog) {
		this.catalog = catalog.filter(({ id }) => id !== FRIDAY_ID);
		this.catalogById = new Map(catalog.map((tile) => [tile.id, tile]));
		this.verifyModeButton.disabled = false;
		this.renderCalls();
	}
	bind() {
		this.search.addEventListener("input", () => this.renderCalls());
		this.verifyModeButton.addEventListener("click", () => this.setVerifierOpen(!this.verifierOpen));
		this.verifierForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.verifyIdentifier();
		});
		this.trackingButton.addEventListener("click", () => this.toggleTracking());
		this.historyButton.addEventListener("click", () => this.openHistory());
		this.historyClose.addEventListener("click", () => this.closeHistory());
		this.historyModal.addEventListener("click", (event) => {
			if (event.target === this.historyModal) this.closeHistory();
		});
		this.spotifyStatus.addEventListener("click", () => this.openSpotify());
		this.spotifyCancel.addEventListener("click", () => this.closeSpotify());
		this.spotifyDisconnect.addEventListener("click", () => this.disconnectSpotify());
		this.spotifyModal.addEventListener("click", (event) => {
			if (event.target === this.spotifyModal) this.closeSpotify();
		});
		this.spotifyForm.addEventListener("submit", (event) => {
			event.preventDefault();
			this.connectSpotify();
		});
		this.root.addEventListener("keydown", (event) => this.handleKeydown(event), true);
		window.addEventListener("resize", () => {
			if (this.verifierOpen) this.requestVerifierLabelFit();
		});
	}
	setVerifierOpen(open) {
		if (open === this.verifierOpen || open && !this.catalogById.size) return;
		this.verifierOpen = open;
		this.root.classList.toggle("gm-verifier-open", open);
		this.playerBoard.hidden = open;
		this.verifier.hidden = !open;
		this.shuffleButton.disabled = open;
		this.shareButton.disabled = open;
		this.verifyModeButton.setAttribute("aria-pressed", String(open));
		this.verifyModeButton.textContent = open ? "BOARD" : "VERIFY";
		if (open) {
			this.verifierInput.focus({ preventScroll: true });
			this.requestVerifierLabelFit();
			this.announce("Bingo verifier opened.");
		} else {
			this.shuffleButton.disabled = false;
			this.shareButton.disabled = false;
			this.verifyModeButton.focus({ preventScroll: true });
			this.announce("Returned to your Bingo board.");
		}
	}
	verifyIdentifier() {
		const identifier = extractIdentifier(this.verifierInput.value);
		const state = identifier ? decodeState(identifier, [...this.catalogById.values()]) : null;
		if (!state) {
			this.renderEmptyVerifier("INVALID BOARD IDENTIFIER", "invalid");
			this.announce("The board identifier is invalid.");
			return;
		}
		this.renderVerifiedBoard(state);
	}
	renderVerifiedBoard(state) {
		const completedPositions = positionsForLines(state.completedLines);
		const blackout = state.marked.size === 25;
		const fragment = document.createDocumentFragment();
		state.layout.forEach((id, index) => {
			const tile = this.catalogById.get(id);
			if (!tile) return;
			const cell = document.createElement("span");
			cell.className = "gm-verify-cell";
			cell.classList.toggle("marked", state.marked.has(index));
			cell.classList.toggle("in-completed-line", completedPositions.has(index));
			const label = document.createElement("span");
			label.className = "gm-verify-label";
			label.textContent = index === 12 ? blackout ? "BLACKOUT" : state.completedLines.size ? "BINGO" : tile.label : tile.label;
			cell.append(label);
			fragment.append(cell);
		});
		this.verifierGrid.replaceChildren(fragment);
		const lines = state.completedLines.size;
		this.setVerifierStatus(blackout ? "BLACKOUT FOUND" : lines ? `${lines} BINGO ${lines === 1 ? "LINE" : "LINES"} FOUND` : "VALID BOARD — NO BINGO", blackout || lines ? "success" : "valid");
		this.announce(blackout ? "Blackout found in the submitted board." : lines ? `${lines} completed Bingo ${lines === 1 ? "line" : "lines"} found in the submitted board.` : "The submitted board is valid but has no Bingo.");
		this.requestVerifierLabelFit();
	}
	renderEmptyVerifier(message = "PASTE A BOARD IDENTIFIER", tone = "idle") {
		const cells = Array.from({ length: 25 }, () => {
			const cell = document.createElement("span");
			cell.className = "gm-verify-cell empty";
			return cell;
		});
		this.verifierGrid.replaceChildren(...cells);
		this.setVerifierStatus(message, tone);
	}
	setVerifierStatus(message, tone) {
		this.verifierStatus.textContent = message;
		this.verifierStatus.dataset.tone = tone;
	}
	renderCalls() {
		const query = this.search.value.trim().toLocaleLowerCase();
		const visible = query ? this.catalog.filter(({ label }) => label.toLocaleLowerCase().includes(query)) : this.catalog;
		if (!visible.length) {
			const empty = document.createElement("p");
			empty.className = "gm-empty";
			empty.textContent = "NO MATCHING CALLS";
			this.calls.replaceChildren(empty);
			return;
		}
		this.calls.replaceChildren(...visible.map(({ id, label }) => {
			const call = document.createElement("button");
			call.type = "button";
			call.className = "gm-call";
			call.dataset.callId = id;
			call.textContent = label;
			call.disabled = true;
			call.title = "A playing song is required before calls can be recorded.";
			return call;
		}));
	}
	toggleTracking() {
		this.tracking = !this.tracking;
		this.trackingButton.textContent = this.tracking ? "STOP TRACKING" : "START TRACKING";
		this.trackingButton.setAttribute("aria-pressed", String(this.tracking));
		this.root.classList.toggle("gm-is-tracking", this.tracking);
		this.announce(this.tracking ? "Session tracking started. Waiting for a Spotify track." : "Session tracking stopped.");
	}
	async initializeSpotify() {
		const callback = await this.spotifyAuth.completeCallback(window.location.search);
		if (callback.kind !== "none") try {
			window.history.replaceState(null, "", cleanSpotifyCallbackUrl());
		} catch {}
		if (callback.kind === "error") {
			this.setSpotifyStatus("CONNECT", "disconnected");
			this.openSpotify(callback.message);
			this.announce(callback.message);
			return;
		}
		if (this.spotifyAuth.isConnected()) {
			this.setSpotifyStatus("CONNECTING", "connecting");
			this.spotifyMonitor.start();
			if (callback.kind === "connected") this.announce("Spotify connected.");
			return;
		}
		this.setSpotifyStatus(this.spotifyAuth.loadConfig() ? "CONNECT" : "SET UP", "disconnected");
	}
	openSpotify(message = "") {
		if (this.spotifyOpen || this.historyOpen) return;
		if (this.modalCloseTimer) window.clearTimeout(this.modalCloseTimer);
		this.modalCloseTimer = 0;
		const config = this.spotifyAuth.loadConfig();
		this.spotifyClientId.value = config?.clientId ?? "";
		this.spotifyRedirectUri.value = currentSpotifyRedirectUri();
		this.spotifyError.textContent = message;
		this.spotifyDisconnect.hidden = !this.spotifyAuth.isConnected();
		this.spotifyOpen = true;
		this.root.classList.add("gm-spotify-open");
		this.spotifyModal.setAttribute("aria-hidden", "false");
		this.spotifyStatus.setAttribute("aria-expanded", "true");
		this.spotifyPanel.focus({ preventScroll: true });
		requestAnimationFrame(() => {
			if (!this.spotifyOpen) return;
			this.root.classList.add("gm-spotify-visible");
			window.setTimeout(() => {
				if (this.spotifyOpen) this.spotifyClientId.focus({ preventScroll: true });
			}, MODAL_TRANSITION_MS);
		});
	}
	closeSpotify() {
		if (!this.spotifyOpen) return;
		this.spotifyOpen = false;
		this.root.classList.remove("gm-spotify-visible");
		this.spotifyModal.setAttribute("aria-hidden", "true");
		this.spotifyStatus.setAttribute("aria-expanded", "false");
		const finish = () => {
			this.modalCloseTimer = 0;
			this.root.classList.remove("gm-spotify-open");
			this.spotifyStatus.focus({ preventScroll: true });
		};
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
		else this.modalCloseTimer = window.setTimeout(finish, MODAL_TRANSITION_MS);
	}
	async connectSpotify() {
		this.spotifyError.textContent = "";
		const config = this.spotifyAuth.saveConfig(this.spotifyClientId.value, this.spotifyRedirectUri.value);
		if (!config) {
			this.spotifyError.textContent = "ENTER A VALID SPOTIFY CLIENT ID.";
			this.spotifyClientId.focus({ preventScroll: true });
			return;
		}
		const authorizationUrl = await this.spotifyAuth.createAuthorizationUrl(config);
		if (!authorizationUrl) {
			this.spotifyError.textContent = "AUTHORIZATION COULD NOT BE STARTED IN THIS BROWSER.";
			return;
		}
		window.location.assign(authorizationUrl);
	}
	disconnectSpotify() {
		this.spotifyMonitor.stop();
		this.spotifyAuth.disconnect();
		this.setSpotifyStatus("CONNECT", "disconnected");
		this.closeSpotify();
		this.announce("Spotify disconnected.");
	}
	handleSpotifyResult(result) {
		switch (result.kind) {
			case "track":
				this.renderSpotifyTrack(result.track);
				this.setSpotifyStatus(result.track.isPlaying ? "CONNECTED" : "PAUSED", "connected");
				return;
			case "empty":
				this.setSpotifyStatus("IDLE", "connected");
				if (!this.lastTrack) {
					this.trackTitle.textContent = "NOTHING PLAYING";
					this.trackArtists.textContent = "Start a track in Spotify to display it here.";
				}
				return;
			case "rate-limited":
				this.setSpotifyStatus("WAITING", "waiting");
				return;
			case "network-error":
			case "unavailable":
				this.setSpotifyStatus("RETRYING", "waiting");
				return;
			case "unauthorized":
			case "auth-required":
				this.setSpotifyStatus("CONNECT", "disconnected");
				return;
		}
	}
	renderSpotifyTrack(track) {
		this.lastTrack = track;
		if (track.artworkUrl) {
			this.artwork.src = track.artworkUrl;
			this.artwork.alt = `${track.album} artwork`;
			this.artwork.hidden = false;
			this.artworkFallback.hidden = true;
		} else {
			this.artwork.removeAttribute("src");
			this.artwork.alt = "";
			this.artwork.hidden = true;
			this.artworkFallback.hidden = false;
		}
		this.trackTitle.textContent = track.title;
		if (track.spotifyUrl) {
			this.trackTitle.href = track.spotifyUrl;
			this.trackTitle.target = "_blank";
			this.trackTitle.rel = "noreferrer";
		} else {
			this.trackTitle.removeAttribute("href");
			this.trackTitle.removeAttribute("target");
			this.trackTitle.removeAttribute("rel");
		}
		this.trackArtists.textContent = track.artists;
		this.trackAlbum.textContent = track.album;
		this.explicitBadge.hidden = !track.explicit;
		const progress = track.durationMs > 0 ? track.progressMs / track.durationMs * 100 : 0;
		this.progressFill.style.width = `${Math.max(0, Math.min(100, progress))}%`;
		this.progressCurrent.textContent = formatTime(track.progressMs);
		this.progressState.textContent = track.isPlaying ? "PLAYING" : "PAUSED";
		this.progressDuration.textContent = formatTime(track.durationMs);
	}
	setSpotifyStatus(text, state) {
		this.spotifyStatus.textContent = text;
		this.spotifyStatus.dataset.state = state;
		this.root.classList.toggle("gm-spotify-connected", state === "connected");
	}
	openHistory() {
		if (this.historyOpen) return;
		if (this.modalCloseTimer) window.clearTimeout(this.modalCloseTimer);
		this.modalCloseTimer = 0;
		this.historyOpen = true;
		this.root.classList.add("gm-history-open");
		this.historyModal.setAttribute("aria-hidden", "false");
		this.historyButton.setAttribute("aria-expanded", "true");
		this.historyPanel.focus({ preventScroll: true });
		requestAnimationFrame(() => {
			if (!this.historyOpen) return;
			this.root.classList.add("gm-history-visible");
			window.setTimeout(() => {
				if (this.historyOpen) this.historyClose.focus({ preventScroll: true });
			}, MODAL_TRANSITION_MS);
		});
	}
	closeHistory() {
		if (!this.historyOpen) return;
		this.historyOpen = false;
		this.root.classList.remove("gm-history-visible");
		this.historyModal.setAttribute("aria-hidden", "true");
		this.historyButton.setAttribute("aria-expanded", "false");
		const finish = () => {
			this.modalCloseTimer = 0;
			this.root.classList.remove("gm-history-open");
			this.historyButton.focus({ preventScroll: true });
		};
		if (matchMedia("(prefers-reduced-motion: reduce)").matches) finish();
		else this.modalCloseTimer = window.setTimeout(finish, MODAL_TRANSITION_MS);
	}
	handleKeydown(event) {
		if (this.spotifyOpen) {
			if (event.key === "Escape") {
				event.preventDefault();
				this.closeSpotify();
			} else this.trapModalFocus(event, this.spotifyPanel);
			return;
		}
		if (!this.historyOpen) return;
		if (event.key === "Escape") {
			event.preventDefault();
			this.closeHistory();
			return;
		}
		this.trapModalFocus(event, this.historyPanel);
	}
	trapModalFocus(event, panel) {
		if (event.key !== "Tab") return;
		const focusable = [...panel.querySelectorAll("button:not([disabled]), input:not([disabled])")].filter((element) => !element.hidden);
		const first = focusable[0];
		const last = focusable.at(-1);
		if (!first || !last) return;
		if (!panel.contains(document.activeElement)) {
			event.preventDefault();
			(event.shiftKey ? last : first).focus();
		} else if (event.shiftKey && document.activeElement === first) {
			event.preventDefault();
			last.focus();
		} else if (!event.shiftKey && document.activeElement === last) {
			event.preventDefault();
			first.focus();
		}
	}
	requestVerifierLabelFit() {
		requestAnimationFrame(() => this.fitVerifierLabels());
	}
	fitVerifierLabels() {
		for (const label of this.verifierGrid.querySelectorAll(".gm-verify-label")) {
			const cell = label.parentElement;
			if (!cell || cell.clientWidth <= 0 || cell.clientHeight <= 0) continue;
			const availableWidth = cell.clientWidth - 12;
			const availableHeight = cell.clientHeight - 12;
			let low = 6;
			let high = Math.min(availableWidth, availableHeight);
			label.style.width = `${availableWidth}px`;
			for (let attempt = 0; attempt < 9; attempt += 1) {
				const candidate = (low + high) / 2;
				label.style.fontSize = `${candidate}px`;
				if (label.scrollWidth <= availableWidth + .5 && label.scrollHeight <= availableHeight + .5) low = candidate;
				else high = candidate;
			}
			label.style.fontSize = `${Math.floor(low * 10) / 10}px`;
		}
	}
	announce(message) {
		const region = this.root.querySelector(".live-region");
		if (!region) return;
		region.textContent = "";
		requestAnimationFrame(() => {
			region.textContent = message;
		});
	}
	required(selector) {
		const element = this.root.querySelector(selector);
		if (!element) throw new Error(`Missing GM prototype element: ${selector}`);
		return element;
	}
};
function extractIdentifier(value) {
	const trimmed = value.trim();
	if (!trimmed) return "";
	try {
		const url = new URL(trimmed, window.location.href);
		const board = new URLSearchParams(url.hash.startsWith("#") ? url.hash.slice(1) : url.hash).get("board");
		if (board) return board;
	} catch {}
	if (trimmed.startsWith("#")) return new URLSearchParams(trimmed.slice(1)).get("board") ?? trimmed;
	return trimmed;
}
function formatTime(milliseconds) {
	const seconds = Math.max(0, Math.floor(milliseconds / 1e3));
	return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;
}
function actionMarkup() {
	return `<button class="button gm-verify-mode-button" type="button" aria-pressed="false" disabled>VERIFY</button>`;
}
function panelMarkup() {
	return `
    <aside class="gm-side gm-now-playing glass" aria-label="Spotify and session">
      <header class="gm-panel-heading">
        <span><small>SPOTIFY</small><strong>NOW PLAYING</strong></span>
        <button class="gm-spotify-status" type="button" data-state="disconnected" aria-haspopup="dialog" aria-expanded="false">SET UP</button>
      </header>
      <div class="gm-artwork-placeholder">
        <img class="gm-artwork" alt="" hidden>
        <span class="gm-artwork-fallback" aria-hidden="true">✦</span>
      </div>
      <div class="gm-track-placeholder">
        <span class="gm-track-heading"><a class="gm-track-title">NO TRACK DETECTED</a><small class="gm-explicit-badge" hidden>EXPLICIT</small></span>
        <span class="gm-track-artists">Connect Spotify to display the current release.</span>
        <span class="gm-track-album"></span>
      </div>
      <div class="gm-progress-placeholder"><span></span></div>
      <div class="gm-track-stats"><span class="gm-progress-current">0:00</span><span class="gm-progress-state">SONG —</span><span class="gm-progress-duration">0:00</span></div>
      <footer class="gm-session-controls">
        <button class="gm-control gm-control-primary gm-tracking-button" type="button" aria-pressed="false">START TRACKING</button>
        <button class="gm-control gm-history-button" type="button" aria-haspopup="dialog" aria-expanded="false">HISTORY</button>
      </footer>
    </aside>
    <aside class="gm-side gm-calls-panel glass" aria-label="Calls">
      <header class="gm-panel-heading">
        <span><small>SELECTED SONG</small><strong>CALLS</strong></span>
        <em>NO SONG</em>
      </header>
      <label class="gm-search">
        <span class="sr-only">Search calls</span>
        <input class="gm-call-search" type="search" placeholder="SEARCH CALLS…" autocomplete="off">
        <span aria-hidden="true">⌕</span>
      </label>
      <div class="gm-call-list"><p class="gm-empty">LOADING CALLS…</p></div>
    </aside>`;
}
function verifierMarkup() {
	return `
    <section class="gm-verifier-stage" aria-label="Bingo verifier" hidden>
      <div class="gm-verifier-grid" role="img" aria-label="Submitted Bingo board"></div>
      <form class="gm-verifier-form">
        <label><span class="sr-only">Board identifier or URL</span><input class="gm-verifier-input" type="text" placeholder="BOARD IDENTIFIER OR URL…" autocomplete="off"></label>
        <button class="button gm-verify-submit" type="submit">CHECK</button>
        <p class="gm-verifier-status" data-tone="idle" aria-live="polite"></p>
      </form>
    </section>`;
}
function historyMarkup() {
	return `
    <div class="gm-history-modal" aria-hidden="true">
      <section class="gm-history-panel glass" role="dialog" aria-modal="true" aria-labelledby="gm-history-title" tabindex="-1">
        <header class="gm-history-title">
          <span><small>CURRENT SESSION</small><strong id="gm-history-title">SONG HISTORY</strong></span>
          <em>0 SONGS</em>
        </header>
        <div class="gm-history-columns"><span>#</span><span>ARTIST / TITLE</span><span>CALLS</span></div>
        <p class="gm-history-empty">START TRACKING TO BUILD THE SESSION HISTORY</p>
        <div class="gm-history-actions">
          <button class="button gm-history-close" type="button">CLOSE</button>
        </div>
      </section>
    </div>`;
}
function spotifyMarkup() {
	return `
    <div class="gm-spotify-modal" aria-hidden="true">
      <section class="gm-spotify-panel glass" role="dialog" aria-modal="true" aria-labelledby="gm-spotify-title" aria-describedby="gm-spotify-description" tabindex="-1">
        <header class="gm-spotify-title">
          <small>ONE-TIME SETUP</small>
          <strong id="gm-spotify-title">CONNECT SPOTIFY</strong>
        </header>
        <p id="gm-spotify-description">CREATE A SPOTIFY DEVELOPER APP, THEN ENTER ITS PUBLIC CLIENT ID. THE CLIENT SECRET IS NEVER USED.</p>
        <form class="gm-spotify-form">
          <label><span>CLIENT ID</span><input class="gm-spotify-client-id" type="text" inputmode="text" autocomplete="off" spellcheck="false" placeholder="SPOTIFY CLIENT ID" required></label>
          <label><span>REDIRECT URI</span><input class="gm-spotify-redirect-uri" type="url" readonly></label>
          <p class="gm-spotify-hint">ADD THIS EXACT REDIRECT URI TO YOUR SPOTIFY APP SETTINGS.</p>
          <p class="gm-spotify-error" role="alert"></p>
          <div class="gm-spotify-actions">
            <button class="button gm-spotify-cancel" type="button">CANCEL</button>
            <button class="button gm-spotify-disconnect" type="button" hidden>DISCONNECT</button>
            <button class="button gm-spotify-connect" type="submit">SAVE &amp; CONNECT</button>
          </div>
        </form>
      </section>
    </div>`;
}
//#endregion
//#region src/storage.ts
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
			if (!this.storage) return null;
			const stored = this.storage.getItem(STORAGE_KEY);
			if (stored === null) return null;
			return parseSnapshot(JSON.parse(stored), catalog);
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
//#endregion
//#region src/view.ts
var BOARD_CENTER = Math.floor(5 / 2);
var BLACKOUT_WAVE_POSITIONS = Array.from({ length: 25 }, (_, position) => position).sort((left, right) => {
	return Math.abs(Math.floor(left / 5) - BOARD_CENTER) + Math.abs(left % 5 - BOARD_CENTER) - (Math.abs(Math.floor(right / 5) - BOARD_CENTER) + Math.abs(right % 5 - BOARD_CENTER)) || left - right;
});
var BingoView = class {
	root;
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
	constructor(root) {
		this.root = root;
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
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
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
		if (this.shareFeedbackTimer) window.clearTimeout(this.shareFeedbackTimer);
		const generation = ++this.shareFeedbackGeneration;
		this.shareLabel.classList.remove("fading");
		this.shareLabel.textContent = "COPIED";
		this.shareFeedbackTimer = window.setTimeout(() => {
			this.shareFeedbackTimer = 0;
			this.swapShareLabel("SHARE", generation);
		}, 680);
	}
	announce(message) {
		cancelAnimationFrame(this.announcementFrame);
		this.announcementFrame = 0;
		this.liveRegion.textContent = "";
		if (!message) return;
		this.announcementFrame = requestAnimationFrame(() => {
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
		window.setTimeout(() => {
			if (generation !== this.shareFeedbackGeneration) return;
			this.shareLabel.textContent = text;
			this.shareLabel.classList.remove("fading");
		}, 200);
	}
	updateFreeTileLabel(state) {
		const text = this.freeTileLabel(state);
		if (text === this.freeLabelTarget) return;
		this.freeLabelTarget = text;
		if (this.freeLabelTimer) window.clearTimeout(this.freeLabelTimer);
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
		this.freeLabelTimer = window.setTimeout(() => {
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
		cancelAnimationFrame(this.fitFrame);
		this.fitFrame = requestAnimationFrame(() => {
			this.fitFrame = 0;
			this.fitLabels();
		});
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
//#endregion
//#region src/main.ts
var root = document.querySelector("#release-radar-bingo");
var gmMode = new URLSearchParams(window.location.search).get("gm") === "1";
if (root && !root.dataset.bingoReady) {
	root.dataset.bingoReady = "true";
	const view = new BingoView(root);
	const gmPrototype = gmMode ? new GmPrototype(root) : null;
	const storage = new BoardStorage();
	let catalog = [];
	let state = null;
	let persistenceFailureAnnounced = false;
	view.bind({
		shuffle: () => {
			if (!state) return;
			if (hasManualMarks(state)) view.showShuffleConfirmation();
			else shuffleBoard();
		},
		confirmShuffle: () => shuffleBoard(),
		share: () => void shareBoard(),
		toggleTile: (index) => markTile(index)
	});
	window.addEventListener("hashchange", restoreSharedBoard);
	bootstrap();
	async function bootstrap() {
		const moduleUrl = new URL(import.meta.url);
		const catalogUrl = new URL("tiles.json", moduleUrl);
		catalogUrl.search = moduleUrl.search;
		try {
			catalog = await loadCatalog(catalogUrl);
		} catch {
			view.showFailure();
			return;
		}
		gmPrototype?.setCatalog(catalog);
		const shared = readBoardHash(window.location.hash, catalog);
		let announcement = "";
		if (shared.kind === "valid") {
			state = shared.state;
			announcement = "A shared Release Radar board was loaded.";
		} else {
			const saved = storage.load(catalog);
			state = saved ?? createState(generateBoard(catalog));
			if (shared.kind === "invalid") {
				announcement = saved ? "The shared board link was invalid. Your saved board was restored." : "The shared board link was invalid. A new board was created.";
				clearInvalidBoardHash();
			}
		}
		if (!storage.save(state)) {
			persistenceFailureAnnounced = true;
			announcement = [announcement, "Board changes cannot be saved in this browser."].filter(Boolean).join(" ");
		}
		view.showReady(catalog, state);
		if (announcement) view.announce(announcement);
	}
	function markTile(index) {
		if (!state) return;
		if (index === 12) {
			view.announceFreeTile(state);
			return;
		}
		const tile = catalog.find(({ id }) => id === state?.layout[index]);
		if (!tile) return;
		const result = toggleTile(state, index);
		state = result.state;
		view.updateState(state, result.newlyCompletedLineIds);
		const saved = storage.save(state);
		const marked = state.marked.has(index);
		let announcement = result.newlyCompletedLineIds.length ? `Bingo! ${result.newlyCompletedLineIds.length === 1 ? "One line" : `${result.newlyCompletedLineIds.length} lines`} completed.` : `${tile.label} ${marked ? "marked" : "unmarked"}.`;
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
	function shuffleBoard() {
		if (!state) return;
		state = createState(generateBoard(catalog));
		view.renderBoard(state, true);
		const saved = storage.save(state);
		let announcement = "A new Release Radar board was shuffled.";
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
	async function shareBoard() {
		if (!state) return;
		const copied = await copyText(encodeState(state, catalog));
		if (copied) view.showShareCopied();
		view.announce(copied ? "The board identifier was copied." : "The board identifier could not be copied.");
	}
	function restoreSharedBoard() {
		if (!state || catalog.length === 0) return;
		const shared = readBoardHash(window.location.hash, catalog);
		if (shared.kind === "none") return;
		if (shared.kind === "invalid") {
			clearInvalidBoardHash();
			view.announce("The shared board link was invalid. Your current board was kept.");
			return;
		}
		state = shared.state;
		view.renderBoard(state, true);
		const saved = storage.save(state);
		let announcement = "A shared Release Radar board was loaded.";
		if (!saved && !persistenceFailureAnnounced) {
			persistenceFailureAnnounced = true;
			announcement += " Board changes cannot be saved in this browser.";
		}
		view.announce(announcement);
	}
}
async function copyText(text) {
	try {
		if (!navigator.clipboard) return false;
		await navigator.clipboard.writeText(text);
		return true;
	} catch {
		return false;
	}
}
function clearInvalidBoardHash() {
	try {
		const url = new URL(window.location.href);
		const params = new URLSearchParams(url.hash.slice(1));
		params.delete("board");
		url.hash = params.toString();
		window.history.replaceState(null, "", url);
	} catch {}
}
//#endregion
