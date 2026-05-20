//#region src/preload/preload.js
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("floatingButtonApi", {
	getConfig: () => ipcRenderer.invoke("floating-button:get-config"),
	onClick: () => ipcRenderer.send("floating-button:clicked"),
	startDrag: () => ipcRenderer.send("floating-button:drag-start"),
	moveDrag: (dx, dy) => ipcRenderer.send("floating-button:drag-move", {
		dx,
		dy
	}),
	endDrag: () => ipcRenderer.send("floating-button:drag-end"),
	setIgnoreMouseEvents: (ignore) => ipcRenderer.send("floating-button:set-ignore-mouse", ignore)
});
contextBridge.exposeInMainWorld("pickCountApi", {
	getConfig: () => ipcRenderer.invoke("pick-count:get-config"),
	cancel: () => ipcRenderer.send("pick-count:cancel"),
	confirm: (count, playMusic) => ipcRenderer.send("pick-count:confirm", {
		count,
		playMusic
	}),
	onOpen: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("pick-count:open", listener);
		return () => {
			ipcRenderer.removeListener("pick-count:open", listener);
		};
	},
	onStopBgm: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("pick-count:stop-bgm", listener);
		return () => {
			ipcRenderer.removeListener("pick-count:stop-bgm", listener);
		};
	}
});
contextBridge.exposeInMainWorld("pickResultApi", {
	getResults: () => ipcRenderer.invoke("pick-result:get-results"),
	getConfig: () => ipcRenderer.invoke("pick-result:get-config"),
	close: () => ipcRenderer.send("pick-result:close"),
	onOpen: (callback) => {
		const listener = (_event, payload) => callback(payload);
		ipcRenderer.on("pick-result:open", listener);
		return () => {
			ipcRenderer.removeListener("pick-result:open", listener);
		};
	},
	onReset: (callback) => {
		const listener = (_event, payload) => callback(payload);
		ipcRenderer.on("pick-result:reset", listener);
		return () => {
			ipcRenderer.removeListener("pick-result:reset", listener);
		};
	}
});
contextBridge.exposeInMainWorld("logApi", { send: (level, text) => ipcRenderer.send("renderer:log", {
	level,
	text
}) });
//#endregion
