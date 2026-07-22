//#region src/preload/preload.js
var { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("floatingButtonApi", {
	getConfig: () => ipcRenderer.invoke("floating-button:get-config"),
	startDrag: () => ipcRenderer.send("floating-button:drag-start"),
	moveDrag: (dx, dy) => ipcRenderer.send("floating-button:drag-move", {
		dx,
		dy
	}),
	endDrag: () => ipcRenderer.send("floating-button:drag-end"),
	setIgnoreMouseEvents: (ignore) => ipcRenderer.send("floating-button:set-ignore-mouse", ignore),
	setExpanded: (expanded, size) => ipcRenderer.send("floating-button:set-expanded", {
		expanded,
		size
	}),
	setShape: (rects) => ipcRenderer.send("floating-button:set-shape", rects),
	onCssFadeOut: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("floating-button:css-fade-out", listener);
		return () => {
			ipcRenderer.removeListener("floating-button:css-fade-out", listener);
		};
	},
	onCssFadeIn: (callback) => {
		const listener = () => callback();
		ipcRenderer.on("floating-button:css-fade-in", listener);
		return () => {
			ipcRenderer.removeListener("floating-button:css-fade-in", listener);
		};
	}
});
contextBridge.exposeInMainWorld("floatingPickerApi", {
	getConfig: () => ipcRenderer.invoke("floating-picker:get-config"),
	confirm: (count) => ipcRenderer.send("floating-picker:confirm", { count })
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
contextBridge.exposeInMainWorld("configPanelApi", {
	getConfig: () => ipcRenderer.invoke("config-panel:get-config"),
	saveConfig: (config) => ipcRenderer.invoke("config-panel:save-config", config),
	close: (saved) => ipcRenderer.send("config-panel:close", { saved }),
	getAppInfo: () => ipcRenderer.invoke("config-panel:get-app-info"),
	adminElevate: () => ipcRenderer.invoke("config-panel:admin-elevate"),
	restart: () => ipcRenderer.invoke("config-panel:restart"),
	createStartupTask: (payload) => ipcRenderer.invoke("config-panel:create-startup-task", payload),
	openConfigFile: () => ipcRenderer.invoke("config-panel:open-config-file"),
	openConfigDir: () => ipcRenderer.invoke("config-panel:open-config-dir"),
	checkUpdate: () => ipcRenderer.invoke("config-panel:check-update"),
	pickExeFile: () => ipcRenderer.invoke("config-panel:pick-exe-file"),
	resetConfig: () => ipcRenderer.invoke("config-panel:reset-config"),
	getLogs: (maxLines) => ipcRenderer.invoke("config-panel:get-logs", maxLines),
	openDevTools: (target) => ipcRenderer.send("config-panel:open-devtools", target)
});
//#endregion
