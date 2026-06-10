//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
//#endregion
//#region src/main/admin.js
var require_admin = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { app: app$3 } = require("electron");
	var { execFileSync, spawnSync } = require("child_process");
	var fs$3 = require("fs");
	var path$4 = require("path");
	var IS_WINDOWS = process.platform === "win32";
	var ADMIN_TASK_DEFAULT_NAME = "Blue Random (Admin)";
	var USERDATA_DIR_NAME = "BlueRandom";
	var UIACCESS_ARG = "--uiaccess";
	var IS_UIACCESS_PROCESS = process.argv.includes(UIACCESS_ARG);
	function configureUserDataPath() {
		if (!IS_WINDOWS) return;
		const appData = app$3.getPath("appData");
		const localRoot = path$4.resolve(appData, "..", "Local");
		const targetPath = path$4.join(localRoot, USERDATA_DIR_NAME);
		app$3.setPath("userData", targetPath);
	}
	function quoteForPowerShell(text) {
		return String(text).replace(/'/g, "''");
	}
	function getPowerShellPath() {
		if (!IS_WINDOWS) return "powershell";
		const root = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
		const psPath = path$4.join(root, "System32", "WindowsPowerShell", "v1.0", "powershell.exe");
		return fs$3.existsSync(psPath) ? psPath : "powershell";
	}
	function getRundll32Path() {
		if (!IS_WINDOWS) return "rundll32.exe";
		const root = process.env.SystemRoot || process.env.WINDIR || "C:\\Windows";
		const dllPath = path$4.join(root, "System32", "rundll32.exe");
		return fs$3.existsSync(dllPath) ? dllPath : "rundll32.exe";
	}
	function isProcessElevated() {
		if (!IS_WINDOWS) return false;
		try {
			const output = execFileSync(getPowerShellPath(), [
				"-NoProfile",
				"-Command",
				"([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)"
			], { encoding: "utf8" });
			return String(output).trim().toLowerCase() === "true";
		} catch (_error) {
			return false;
		}
	}
	function requestAdminRelaunch() {
		if (!IS_WINDOWS) return {
			ok: false,
			message: "当前系统不支持管理员提升。"
		};
		const exePath = process.execPath;
		const args = process.argv.slice(1);
		const argList = args.length > 0 ? args.map((arg) => `'${quoteForPowerShell(arg)}'`).join(", ") : "";
		const script = [`$exe = '${quoteForPowerShell(exePath)}'`, args.length > 0 ? `$args = @(${argList}); Start-Process -FilePath $exe -ArgumentList $args -Verb RunAs` : "Start-Process -FilePath $exe -Verb RunAs"].join("; ");
		const result = spawnSync(getPowerShellPath(), [
			"-NoProfile",
			"-Command",
			script
		], {
			encoding: "utf8",
			windowsHide: true
		});
		if (result.error || result.status !== 0) {
			const detail = [
				result.error ? String(result.error) : "",
				result.stderr || "",
				result.stdout || ""
			].join("\n").trim();
			console.error("Admin relaunch failed:", detail || "command failed");
			return {
				ok: false,
				message: "管理员权限请求失败或被取消。",
				detail: detail || "command failed"
			};
		}
		return {
			ok: true,
			message: "已请求管理员权限，即将重新启动。"
		};
	}
	function getDefaultExePath() {
		return app$3.getPath("exe");
	}
	function getDefaultUiAccessDllPath() {
		const exeDir = path$4.dirname(getDefaultExePath());
		return path$4.join(exeDir, "uiaccess.dll");
	}
	function buildUiAccessCommandLine(exePath, args) {
		const quote = (value) => `"${String(value).replace(/"/g, "\\\"")}"`;
		const safeArgs = Array.isArray(args) ? args : [];
		return [quote(exePath), ...safeArgs.map((arg) => quote(arg))].join(" ");
	}
	function requestUiAccessRelaunch(uiAccessDllPath) {
		if (!IS_WINDOWS) return {
			ok: false,
			message: "当前系统不支持 UIAccess。"
		};
		if (!app$3.isPackaged) return {
			ok: false,
			message: "UIAccess 仅支持正式版运行。"
		};
		if (!uiAccessDllPath || !fs$3.existsSync(uiAccessDllPath)) return {
			ok: false,
			message: "未找到 uiaccess.dll，请检查路径。"
		};
		const exePath = getDefaultExePath();
		const exeDir = path$4.dirname(exePath);
		const baseArgs = process.argv.slice(1);
		const cmdLine = buildUiAccessCommandLine(exePath, baseArgs.includes(UIACCESS_ARG) ? baseArgs : [...baseArgs, UIACCESS_ARG]);
		const entry = `${uiAccessDllPath},run`;
		const rundll32Path = getRundll32Path();
		const psPath = getPowerShellPath();
		const result = spawnSync(psPath, [
			"-NoProfile",
			"-Command",
			[
				`$entry = '${quoteForPowerShell(entry)}'`,
				`$cmdLine = '${quoteForPowerShell(cmdLine)}'`,
				`Start-Process -FilePath '${quoteForPowerShell(rundll32Path)}' -ArgumentList @($entry, $cmdLine) -WorkingDirectory '${quoteForPowerShell(exeDir)}'`
			].join("; ")
		], {
			encoding: "utf8",
			windowsHide: true
		});
		if (result.error || result.status !== 0) {
			const detailParts = [
				result.error ? `error=${String(result.error)}` : "",
				typeof result.status === "number" ? `status=${result.status}` : "",
				result.stderr ? `stderr=${result.stderr}` : "",
				result.stdout ? `stdout=${result.stdout}` : ""
			].filter(Boolean);
			detailParts.push(`rundll32=${rundll32Path}`);
			detailParts.push(`entry=${entry}`);
			detailParts.push(`cmdLine=${cmdLine}`);
			detailParts.push(`cwd=${exeDir}`);
			detailParts.push(`ps=${psPath}`);
			const detail = detailParts.join("\n").trim();
			console.error("UIAccess relaunch failed:", detail || "command failed");
			return {
				ok: false,
				message: "UIAccess 请求失败或被取消。",
				detail: detail || "command failed"
			};
		}
		return {
			ok: true,
			message: "已请求 UIAccess 权限，即将重新启动。"
		};
	}
	function createAdminStartupTask({ taskName, exePath, runAsUser }) {
		if (!IS_WINDOWS) return {
			ok: false,
			message: "仅支持 Windows 计划任务。"
		};
		if (!exePath || !fs$3.existsSync(exePath)) return {
			ok: false,
			message: "可执行文件路径无效或不存在。"
		};
		const safeTaskName = taskName || ADMIN_TASK_DEFAULT_NAME;
		const userName = runAsUser || process.env.USERNAME || "";
		const taskArgs = [
			"/Create",
			"/F",
			"/RL",
			"HIGHEST",
			"/SC",
			"ONLOGON",
			"/TN",
			safeTaskName,
			"/TR",
			`"${exePath}"`
		];
		if (userName) taskArgs.push("/RU", userName);
		try {
			if (isProcessElevated()) execFileSync("schtasks", taskArgs, { stdio: "ignore" });
			else execFileSync("powershell", [
				"-NoProfile",
				"-Command",
				`Start-Process -FilePath 'schtasks.exe' -ArgumentList '${quoteForPowerShell(taskArgs.map((arg) => `"${arg.replace(/"/g, "\\\"")}"`).join(" "))}' -Verb RunAs -Wait`
			], { stdio: "ignore" });
			return {
				ok: true,
				message: "计划任务已创建或更新。"
			};
		} catch (error) {
			return {
				ok: false,
				message: "计划任务创建失败或被取消。",
				detail: String(error)
			};
		}
	}
	module.exports = {
		ADMIN_TASK_DEFAULT_NAME,
		IS_UIACCESS_PROCESS,
		IS_WINDOWS,
		UIACCESS_ARG,
		configureUserDataPath,
		createAdminStartupTask,
		getDefaultExePath,
		getDefaultUiAccessDllPath,
		isProcessElevated,
		requestAdminRelaunch,
		requestUiAccessRelaunch
	};
}));
//#endregion
//#region node_modules/js-yaml/lib/common.js
var require_common = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function isNothing(subject) {
		return typeof subject === "undefined" || subject === null;
	}
	function isObject(subject) {
		return typeof subject === "object" && subject !== null;
	}
	function toArray(sequence) {
		if (Array.isArray(sequence)) return sequence;
		else if (isNothing(sequence)) return [];
		return [sequence];
	}
	function extend(target, source) {
		var index, length, key, sourceKeys;
		if (source) {
			sourceKeys = Object.keys(source);
			for (index = 0, length = sourceKeys.length; index < length; index += 1) {
				key = sourceKeys[index];
				target[key] = source[key];
			}
		}
		return target;
	}
	function repeat(string, count) {
		var result = "", cycle;
		for (cycle = 0; cycle < count; cycle += 1) result += string;
		return result;
	}
	function isNegativeZero(number) {
		return number === 0 && Number.NEGATIVE_INFINITY === 1 / number;
	}
	module.exports.isNothing = isNothing;
	module.exports.isObject = isObject;
	module.exports.toArray = toArray;
	module.exports.repeat = repeat;
	module.exports.isNegativeZero = isNegativeZero;
	module.exports.extend = extend;
}));
//#endregion
//#region node_modules/js-yaml/lib/exception.js
var require_exception = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	function formatError(exception, compact) {
		var where = "", message = exception.reason || "(unknown reason)";
		if (!exception.mark) return message;
		if (exception.mark.name) where += "in \"" + exception.mark.name + "\" ";
		where += "(" + (exception.mark.line + 1) + ":" + (exception.mark.column + 1) + ")";
		if (!compact && exception.mark.snippet) where += "\n\n" + exception.mark.snippet;
		return message + " " + where;
	}
	function YAMLException(reason, mark) {
		Error.call(this);
		this.name = "YAMLException";
		this.reason = reason;
		this.mark = mark;
		this.message = formatError(this, false);
		if (Error.captureStackTrace) Error.captureStackTrace(this, this.constructor);
		else this.stack = (/* @__PURE__ */ new Error()).stack || "";
	}
	YAMLException.prototype = Object.create(Error.prototype);
	YAMLException.prototype.constructor = YAMLException;
	YAMLException.prototype.toString = function toString(compact) {
		return this.name + ": " + formatError(this, compact);
	};
	module.exports = YAMLException;
}));
//#endregion
//#region node_modules/js-yaml/lib/snippet.js
var require_snippet = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	function getLine(buffer, lineStart, lineEnd, position, maxLineLength) {
		var head = "";
		var tail = "";
		var maxHalfLength = Math.floor(maxLineLength / 2) - 1;
		if (position - lineStart > maxHalfLength) {
			head = " ... ";
			lineStart = position - maxHalfLength + head.length;
		}
		if (lineEnd - position > maxHalfLength) {
			tail = " ...";
			lineEnd = position + maxHalfLength - tail.length;
		}
		return {
			str: head + buffer.slice(lineStart, lineEnd).replace(/\t/g, "→") + tail,
			pos: position - lineStart + head.length
		};
	}
	function padStart(string, max) {
		return common.repeat(" ", max - string.length) + string;
	}
	function makeSnippet(mark, options) {
		options = Object.create(options || null);
		if (!mark.buffer) return null;
		if (!options.maxLength) options.maxLength = 79;
		if (typeof options.indent !== "number") options.indent = 1;
		if (typeof options.linesBefore !== "number") options.linesBefore = 3;
		if (typeof options.linesAfter !== "number") options.linesAfter = 2;
		var re = /\r?\n|\r|\0/g;
		var lineStarts = [0];
		var lineEnds = [];
		var match;
		var foundLineNo = -1;
		while (match = re.exec(mark.buffer)) {
			lineEnds.push(match.index);
			lineStarts.push(match.index + match[0].length);
			if (mark.position <= match.index && foundLineNo < 0) foundLineNo = lineStarts.length - 2;
		}
		if (foundLineNo < 0) foundLineNo = lineStarts.length - 1;
		var result = "", i, line;
		var lineNoLength = Math.min(mark.line + options.linesAfter, lineEnds.length).toString().length;
		var maxLineLength = options.maxLength - (options.indent + lineNoLength + 3);
		for (i = 1; i <= options.linesBefore; i++) {
			if (foundLineNo - i < 0) break;
			line = getLine(mark.buffer, lineStarts[foundLineNo - i], lineEnds[foundLineNo - i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo - i]), maxLineLength);
			result = common.repeat(" ", options.indent) + padStart((mark.line - i + 1).toString(), lineNoLength) + " | " + line.str + "\n" + result;
		}
		line = getLine(mark.buffer, lineStarts[foundLineNo], lineEnds[foundLineNo], mark.position, maxLineLength);
		result += common.repeat(" ", options.indent) + padStart((mark.line + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		result += common.repeat("-", options.indent + lineNoLength + 3 + line.pos) + "^\n";
		for (i = 1; i <= options.linesAfter; i++) {
			if (foundLineNo + i >= lineEnds.length) break;
			line = getLine(mark.buffer, lineStarts[foundLineNo + i], lineEnds[foundLineNo + i], mark.position - (lineStarts[foundLineNo] - lineStarts[foundLineNo + i]), maxLineLength);
			result += common.repeat(" ", options.indent) + padStart((mark.line + i + 1).toString(), lineNoLength) + " | " + line.str + "\n";
		}
		return result.replace(/\n$/, "");
	}
	module.exports = makeSnippet;
}));
//#endregion
//#region node_modules/js-yaml/lib/type.js
var require_type = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var YAMLException = require_exception();
	var TYPE_CONSTRUCTOR_OPTIONS = [
		"kind",
		"multi",
		"resolve",
		"construct",
		"instanceOf",
		"predicate",
		"represent",
		"representName",
		"defaultStyle",
		"styleAliases"
	];
	var YAML_NODE_KINDS = [
		"scalar",
		"sequence",
		"mapping"
	];
	function compileStyleAliases(map) {
		var result = {};
		if (map !== null) Object.keys(map).forEach(function(style) {
			map[style].forEach(function(alias) {
				result[String(alias)] = style;
			});
		});
		return result;
	}
	function Type(tag, options) {
		options = options || {};
		Object.keys(options).forEach(function(name) {
			if (TYPE_CONSTRUCTOR_OPTIONS.indexOf(name) === -1) throw new YAMLException("Unknown option \"" + name + "\" is met in definition of \"" + tag + "\" YAML type.");
		});
		this.options = options;
		this.tag = tag;
		this.kind = options["kind"] || null;
		this.resolve = options["resolve"] || function() {
			return true;
		};
		this.construct = options["construct"] || function(data) {
			return data;
		};
		this.instanceOf = options["instanceOf"] || null;
		this.predicate = options["predicate"] || null;
		this.represent = options["represent"] || null;
		this.representName = options["representName"] || null;
		this.defaultStyle = options["defaultStyle"] || null;
		this.multi = options["multi"] || false;
		this.styleAliases = compileStyleAliases(options["styleAliases"] || null);
		if (YAML_NODE_KINDS.indexOf(this.kind) === -1) throw new YAMLException("Unknown kind \"" + this.kind + "\" is specified for \"" + tag + "\" YAML type.");
	}
	module.exports = Type;
}));
//#endregion
//#region node_modules/js-yaml/lib/schema.js
var require_schema = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var YAMLException = require_exception();
	var Type = require_type();
	function compileList(schema, name) {
		var result = [];
		schema[name].forEach(function(currentType) {
			var newIndex = result.length;
			result.forEach(function(previousType, previousIndex) {
				if (previousType.tag === currentType.tag && previousType.kind === currentType.kind && previousType.multi === currentType.multi) newIndex = previousIndex;
			});
			result[newIndex] = currentType;
		});
		return result;
	}
	function compileMap() {
		var result = {
			scalar: {},
			sequence: {},
			mapping: {},
			fallback: {},
			multi: {
				scalar: [],
				sequence: [],
				mapping: [],
				fallback: []
			}
		}, index, length;
		function collectType(type) {
			if (type.multi) {
				result.multi[type.kind].push(type);
				result.multi["fallback"].push(type);
			} else result[type.kind][type.tag] = result["fallback"][type.tag] = type;
		}
		for (index = 0, length = arguments.length; index < length; index += 1) arguments[index].forEach(collectType);
		return result;
	}
	function Schema(definition) {
		return this.extend(definition);
	}
	Schema.prototype.extend = function extend(definition) {
		var implicit = [];
		var explicit = [];
		if (definition instanceof Type) explicit.push(definition);
		else if (Array.isArray(definition)) explicit = explicit.concat(definition);
		else if (definition && (Array.isArray(definition.implicit) || Array.isArray(definition.explicit))) {
			if (definition.implicit) implicit = implicit.concat(definition.implicit);
			if (definition.explicit) explicit = explicit.concat(definition.explicit);
		} else throw new YAMLException("Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })");
		implicit.forEach(function(type) {
			if (!(type instanceof Type)) throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
			if (type.loadKind && type.loadKind !== "scalar") throw new YAMLException("There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.");
			if (type.multi) throw new YAMLException("There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.");
		});
		explicit.forEach(function(type) {
			if (!(type instanceof Type)) throw new YAMLException("Specified list of YAML types (or a single Type object) contains a non-Type object.");
		});
		var result = Object.create(Schema.prototype);
		result.implicit = (this.implicit || []).concat(implicit);
		result.explicit = (this.explicit || []).concat(explicit);
		result.compiledImplicit = compileList(result, "implicit");
		result.compiledExplicit = compileList(result, "explicit");
		result.compiledTypeMap = compileMap(result.compiledImplicit, result.compiledExplicit);
		return result;
	};
	module.exports = Schema;
}));
//#endregion
//#region node_modules/js-yaml/lib/type/str.js
var require_str = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:str", {
		kind: "scalar",
		construct: function(data) {
			return data !== null ? data : "";
		}
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/seq.js
var require_seq = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:seq", {
		kind: "sequence",
		construct: function(data) {
			return data !== null ? data : [];
		}
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/map.js
var require_map = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_type())("tag:yaml.org,2002:map", {
		kind: "mapping",
		construct: function(data) {
			return data !== null ? data : {};
		}
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/schema/failsafe.js
var require_failsafe = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = new (require_schema())({ explicit: [
		require_str(),
		require_seq(),
		require_map()
	] });
}));
//#endregion
//#region node_modules/js-yaml/lib/type/null.js
var require_null = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlNull(data) {
		if (data === null) return true;
		var max = data.length;
		return max === 1 && data === "~" || max === 4 && (data === "null" || data === "Null" || data === "NULL");
	}
	function constructYamlNull() {
		return null;
	}
	function isNull(object) {
		return object === null;
	}
	module.exports = new Type("tag:yaml.org,2002:null", {
		kind: "scalar",
		resolve: resolveYamlNull,
		construct: constructYamlNull,
		predicate: isNull,
		represent: {
			canonical: function() {
				return "~";
			},
			lowercase: function() {
				return "null";
			},
			uppercase: function() {
				return "NULL";
			},
			camelcase: function() {
				return "Null";
			},
			empty: function() {
				return "";
			}
		},
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/bool.js
var require_bool = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlBoolean(data) {
		if (data === null) return false;
		var max = data.length;
		return max === 4 && (data === "true" || data === "True" || data === "TRUE") || max === 5 && (data === "false" || data === "False" || data === "FALSE");
	}
	function constructYamlBoolean(data) {
		return data === "true" || data === "True" || data === "TRUE";
	}
	function isBoolean(object) {
		return Object.prototype.toString.call(object) === "[object Boolean]";
	}
	module.exports = new Type("tag:yaml.org,2002:bool", {
		kind: "scalar",
		resolve: resolveYamlBoolean,
		construct: constructYamlBoolean,
		predicate: isBoolean,
		represent: {
			lowercase: function(object) {
				return object ? "true" : "false";
			},
			uppercase: function(object) {
				return object ? "TRUE" : "FALSE";
			},
			camelcase: function(object) {
				return object ? "True" : "False";
			}
		},
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/int.js
var require_int = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var Type = require_type();
	function isHexCode(c) {
		return 48 <= c && c <= 57 || 65 <= c && c <= 70 || 97 <= c && c <= 102;
	}
	function isOctCode(c) {
		return 48 <= c && c <= 55;
	}
	function isDecCode(c) {
		return 48 <= c && c <= 57;
	}
	function resolveYamlInteger(data) {
		if (data === null) return false;
		var max = data.length, index = 0, hasDigits = false, ch;
		if (!max) return false;
		ch = data[index];
		if (ch === "-" || ch === "+") ch = data[++index];
		if (ch === "0") {
			if (index + 1 === max) return true;
			ch = data[++index];
			if (ch === "b") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch === "_") continue;
					if (ch !== "0" && ch !== "1") return false;
					hasDigits = true;
				}
				return hasDigits && ch !== "_";
			}
			if (ch === "x") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch === "_") continue;
					if (!isHexCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && ch !== "_";
			}
			if (ch === "o") {
				index++;
				for (; index < max; index++) {
					ch = data[index];
					if (ch === "_") continue;
					if (!isOctCode(data.charCodeAt(index))) return false;
					hasDigits = true;
				}
				return hasDigits && ch !== "_";
			}
		}
		if (ch === "_") return false;
		for (; index < max; index++) {
			ch = data[index];
			if (ch === "_") continue;
			if (!isDecCode(data.charCodeAt(index))) return false;
			hasDigits = true;
		}
		if (!hasDigits || ch === "_") return false;
		return true;
	}
	function constructYamlInteger(data) {
		var value = data, sign = 1, ch;
		if (value.indexOf("_") !== -1) value = value.replace(/_/g, "");
		ch = value[0];
		if (ch === "-" || ch === "+") {
			if (ch === "-") sign = -1;
			value = value.slice(1);
			ch = value[0];
		}
		if (value === "0") return 0;
		if (ch === "0") {
			if (value[1] === "b") return sign * parseInt(value.slice(2), 2);
			if (value[1] === "x") return sign * parseInt(value.slice(2), 16);
			if (value[1] === "o") return sign * parseInt(value.slice(2), 8);
		}
		return sign * parseInt(value, 10);
	}
	function isInteger(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && object % 1 === 0 && !common.isNegativeZero(object);
	}
	module.exports = new Type("tag:yaml.org,2002:int", {
		kind: "scalar",
		resolve: resolveYamlInteger,
		construct: constructYamlInteger,
		predicate: isInteger,
		represent: {
			binary: function(obj) {
				return obj >= 0 ? "0b" + obj.toString(2) : "-0b" + obj.toString(2).slice(1);
			},
			octal: function(obj) {
				return obj >= 0 ? "0o" + obj.toString(8) : "-0o" + obj.toString(8).slice(1);
			},
			decimal: function(obj) {
				return obj.toString(10);
			},
			hexadecimal: function(obj) {
				return obj >= 0 ? "0x" + obj.toString(16).toUpperCase() : "-0x" + obj.toString(16).toUpperCase().slice(1);
			}
		},
		defaultStyle: "decimal",
		styleAliases: {
			binary: [2, "bin"],
			octal: [8, "oct"],
			decimal: [10, "dec"],
			hexadecimal: [16, "hex"]
		}
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/float.js
var require_float = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var Type = require_type();
	var YAML_FLOAT_PATTERN = /* @__PURE__ */ new RegExp("^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$");
	function resolveYamlFloat(data) {
		if (data === null) return false;
		if (!YAML_FLOAT_PATTERN.test(data) || data[data.length - 1] === "_") return false;
		return true;
	}
	function constructYamlFloat(data) {
		var value = data.replace(/_/g, "").toLowerCase(), sign = value[0] === "-" ? -1 : 1;
		if ("+-".indexOf(value[0]) >= 0) value = value.slice(1);
		if (value === ".inf") return sign === 1 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY;
		else if (value === ".nan") return NaN;
		return sign * parseFloat(value, 10);
	}
	var SCIENTIFIC_WITHOUT_DOT = /^[-+]?[0-9]+e/;
	function representYamlFloat(object, style) {
		var res;
		if (isNaN(object)) switch (style) {
			case "lowercase": return ".nan";
			case "uppercase": return ".NAN";
			case "camelcase": return ".NaN";
		}
		else if (Number.POSITIVE_INFINITY === object) switch (style) {
			case "lowercase": return ".inf";
			case "uppercase": return ".INF";
			case "camelcase": return ".Inf";
		}
		else if (Number.NEGATIVE_INFINITY === object) switch (style) {
			case "lowercase": return "-.inf";
			case "uppercase": return "-.INF";
			case "camelcase": return "-.Inf";
		}
		else if (common.isNegativeZero(object)) return "-0.0";
		res = object.toString(10);
		return SCIENTIFIC_WITHOUT_DOT.test(res) ? res.replace("e", ".e") : res;
	}
	function isFloat(object) {
		return Object.prototype.toString.call(object) === "[object Number]" && (object % 1 !== 0 || common.isNegativeZero(object));
	}
	module.exports = new Type("tag:yaml.org,2002:float", {
		kind: "scalar",
		resolve: resolveYamlFloat,
		construct: constructYamlFloat,
		predicate: isFloat,
		represent: representYamlFloat,
		defaultStyle: "lowercase"
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/schema/json.js
var require_json = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_failsafe().extend({ implicit: [
		require_null(),
		require_bool(),
		require_int(),
		require_float()
	] });
}));
//#endregion
//#region node_modules/js-yaml/lib/schema/core.js
var require_core = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_json();
}));
//#endregion
//#region node_modules/js-yaml/lib/type/timestamp.js
var require_timestamp = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var YAML_DATE_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$");
	var YAML_TIMESTAMP_REGEXP = /* @__PURE__ */ new RegExp("^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$");
	function resolveYamlTimestamp(data) {
		if (data === null) return false;
		if (YAML_DATE_REGEXP.exec(data) !== null) return true;
		if (YAML_TIMESTAMP_REGEXP.exec(data) !== null) return true;
		return false;
	}
	function constructYamlTimestamp(data) {
		var match, year, month, day, hour, minute, second, fraction = 0, delta = null, tz_hour, tz_minute, date;
		match = YAML_DATE_REGEXP.exec(data);
		if (match === null) match = YAML_TIMESTAMP_REGEXP.exec(data);
		if (match === null) throw new Error("Date resolve error");
		year = +match[1];
		month = +match[2] - 1;
		day = +match[3];
		if (!match[4]) return new Date(Date.UTC(year, month, day));
		hour = +match[4];
		minute = +match[5];
		second = +match[6];
		if (match[7]) {
			fraction = match[7].slice(0, 3);
			while (fraction.length < 3) fraction += "0";
			fraction = +fraction;
		}
		if (match[9]) {
			tz_hour = +match[10];
			tz_minute = +(match[11] || 0);
			delta = (tz_hour * 60 + tz_minute) * 6e4;
			if (match[9] === "-") delta = -delta;
		}
		date = new Date(Date.UTC(year, month, day, hour, minute, second, fraction));
		if (delta) date.setTime(date.getTime() - delta);
		return date;
	}
	function representYamlTimestamp(object) {
		return object.toISOString();
	}
	module.exports = new Type("tag:yaml.org,2002:timestamp", {
		kind: "scalar",
		resolve: resolveYamlTimestamp,
		construct: constructYamlTimestamp,
		instanceOf: Date,
		represent: representYamlTimestamp
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/merge.js
var require_merge = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	function resolveYamlMerge(data) {
		return data === "<<" || data === null;
	}
	module.exports = new Type("tag:yaml.org,2002:merge", {
		kind: "scalar",
		resolve: resolveYamlMerge
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/binary.js
var require_binary = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var BASE64_MAP = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=\n\r";
	function resolveYamlBinary(data) {
		if (data === null) return false;
		var code, idx, bitlen = 0, max = data.length, map = BASE64_MAP;
		for (idx = 0; idx < max; idx++) {
			code = map.indexOf(data.charAt(idx));
			if (code > 64) continue;
			if (code < 0) return false;
			bitlen += 6;
		}
		return bitlen % 8 === 0;
	}
	function constructYamlBinary(data) {
		var idx, tailbits, input = data.replace(/[\r\n=]/g, ""), max = input.length, map = BASE64_MAP, bits = 0, result = [];
		for (idx = 0; idx < max; idx++) {
			if (idx % 4 === 0 && idx) {
				result.push(bits >> 16 & 255);
				result.push(bits >> 8 & 255);
				result.push(bits & 255);
			}
			bits = bits << 6 | map.indexOf(input.charAt(idx));
		}
		tailbits = max % 4 * 6;
		if (tailbits === 0) {
			result.push(bits >> 16 & 255);
			result.push(bits >> 8 & 255);
			result.push(bits & 255);
		} else if (tailbits === 18) {
			result.push(bits >> 10 & 255);
			result.push(bits >> 2 & 255);
		} else if (tailbits === 12) result.push(bits >> 4 & 255);
		return new Uint8Array(result);
	}
	function representYamlBinary(object) {
		var result = "", bits = 0, idx, tail, max = object.length, map = BASE64_MAP;
		for (idx = 0; idx < max; idx++) {
			if (idx % 3 === 0 && idx) {
				result += map[bits >> 18 & 63];
				result += map[bits >> 12 & 63];
				result += map[bits >> 6 & 63];
				result += map[bits & 63];
			}
			bits = (bits << 8) + object[idx];
		}
		tail = max % 3;
		if (tail === 0) {
			result += map[bits >> 18 & 63];
			result += map[bits >> 12 & 63];
			result += map[bits >> 6 & 63];
			result += map[bits & 63];
		} else if (tail === 2) {
			result += map[bits >> 10 & 63];
			result += map[bits >> 4 & 63];
			result += map[bits << 2 & 63];
			result += map[64];
		} else if (tail === 1) {
			result += map[bits >> 2 & 63];
			result += map[bits << 4 & 63];
			result += map[64];
			result += map[64];
		}
		return result;
	}
	function isBinary(obj) {
		return Object.prototype.toString.call(obj) === "[object Uint8Array]";
	}
	module.exports = new Type("tag:yaml.org,2002:binary", {
		kind: "scalar",
		resolve: resolveYamlBinary,
		construct: constructYamlBinary,
		predicate: isBinary,
		represent: representYamlBinary
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/omap.js
var require_omap = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var _toString = Object.prototype.toString;
	function resolveYamlOmap(data) {
		if (data === null) return true;
		var objectKeys = [], index, length, pair, pairKey, pairHasKey, object = data;
		for (index = 0, length = object.length; index < length; index += 1) {
			pair = object[index];
			pairHasKey = false;
			if (_toString.call(pair) !== "[object Object]") return false;
			for (pairKey in pair) if (_hasOwnProperty.call(pair, pairKey)) if (!pairHasKey) pairHasKey = true;
			else return false;
			if (!pairHasKey) return false;
			if (objectKeys.indexOf(pairKey) === -1) objectKeys.push(pairKey);
			else return false;
		}
		return true;
	}
	function constructYamlOmap(data) {
		return data !== null ? data : [];
	}
	module.exports = new Type("tag:yaml.org,2002:omap", {
		kind: "sequence",
		resolve: resolveYamlOmap,
		construct: constructYamlOmap
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/pairs.js
var require_pairs = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _toString = Object.prototype.toString;
	function resolveYamlPairs(data) {
		if (data === null) return true;
		var index, length, pair, keys, result, object = data;
		result = new Array(object.length);
		for (index = 0, length = object.length; index < length; index += 1) {
			pair = object[index];
			if (_toString.call(pair) !== "[object Object]") return false;
			keys = Object.keys(pair);
			if (keys.length !== 1) return false;
			result[index] = [keys[0], pair[keys[0]]];
		}
		return true;
	}
	function constructYamlPairs(data) {
		if (data === null) return [];
		var index, length, pair, keys, result, object = data;
		result = new Array(object.length);
		for (index = 0, length = object.length; index < length; index += 1) {
			pair = object[index];
			keys = Object.keys(pair);
			result[index] = [keys[0], pair[keys[0]]];
		}
		return result;
	}
	module.exports = new Type("tag:yaml.org,2002:pairs", {
		kind: "sequence",
		resolve: resolveYamlPairs,
		construct: constructYamlPairs
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/type/set.js
var require_set = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var Type = require_type();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	function resolveYamlSet(data) {
		if (data === null) return true;
		var key, object = data;
		for (key in object) if (_hasOwnProperty.call(object, key)) {
			if (object[key] !== null) return false;
		}
		return true;
	}
	function constructYamlSet(data) {
		return data !== null ? data : {};
	}
	module.exports = new Type("tag:yaml.org,2002:set", {
		kind: "mapping",
		resolve: resolveYamlSet,
		construct: constructYamlSet
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/schema/default.js
var require_default = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	module.exports = require_core().extend({
		implicit: [require_timestamp(), require_merge()],
		explicit: [
			require_binary(),
			require_omap(),
			require_pairs(),
			require_set()
		]
	});
}));
//#endregion
//#region node_modules/js-yaml/lib/loader.js
var require_loader = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var YAMLException = require_exception();
	var makeSnippet = require_snippet();
	var DEFAULT_SCHEMA = require_default();
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var CONTEXT_FLOW_IN = 1;
	var CONTEXT_FLOW_OUT = 2;
	var CONTEXT_BLOCK_IN = 3;
	var CONTEXT_BLOCK_OUT = 4;
	var CHOMPING_CLIP = 1;
	var CHOMPING_STRIP = 2;
	var CHOMPING_KEEP = 3;
	var PATTERN_NON_PRINTABLE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/;
	var PATTERN_NON_ASCII_LINE_BREAKS = /[\x85\u2028\u2029]/;
	var PATTERN_FLOW_INDICATORS = /[,\[\]\{\}]/;
	var PATTERN_TAG_HANDLE = /^(?:!|!!|![a-z\-]+!)$/i;
	var PATTERN_TAG_URI = /^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;
	function _class(obj) {
		return Object.prototype.toString.call(obj);
	}
	function is_EOL(c) {
		return c === 10 || c === 13;
	}
	function is_WHITE_SPACE(c) {
		return c === 9 || c === 32;
	}
	function is_WS_OR_EOL(c) {
		return c === 9 || c === 32 || c === 10 || c === 13;
	}
	function is_FLOW_INDICATOR(c) {
		return c === 44 || c === 91 || c === 93 || c === 123 || c === 125;
	}
	function fromHexCode(c) {
		var lc;
		if (48 <= c && c <= 57) return c - 48;
		lc = c | 32;
		if (97 <= lc && lc <= 102) return lc - 97 + 10;
		return -1;
	}
	function escapedHexLen(c) {
		if (c === 120) return 2;
		if (c === 117) return 4;
		if (c === 85) return 8;
		return 0;
	}
	function fromDecimalCode(c) {
		if (48 <= c && c <= 57) return c - 48;
		return -1;
	}
	function simpleEscapeSequence(c) {
		return c === 48 ? "\0" : c === 97 ? "\x07" : c === 98 ? "\b" : c === 116 ? "	" : c === 9 ? "	" : c === 110 ? "\n" : c === 118 ? "\v" : c === 102 ? "\f" : c === 114 ? "\r" : c === 101 ? "\x1B" : c === 32 ? " " : c === 34 ? "\"" : c === 47 ? "/" : c === 92 ? "\\" : c === 78 ? "" : c === 95 ? "\xA0" : c === 76 ? "\u2028" : c === 80 ? "\u2029" : "";
	}
	function charFromCodepoint(c) {
		if (c <= 65535) return String.fromCharCode(c);
		return String.fromCharCode((c - 65536 >> 10) + 55296, (c - 65536 & 1023) + 56320);
	}
	function setProperty(object, key, value) {
		if (key === "__proto__") Object.defineProperty(object, key, {
			configurable: true,
			enumerable: true,
			writable: true,
			value
		});
		else object[key] = value;
	}
	var simpleEscapeCheck = new Array(256);
	var simpleEscapeMap = new Array(256);
	for (var i = 0; i < 256; i++) {
		simpleEscapeCheck[i] = simpleEscapeSequence(i) ? 1 : 0;
		simpleEscapeMap[i] = simpleEscapeSequence(i);
	}
	function State(input, options) {
		this.input = input;
		this.filename = options["filename"] || null;
		this.schema = options["schema"] || DEFAULT_SCHEMA;
		this.onWarning = options["onWarning"] || null;
		this.legacy = options["legacy"] || false;
		this.json = options["json"] || false;
		this.listener = options["listener"] || null;
		this.implicitTypes = this.schema.compiledImplicit;
		this.typeMap = this.schema.compiledTypeMap;
		this.length = input.length;
		this.position = 0;
		this.line = 0;
		this.lineStart = 0;
		this.lineIndent = 0;
		this.firstTabInLine = -1;
		this.documents = [];
	}
	function generateError(state, message) {
		var mark = {
			name: state.filename,
			buffer: state.input.slice(0, -1),
			position: state.position,
			line: state.line,
			column: state.position - state.lineStart
		};
		mark.snippet = makeSnippet(mark);
		return new YAMLException(message, mark);
	}
	function throwError(state, message) {
		throw generateError(state, message);
	}
	function throwWarning(state, message) {
		if (state.onWarning) state.onWarning.call(null, generateError(state, message));
	}
	var directiveHandlers = {
		YAML: function handleYamlDirective(state, name, args) {
			var match, major, minor;
			if (state.version !== null) throwError(state, "duplication of %YAML directive");
			if (args.length !== 1) throwError(state, "YAML directive accepts exactly one argument");
			match = /^([0-9]+)\.([0-9]+)$/.exec(args[0]);
			if (match === null) throwError(state, "ill-formed argument of the YAML directive");
			major = parseInt(match[1], 10);
			minor = parseInt(match[2], 10);
			if (major !== 1) throwError(state, "unacceptable YAML version of the document");
			state.version = args[0];
			state.checkLineBreaks = minor < 2;
			if (minor !== 1 && minor !== 2) throwWarning(state, "unsupported YAML version of the document");
		},
		TAG: function handleTagDirective(state, name, args) {
			var handle, prefix;
			if (args.length !== 2) throwError(state, "TAG directive accepts exactly two arguments");
			handle = args[0];
			prefix = args[1];
			if (!PATTERN_TAG_HANDLE.test(handle)) throwError(state, "ill-formed tag handle (first argument) of the TAG directive");
			if (_hasOwnProperty.call(state.tagMap, handle)) throwError(state, "there is a previously declared suffix for \"" + handle + "\" tag handle");
			if (!PATTERN_TAG_URI.test(prefix)) throwError(state, "ill-formed tag prefix (second argument) of the TAG directive");
			try {
				prefix = decodeURIComponent(prefix);
			} catch (err) {
				throwError(state, "tag prefix is malformed: " + prefix);
			}
			state.tagMap[handle] = prefix;
		}
	};
	function captureSegment(state, start, end, checkJson) {
		var _position, _length, _character, _result;
		if (start < end) {
			_result = state.input.slice(start, end);
			if (checkJson) for (_position = 0, _length = _result.length; _position < _length; _position += 1) {
				_character = _result.charCodeAt(_position);
				if (!(_character === 9 || 32 <= _character && _character <= 1114111)) throwError(state, "expected valid JSON character");
			}
			else if (PATTERN_NON_PRINTABLE.test(_result)) throwError(state, "the stream contains non-printable characters");
			state.result += _result;
		}
	}
	function mergeMappings(state, destination, source, overridableKeys) {
		var sourceKeys, key, index, quantity;
		if (!common.isObject(source)) throwError(state, "cannot merge mappings; the provided source object is unacceptable");
		sourceKeys = Object.keys(source);
		for (index = 0, quantity = sourceKeys.length; index < quantity; index += 1) {
			key = sourceKeys[index];
			if (!_hasOwnProperty.call(destination, key)) {
				setProperty(destination, key, source[key]);
				overridableKeys[key] = true;
			}
		}
	}
	function storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, startLine, startLineStart, startPos) {
		var index, quantity;
		if (Array.isArray(keyNode)) {
			keyNode = Array.prototype.slice.call(keyNode);
			for (index = 0, quantity = keyNode.length; index < quantity; index += 1) {
				if (Array.isArray(keyNode[index])) throwError(state, "nested arrays are not supported inside keys");
				if (typeof keyNode === "object" && _class(keyNode[index]) === "[object Object]") keyNode[index] = "[object Object]";
			}
		}
		if (typeof keyNode === "object" && _class(keyNode) === "[object Object]") keyNode = "[object Object]";
		keyNode = String(keyNode);
		if (_result === null) _result = {};
		if (keyTag === "tag:yaml.org,2002:merge") if (Array.isArray(valueNode)) for (index = 0, quantity = valueNode.length; index < quantity; index += 1) mergeMappings(state, _result, valueNode[index], overridableKeys);
		else mergeMappings(state, _result, valueNode, overridableKeys);
		else {
			if (!state.json && !_hasOwnProperty.call(overridableKeys, keyNode) && _hasOwnProperty.call(_result, keyNode)) {
				state.line = startLine || state.line;
				state.lineStart = startLineStart || state.lineStart;
				state.position = startPos || state.position;
				throwError(state, "duplicated mapping key");
			}
			setProperty(_result, keyNode, valueNode);
			delete overridableKeys[keyNode];
		}
		return _result;
	}
	function readLineBreak(state) {
		var ch = state.input.charCodeAt(state.position);
		if (ch === 10) state.position++;
		else if (ch === 13) {
			state.position++;
			if (state.input.charCodeAt(state.position) === 10) state.position++;
		} else throwError(state, "a line break is expected");
		state.line += 1;
		state.lineStart = state.position;
		state.firstTabInLine = -1;
	}
	function skipSeparationSpace(state, allowComments, checkIndent) {
		var lineBreaks = 0, ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			while (is_WHITE_SPACE(ch)) {
				if (ch === 9 && state.firstTabInLine === -1) state.firstTabInLine = state.position;
				ch = state.input.charCodeAt(++state.position);
			}
			if (allowComments && ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 10 && ch !== 13 && ch !== 0);
			if (is_EOL(ch)) {
				readLineBreak(state);
				ch = state.input.charCodeAt(state.position);
				lineBreaks++;
				state.lineIndent = 0;
				while (ch === 32) {
					state.lineIndent++;
					ch = state.input.charCodeAt(++state.position);
				}
			} else break;
		}
		if (checkIndent !== -1 && lineBreaks !== 0 && state.lineIndent < checkIndent) throwWarning(state, "deficient indentation");
		return lineBreaks;
	}
	function testDocumentSeparator(state) {
		var _position = state.position, ch = state.input.charCodeAt(_position);
		if ((ch === 45 || ch === 46) && ch === state.input.charCodeAt(_position + 1) && ch === state.input.charCodeAt(_position + 2)) {
			_position += 3;
			ch = state.input.charCodeAt(_position);
			if (ch === 0 || is_WS_OR_EOL(ch)) return true;
		}
		return false;
	}
	function writeFoldedLines(state, count) {
		if (count === 1) state.result += " ";
		else if (count > 1) state.result += common.repeat("\n", count - 1);
	}
	function readPlainScalar(state, nodeIndent, withinFlowCollection) {
		var preceding, following, captureStart, captureEnd, hasPendingContent, _line, _lineStart, _lineIndent, _kind = state.kind, _result = state.result, ch = state.input.charCodeAt(state.position);
		if (is_WS_OR_EOL(ch) || is_FLOW_INDICATOR(ch) || ch === 35 || ch === 38 || ch === 42 || ch === 33 || ch === 124 || ch === 62 || ch === 39 || ch === 34 || ch === 37 || ch === 64 || ch === 96) return false;
		if (ch === 63 || ch === 45) {
			following = state.input.charCodeAt(state.position + 1);
			if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) return false;
		}
		state.kind = "scalar";
		state.result = "";
		captureStart = captureEnd = state.position;
		hasPendingContent = false;
		while (ch !== 0) {
			if (ch === 58) {
				following = state.input.charCodeAt(state.position + 1);
				if (is_WS_OR_EOL(following) || withinFlowCollection && is_FLOW_INDICATOR(following)) break;
			} else if (ch === 35) {
				preceding = state.input.charCodeAt(state.position - 1);
				if (is_WS_OR_EOL(preceding)) break;
			} else if (state.position === state.lineStart && testDocumentSeparator(state) || withinFlowCollection && is_FLOW_INDICATOR(ch)) break;
			else if (is_EOL(ch)) {
				_line = state.line;
				_lineStart = state.lineStart;
				_lineIndent = state.lineIndent;
				skipSeparationSpace(state, false, -1);
				if (state.lineIndent >= nodeIndent) {
					hasPendingContent = true;
					ch = state.input.charCodeAt(state.position);
					continue;
				} else {
					state.position = captureEnd;
					state.line = _line;
					state.lineStart = _lineStart;
					state.lineIndent = _lineIndent;
					break;
				}
			}
			if (hasPendingContent) {
				captureSegment(state, captureStart, captureEnd, false);
				writeFoldedLines(state, state.line - _line);
				captureStart = captureEnd = state.position;
				hasPendingContent = false;
			}
			if (!is_WHITE_SPACE(ch)) captureEnd = state.position + 1;
			ch = state.input.charCodeAt(++state.position);
		}
		captureSegment(state, captureStart, captureEnd, false);
		if (state.result) return true;
		state.kind = _kind;
		state.result = _result;
		return false;
	}
	function readSingleQuotedScalar(state, nodeIndent) {
		var ch = state.input.charCodeAt(state.position), captureStart, captureEnd;
		if (ch !== 39) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 39) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (ch === 39) {
				captureStart = state.position;
				state.position++;
				captureEnd = state.position;
			} else return true;
		} else if (is_EOL(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a single quoted scalar");
		else {
			state.position++;
			captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a single quoted scalar");
	}
	function readDoubleQuotedScalar(state, nodeIndent) {
		var captureStart, captureEnd, hexLength, hexResult, tmp, ch = state.input.charCodeAt(state.position);
		if (ch !== 34) return false;
		state.kind = "scalar";
		state.result = "";
		state.position++;
		captureStart = captureEnd = state.position;
		while ((ch = state.input.charCodeAt(state.position)) !== 0) if (ch === 34) {
			captureSegment(state, captureStart, state.position, true);
			state.position++;
			return true;
		} else if (ch === 92) {
			captureSegment(state, captureStart, state.position, true);
			ch = state.input.charCodeAt(++state.position);
			if (is_EOL(ch)) skipSeparationSpace(state, false, nodeIndent);
			else if (ch < 256 && simpleEscapeCheck[ch]) {
				state.result += simpleEscapeMap[ch];
				state.position++;
			} else if ((tmp = escapedHexLen(ch)) > 0) {
				hexLength = tmp;
				hexResult = 0;
				for (; hexLength > 0; hexLength--) {
					ch = state.input.charCodeAt(++state.position);
					if ((tmp = fromHexCode(ch)) >= 0) hexResult = (hexResult << 4) + tmp;
					else throwError(state, "expected hexadecimal character");
				}
				state.result += charFromCodepoint(hexResult);
				state.position++;
			} else throwError(state, "unknown escape sequence");
			captureStart = captureEnd = state.position;
		} else if (is_EOL(ch)) {
			captureSegment(state, captureStart, captureEnd, true);
			writeFoldedLines(state, skipSeparationSpace(state, false, nodeIndent));
			captureStart = captureEnd = state.position;
		} else if (state.position === state.lineStart && testDocumentSeparator(state)) throwError(state, "unexpected end of the document within a double quoted scalar");
		else {
			state.position++;
			captureEnd = state.position;
		}
		throwError(state, "unexpected end of the stream within a double quoted scalar");
	}
	function readFlowCollection(state, nodeIndent) {
		var readNext = true, _line, _lineStart, _pos, _tag = state.tag, _result, _anchor = state.anchor, following, terminator, isPair, isExplicitPair, isMapping, overridableKeys = Object.create(null), keyNode, keyTag, valueNode, ch = state.input.charCodeAt(state.position);
		if (ch === 91) {
			terminator = 93;
			isMapping = false;
			_result = [];
		} else if (ch === 123) {
			terminator = 125;
			isMapping = true;
			_result = {};
		} else return false;
		if (state.anchor !== null) state.anchorMap[state.anchor] = _result;
		ch = state.input.charCodeAt(++state.position);
		while (ch !== 0) {
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === terminator) {
				state.position++;
				state.tag = _tag;
				state.anchor = _anchor;
				state.kind = isMapping ? "mapping" : "sequence";
				state.result = _result;
				return true;
			} else if (!readNext) throwError(state, "missed comma between flow collection entries");
			else if (ch === 44) throwError(state, "expected the node content, but found ','");
			keyTag = keyNode = valueNode = null;
			isPair = isExplicitPair = false;
			if (ch === 63) {
				following = state.input.charCodeAt(state.position + 1);
				if (is_WS_OR_EOL(following)) {
					isPair = isExplicitPair = true;
					state.position++;
					skipSeparationSpace(state, true, nodeIndent);
				}
			}
			_line = state.line;
			_lineStart = state.lineStart;
			_pos = state.position;
			composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
			keyTag = state.tag;
			keyNode = state.result;
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if ((isExplicitPair || state.line === _line) && ch === 58) {
				isPair = true;
				ch = state.input.charCodeAt(++state.position);
				skipSeparationSpace(state, true, nodeIndent);
				composeNode(state, nodeIndent, CONTEXT_FLOW_IN, false, true);
				valueNode = state.result;
			}
			if (isMapping) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos);
			else if (isPair) _result.push(storeMappingPair(state, null, overridableKeys, keyTag, keyNode, valueNode, _line, _lineStart, _pos));
			else _result.push(keyNode);
			skipSeparationSpace(state, true, nodeIndent);
			ch = state.input.charCodeAt(state.position);
			if (ch === 44) {
				readNext = true;
				ch = state.input.charCodeAt(++state.position);
			} else readNext = false;
		}
		throwError(state, "unexpected end of the stream within a flow collection");
	}
	function readBlockScalar(state, nodeIndent) {
		var captureStart, folding, chomping = CHOMPING_CLIP, didReadContent = false, detectedIndent = false, textIndent = nodeIndent, emptyLines = 0, atMoreIndented = false, tmp, ch = state.input.charCodeAt(state.position);
		if (ch === 124) folding = false;
		else if (ch === 62) folding = true;
		else return false;
		state.kind = "scalar";
		state.result = "";
		while (ch !== 0) {
			ch = state.input.charCodeAt(++state.position);
			if (ch === 43 || ch === 45) if (CHOMPING_CLIP === chomping) chomping = ch === 43 ? CHOMPING_KEEP : CHOMPING_STRIP;
			else throwError(state, "repeat of a chomping mode identifier");
			else if ((tmp = fromDecimalCode(ch)) >= 0) if (tmp === 0) throwError(state, "bad explicit indentation width of a block scalar; it cannot be less than one");
			else if (!detectedIndent) {
				textIndent = nodeIndent + tmp - 1;
				detectedIndent = true;
			} else throwError(state, "repeat of an indentation width identifier");
			else break;
		}
		if (is_WHITE_SPACE(ch)) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (is_WHITE_SPACE(ch));
			if (ch === 35) do
				ch = state.input.charCodeAt(++state.position);
			while (!is_EOL(ch) && ch !== 0);
		}
		while (ch !== 0) {
			readLineBreak(state);
			state.lineIndent = 0;
			ch = state.input.charCodeAt(state.position);
			while ((!detectedIndent || state.lineIndent < textIndent) && ch === 32) {
				state.lineIndent++;
				ch = state.input.charCodeAt(++state.position);
			}
			if (!detectedIndent && state.lineIndent > textIndent) textIndent = state.lineIndent;
			if (is_EOL(ch)) {
				emptyLines++;
				continue;
			}
			if (state.lineIndent < textIndent) {
				if (chomping === CHOMPING_KEEP) state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
				else if (chomping === CHOMPING_CLIP) {
					if (didReadContent) state.result += "\n";
				}
				break;
			}
			if (folding) if (is_WHITE_SPACE(ch)) {
				atMoreIndented = true;
				state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			} else if (atMoreIndented) {
				atMoreIndented = false;
				state.result += common.repeat("\n", emptyLines + 1);
			} else if (emptyLines === 0) {
				if (didReadContent) state.result += " ";
			} else state.result += common.repeat("\n", emptyLines);
			else state.result += common.repeat("\n", didReadContent ? 1 + emptyLines : emptyLines);
			didReadContent = true;
			detectedIndent = true;
			emptyLines = 0;
			captureStart = state.position;
			while (!is_EOL(ch) && ch !== 0) ch = state.input.charCodeAt(++state.position);
			captureSegment(state, captureStart, state.position, false);
		}
		return true;
	}
	function readBlockSequence(state, nodeIndent) {
		var _line, _tag = state.tag, _anchor = state.anchor, _result = [], following, detected = false, ch;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) state.anchorMap[state.anchor] = _result;
		ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			if (ch !== 45) break;
			following = state.input.charCodeAt(state.position + 1);
			if (!is_WS_OR_EOL(following)) break;
			detected = true;
			state.position++;
			if (skipSeparationSpace(state, true, -1)) {
				if (state.lineIndent <= nodeIndent) {
					_result.push(null);
					ch = state.input.charCodeAt(state.position);
					continue;
				}
			}
			_line = state.line;
			composeNode(state, nodeIndent, CONTEXT_BLOCK_IN, false, true);
			_result.push(state.result);
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a sequence entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "sequence";
			state.result = _result;
			return true;
		}
		return false;
	}
	function readBlockMapping(state, nodeIndent, flowIndent) {
		var following, allowCompact, _line, _keyLine, _keyLineStart, _keyPos, _tag = state.tag, _anchor = state.anchor, _result = {}, overridableKeys = Object.create(null), keyTag = null, keyNode = null, valueNode = null, atExplicitKey = false, detected = false, ch;
		if (state.firstTabInLine !== -1) return false;
		if (state.anchor !== null) state.anchorMap[state.anchor] = _result;
		ch = state.input.charCodeAt(state.position);
		while (ch !== 0) {
			if (!atExplicitKey && state.firstTabInLine !== -1) {
				state.position = state.firstTabInLine;
				throwError(state, "tab characters must not be used in indentation");
			}
			following = state.input.charCodeAt(state.position + 1);
			_line = state.line;
			if ((ch === 63 || ch === 58) && is_WS_OR_EOL(following)) {
				if (ch === 63) {
					if (atExplicitKey) {
						storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
						keyTag = keyNode = valueNode = null;
					}
					detected = true;
					atExplicitKey = true;
					allowCompact = true;
				} else if (atExplicitKey) {
					atExplicitKey = false;
					allowCompact = true;
				} else throwError(state, "incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line");
				state.position += 1;
				ch = following;
			} else {
				_keyLine = state.line;
				_keyLineStart = state.lineStart;
				_keyPos = state.position;
				if (!composeNode(state, flowIndent, CONTEXT_FLOW_OUT, false, true)) break;
				if (state.line === _line) {
					ch = state.input.charCodeAt(state.position);
					while (is_WHITE_SPACE(ch)) ch = state.input.charCodeAt(++state.position);
					if (ch === 58) {
						ch = state.input.charCodeAt(++state.position);
						if (!is_WS_OR_EOL(ch)) throwError(state, "a whitespace character is expected after the key-value separator within a block mapping");
						if (atExplicitKey) {
							storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
							keyTag = keyNode = valueNode = null;
						}
						detected = true;
						atExplicitKey = false;
						allowCompact = false;
						keyTag = state.tag;
						keyNode = state.result;
					} else if (detected) throwError(state, "can not read an implicit mapping pair; a colon is missed");
					else {
						state.tag = _tag;
						state.anchor = _anchor;
						return true;
					}
				} else if (detected) throwError(state, "can not read a block mapping entry; a multiline key may not be an implicit key");
				else {
					state.tag = _tag;
					state.anchor = _anchor;
					return true;
				}
			}
			if (state.line === _line || state.lineIndent > nodeIndent) {
				if (atExplicitKey) {
					_keyLine = state.line;
					_keyLineStart = state.lineStart;
					_keyPos = state.position;
				}
				if (composeNode(state, nodeIndent, CONTEXT_BLOCK_OUT, true, allowCompact)) if (atExplicitKey) keyNode = state.result;
				else valueNode = state.result;
				if (!atExplicitKey) {
					storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, valueNode, _keyLine, _keyLineStart, _keyPos);
					keyTag = keyNode = valueNode = null;
				}
				skipSeparationSpace(state, true, -1);
				ch = state.input.charCodeAt(state.position);
			}
			if ((state.line === _line || state.lineIndent > nodeIndent) && ch !== 0) throwError(state, "bad indentation of a mapping entry");
			else if (state.lineIndent < nodeIndent) break;
		}
		if (atExplicitKey) storeMappingPair(state, _result, overridableKeys, keyTag, keyNode, null, _keyLine, _keyLineStart, _keyPos);
		if (detected) {
			state.tag = _tag;
			state.anchor = _anchor;
			state.kind = "mapping";
			state.result = _result;
		}
		return detected;
	}
	function readTagProperty(state) {
		var _position, isVerbatim = false, isNamed = false, tagHandle, tagName, ch = state.input.charCodeAt(state.position);
		if (ch !== 33) return false;
		if (state.tag !== null) throwError(state, "duplication of a tag property");
		ch = state.input.charCodeAt(++state.position);
		if (ch === 60) {
			isVerbatim = true;
			ch = state.input.charCodeAt(++state.position);
		} else if (ch === 33) {
			isNamed = true;
			tagHandle = "!!";
			ch = state.input.charCodeAt(++state.position);
		} else tagHandle = "!";
		_position = state.position;
		if (isVerbatim) {
			do
				ch = state.input.charCodeAt(++state.position);
			while (ch !== 0 && ch !== 62);
			if (state.position < state.length) {
				tagName = state.input.slice(_position, state.position);
				ch = state.input.charCodeAt(++state.position);
			} else throwError(state, "unexpected end of the stream within a verbatim tag");
		} else {
			while (ch !== 0 && !is_WS_OR_EOL(ch)) {
				if (ch === 33) if (!isNamed) {
					tagHandle = state.input.slice(_position - 1, state.position + 1);
					if (!PATTERN_TAG_HANDLE.test(tagHandle)) throwError(state, "named tag handle cannot contain such characters");
					isNamed = true;
					_position = state.position + 1;
				} else throwError(state, "tag suffix cannot contain exclamation marks");
				ch = state.input.charCodeAt(++state.position);
			}
			tagName = state.input.slice(_position, state.position);
			if (PATTERN_FLOW_INDICATORS.test(tagName)) throwError(state, "tag suffix cannot contain flow indicator characters");
		}
		if (tagName && !PATTERN_TAG_URI.test(tagName)) throwError(state, "tag name cannot contain such characters: " + tagName);
		try {
			tagName = decodeURIComponent(tagName);
		} catch (err) {
			throwError(state, "tag name is malformed: " + tagName);
		}
		if (isVerbatim) state.tag = tagName;
		else if (_hasOwnProperty.call(state.tagMap, tagHandle)) state.tag = state.tagMap[tagHandle] + tagName;
		else if (tagHandle === "!") state.tag = "!" + tagName;
		else if (tagHandle === "!!") state.tag = "tag:yaml.org,2002:" + tagName;
		else throwError(state, "undeclared tag handle \"" + tagHandle + "\"");
		return true;
	}
	function readAnchorProperty(state) {
		var _position, ch = state.input.charCodeAt(state.position);
		if (ch !== 38) return false;
		if (state.anchor !== null) throwError(state, "duplication of an anchor property");
		ch = state.input.charCodeAt(++state.position);
		_position = state.position;
		while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an anchor node must contain at least one character");
		state.anchor = state.input.slice(_position, state.position);
		return true;
	}
	function readAlias(state) {
		var _position, alias, ch = state.input.charCodeAt(state.position);
		if (ch !== 42) return false;
		ch = state.input.charCodeAt(++state.position);
		_position = state.position;
		while (ch !== 0 && !is_WS_OR_EOL(ch) && !is_FLOW_INDICATOR(ch)) ch = state.input.charCodeAt(++state.position);
		if (state.position === _position) throwError(state, "name of an alias node must contain at least one character");
		alias = state.input.slice(_position, state.position);
		if (!_hasOwnProperty.call(state.anchorMap, alias)) throwError(state, "unidentified alias \"" + alias + "\"");
		state.result = state.anchorMap[alias];
		skipSeparationSpace(state, true, -1);
		return true;
	}
	function composeNode(state, parentIndent, nodeContext, allowToSeek, allowCompact) {
		var allowBlockStyles, allowBlockScalars, allowBlockCollections, indentStatus = 1, atNewLine = false, hasContent = false, typeIndex, typeQuantity, typeList, type, flowIndent, blockIndent;
		if (state.listener !== null) state.listener("open", state);
		state.tag = null;
		state.anchor = null;
		state.kind = null;
		state.result = null;
		allowBlockStyles = allowBlockScalars = allowBlockCollections = CONTEXT_BLOCK_OUT === nodeContext || CONTEXT_BLOCK_IN === nodeContext;
		if (allowToSeek) {
			if (skipSeparationSpace(state, true, -1)) {
				atNewLine = true;
				if (state.lineIndent > parentIndent) indentStatus = 1;
				else if (state.lineIndent === parentIndent) indentStatus = 0;
				else if (state.lineIndent < parentIndent) indentStatus = -1;
			}
		}
		if (indentStatus === 1) while (readTagProperty(state) || readAnchorProperty(state)) if (skipSeparationSpace(state, true, -1)) {
			atNewLine = true;
			allowBlockCollections = allowBlockStyles;
			if (state.lineIndent > parentIndent) indentStatus = 1;
			else if (state.lineIndent === parentIndent) indentStatus = 0;
			else if (state.lineIndent < parentIndent) indentStatus = -1;
		} else allowBlockCollections = false;
		if (allowBlockCollections) allowBlockCollections = atNewLine || allowCompact;
		if (indentStatus === 1 || CONTEXT_BLOCK_OUT === nodeContext) {
			if (CONTEXT_FLOW_IN === nodeContext || CONTEXT_FLOW_OUT === nodeContext) flowIndent = parentIndent;
			else flowIndent = parentIndent + 1;
			blockIndent = state.position - state.lineStart;
			if (indentStatus === 1) if (allowBlockCollections && (readBlockSequence(state, blockIndent) || readBlockMapping(state, blockIndent, flowIndent)) || readFlowCollection(state, flowIndent)) hasContent = true;
			else {
				if (allowBlockScalars && readBlockScalar(state, flowIndent) || readSingleQuotedScalar(state, flowIndent) || readDoubleQuotedScalar(state, flowIndent)) hasContent = true;
				else if (readAlias(state)) {
					hasContent = true;
					if (state.tag !== null || state.anchor !== null) throwError(state, "alias node should not have any properties");
				} else if (readPlainScalar(state, flowIndent, CONTEXT_FLOW_IN === nodeContext)) {
					hasContent = true;
					if (state.tag === null) state.tag = "?";
				}
				if (state.anchor !== null) state.anchorMap[state.anchor] = state.result;
			}
			else if (indentStatus === 0) hasContent = allowBlockCollections && readBlockSequence(state, blockIndent);
		}
		if (state.tag === null) {
			if (state.anchor !== null) state.anchorMap[state.anchor] = state.result;
		} else if (state.tag === "?") {
			if (state.result !== null && state.kind !== "scalar") throwError(state, "unacceptable node kind for !<?> tag; it should be \"scalar\", not \"" + state.kind + "\"");
			for (typeIndex = 0, typeQuantity = state.implicitTypes.length; typeIndex < typeQuantity; typeIndex += 1) {
				type = state.implicitTypes[typeIndex];
				if (type.resolve(state.result)) {
					state.result = type.construct(state.result);
					state.tag = type.tag;
					if (state.anchor !== null) state.anchorMap[state.anchor] = state.result;
					break;
				}
			}
		} else if (state.tag !== "!") {
			if (_hasOwnProperty.call(state.typeMap[state.kind || "fallback"], state.tag)) type = state.typeMap[state.kind || "fallback"][state.tag];
			else {
				type = null;
				typeList = state.typeMap.multi[state.kind || "fallback"];
				for (typeIndex = 0, typeQuantity = typeList.length; typeIndex < typeQuantity; typeIndex += 1) if (state.tag.slice(0, typeList[typeIndex].tag.length) === typeList[typeIndex].tag) {
					type = typeList[typeIndex];
					break;
				}
			}
			if (!type) throwError(state, "unknown tag !<" + state.tag + ">");
			if (state.result !== null && type.kind !== state.kind) throwError(state, "unacceptable node kind for !<" + state.tag + "> tag; it should be \"" + type.kind + "\", not \"" + state.kind + "\"");
			if (!type.resolve(state.result, state.tag)) throwError(state, "cannot resolve a node with !<" + state.tag + "> explicit tag");
			else {
				state.result = type.construct(state.result, state.tag);
				if (state.anchor !== null) state.anchorMap[state.anchor] = state.result;
			}
		}
		if (state.listener !== null) state.listener("close", state);
		return state.tag !== null || state.anchor !== null || hasContent;
	}
	function readDocument(state) {
		var documentStart = state.position, _position, directiveName, directiveArgs, hasDirectives = false, ch;
		state.version = null;
		state.checkLineBreaks = state.legacy;
		state.tagMap = Object.create(null);
		state.anchorMap = Object.create(null);
		while ((ch = state.input.charCodeAt(state.position)) !== 0) {
			skipSeparationSpace(state, true, -1);
			ch = state.input.charCodeAt(state.position);
			if (state.lineIndent > 0 || ch !== 37) break;
			hasDirectives = true;
			ch = state.input.charCodeAt(++state.position);
			_position = state.position;
			while (ch !== 0 && !is_WS_OR_EOL(ch)) ch = state.input.charCodeAt(++state.position);
			directiveName = state.input.slice(_position, state.position);
			directiveArgs = [];
			if (directiveName.length < 1) throwError(state, "directive name must not be less than one character in length");
			while (ch !== 0) {
				while (is_WHITE_SPACE(ch)) ch = state.input.charCodeAt(++state.position);
				if (ch === 35) {
					do
						ch = state.input.charCodeAt(++state.position);
					while (ch !== 0 && !is_EOL(ch));
					break;
				}
				if (is_EOL(ch)) break;
				_position = state.position;
				while (ch !== 0 && !is_WS_OR_EOL(ch)) ch = state.input.charCodeAt(++state.position);
				directiveArgs.push(state.input.slice(_position, state.position));
			}
			if (ch !== 0) readLineBreak(state);
			if (_hasOwnProperty.call(directiveHandlers, directiveName)) directiveHandlers[directiveName](state, directiveName, directiveArgs);
			else throwWarning(state, "unknown document directive \"" + directiveName + "\"");
		}
		skipSeparationSpace(state, true, -1);
		if (state.lineIndent === 0 && state.input.charCodeAt(state.position) === 45 && state.input.charCodeAt(state.position + 1) === 45 && state.input.charCodeAt(state.position + 2) === 45) {
			state.position += 3;
			skipSeparationSpace(state, true, -1);
		} else if (hasDirectives) throwError(state, "directives end mark is expected");
		composeNode(state, state.lineIndent - 1, CONTEXT_BLOCK_OUT, false, true);
		skipSeparationSpace(state, true, -1);
		if (state.checkLineBreaks && PATTERN_NON_ASCII_LINE_BREAKS.test(state.input.slice(documentStart, state.position))) throwWarning(state, "non-ASCII line breaks are interpreted as content");
		state.documents.push(state.result);
		if (state.position === state.lineStart && testDocumentSeparator(state)) {
			if (state.input.charCodeAt(state.position) === 46) {
				state.position += 3;
				skipSeparationSpace(state, true, -1);
			}
			return;
		}
		if (state.position < state.length - 1) throwError(state, "end of the stream or a document separator is expected");
		else return;
	}
	function loadDocuments(input, options) {
		input = String(input);
		options = options || {};
		if (input.length !== 0) {
			if (input.charCodeAt(input.length - 1) !== 10 && input.charCodeAt(input.length - 1) !== 13) input += "\n";
			if (input.charCodeAt(0) === 65279) input = input.slice(1);
		}
		var state = new State(input, options);
		var nullpos = input.indexOf("\0");
		if (nullpos !== -1) {
			state.position = nullpos;
			throwError(state, "null byte is not allowed in input");
		}
		state.input += "\0";
		while (state.input.charCodeAt(state.position) === 32) {
			state.lineIndent += 1;
			state.position += 1;
		}
		while (state.position < state.length - 1) readDocument(state);
		return state.documents;
	}
	function loadAll(input, iterator, options) {
		if (iterator !== null && typeof iterator === "object" && typeof options === "undefined") {
			options = iterator;
			iterator = null;
		}
		var documents = loadDocuments(input, options);
		if (typeof iterator !== "function") return documents;
		for (var index = 0, length = documents.length; index < length; index += 1) iterator(documents[index]);
	}
	function load(input, options) {
		var documents = loadDocuments(input, options);
		if (documents.length === 0) return;
		else if (documents.length === 1) return documents[0];
		throw new YAMLException("expected a single document in the stream, but found more");
	}
	module.exports.loadAll = loadAll;
	module.exports.load = load;
}));
//#endregion
//#region node_modules/js-yaml/lib/dumper.js
var require_dumper = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var common = require_common();
	var YAMLException = require_exception();
	var DEFAULT_SCHEMA = require_default();
	var _toString = Object.prototype.toString;
	var _hasOwnProperty = Object.prototype.hasOwnProperty;
	var CHAR_BOM = 65279;
	var CHAR_TAB = 9;
	var CHAR_LINE_FEED = 10;
	var CHAR_CARRIAGE_RETURN = 13;
	var CHAR_SPACE = 32;
	var CHAR_EXCLAMATION = 33;
	var CHAR_DOUBLE_QUOTE = 34;
	var CHAR_SHARP = 35;
	var CHAR_PERCENT = 37;
	var CHAR_AMPERSAND = 38;
	var CHAR_SINGLE_QUOTE = 39;
	var CHAR_ASTERISK = 42;
	var CHAR_COMMA = 44;
	var CHAR_MINUS = 45;
	var CHAR_COLON = 58;
	var CHAR_EQUALS = 61;
	var CHAR_GREATER_THAN = 62;
	var CHAR_QUESTION = 63;
	var CHAR_COMMERCIAL_AT = 64;
	var CHAR_LEFT_SQUARE_BRACKET = 91;
	var CHAR_RIGHT_SQUARE_BRACKET = 93;
	var CHAR_GRAVE_ACCENT = 96;
	var CHAR_LEFT_CURLY_BRACKET = 123;
	var CHAR_VERTICAL_LINE = 124;
	var CHAR_RIGHT_CURLY_BRACKET = 125;
	var ESCAPE_SEQUENCES = {};
	ESCAPE_SEQUENCES[0] = "\\0";
	ESCAPE_SEQUENCES[7] = "\\a";
	ESCAPE_SEQUENCES[8] = "\\b";
	ESCAPE_SEQUENCES[9] = "\\t";
	ESCAPE_SEQUENCES[10] = "\\n";
	ESCAPE_SEQUENCES[11] = "\\v";
	ESCAPE_SEQUENCES[12] = "\\f";
	ESCAPE_SEQUENCES[13] = "\\r";
	ESCAPE_SEQUENCES[27] = "\\e";
	ESCAPE_SEQUENCES[34] = "\\\"";
	ESCAPE_SEQUENCES[92] = "\\\\";
	ESCAPE_SEQUENCES[133] = "\\N";
	ESCAPE_SEQUENCES[160] = "\\_";
	ESCAPE_SEQUENCES[8232] = "\\L";
	ESCAPE_SEQUENCES[8233] = "\\P";
	var DEPRECATED_BOOLEANS_SYNTAX = [
		"y",
		"Y",
		"yes",
		"Yes",
		"YES",
		"on",
		"On",
		"ON",
		"n",
		"N",
		"no",
		"No",
		"NO",
		"off",
		"Off",
		"OFF"
	];
	var DEPRECATED_BASE60_SYNTAX = /^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;
	function compileStyleMap(schema, map) {
		var result, keys, index, length, tag, style, type;
		if (map === null) return {};
		result = {};
		keys = Object.keys(map);
		for (index = 0, length = keys.length; index < length; index += 1) {
			tag = keys[index];
			style = String(map[tag]);
			if (tag.slice(0, 2) === "!!") tag = "tag:yaml.org,2002:" + tag.slice(2);
			type = schema.compiledTypeMap["fallback"][tag];
			if (type && _hasOwnProperty.call(type.styleAliases, style)) style = type.styleAliases[style];
			result[tag] = style;
		}
		return result;
	}
	function encodeHex(character) {
		var string = character.toString(16).toUpperCase(), handle, length;
		if (character <= 255) {
			handle = "x";
			length = 2;
		} else if (character <= 65535) {
			handle = "u";
			length = 4;
		} else if (character <= 4294967295) {
			handle = "U";
			length = 8;
		} else throw new YAMLException("code point within a string may not be greater than 0xFFFFFFFF");
		return "\\" + handle + common.repeat("0", length - string.length) + string;
	}
	var QUOTING_TYPE_SINGLE = 1, QUOTING_TYPE_DOUBLE = 2;
	function State(options) {
		this.schema = options["schema"] || DEFAULT_SCHEMA;
		this.indent = Math.max(1, options["indent"] || 2);
		this.noArrayIndent = options["noArrayIndent"] || false;
		this.skipInvalid = options["skipInvalid"] || false;
		this.flowLevel = common.isNothing(options["flowLevel"]) ? -1 : options["flowLevel"];
		this.styleMap = compileStyleMap(this.schema, options["styles"] || null);
		this.sortKeys = options["sortKeys"] || false;
		this.lineWidth = options["lineWidth"] || 80;
		this.noRefs = options["noRefs"] || false;
		this.noCompatMode = options["noCompatMode"] || false;
		this.condenseFlow = options["condenseFlow"] || false;
		this.quotingType = options["quotingType"] === "\"" ? QUOTING_TYPE_DOUBLE : QUOTING_TYPE_SINGLE;
		this.forceQuotes = options["forceQuotes"] || false;
		this.replacer = typeof options["replacer"] === "function" ? options["replacer"] : null;
		this.implicitTypes = this.schema.compiledImplicit;
		this.explicitTypes = this.schema.compiledExplicit;
		this.tag = null;
		this.result = "";
		this.duplicates = [];
		this.usedDuplicates = null;
	}
	function indentString(string, spaces) {
		var ind = common.repeat(" ", spaces), position = 0, next = -1, result = "", line, length = string.length;
		while (position < length) {
			next = string.indexOf("\n", position);
			if (next === -1) {
				line = string.slice(position);
				position = length;
			} else {
				line = string.slice(position, next + 1);
				position = next + 1;
			}
			if (line.length && line !== "\n") result += ind;
			result += line;
		}
		return result;
	}
	function generateNextLine(state, level) {
		return "\n" + common.repeat(" ", state.indent * level);
	}
	function testImplicitResolving(state, str) {
		var index, length, type;
		for (index = 0, length = state.implicitTypes.length; index < length; index += 1) {
			type = state.implicitTypes[index];
			if (type.resolve(str)) return true;
		}
		return false;
	}
	function isWhitespace(c) {
		return c === CHAR_SPACE || c === CHAR_TAB;
	}
	function isPrintable(c) {
		return 32 <= c && c <= 126 || 161 <= c && c <= 55295 && c !== 8232 && c !== 8233 || 57344 <= c && c <= 65533 && c !== CHAR_BOM || 65536 <= c && c <= 1114111;
	}
	function isNsCharOrWhitespace(c) {
		return isPrintable(c) && c !== CHAR_BOM && c !== CHAR_CARRIAGE_RETURN && c !== CHAR_LINE_FEED;
	}
	function isPlainSafe(c, prev, inblock) {
		var cIsNsCharOrWhitespace = isNsCharOrWhitespace(c);
		var cIsNsChar = cIsNsCharOrWhitespace && !isWhitespace(c);
		return (inblock ? cIsNsCharOrWhitespace : cIsNsCharOrWhitespace && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET) && c !== CHAR_SHARP && !(prev === CHAR_COLON && !cIsNsChar) || isNsCharOrWhitespace(prev) && !isWhitespace(prev) && c === CHAR_SHARP || prev === CHAR_COLON && cIsNsChar;
	}
	function isPlainSafeFirst(c) {
		return isPrintable(c) && c !== CHAR_BOM && !isWhitespace(c) && c !== CHAR_MINUS && c !== CHAR_QUESTION && c !== CHAR_COLON && c !== CHAR_COMMA && c !== CHAR_LEFT_SQUARE_BRACKET && c !== CHAR_RIGHT_SQUARE_BRACKET && c !== CHAR_LEFT_CURLY_BRACKET && c !== CHAR_RIGHT_CURLY_BRACKET && c !== CHAR_SHARP && c !== CHAR_AMPERSAND && c !== CHAR_ASTERISK && c !== CHAR_EXCLAMATION && c !== CHAR_VERTICAL_LINE && c !== CHAR_EQUALS && c !== CHAR_GREATER_THAN && c !== CHAR_SINGLE_QUOTE && c !== CHAR_DOUBLE_QUOTE && c !== CHAR_PERCENT && c !== CHAR_COMMERCIAL_AT && c !== CHAR_GRAVE_ACCENT;
	}
	function isPlainSafeLast(c) {
		return !isWhitespace(c) && c !== CHAR_COLON;
	}
	function codePointAt(string, pos) {
		var first = string.charCodeAt(pos), second;
		if (first >= 55296 && first <= 56319 && pos + 1 < string.length) {
			second = string.charCodeAt(pos + 1);
			if (second >= 56320 && second <= 57343) return (first - 55296) * 1024 + second - 56320 + 65536;
		}
		return first;
	}
	function needIndentIndicator(string) {
		return /^\n* /.test(string);
	}
	var STYLE_PLAIN = 1, STYLE_SINGLE = 2, STYLE_LITERAL = 3, STYLE_FOLDED = 4, STYLE_DOUBLE = 5;
	function chooseScalarStyle(string, singleLineOnly, indentPerLevel, lineWidth, testAmbiguousType, quotingType, forceQuotes, inblock) {
		var i;
		var char = 0;
		var prevChar = null;
		var hasLineBreak = false;
		var hasFoldableLine = false;
		var shouldTrackWidth = lineWidth !== -1;
		var previousLineBreak = -1;
		var plain = isPlainSafeFirst(codePointAt(string, 0)) && isPlainSafeLast(codePointAt(string, string.length - 1));
		if (singleLineOnly || forceQuotes) for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			if (!isPrintable(char)) return STYLE_DOUBLE;
			plain = plain && isPlainSafe(char, prevChar, inblock);
			prevChar = char;
		}
		else {
			for (i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
				char = codePointAt(string, i);
				if (char === CHAR_LINE_FEED) {
					hasLineBreak = true;
					if (shouldTrackWidth) {
						hasFoldableLine = hasFoldableLine || i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
						previousLineBreak = i;
					}
				} else if (!isPrintable(char)) return STYLE_DOUBLE;
				plain = plain && isPlainSafe(char, prevChar, inblock);
				prevChar = char;
			}
			hasFoldableLine = hasFoldableLine || shouldTrackWidth && i - previousLineBreak - 1 > lineWidth && string[previousLineBreak + 1] !== " ";
		}
		if (!hasLineBreak && !hasFoldableLine) {
			if (plain && !forceQuotes && !testAmbiguousType(string)) return STYLE_PLAIN;
			return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
		}
		if (indentPerLevel > 9 && needIndentIndicator(string)) return STYLE_DOUBLE;
		if (!forceQuotes) return hasFoldableLine ? STYLE_FOLDED : STYLE_LITERAL;
		return quotingType === QUOTING_TYPE_DOUBLE ? STYLE_DOUBLE : STYLE_SINGLE;
	}
	function writeScalar(state, string, level, iskey, inblock) {
		state.dump = function() {
			if (string.length === 0) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"\"" : "''";
			if (!state.noCompatMode) {
				if (DEPRECATED_BOOLEANS_SYNTAX.indexOf(string) !== -1 || DEPRECATED_BASE60_SYNTAX.test(string)) return state.quotingType === QUOTING_TYPE_DOUBLE ? "\"" + string + "\"" : "'" + string + "'";
			}
			var indent = state.indent * Math.max(1, level);
			var lineWidth = state.lineWidth === -1 ? -1 : Math.max(Math.min(state.lineWidth, 40), state.lineWidth - indent);
			var singleLineOnly = iskey || state.flowLevel > -1 && level >= state.flowLevel;
			function testAmbiguity(string) {
				return testImplicitResolving(state, string);
			}
			switch (chooseScalarStyle(string, singleLineOnly, state.indent, lineWidth, testAmbiguity, state.quotingType, state.forceQuotes && !iskey, inblock)) {
				case STYLE_PLAIN: return string;
				case STYLE_SINGLE: return "'" + string.replace(/'/g, "''") + "'";
				case STYLE_LITERAL: return "|" + blockHeader(string, state.indent) + dropEndingNewline(indentString(string, indent));
				case STYLE_FOLDED: return ">" + blockHeader(string, state.indent) + dropEndingNewline(indentString(foldString(string, lineWidth), indent));
				case STYLE_DOUBLE: return "\"" + escapeString(string, lineWidth) + "\"";
				default: throw new YAMLException("impossible error: invalid scalar style");
			}
		}();
	}
	function blockHeader(string, indentPerLevel) {
		var indentIndicator = needIndentIndicator(string) ? String(indentPerLevel) : "";
		var clip = string[string.length - 1] === "\n";
		return indentIndicator + (clip && (string[string.length - 2] === "\n" || string === "\n") ? "+" : clip ? "" : "-") + "\n";
	}
	function dropEndingNewline(string) {
		return string[string.length - 1] === "\n" ? string.slice(0, -1) : string;
	}
	function foldString(string, width) {
		var lineRe = /(\n+)([^\n]*)/g;
		var result = function() {
			var nextLF = string.indexOf("\n");
			nextLF = nextLF !== -1 ? nextLF : string.length;
			lineRe.lastIndex = nextLF;
			return foldLine(string.slice(0, nextLF), width);
		}();
		var prevMoreIndented = string[0] === "\n" || string[0] === " ";
		var moreIndented;
		var match;
		while (match = lineRe.exec(string)) {
			var prefix = match[1], line = match[2];
			moreIndented = line[0] === " ";
			result += prefix + (!prevMoreIndented && !moreIndented && line !== "" ? "\n" : "") + foldLine(line, width);
			prevMoreIndented = moreIndented;
		}
		return result;
	}
	function foldLine(line, width) {
		if (line === "" || line[0] === " ") return line;
		var breakRe = / [^ ]/g;
		var match;
		var start = 0, end, curr = 0, next = 0;
		var result = "";
		while (match = breakRe.exec(line)) {
			next = match.index;
			if (next - start > width) {
				end = curr > start ? curr : next;
				result += "\n" + line.slice(start, end);
				start = end + 1;
			}
			curr = next;
		}
		result += "\n";
		if (line.length - start > width && curr > start) result += line.slice(start, curr) + "\n" + line.slice(curr + 1);
		else result += line.slice(start);
		return result.slice(1);
	}
	function escapeString(string) {
		var result = "";
		var char = 0;
		var escapeSeq;
		for (var i = 0; i < string.length; char >= 65536 ? i += 2 : i++) {
			char = codePointAt(string, i);
			escapeSeq = ESCAPE_SEQUENCES[char];
			if (!escapeSeq && isPrintable(char)) {
				result += string[i];
				if (char >= 65536) result += string[i + 1];
			} else result += escapeSeq || encodeHex(char);
		}
		return result;
	}
	function writeFlowSequence(state, level, object) {
		var _result = "", _tag = state.tag, index, length, value;
		for (index = 0, length = object.length; index < length; index += 1) {
			value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level, value, false, false) || typeof value === "undefined" && writeNode(state, level, null, false, false)) {
				if (_result !== "") _result += "," + (!state.condenseFlow ? " " : "");
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = "[" + _result + "]";
	}
	function writeBlockSequence(state, level, object, compact) {
		var _result = "", _tag = state.tag, index, length, value;
		for (index = 0, length = object.length; index < length; index += 1) {
			value = object[index];
			if (state.replacer) value = state.replacer.call(object, String(index), value);
			if (writeNode(state, level + 1, value, true, true, false, true) || typeof value === "undefined" && writeNode(state, level + 1, null, true, true, false, true)) {
				if (!compact || _result !== "") _result += generateNextLine(state, level);
				if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) _result += "-";
				else _result += "- ";
				_result += state.dump;
			}
		}
		state.tag = _tag;
		state.dump = _result || "[]";
	}
	function writeFlowMapping(state, level, object) {
		var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, pairBuffer;
		for (index = 0, length = objectKeyList.length; index < length; index += 1) {
			pairBuffer = "";
			if (_result !== "") pairBuffer += ", ";
			if (state.condenseFlow) pairBuffer += "\"";
			objectKey = objectKeyList[index];
			objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level, objectKey, false, false)) continue;
			if (state.dump.length > 1024) pairBuffer += "? ";
			pairBuffer += state.dump + (state.condenseFlow ? "\"" : "") + ":" + (state.condenseFlow ? "" : " ");
			if (!writeNode(state, level, objectValue, false, false)) continue;
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = "{" + _result + "}";
	}
	function writeBlockMapping(state, level, object, compact) {
		var _result = "", _tag = state.tag, objectKeyList = Object.keys(object), index, length, objectKey, objectValue, explicitPair, pairBuffer;
		if (state.sortKeys === true) objectKeyList.sort();
		else if (typeof state.sortKeys === "function") objectKeyList.sort(state.sortKeys);
		else if (state.sortKeys) throw new YAMLException("sortKeys must be a boolean or a function");
		for (index = 0, length = objectKeyList.length; index < length; index += 1) {
			pairBuffer = "";
			if (!compact || _result !== "") pairBuffer += generateNextLine(state, level);
			objectKey = objectKeyList[index];
			objectValue = object[objectKey];
			if (state.replacer) objectValue = state.replacer.call(object, objectKey, objectValue);
			if (!writeNode(state, level + 1, objectKey, true, true, true)) continue;
			explicitPair = state.tag !== null && state.tag !== "?" || state.dump && state.dump.length > 1024;
			if (explicitPair) if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += "?";
			else pairBuffer += "? ";
			pairBuffer += state.dump;
			if (explicitPair) pairBuffer += generateNextLine(state, level);
			if (!writeNode(state, level + 1, objectValue, true, explicitPair)) continue;
			if (state.dump && CHAR_LINE_FEED === state.dump.charCodeAt(0)) pairBuffer += ":";
			else pairBuffer += ": ";
			pairBuffer += state.dump;
			_result += pairBuffer;
		}
		state.tag = _tag;
		state.dump = _result || "{}";
	}
	function detectType(state, object, explicit) {
		var _result, typeList = explicit ? state.explicitTypes : state.implicitTypes, index, length, type, style;
		for (index = 0, length = typeList.length; index < length; index += 1) {
			type = typeList[index];
			if ((type.instanceOf || type.predicate) && (!type.instanceOf || typeof object === "object" && object instanceof type.instanceOf) && (!type.predicate || type.predicate(object))) {
				if (explicit) if (type.multi && type.representName) state.tag = type.representName(object);
				else state.tag = type.tag;
				else state.tag = "?";
				if (type.represent) {
					style = state.styleMap[type.tag] || type.defaultStyle;
					if (_toString.call(type.represent) === "[object Function]") _result = type.represent(object, style);
					else if (_hasOwnProperty.call(type.represent, style)) _result = type.represent[style](object, style);
					else throw new YAMLException("!<" + type.tag + "> tag resolver accepts not \"" + style + "\" style");
					state.dump = _result;
				}
				return true;
			}
		}
		return false;
	}
	function writeNode(state, level, object, block, compact, iskey, isblockseq) {
		state.tag = null;
		state.dump = object;
		if (!detectType(state, object, false)) detectType(state, object, true);
		var type = _toString.call(state.dump);
		var inblock = block;
		var tagStr;
		if (block) block = state.flowLevel < 0 || state.flowLevel > level;
		var objectOrArray = type === "[object Object]" || type === "[object Array]", duplicateIndex, duplicate;
		if (objectOrArray) {
			duplicateIndex = state.duplicates.indexOf(object);
			duplicate = duplicateIndex !== -1;
		}
		if (state.tag !== null && state.tag !== "?" || duplicate || state.indent !== 2 && level > 0) compact = false;
		if (duplicate && state.usedDuplicates[duplicateIndex]) state.dump = "*ref_" + duplicateIndex;
		else {
			if (objectOrArray && duplicate && !state.usedDuplicates[duplicateIndex]) state.usedDuplicates[duplicateIndex] = true;
			if (type === "[object Object]") if (block && Object.keys(state.dump).length !== 0) {
				writeBlockMapping(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowMapping(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type === "[object Array]") if (block && state.dump.length !== 0) {
				if (state.noArrayIndent && !isblockseq && level > 0) writeBlockSequence(state, level - 1, state.dump, compact);
				else writeBlockSequence(state, level, state.dump, compact);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + state.dump;
			} else {
				writeFlowSequence(state, level, state.dump);
				if (duplicate) state.dump = "&ref_" + duplicateIndex + " " + state.dump;
			}
			else if (type === "[object String]") {
				if (state.tag !== "?") writeScalar(state, state.dump, level, iskey, inblock);
			} else if (type === "[object Undefined]") return false;
			else {
				if (state.skipInvalid) return false;
				throw new YAMLException("unacceptable kind of an object to dump " + type);
			}
			if (state.tag !== null && state.tag !== "?") {
				tagStr = encodeURI(state.tag[0] === "!" ? state.tag.slice(1) : state.tag).replace(/!/g, "%21");
				if (state.tag[0] === "!") tagStr = "!" + tagStr;
				else if (tagStr.slice(0, 18) === "tag:yaml.org,2002:") tagStr = "!!" + tagStr.slice(18);
				else tagStr = "!<" + tagStr + ">";
				state.dump = tagStr + " " + state.dump;
			}
		}
		return true;
	}
	function getDuplicateReferences(object, state) {
		var objects = [], duplicatesIndexes = [], index, length;
		inspectNode(object, objects, duplicatesIndexes);
		for (index = 0, length = duplicatesIndexes.length; index < length; index += 1) state.duplicates.push(objects[duplicatesIndexes[index]]);
		state.usedDuplicates = new Array(length);
	}
	function inspectNode(object, objects, duplicatesIndexes) {
		var objectKeyList, index, length;
		if (object !== null && typeof object === "object") {
			index = objects.indexOf(object);
			if (index !== -1) {
				if (duplicatesIndexes.indexOf(index) === -1) duplicatesIndexes.push(index);
			} else {
				objects.push(object);
				if (Array.isArray(object)) for (index = 0, length = object.length; index < length; index += 1) inspectNode(object[index], objects, duplicatesIndexes);
				else {
					objectKeyList = Object.keys(object);
					for (index = 0, length = objectKeyList.length; index < length; index += 1) inspectNode(object[objectKeyList[index]], objects, duplicatesIndexes);
				}
			}
		}
	}
	function dump(input, options) {
		options = options || {};
		var state = new State(options);
		if (!state.noRefs) getDuplicateReferences(input, state);
		var value = input;
		if (state.replacer) value = state.replacer.call({ "": value }, "", value);
		if (writeNode(state, 0, value, true, true)) return state.dump + "\n";
		return "";
	}
	module.exports.dump = dump;
}));
//#endregion
//#region node_modules/js-yaml/index.js
var require_js_yaml = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var loader = require_loader();
	var dumper = require_dumper();
	function renamed(from, to) {
		return function() {
			throw new Error("Function yaml." + from + " is removed in js-yaml 4. Use yaml." + to + " instead, which is now safe by default.");
		};
	}
	module.exports.Type = require_type();
	module.exports.Schema = require_schema();
	module.exports.FAILSAFE_SCHEMA = require_failsafe();
	module.exports.JSON_SCHEMA = require_json();
	module.exports.CORE_SCHEMA = require_core();
	module.exports.DEFAULT_SCHEMA = require_default();
	module.exports.load = loader.load;
	module.exports.loadAll = loader.loadAll;
	module.exports.dump = dumper.dump;
	module.exports.YAMLException = require_exception();
	module.exports.types = {
		binary: require_binary(),
		float: require_float(),
		map: require_map(),
		null: require_null(),
		pairs: require_pairs(),
		set: require_set(),
		timestamp: require_timestamp(),
		bool: require_bool(),
		int: require_int(),
		merge: require_merge(),
		omap: require_omap(),
		seq: require_seq(),
		str: require_str()
	};
	module.exports.safeLoad = renamed("safeLoad", "load");
	module.exports.safeLoadAll = renamed("safeLoadAll", "loadAll");
	module.exports.safeDump = renamed("safeDump", "dump");
}));
//#endregion
//#region src/main/config.js
var require_config = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { app: app$2, shell } = require("electron");
	var fs$2 = require("fs");
	var path$3 = require("path");
	var yaml = require_js_yaml();
	var admin = require_admin();
	var DEFAULT_CONFIG = {
		studentList: [],
		allowRepeatDraw: true,
		agreedEula: false,
		floatingButton: {
			sizePercent: 100,
			transparencyPercent: 20,
			alwaysOnTop: true,
			position: {
				x: null,
				y: null
			}
		},
		pickCountDialog: {
			defaultPlayMusic: false,
			backgroundDarknessPercent: 50,
			defaultCount: 1
		},
		pickResultDialog: {
			defaultPlayGachaSound: true,
			gachaSoundVolume: .6
		},
		webConfig: {
			port: 21219,
			adminTopmostEnabled: false,
			adminAutoStartEnabled: false,
			adminAutoStartPath: "",
			adminAutoStartTaskName: admin.ADMIN_TASK_DEFAULT_NAME,
			uiAccessEnabled: false
		}
	};
	var currentConfig = DEFAULT_CONFIG;
	function clampNumber(value, min, max, fallback) {
		const num = Number(value);
		if (Number.isNaN(num)) return fallback;
		return Math.min(max, Math.max(min, num));
	}
	function normalizeConfig(input) {
		const source = input && typeof input === "object" ? input : {};
		const students = (Array.isArray(source.studentList) ? source.studentList : []).map((s) => {
			if (typeof s === "string") return {
				name: s.trim(),
				weight: 1
			};
			if (s && typeof s === "object") return {
				name: String(s.name || "").trim(),
				weight: Number.isFinite(Number(s.weight)) ? Number(s.weight) : 1
			};
			return null;
		}).filter((s) => s && s.name);
		const fb = source.floatingButton && typeof source.floatingButton === "object" ? source.floatingButton : {};
		const allowRepeatDraw = typeof source.allowRepeatDraw === "boolean" ? source.allowRepeatDraw : DEFAULT_CONFIG.allowRepeatDraw;
		const agreedEula = typeof source.agreedEula === "boolean" ? source.agreedEula : DEFAULT_CONFIG.agreedEula;
		const position = fb.position && typeof fb.position === "object" ? fb.position : {};
		const pick = source.pickCountDialog && typeof source.pickCountDialog === "object" ? source.pickCountDialog : {};
		const pickResult = source.pickResultDialog && typeof source.pickResultDialog === "object" ? source.pickResultDialog : {};
		const web = source.webConfig && typeof source.webConfig === "object" ? source.webConfig : {};
		const alwaysOnTop = typeof fb.alwaysOnTop === "boolean" ? fb.alwaysOnTop : DEFAULT_CONFIG.floatingButton.alwaysOnTop;
		return {
			studentList: students,
			allowRepeatDraw,
			agreedEula,
			floatingButton: {
				sizePercent: clampNumber(fb.sizePercent, 0, 1e3, DEFAULT_CONFIG.floatingButton.sizePercent),
				transparencyPercent: clampNumber(fb.transparencyPercent, 0, 100, DEFAULT_CONFIG.floatingButton.transparencyPercent),
				alwaysOnTop,
				position: {
					x: Number.isFinite(Number(position.x)) ? Math.round(Number(position.x)) : null,
					y: Number.isFinite(Number(position.y)) ? Math.round(Number(position.y)) : null
				}
			},
			pickCountDialog: {
				defaultPlayMusic: typeof pick.defaultPlayMusic === "boolean" ? pick.defaultPlayMusic : DEFAULT_CONFIG.pickCountDialog.defaultPlayMusic,
				backgroundDarknessPercent: clampNumber(pick.backgroundDarknessPercent, 0, 100, DEFAULT_CONFIG.pickCountDialog.backgroundDarknessPercent),
				defaultCount: Math.round(clampNumber(pick.defaultCount, 1, 10, DEFAULT_CONFIG.pickCountDialog.defaultCount))
			},
			pickResultDialog: {
				defaultPlayGachaSound: typeof pickResult.defaultPlayGachaSound === "boolean" ? pickResult.defaultPlayGachaSound : DEFAULT_CONFIG.pickResultDialog.defaultPlayGachaSound,
				gachaSoundVolume: clampNumber(pickResult.gachaSoundVolume, 0, 1, DEFAULT_CONFIG.pickResultDialog.gachaSoundVolume)
			},
			webConfig: {
				port: Math.round(clampNumber(web.port, 1, 65535, DEFAULT_CONFIG.webConfig.port)),
				adminTopmostEnabled: typeof web.adminTopmostEnabled === "boolean" ? web.adminTopmostEnabled : DEFAULT_CONFIG.webConfig.adminTopmostEnabled,
				adminAutoStartEnabled: typeof web.adminAutoStartEnabled === "boolean" ? web.adminAutoStartEnabled : DEFAULT_CONFIG.webConfig.adminAutoStartEnabled,
				adminAutoStartPath: typeof web.adminAutoStartPath === "string" ? web.adminAutoStartPath : DEFAULT_CONFIG.webConfig.adminAutoStartPath,
				adminAutoStartTaskName: typeof web.adminAutoStartTaskName === "string" && web.adminAutoStartTaskName.trim() ? web.adminAutoStartTaskName.trim() : DEFAULT_CONFIG.webConfig.adminAutoStartTaskName,
				uiAccessEnabled: typeof web.uiAccessEnabled === "boolean" ? web.uiAccessEnabled : DEFAULT_CONFIG.webConfig.uiAccessEnabled
			}
		};
	}
	function getConfigPath() {
		return path$3.join(app$2.getPath("userData"), "config.yml");
	}
	function getLegacyConfigPaths() {
		const legacyPaths = [];
		const exeDir = path$3.dirname(app$2.getPath("exe"));
		legacyPaths.push(path$3.join(exeDir, "config.yml"));
		if (!app$2.isPackaged) legacyPaths.push(path$3.join(process.cwd(), "config.yml"));
		if (admin.IS_WINDOWS) {
			const appData = app$2.getPath("appData");
			const localRoot = path$3.resolve(appData, "..", "Local");
			legacyPaths.push(path$3.join(localRoot, "Blue Random", "config.yml"));
		}
		const currentPath = getConfigPath();
		return Array.from(new Set(legacyPaths.filter((p) => p && p !== currentPath)));
	}
	function getConfigDir() {
		return path$3.dirname(getConfigPath());
	}
	async function openConfigFile() {
		const configPath = getConfigPath();
		writeDefaultConfigIfMissing(configPath);
		const result = await shell.openPath(configPath);
		if (result) return {
			ok: false,
			message: `打开配置文件失败: ${result}`
		};
		return {
			ok: true,
			message: "已打开配置文件。"
		};
	}
	async function openConfigDir() {
		const configDir = getConfigDir();
		fs$2.mkdirSync(configDir, { recursive: true });
		const result = await shell.openPath(configDir);
		if (result) return {
			ok: false,
			message: `打开配置目录失败: ${result}`
		};
		return {
			ok: true,
			message: "已打开配置目录。"
		};
	}
	function openConfigPageInBrowser() {
		const url = `http://localhost:${refreshConfig().webConfig.port}/#/config`;
		shell.openExternal(url);
	}
	function toConfigYamlWithComments(config) {
		const fb = config.floatingButton;
		const pick = config.pickCountDialog;
		const pickResult = config.pickResultDialog;
		const web = config.webConfig;
		const posX = Number.isFinite(Number(fb.position.x)) ? String(Math.round(Number(fb.position.x))) : "null";
		const posY = Number.isFinite(Number(fb.position.y)) ? String(Math.round(Number(fb.position.y))) : "null";
		const yamlSingleQuote = (value) => `'${String(value || "").replace(/'/g, "''")}'`;
		return [
			"# 抽取名单列表",
			`studentList:${Array.isArray(config.studentList) && config.studentList.length > 0 ? "\n" + config.studentList.map((s) => `  - name: "${s.name}"\n    weight: ${s.weight}`).join("\n") : " []"}`,
			`allowRepeatDraw: ${config.allowRepeatDraw ? "true" : "false"}`,
			`agreedEula: ${config.agreedEula ? "true" : "false"}`,
			"",
			"# 悬浮按钮配置",
			"floatingButton:",
			"  # 按钮大小百分比（基准 50px*50px），范围 0-1000，默认 100",
			`  sizePercent: ${fb.sizePercent}`,
			"  # 透明度百分比，范围 0-100（0=完全不透明，100=完全透明），默认 20",
			`  transparencyPercent: ${fb.transparencyPercent}`,
			"  # 是否置顶（true/false），默认 true",
			`  alwaysOnTop: ${fb.alwaysOnTop ? "true" : "false"}`,
			"  # 悬浮按钮窗口位置（左上角屏幕坐标），退出时自动保存；null 表示使用系统默认位置",
			"  position:",
			`    x: ${posX}`,
			`    y: ${posY}`,
			"",
			"# 人数选择窗口配置",
			"pickCountDialog:",
			"  # 是否默认播放喜庆点名音乐（true/false），默认 false",
			`  defaultPlayMusic: ${pick.defaultPlayMusic ? "true" : "false"}`,
			"  # 背景变暗程度，范围 0-100（100 接近全黑），默认 50",
			`  backgroundDarknessPercent: ${pick.backgroundDarknessPercent}`,
			"  # 人数默认值，范围 1-10 的整数，默认 1",
			`  defaultCount: ${pick.defaultCount}`,
			"",
			"# 抽奖结果动画音效配置",
			"pickResultDialog:",
			"  # 是否默认播放抽奖音效（true/false），默认 true",
			`  defaultPlayGachaSound: ${pickResult.defaultPlayGachaSound ? "true" : "false"}`,
			"  # 抽奖音效音量（0.0-1.0），默认 0.6",
			`  gachaSoundVolume: ${pickResult.gachaSoundVolume}`,
			"",
			"# 网页配置服务",
			"webConfig:",
			"  # 配置网页端口（默认 21219）",
			`  port: ${web.port}`,
			"  # 启用管理员置顶增强（Windows 下会尝试管理员权限）",
			`  adminTopmostEnabled: ${web.adminTopmostEnabled ? "true" : "false"}`,
			"  # 是否创建开机计划任务（管理员权限运行）",
			`  adminAutoStartEnabled: ${web.adminAutoStartEnabled ? "true" : "false"}`,
			"  # 计划任务运行的可执行文件路径",
			`  adminAutoStartPath: ${yamlSingleQuote(web.adminAutoStartPath)}`,
			"  # 计划任务名称",
			`  adminAutoStartTaskName: ${yamlSingleQuote(web.adminAutoStartTaskName || admin.ADMIN_TASK_DEFAULT_NAME)}`,
			"  # 管理员身份运行时自动使用 UIAccess（需要 uiaccess.dll 随包分发）",
			`  uiAccessEnabled: ${web.uiAccessEnabled ? "true" : "false"}`,
			""
		].join("\n");
	}
	function saveConfig(config) {
		const configPath = getConfigPath();
		const yamlText = toConfigYamlWithComments(config);
		fs$2.mkdirSync(path$3.dirname(configPath), { recursive: true });
		fs$2.writeFileSync(configPath, yamlText, "utf8");
	}
	function writeDefaultConfigIfMissing(configPath) {
		if (fs$2.existsSync(configPath)) return;
		for (const legacyPath of getLegacyConfigPaths()) if (fs$2.existsSync(legacyPath)) {
			fs$2.mkdirSync(path$3.dirname(configPath), { recursive: true });
			fs$2.copyFileSync(legacyPath, configPath);
			return;
		}
		saveConfig(DEFAULT_CONFIG);
	}
	function loadConfig() {
		const configPath = getConfigPath();
		writeDefaultConfigIfMissing(configPath);
		try {
			const raw = fs$2.readFileSync(configPath, "utf8");
			const normalized = normalizeConfig(yaml.load(raw));
			saveConfig(normalized);
			return normalized;
		} catch (error) {
			console.error("Failed to load config.yml, using defaults.", error);
			const fallback = normalizeConfig(DEFAULT_CONFIG);
			saveConfig(fallback);
			return fallback;
		}
	}
	function refreshConfig() {
		currentConfig = loadConfig();
		return currentConfig;
	}
	module.exports = {
		DEFAULT_CONFIG,
		getConfigDir,
		getConfigPath,
		getLegacyConfigPaths,
		loadConfig,
		normalizeConfig,
		openConfigDir,
		openConfigFile,
		openConfigPageInBrowser,
		refreshConfig,
		saveConfig,
		writeDefaultConfigIfMissing
	};
}));
//#endregion
//#region src/main/config-server.js
var require_config_server = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var http = require("http");
	var fs$1 = require("fs");
	var path$2 = require("path");
	var configServer = null;
	var configServerPort = null;
	var serverDeps = null;
	var configEventClients = /* @__PURE__ */ new Set();
	function broadcastConfigRefresh(reason = "refresh") {
		const payload = {
			type: "config-refresh",
			reason,
			time: (/* @__PURE__ */ new Date()).toISOString()
		};
		const message = `data: ${JSON.stringify(payload)}\n\n`;
		for (const res of configEventClients) res.write(message);
	}
	function handleConfigEventStream(req, res) {
		res.writeHead(200, {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no"
		});
		res.write("\n");
		configEventClients.add(res);
		broadcastConfigRefresh("connect");
		req.on("close", () => {
			configEventClients.delete(res);
		});
	}
	function getMimeType(filePath) {
		if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
		if (filePath.endsWith(".js")) return "application/javascript; charset=utf-8";
		if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
		if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
		return "text/plain; charset=utf-8";
	}
	function sendJson(res, statusCode, payload) {
		res.writeHead(statusCode, { "Content-Type": "application/json; charset=utf-8" });
		res.end(JSON.stringify(payload));
	}
	function parseRequestJsonBody(req) {
		return new Promise((resolve, reject) => {
			let body = "";
			req.on("data", (chunk) => {
				body += chunk;
				if (body.length > 1024 * 1024) reject(/* @__PURE__ */ new Error("Payload too large"));
			});
			req.on("end", () => {
				if (!body.trim()) {
					resolve({});
					return;
				}
				try {
					resolve(JSON.parse(body));
				} catch (error) {
					reject(error);
				}
			});
			req.on("error", reject);
		});
	}
	function createConfigServerRequestHandler() {
		const { app, isDebugMode, config, update, logging, windows, admin } = serverDeps;
		return async (req, res) => {
			const requestUrl = req.url || "/";
			if (req.method === "GET" && requestUrl === "/api/config") return sendJson(res, 200, config.refreshConfig());
			if (req.method === "GET" && requestUrl === "/api/app-info") {
				const uiAccessDefaultPath = admin.getDefaultUiAccessDllPath();
				return sendJson(res, 200, {
					version: app.getVersion(),
					isDebugMode,
					isAdmin: admin.isProcessElevated(),
					exePath: admin.getDefaultExePath(),
					uiAccessDllExists: fs$1.existsSync(uiAccessDefaultPath),
					isUiAccess: process.argv.includes(admin.UIACCESS_ARG),
					configPath: config.getConfigPath(),
					configDir: config.getConfigDir()
				});
			}
			if (req.method === "POST" && requestUrl === "/api/config/open-file") try {
				const result = await config.openConfigFile();
				if (!result.ok) return sendJson(res, 400, result);
				return sendJson(res, 200, result);
			} catch (error) {
				return sendJson(res, 500, {
					ok: false,
					message: String(error)
				});
			}
			if (req.method === "POST" && requestUrl === "/api/config/open-dir") try {
				const result = await config.openConfigDir();
				if (!result.ok) return sendJson(res, 400, result);
				return sendJson(res, 200, result);
			} catch (error) {
				return sendJson(res, 500, {
					ok: false,
					message: String(error)
				});
			}
			if (req.method === "GET" && requestUrl === "/api/check-update") try {
				return sendJson(res, 200, await update.checkUpdateFromMain());
			} catch (error) {
				console.error("Update check failed:", error);
				return sendJson(res, 500, {
					ok: false,
					status: "error",
					title: "检查更新失败",
					detail: "请检查网络或稍后再试。"
				});
			}
			if (req.method === "GET" && requestUrl === "/api/logs") {
				logging.handleLogStream(req, res);
				return;
			}
			if (req.method === "GET" && requestUrl === "/api/config-events") {
				handleConfigEventStream(req, res);
				return;
			}
			if (req.method === "POST" && requestUrl === "/api/config") try {
				const payload = await parseRequestJsonBody(req);
				const normalized = config.normalizeConfig(payload);
				config.saveConfig(normalized);
				startConfigServer();
				windows.refreshFloatingButtonWindow();
				broadcastConfigRefresh("save");
				return sendJson(res, 200, {
					ok: true,
					message: "配置保存成功，悬浮窗已自动刷新配置",
					restartRequired: false
				});
			} catch (error) {
				return sendJson(res, 400, {
					ok: false,
					message: "配置保存失败，请检查输入格式"
				});
			}
			if (req.method === "POST" && requestUrl === "/api/restart") {
				sendJson(res, 200, { ok: true });
				setTimeout(() => {
					windows.setQuitting(true);
					app.relaunch();
					app.exit(0);
				}, 80);
				return;
			}
			if (req.method === "POST" && requestUrl === "/api/admin/elevate") {
				if (!admin.IS_WINDOWS) return sendJson(res, 400, {
					ok: false,
					message: "当前系统不支持管理员提升。"
				});
				if (admin.isProcessElevated()) return sendJson(res, 200, {
					ok: true,
					message: "已在管理员权限下运行。"
				});
				const result = admin.requestAdminRelaunch();
				if (!result.ok) return sendJson(res, 400, result);
				sendJson(res, 200, result);
				setTimeout(() => {
					windows.setQuitting(true);
					app.exit(0);
				}, 150);
				return;
			}
			if (req.method === "POST" && requestUrl === "/api/task/create-admin-startup") try {
				const payload = await parseRequestJsonBody(req);
				const exePath = payload && typeof payload.exePath === "string" ? payload.exePath.trim() : "";
				const taskName = payload && typeof payload.taskName === "string" ? payload.taskName.trim() : admin.ADMIN_TASK_DEFAULT_NAME;
				const result = admin.createAdminStartupTask({
					taskName,
					exePath
				});
				if (!result.ok) return sendJson(res, 400, result);
				const baseConfig = config.refreshConfig();
				const updated = config.normalizeConfig({
					...baseConfig,
					webConfig: {
						...baseConfig.webConfig,
						adminAutoStartEnabled: true,
						adminAutoStartPath: exePath,
						adminAutoStartTaskName: taskName
					}
				});
				config.saveConfig(updated);
				return sendJson(res, 200, result);
			} catch (error) {
				return sendJson(res, 400, {
					ok: false,
					message: "创建计划任务失败。"
				});
			}
			const urlPath = requestUrl.split("?")[0].split("#")[0];
			if (!urlPath.startsWith("/api")) {
				if (process.env.VITE_DEV_SERVER_URL) {
					res.writeHead(302, { Location: process.env.VITE_DEV_SERVER_URL + "#/config" });
					res.end();
					return;
				}
				const distDir = path$2.join(__dirname, "../dist");
				const targetPath = path$2.join(distDir, urlPath === "/" ? "index.html" : urlPath);
				if (!targetPath.startsWith(distDir)) return sendJson(res, 403, {
					ok: false,
					message: "Forbidden"
				});
				if (fs$1.existsSync(targetPath) && fs$1.statSync(targetPath).isFile()) {
					const fileContent = fs$1.readFileSync(targetPath);
					res.writeHead(200, { "Content-Type": getMimeType(targetPath) });
					res.end(fileContent);
					return;
				}
			}
			sendJson(res, 404, {
				ok: false,
				message: "Not Found"
			});
		};
	}
	function startConfigServer(deps) {
		if (deps) serverDeps = deps;
		const { config } = serverDeps;
		const desiredPort = config.refreshConfig().webConfig.port;
		if (configServer && configServerPort === desiredPort) return;
		if (configServer) {
			configServer.close();
			configServer = null;
			configServerPort = null;
		}
		const server = http.createServer(createConfigServerRequestHandler());
		server.listen(desiredPort, "127.0.0.1", () => {
			configServerPort = desiredPort;
			console.log(`Config web server running at http://localhost:${desiredPort}`);
			broadcastConfigRefresh("startup");
		});
		server.on("error", (error) => {
			console.error("Failed to start config web server:", error);
		});
		configServer = server;
	}
	module.exports = { startConfigServer };
}));
//#endregion
//#region src/main/windows.js
var require_windows = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { BrowserWindow: BrowserWindow$1, screen } = require("electron");
	var path$1 = require("path");
	var config = require_config();
	var IS_WINDOWS = process.platform === "win32";
	function getScreenBounds() {
		const cursorPoint = screen.getCursorScreenPoint();
		return screen.getDisplayNearestPoint(cursorPoint).bounds;
	}
	var dragSessions = /* @__PURE__ */ new Map();
	var floatingButtonWindow = null;
	var pickCountWindow = null;
	var isPickCountWindowReady = false;
	var isFloatingHiddenForPickCount = false;
	var pickResultWindow = null;
	var isPickResultWindowReady = false;
	var currentPickResults = [];
	var pickResultToken = 0;
	var activePickResultToken = 0;
	var floatingWindowWatchdog = null;
	var isDebugMode = false;
	var isQuitting = false;
	var FLOATING_WINDOW_FADE_MS = 400;
	var WEIGHT_BOOST_GAMMA = 1.5;
	function setDebugMode(value) {
		isDebugMode = Boolean(value);
	}
	function setQuitting(value) {
		isQuitting = Boolean(value);
	}
	function getFloatingButtonWindow() {
		return floatingButtonWindow;
	}
	function getPickCountWindow() {
		return pickCountWindow;
	}
	function getPickResultWindow() {
		return pickResultWindow;
	}
	function getCurrentPickResults() {
		return currentPickResults;
	}
	function refreshFloatingButtonWindow() {
		if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) floatingButtonWindow.close();
	}
	function persistFloatingButtonPosition() {
		if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) return;
		const baseConfig = config.refreshConfig();
		const bounds = floatingButtonWindow.getBounds();
		const updated = config.normalizeConfig({
			...baseConfig,
			floatingButton: {
				...baseConfig.floatingButton,
				position: {
					x: bounds.x,
					y: bounds.y
				}
			}
		});
		config.saveConfig(updated);
	}
	function animateWindowOpacity(win, fromOpacity, toOpacity, durationMs) {
		return new Promise((resolve) => {
			if (!win || win.isDestroyed()) {
				resolve();
				return;
			}
			const start = Date.now();
			const delta = toOpacity - fromOpacity;
			win.setOpacity(fromOpacity);
			const timer = setInterval(() => {
				if (!win || win.isDestroyed()) {
					clearInterval(timer);
					resolve();
					return;
				}
				const elapsed = Date.now() - start;
				const t = Math.min(1, elapsed / durationMs);
				win.setOpacity(fromOpacity + delta * t);
				if (t >= 1) {
					clearInterval(timer);
					resolve();
				}
			}, 16);
		});
	}
	async function fadeOutFloatingButtonWindow() {
		if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) return;
		if (!floatingButtonWindow.isVisible()) return;
		const currentOpacity = floatingButtonWindow.getOpacity();
		await animateWindowOpacity(floatingButtonWindow, Number.isFinite(currentOpacity) ? currentOpacity : 1, 0, FLOATING_WINDOW_FADE_MS);
		if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) {
			floatingButtonWindow.hide();
			floatingButtonWindow.setOpacity(1);
		}
	}
	async function fadeInFloatingButtonWindow() {
		if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) return;
		floatingButtonWindow.setOpacity(0);
		floatingButtonWindow.show();
		floatingButtonWindow.focus();
		await animateWindowOpacity(floatingButtonWindow, 0, 1, FLOATING_WINDOW_FADE_MS);
	}
	function createFloatingButtonWindow() {
		if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) return floatingButtonWindow;
		const cfg = config.refreshConfig();
		const sizePx = Math.round(50 * (cfg.floatingButton.sizePercent / 100));
		const winWidth = Math.max(72, sizePx + 20);
		const winHeight = Math.max(72, sizePx + 20);
		const hasSavedX = Number.isFinite(Number(cfg.floatingButton.position.x));
		const hasSavedY = Number.isFinite(Number(cfg.floatingButton.position.y));
		const windowOptions = {
			width: winWidth,
			height: winHeight,
			frame: false,
			resizable: false,
			minimizable: false,
			maximizable: false,
			hasShadow: false,
			transparent: true,
			alwaysOnTop: cfg.floatingButton.alwaysOnTop,
			skipTaskbar: !isDebugMode,
			type: isDebugMode ? void 0 : "toolbar",
			focusable: isDebugMode ? true : process.platform !== "win32",
			webPreferences: {
				preload: path$1.join(__dirname, "preload.js"),
				contextIsolation: true,
				nodeIntegration: false,
				autoplayPolicy: "no-user-gesture-required"
			}
		};
		if (hasSavedX && hasSavedY) {
			windowOptions.x = Math.round(Number(cfg.floatingButton.position.x));
			windowOptions.y = Math.round(Number(cfg.floatingButton.position.y));
		}
		const win = new BrowserWindow$1(windowOptions);
		floatingButtonWindow = win;
		if (cfg.floatingButton.alwaysOnTop) win.setAlwaysOnTop(true, "screen-saver");
		if (cfg.webConfig && cfg.webConfig.adminTopmostEnabled && typeof win.setVisibleOnAllWorkspaces === "function") win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
		win.setMenuBarVisibility(false);
		if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
		else {
			if (isDebugMode) win.webContents.openDevTools({ mode: "detach" });
			win.loadFile(path$1.join(__dirname, "../dist/index.html"));
		}
		win.webContents.on("context-menu", (event) => {
			event.preventDefault();
		});
		win.on("hide", () => {
			if (isQuitting || isFloatingHiddenForPickCount) return;
			setTimeout(() => {
				if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) return;
				if (isQuitting || isFloatingHiddenForPickCount) return;
				if (!floatingButtonWindow.isVisible()) {
					floatingButtonWindow.setOpacity(1);
					floatingButtonWindow.show();
				}
			}, 0);
		});
		win.on("closed", () => {
			floatingButtonWindow = null;
			if (!isQuitting && !isFloatingHiddenForPickCount) setTimeout(() => {
				if (!isQuitting && !isFloatingHiddenForPickCount) createFloatingButtonWindow();
			}, 60);
		});
		return win;
	}
	function startFloatingWindowWatchdog() {
		if (floatingWindowWatchdog) {
			clearInterval(floatingWindowWatchdog);
			floatingWindowWatchdog = null;
		}
		floatingWindowWatchdog = setInterval(() => {
			if (isQuitting || isFloatingHiddenForPickCount) return;
			if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) {
				createFloatingButtonWindow();
				return;
			}
			if (!floatingButtonWindow.isVisible()) {
				floatingButtonWindow.setOpacity(1);
				floatingButtonWindow.show();
			}
		}, 450);
	}
	function stopFloatingWindowWatchdog() {
		if (floatingWindowWatchdog) {
			clearInterval(floatingWindowWatchdog);
			floatingWindowWatchdog = null;
		}
	}
	function closePickCountWindow(options = {}) {
		const keepFloatingHidden = Boolean(options.keepFloatingHidden);
		if (!pickCountWindow || pickCountWindow.isDestroyed()) {
			if (!keepFloatingHidden) {
				isFloatingHiddenForPickCount = false;
				fadeInFloatingButtonWindow();
			}
			return;
		}
		if (pickCountWindow.isVisible()) pickCountWindow.hide();
		if (keepFloatingHidden) {
			isFloatingHiddenForPickCount = true;
			return;
		}
		isFloatingHiddenForPickCount = false;
		fadeInFloatingButtonWindow();
	}
	function createPickCountWindowInstance() {
		if (pickCountWindow && !pickCountWindow.isDestroyed()) return;
		const bounds = getScreenBounds();
		const win = new BrowserWindow$1({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			show: false,
			frame: false,
			transparent: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			movable: false,
			alwaysOnTop: true,
			skipTaskbar: !isDebugMode,
			webPreferences: {
				preload: path$1.join(__dirname, "preload.js"),
				contextIsolation: true,
				nodeIntegration: false,
				autoplayPolicy: "no-user-gesture-required"
			}
		});
		if (IS_WINDOWS) win.setAlwaysOnTop(true, "screen-saver");
		pickCountWindow = win;
		isPickCountWindowReady = false;
		win.setMenuBarVisibility(false);
		if (process.env.VITE_DEV_SERVER_URL) win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-count`);
		else win.loadURL(`file://${path$1.join(__dirname, "../dist/index.html")}#/pick-count`);
		if (isDebugMode) win.webContents.openDevTools({ mode: "detach" });
		win.once("ready-to-show", () => {
			isPickCountWindowReady = true;
		});
		win.on("closed", () => {
			pickCountWindow = null;
			isPickCountWindowReady = false;
			if (!isQuitting) fadeInFloatingButtonWindow();
		});
	}
	function createPickCountWindow() {
		createPickCountWindowInstance();
		if (!pickCountWindow || pickCountWindow.isDestroyed()) return;
		const openPickCountWindow = () => {
			if (!pickCountWindow || pickCountWindow.isDestroyed()) return;
			if (IS_WINDOWS) {
				const bounds = getScreenBounds();
				pickCountWindow.setBounds(bounds);
				pickCountWindow.setAlwaysOnTop(true, "screen-saver");
			}
			pickCountWindow.webContents.send("pick-count:open");
			pickCountWindow.show();
			pickCountWindow.focus();
		};
		if (isPickCountWindowReady) openPickCountWindow();
		else pickCountWindow.once("ready-to-show", openPickCountWindow);
		isFloatingHiddenForPickCount = true;
		fadeOutFloatingButtonWindow();
	}
	function closePickResultWindow() {
		if (!pickResultWindow || pickResultWindow.isDestroyed()) {
			currentPickResults = [];
			activePickResultToken = 0;
			isFloatingHiddenForPickCount = false;
			fadeInFloatingButtonWindow();
			if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
			return;
		}
		if (pickResultWindow.isVisible()) pickResultWindow.hide();
		currentPickResults = [];
		activePickResultToken = 0;
		isFloatingHiddenForPickCount = false;
		fadeInFloatingButtonWindow();
		if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
	}
	function createPickResultWindowInstance() {
		if (pickResultWindow && !pickResultWindow.isDestroyed()) return;
		const bounds = getScreenBounds();
		const win = new BrowserWindow$1({
			x: bounds.x,
			y: bounds.y,
			width: bounds.width,
			height: bounds.height,
			show: false,
			frame: false,
			transparent: true,
			resizable: false,
			minimizable: false,
			maximizable: false,
			movable: false,
			alwaysOnTop: true,
			skipTaskbar: !isDebugMode,
			webPreferences: {
				preload: path$1.join(__dirname, "preload.js"),
				contextIsolation: true,
				nodeIntegration: false,
				autoplayPolicy: "no-user-gesture-required"
			}
		});
		if (IS_WINDOWS) win.setAlwaysOnTop(true, "screen-saver");
		pickResultWindow = win;
		isPickResultWindowReady = false;
		win.setMenuBarVisibility(false);
		if (process.env.VITE_DEV_SERVER_URL) win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-result`);
		else win.loadURL(`file://${path$1.join(__dirname, "../dist/index.html")}#/pick-result`);
		if (isDebugMode) win.webContents.openDevTools({ mode: "detach" });
		win.once("ready-to-show", () => {
			isPickResultWindowReady = true;
		});
		win.on("closed", () => {
			pickResultWindow = null;
			isPickResultWindowReady = false;
			currentPickResults = [];
			activePickResultToken = 0;
		});
	}
	function openPickResultWindow(results) {
		currentPickResults = Array.isArray(results) ? results : [];
		pickResultToken += 1;
		activePickResultToken = pickResultToken;
		createPickResultWindowInstance();
		if (!pickResultWindow || pickResultWindow.isDestroyed()) return;
		const openResultWindow = () => {
			if (!pickResultWindow || pickResultWindow.isDestroyed()) return;
			if (IS_WINDOWS) {
				const bounds = getScreenBounds();
				pickResultWindow.setBounds(bounds);
				pickResultWindow.setAlwaysOnTop(true, "screen-saver");
			}
			pickResultWindow.webContents.send("pick-result:open", {
				token: activePickResultToken,
				results: currentPickResults
			});
			pickResultWindow.show();
			pickResultWindow.focus();
		};
		if (isPickResultWindowReady) openResultWindow();
		else pickResultWindow.once("ready-to-show", openResultWindow);
		isFloatingHiddenForPickCount = true;
		fadeOutFloatingButtonWindow();
	}
	function sendPickCountStopBgm() {
		if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
	}
	function getDragSession(eventId) {
		return dragSessions.get(eventId);
	}
	function handleDragStart(event) {
		const win = BrowserWindow$1.fromWebContents(event.sender);
		if (!win) return;
		const bounds = win.getBounds();
		dragSessions.set(event.sender.id, {
			startWinX: bounds.x,
			startWinY: bounds.y,
			width: bounds.width,
			height: bounds.height
		});
	}
	function handleDragMove(event, payload) {
		const win = BrowserWindow$1.fromWebContents(event.sender);
		const session = getDragSession(event.sender.id);
		if (!win || !session || !payload) return;
		const dx = Number(payload.dx);
		const dy = Number(payload.dy);
		if (Number.isNaN(dx) || Number.isNaN(dy)) return;
		win.setBounds({
			x: Math.round(session.startWinX + dx),
			y: Math.round(session.startWinY + dy),
			width: session.width,
			height: session.height
		});
	}
	function handleDragEnd(event) {
		dragSessions.delete(event.sender.id);
	}
	function setIgnoreMouseEvents(event, ignore) {
		const win = BrowserWindow$1.fromWebContents(event.sender);
		if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true });
	}
	function pickStudentsByWeight(count) {
		const cfg = config.refreshConfig();
		const pool = (Array.isArray(cfg.studentList) ? cfg.studentList : []).map((s) => ({
			name: String(s.name || "").trim(),
			weight: Math.max(0, Number(s.weight) || 0)
		})).filter((s) => s.name);
		if (pool.length === 0 || count <= 0) return [];
		const targetCount = Math.max(0, count);
		const picked = [];
		const allowRepeatDraw = Boolean(cfg.allowRepeatDraw);
		if (pool.length === 0) return picked;
		if (allowRepeatDraw) {
			const weightedPool = pool.map((s) => ({
				name: s.name,
				weight: Math.pow(s.weight, WEIGHT_BOOST_GAMMA)
			}));
			const totalWeight = weightedPool.reduce((sum, s) => sum + s.weight, 0);
			for (let i = 0; i < targetCount; i++) {
				let pickIndex = -1;
				if (totalWeight > 0) {
					let roll = Math.random() * totalWeight;
					for (let j = 0; j < weightedPool.length; j++) {
						roll -= weightedPool[j].weight;
						if (roll <= 0) {
							pickIndex = j;
							break;
						}
					}
				}
				if (pickIndex < 0) pickIndex = Math.floor(Math.random() * weightedPool.length);
				picked.push({ name: weightedPool[pickIndex].name });
			}
			return picked;
		}
		const positivePool = pool.filter((s) => s.weight > 0);
		const zeroPool = pool.filter((s) => s.weight <= 0);
		if (positivePool.length > 0) {
			const keyed = positivePool.map((s) => ({
				name: s.name,
				key: -Math.log(Math.random()) / s.weight
			}));
			keyed.sort((a, b) => a.key - b.key);
			const limit = Math.min(targetCount, keyed.length);
			for (let i = 0; i < limit; i++) picked.push({ name: keyed[i].name });
		}
		if (picked.length < targetCount && zeroPool.length > 0) {
			const remaining = zeroPool.slice();
			for (let i = remaining.length - 1; i > 0; i--) {
				const j = Math.floor(Math.random() * (i + 1));
				[remaining[i], remaining[j]] = [remaining[j], remaining[i]];
			}
			const fillCount = Math.min(targetCount - picked.length, remaining.length);
			for (let i = 0; i < fillCount; i++) picked.push({ name: remaining[i].name });
		}
		return picked;
	}
	module.exports = {
		closePickCountWindow,
		closePickResultWindow,
		createFloatingButtonWindow,
		createPickCountWindow,
		createPickCountWindowInstance,
		createPickResultWindowInstance,
		fadeInFloatingButtonWindow,
		getCurrentPickResults,
		getFloatingButtonWindow,
		getPickCountWindow,
		getPickResultWindow,
		handleDragEnd,
		handleDragMove,
		handleDragStart,
		openPickResultWindow,
		persistFloatingButtonPosition,
		pickStudentsByWeight,
		refreshFloatingButtonWindow,
		sendPickCountStopBgm,
		setDebugMode,
		setIgnoreMouseEvents,
		setQuitting,
		startFloatingWindowWatchdog,
		stopFloatingWindowWatchdog
	};
}));
//#endregion
//#region src/main/ipc.js
var require_ipc = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { ipcMain: ipcMain$1 } = require("electron");
	var config = require_config();
	var windows = require_windows();
	function registerIpcHandlers() {
		ipcMain$1.handle("floating-button:get-config", () => {
			return config.refreshConfig().floatingButton;
		});
		ipcMain$1.on("floating-button:clicked", () => {
			windows.createPickCountWindow();
		});
		ipcMain$1.handle("pick-count:get-config", () => {
			return config.refreshConfig().pickCountDialog;
		});
		ipcMain$1.on("pick-count:cancel", () => {
			windows.closePickCountWindow();
			windows.sendPickCountStopBgm();
		});
		ipcMain$1.on("pick-count:confirm", (_event, payload) => {
			const selectedCount = Math.round(Number(payload && payload.count)) || 1;
			const count = Math.min(10, Math.max(1, selectedCount));
			const playMusic = Boolean(payload && payload.playMusic);
			console.log(`Pick count confirmed. count=${count}, playMusic=${playMusic}`);
			const pickedStudents = windows.pickStudentsByWeight(count);
			if (pickedStudents.length > 0) console.log(`Picked students: ${pickedStudents.map((s) => s.name).join(", ")}`);
			windows.closePickCountWindow({ keepFloatingHidden: true });
			windows.openPickResultWindow(pickedStudents);
		});
		ipcMain$1.handle("pick-result:get-results", () => {
			return windows.getCurrentPickResults();
		});
		ipcMain$1.handle("pick-result:get-config", () => {
			return config.refreshConfig().pickResultDialog;
		});
		ipcMain$1.on("pick-result:close", () => {
			windows.closePickResultWindow();
		});
		ipcMain$1.on("floating-button:drag-start", (event) => {
			windows.handleDragStart(event);
		});
		ipcMain$1.on("floating-button:drag-move", (event, payload) => {
			windows.handleDragMove(event, payload);
		});
		ipcMain$1.on("floating-button:drag-end", (event) => {
			windows.handleDragEnd(event);
		});
		ipcMain$1.on("floating-button:set-ignore-mouse", (event, ignore) => {
			windows.setIgnoreMouseEvents(event, ignore);
		});
	}
	module.exports = { registerIpcHandlers };
}));
//#endregion
//#region src/main/logging.js
var require_logging = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var LOG_BUFFER_LIMIT = 600;
	var logBuffer = [];
	var logClients = /* @__PURE__ */ new Set();
	function pushLog(level, text) {
		const time = (/* @__PURE__ */ new Date()).toISOString();
		const entry = {
			id: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
			level,
			text: String(text),
			time
		};
		logBuffer.push(entry);
		if (logBuffer.length > LOG_BUFFER_LIMIT) logBuffer.splice(0, logBuffer.length - LOG_BUFFER_LIMIT);
		const payload = `data: ${JSON.stringify(entry)}\n\n`;
		for (const res of logClients) res.write(payload);
	}
	function attachConsoleLogger() {
		[
			"log",
			"info",
			"warn",
			"error"
		].forEach((method) => {
			const original = console[method].bind(console);
			console[method] = (...args) => {
				const text = args.map((arg) => {
					if (typeof arg === "string") return arg;
					try {
						return JSON.stringify(arg);
					} catch (_error) {
						return String(arg);
					}
				}).join(" ");
				pushLog(method === "log" ? "info" : method, text);
				original(...args);
			};
		});
	}
	function registerRendererLogIpc(ipcMain) {
		ipcMain.on("renderer:log", (_event, payload) => {
			if (!payload || typeof payload.text !== "string") return;
			pushLog(typeof payload.level === "string" ? payload.level : "info", payload.text);
		});
	}
	function handleLogStream(req, res) {
		res.writeHead(200, {
			"Content-Type": "text/event-stream; charset=utf-8",
			"Cache-Control": "no-cache",
			"Connection": "keep-alive",
			"X-Accel-Buffering": "no"
		});
		res.write("\n");
		logClients.add(res);
		logBuffer.forEach((entry) => {
			res.write(`data: ${JSON.stringify(entry)}\n\n`);
		});
		req.on("close", () => {
			logClients.delete(res);
		});
	}
	module.exports = {
		attachConsoleLogger,
		handleLogStream,
		pushLog,
		registerRendererLogIpc
	};
}));
//#endregion
//#region src/main/tray-menu.js
var require_tray_menu = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { Menu } = require("electron");
	function buildTrayContextMenu({ onOpenConfig, onQuit }) {
		return Menu.buildFromTemplate([{
			label: "配置",
			click: () => {
				if (typeof onOpenConfig === "function") onOpenConfig();
			}
		}, {
			label: "退出",
			click: () => {
				if (typeof onQuit === "function") onQuit();
			}
		}]);
	}
	module.exports = { buildTrayContextMenu };
}));
//#endregion
//#region src/main/tray.js
var require_tray = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { Tray, nativeImage } = require("electron");
	var path = require("path");
	var { buildTrayContextMenu } = require_tray_menu();
	function createTray({ onOpenConfig, onQuit }) {
		const trayIconPath = !!process.env.VITE_DEV_SERVER_URL ? path.join(__dirname, "../public/image/tray.png") : path.join(__dirname, "../dist/image/tray.png");
		const tray = new Tray(nativeImage.createFromPath(trayIconPath));
		tray.setToolTip("Blue Random");
		const trayMenu = buildTrayContextMenu({
			onOpenConfig,
			onQuit
		});
		tray.setContextMenu(trayMenu);
		return tray;
	}
	module.exports = { createTray };
}));
//#endregion
//#region src/main/update.js
var require_update = /* @__PURE__ */ __commonJSMin(((exports, module) => {
	var { app: app$1, net } = require("electron");
	function parseVersionYaml(text) {
		const lines = String(text || "").split(/\r?\n/);
		const data = {};
		lines.forEach((line) => {
			const match = line.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*"?([^\"]*)"?\s*$/);
			if (match) data[match[1]] = match[2];
		});
		return data;
	}
	function normalizeVersion(value) {
		return String(value || "").trim().replace(/^v/i, "");
	}
	function compareVersion(a, b) {
		const pa = normalizeVersion(a).split(".").map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
		const pb = normalizeVersion(b).split(".").map((n) => parseInt(n, 10)).filter((n) => Number.isFinite(n));
		const len = Math.max(pa.length, pb.length);
		for (let i = 0; i < len; i += 1) {
			const av = pa[i] || 0;
			const bv = pb[i] || 0;
			if (av > bv) return 1;
			if (av < bv) return -1;
		}
		return 0;
	}
	function fetchUrl(url, options = {}) {
		return new Promise((resolve, reject) => {
			const request = net.request({
				method: "GET",
				url,
				headers: {
					"User-Agent": "Blue-Random",
					"Accept": "application/vnd.github+json",
					...options.headers || {}
				}
			});
			const chunks = [];
			request.on("response", (response) => {
				response.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
				response.on("end", () => {
					const body = Buffer.concat(chunks);
					resolve({
						statusCode: response.statusCode || 0,
						headers: response.headers || {},
						body
					});
				});
			});
			request.on("error", reject);
			request.end();
		});
	}
	async function checkUpdateFromMain() {
		const repoOwner = "Yun-Hydrogen";
		const repoName = "ba_random_electron";
		const debug = [];
		const localVersion = app$1.getVersion();
		const releaseApi = `https://api.github.com/repos/${repoOwner}/${repoName}/releases/latest`;
		debug.push(`GET ${releaseApi}`);
		const releaseResp = await fetchUrl(releaseApi);
		if (releaseResp.statusCode < 200 || releaseResp.statusCode >= 300) return {
			ok: false,
			status: "error",
			title: "检查更新失败",
			detail: `Release 请求失败 (${releaseResp.statusCode})`,
			localVersion,
			debug
		};
		const release = JSON.parse(releaseResp.body.toString("utf8"));
		const assets = Array.isArray(release.assets) ? release.assets : [];
		debug.push(`assets=${assets.length}`);
		const versionAsset = assets.find((asset) => asset.name === "version.yml") || assets.find((asset) => String(asset.name || "").toLowerCase().endsWith("version.yml"));
		if (!versionAsset || !versionAsset.browser_download_url) return {
			ok: false,
			status: "error",
			title: "未找到版本描述文件",
			detail: "发布中缺少 version.yml，请稍后再试。",
			releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
			localVersion,
			debug
		};
		debug.push(`GET ${versionAsset.browser_download_url}`);
		const versionResp = await fetchUrl(versionAsset.browser_download_url, { headers: { Accept: "text/plain" } });
		if (versionResp.statusCode < 200 || versionResp.statusCode >= 300) return {
			ok: false,
			status: "error",
			title: "检查更新失败",
			detail: `version.yml 下载失败 (${versionResp.statusCode})`,
			releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
			localVersion,
			debug
		};
		const remoteMeta = parseVersionYaml(versionResp.body.toString("utf8"));
		const remoteVersion = remoteMeta.version || "0.0.0";
		const remoteCommit = remoteMeta.commit || "";
		debug.push(`remoteVersion=${remoteVersion}`);
		let commitMessage = "";
		let commitUrl = "";
		if (remoteCommit) {
			commitUrl = `https://github.com/${repoOwner}/${repoName}/commit/${remoteCommit}`;
			const commitApi = `https://api.github.com/repos/${repoOwner}/${repoName}/commits/${remoteCommit}`;
			debug.push(`GET ${commitApi}`);
			const commitResp = await fetchUrl(commitApi);
			if (commitResp.statusCode >= 200 && commitResp.statusCode < 300) {
				const commitJson = JSON.parse(commitResp.body.toString("utf8"));
				if (commitJson && commitJson.commit && commitJson.commit.message) commitMessage = String(commitJson.commit.message).trim();
			}
		}
		const compare = compareVersion(localVersion, remoteVersion);
		if (compare < 0) return {
			ok: true,
			status: "update",
			title: `发现新版本：${remoteVersion}`,
			detail: commitMessage ? `更新内容：\n${commitMessage}` : "有新版本可用。",
			commitUrl,
			releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
			localVersion,
			remoteVersion,
			debug
		};
		if (compare === 0) return {
			ok: true,
			status: "ok",
			title: `已是最新版本：${localVersion}`,
			detail: commitMessage ? `当前提交：\n${commitMessage}` : "无需更新。",
			commitUrl,
			releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
			localVersion,
			remoteVersion,
			debug
		};
		return {
			ok: true,
			status: "easter",
			title: `这是为什么呢？${localVersion}`,
			detail: "看起来你正在使用来自未来的版本...",
			commitUrl,
			releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
			localVersion,
			remoteVersion,
			debug
		};
	}
	module.exports = { checkUpdateFromMain };
}));
//#endregion
//#region src/main/main.js
var { app, BrowserWindow, ipcMain } = require("electron");
var fs = require("fs");
var admin = require_admin();
var config = require_config();
var configServer = require_config_server();
var ipc = require_ipc();
var logging = require_logging();
var tray = require_tray();
var update = require_update();
var windows = require_windows();
var isDebugMode = !!process.env.VITE_DEV_SERVER_URL || process.argv.includes("-debug") || process.argv.includes("--debug");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
if (admin.IS_UIACCESS_PROCESS) app.commandLine.appendSwitch("disable-direct-composition");
admin.configureUserDataPath();
windows.setDebugMode(isDebugMode);
logging.attachConsoleLogger();
logging.registerRendererLogIpc(ipcMain);
process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
	console.error("Unhandled rejection:", reason);
});
ipc.registerIpcHandlers();
app.whenReady().then(() => {
	const startupConfig = config.refreshConfig();
	if (startupConfig.webConfig && startupConfig.webConfig.uiAccessEnabled && admin.IS_WINDOWS && !admin.IS_UIACCESS_PROCESS) {
		if (admin.isProcessElevated()) {
			const dllPath = admin.getDefaultUiAccessDllPath();
			if (fs.existsSync(dllPath)) {
				const result = admin.requestUiAccessRelaunch(dllPath);
				if (result.ok) {
					windows.setQuitting(true);
					app.exit(0);
					return;
				}
				console.error("UIAccess auto relaunch failed:", result.detail || result.message || "unknown error");
			} else console.error("UIAccess dll missing:", dllPath);
		}
	}
	if (startupConfig.webConfig && startupConfig.webConfig.adminTopmostEnabled && admin.IS_WINDOWS && !admin.isProcessElevated()) {
		if (admin.requestAdminRelaunch().ok) {
			windows.setQuitting(true);
			app.exit(0);
			return;
		}
	}
	configServer.startConfigServer({
		app,
		isDebugMode,
		config,
		update,
		logging,
		windows,
		admin
	});
	tray.createTray({
		onOpenConfig: () => config.openConfigPageInBrowser(),
		onQuit: () => app.quit()
	});
	update.checkUpdateFromMain().then((res) => {
		if (res.ok && res.status === "update") {
			const { Notification, shell } = require("electron");
			if (Notification.isSupported()) {
				const notification = new Notification({
					title: res.title || "发现新版本",
					body: "点击此处前往下载页面"
				});
				notification.on("click", () => {
					if (res.releaseUrl) shell.openExternal(res.releaseUrl);
				});
				notification.show();
			}
		}
	}).catch((err) => {
		console.error("Auto update check failed:", err);
	});
	windows.createFloatingButtonWindow();
	windows.createPickCountWindowInstance();
	windows.createPickResultWindowInstance();
	windows.startFloatingWindowWatchdog();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) windows.createFloatingButtonWindow();
	});
});
app.on("before-quit", () => {
	windows.setQuitting(true);
	windows.stopFloatingWindowWatchdog();
	windows.persistFloatingButtonPosition();
});
app.on("window-all-closed", () => {});
//#endregion
