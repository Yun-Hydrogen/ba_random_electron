<<<<<<< HEAD
//#region \0rolldown/runtime.js
var __commonJSMin = (cb, mod) => () => (mod || cb((mod = { exports: {} }).exports, mod), mod.exports);
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
//#region src/main/main.js
var { app, BrowserWindow, Tray, nativeImage, shell, dialog, ipcMain, net } = require("electron");
var http = require("http");
var { execFileSync } = require("child_process");
var fs = require("fs");
var path = require("path");
var yaml = require_js_yaml();
var { buildTrayContextMenu } = require_tray_menu();
var isDebugMode = !!process.env.VITE_DEV_SERVER_URL || process.argv.includes("-debug") || process.argv.includes("--debug");
app.commandLine.appendSwitch("autoplay-policy", "no-user-gesture-required");
var DEFAULT_CONFIG = {
	studentList: [],
	allowRepeatDraw: true,
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
		adminAutoStartTaskName: "Blue Random (Admin)"
	}
};
var IS_WINDOWS = process.platform === "win32";
var ADMIN_TASK_DEFAULT_NAME = "Blue Random (Admin)";
var USERDATA_DIR_NAME = "BlueRandom";
function configureUserDataPath() {
	if (!IS_WINDOWS) return;
	const appData = app.getPath("appData");
	const localRoot = path.resolve(appData, "..", "Local");
	const targetPath = path.join(localRoot, USERDATA_DIR_NAME);
	app.setPath("userData", targetPath);
}
configureUserDataPath();
var currentConfig = DEFAULT_CONFIG;
var dragSessions = /* @__PURE__ */ new Map();
var appTray = null;
var floatingButtonWindow = null;
var pickCountWindow = null;
var isPickCountWindowReady = false;
var isFloatingHiddenForPickCount = false;
var pickResultWindow = null;
var isPickResultWindowReady = false;
var currentPickResults = [];
var pickResultToken = 0;
var configServer = null;
var configServerPort = null;
var isQuitting = false;
var floatingWindowWatchdog = null;
var FLOATING_WINDOW_FADE_MS = 400;
var logBuffer = [];
var logClients = /* @__PURE__ */ new Set();
var LOG_BUFFER_LIMIT = 600;
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
process.on("uncaughtException", (error) => {
	console.error("Uncaught exception:", error);
});
process.on("unhandledRejection", (reason) => {
	console.error("Unhandled rejection:", reason);
});
ipcMain.on("renderer:log", (_event, payload) => {
	if (!payload || typeof payload.text !== "string") return;
	pushLog(typeof payload.level === "string" ? payload.level : "info", payload.text);
});
function clampNumber(value, min, max, fallback) {
	const num = Number(value);
	if (Number.isNaN(num)) return fallback;
	return Math.min(max, Math.max(min, num));
}
function quoteForPowerShell(text) {
	return String(text).replace(/'/g, "''");
}
function isProcessElevated() {
	if (!IS_WINDOWS) return false;
	try {
		const output = execFileSync("powershell", [
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
	const args = process.argv.slice(1).map((arg) => `"${arg.replace(/"/g, "\\\"")}"`).join(" ");
	const command = `Start-Process -FilePath '${quoteForPowerShell(exePath)}' -ArgumentList '${quoteForPowerShell(args)}' -Verb RunAs`;
	try {
		execFileSync("powershell", [
			"-NoProfile",
			"-Command",
			command
		], { stdio: "ignore" });
		return {
			ok: true,
			message: "已请求管理员权限，即将重新启动。"
		};
	} catch (error) {
		return {
			ok: false,
			message: "管理员权限请求失败或被取消。",
			detail: String(error)
		};
	}
}
function getDefaultExePath() {
	return app.getPath("exe");
}
function createAdminStartupTask({ taskName, exePath, runAsUser }) {
	if (!IS_WINDOWS) return {
		ok: false,
		message: "仅支持 Windows 计划任务。"
	};
	if (!exePath || !fs.existsSync(exePath)) return {
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
	const position = fb.position && typeof fb.position === "object" ? fb.position : {};
	const pick = source.pickCountDialog && typeof source.pickCountDialog === "object" ? source.pickCountDialog : {};
	const pickResult = source.pickResultDialog && typeof source.pickResultDialog === "object" ? source.pickResultDialog : {};
	const web = source.webConfig && typeof source.webConfig === "object" ? source.webConfig : {};
	const alwaysOnTop = typeof fb.alwaysOnTop === "boolean" ? fb.alwaysOnTop : DEFAULT_CONFIG.floatingButton.alwaysOnTop;
	return {
		studentList: students,
		allowRepeatDraw,
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
			adminAutoStartTaskName: typeof web.adminAutoStartTaskName === "string" && web.adminAutoStartTaskName.trim() ? web.adminAutoStartTaskName.trim() : DEFAULT_CONFIG.webConfig.adminAutoStartTaskName
		}
	};
}
function getConfigPath() {
	return path.join(app.getPath("userData"), "config.yml");
}
function getLegacyConfigPaths() {
	const legacyPaths = [];
	const exeDir = path.dirname(app.getPath("exe"));
	legacyPaths.push(path.join(exeDir, "config.yml"));
	if (!app.isPackaged) legacyPaths.push(path.join(process.cwd(), "config.yml"));
	if (IS_WINDOWS) {
		const appData = app.getPath("appData");
		const localRoot = path.resolve(appData, "..", "Local");
		legacyPaths.push(path.join(localRoot, "Blue Random", "config.yml"));
	}
	const currentPath = getConfigPath();
	return Array.from(new Set(legacyPaths.filter((p) => p && p !== currentPath)));
}
function getConfigDir() {
	return path.dirname(getConfigPath());
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
	fs.mkdirSync(configDir, { recursive: true });
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
		`  adminAutoStartTaskName: ${yamlSingleQuote(web.adminAutoStartTaskName || ADMIN_TASK_DEFAULT_NAME)}`,
		""
	].join("\n");
}
function saveConfig(config) {
	const configPath = getConfigPath();
	const yamlText = toConfigYamlWithComments(config);
	fs.mkdirSync(path.dirname(configPath), { recursive: true });
	fs.writeFileSync(configPath, yamlText, "utf8");
}
function writeDefaultConfigIfMissing(configPath) {
	if (fs.existsSync(configPath)) return;
	for (const legacyPath of getLegacyConfigPaths()) if (fs.existsSync(legacyPath)) {
		fs.mkdirSync(path.dirname(configPath), { recursive: true });
		fs.copyFileSync(legacyPath, configPath);
		return;
	}
	saveConfig(DEFAULT_CONFIG);
}
function loadConfig() {
	const configPath = getConfigPath();
	writeDefaultConfigIfMissing(configPath);
	try {
		const raw = fs.readFileSync(configPath, "utf8");
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
var WEIGHT_BOOST_GAMMA = 1.5;
function pickStudentsByWeight(count) {
	const config = refreshConfig();
	const pool = (Array.isArray(config.studentList) ? config.studentList : []).map((s) => ({
		name: String(s.name || "").trim(),
		weight: Math.max(0, Number(s.weight) || 0)
	})).filter((s) => s.name);
	if (pool.length === 0 || count <= 0) return [];
	const targetCount = Math.max(0, count);
	const picked = [];
	const allowRepeatDraw = Boolean(config.allowRepeatDraw);
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
	const localVersion = app.getVersion();
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
		detail: "为什么你的版本比最新发布的版本还要新呢？",
		commitUrl,
		releaseUrl: release.html_url || `https://github.com/${repoOwner}/${repoName}/releases/latest`,
		localVersion,
		remoteVersion,
		debug
	};
}
function openConfigPageInBrowser() {
	const url = `http://localhost:${refreshConfig().webConfig.port}/#/config`;
	shell.openExternal(url);
}
function createConfigServerRequestHandler() {
	return async (req, res) => {
		const requestUrl = req.url || "/";
		path.join(__dirname, "../renderer", "web-config");
		if (req.method === "GET" && requestUrl === "/api/config") return sendJson(res, 200, refreshConfig());
		if (req.method === "GET" && requestUrl === "/api/app-info") return sendJson(res, 200, {
			version: app.getVersion(),
			isDebugMode,
			isAdmin: isProcessElevated(),
			exePath: getDefaultExePath(),
			configPath: getConfigPath(),
			configDir: getConfigDir()
		});
		if (req.method === "POST" && requestUrl === "/api/config/open-file") try {
			const result = await openConfigFile();
			if (!result.ok) return sendJson(res, 400, result);
			return sendJson(res, 200, result);
		} catch (error) {
			return sendJson(res, 500, {
				ok: false,
				message: String(error)
			});
		}
		if (req.method === "POST" && requestUrl === "/api/config/open-dir") try {
			const result = await openConfigDir();
			if (!result.ok) return sendJson(res, 400, result);
			return sendJson(res, 200, result);
		} catch (error) {
			return sendJson(res, 500, {
				ok: false,
				message: String(error)
			});
		}
		if (req.method === "GET" && requestUrl === "/api/check-update") try {
			return sendJson(res, 200, await checkUpdateFromMain());
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
			return;
		}
		if (req.method === "POST" && requestUrl === "/api/config") try {
			const normalized = normalizeConfig(await parseRequestJsonBody(req));
			currentConfig = normalized;
			saveConfig(normalized);
			startConfigServer();
			if (floatingButtonWindow && !floatingButtonWindow.isDestroyed()) floatingButtonWindow.close();
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
				isQuitting = true;
				app.relaunch();
				app.exit(0);
			}, 80);
			return;
		}
		if (req.method === "POST" && requestUrl === "/api/admin/elevate") {
			if (!IS_WINDOWS) return sendJson(res, 400, {
				ok: false,
				message: "当前系统不支持管理员提升。"
			});
			if (isProcessElevated()) return sendJson(res, 200, {
				ok: true,
				message: "已在管理员权限下运行。"
			});
			const result = requestAdminRelaunch();
			if (!result.ok) return sendJson(res, 400, result);
			sendJson(res, 200, result);
			setTimeout(() => {
				isQuitting = true;
				app.exit(0);
			}, 150);
			return;
		}
		if (req.method === "POST" && requestUrl === "/api/task/create-admin-startup") try {
			const payload = await parseRequestJsonBody(req);
			const exePath = payload && typeof payload.exePath === "string" ? payload.exePath.trim() : "";
			const taskName = payload && typeof payload.taskName === "string" ? payload.taskName.trim() : ADMIN_TASK_DEFAULT_NAME;
			const result = createAdminStartupTask({
				taskName,
				exePath
			});
			if (!result.ok) return sendJson(res, 400, result);
			const baseConfig = refreshConfig();
			currentConfig = normalizeConfig({
				...baseConfig,
				webConfig: {
					...baseConfig.webConfig,
					adminAutoStartEnabled: true,
					adminAutoStartPath: exePath,
					adminAutoStartTaskName: taskName
				}
			});
			saveConfig(currentConfig);
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
			const distDir = path.join(__dirname, "../dist");
			const targetPath = path.join(distDir, urlPath === "/" ? "index.html" : urlPath);
			if (!targetPath.startsWith(distDir)) return sendJson(res, 403, {
				ok: false,
				message: "Forbidden"
			});
			if (fs.existsSync(targetPath) && fs.statSync(targetPath).isFile()) {
				const fileContent = fs.readFileSync(targetPath);
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
function startConfigServer() {
	const desiredPort = refreshConfig().webConfig.port;
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
	});
	server.on("error", (error) => {
		console.error("Failed to start config web server:", error);
	});
	configServer = server;
}
function persistFloatingButtonPosition() {
	if (!floatingButtonWindow || floatingButtonWindow.isDestroyed()) return;
	const baseConfig = refreshConfig();
	const bounds = floatingButtonWindow.getBounds();
	currentConfig = normalizeConfig({
		...baseConfig,
		floatingButton: {
			...baseConfig.floatingButton,
			position: {
				x: bounds.x,
				y: bounds.y
			}
		}
	});
	saveConfig(currentConfig);
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
	currentConfig = refreshConfig();
	const config = currentConfig;
	const sizePx = Math.round(50 * (config.floatingButton.sizePercent / 100));
	const winWidth = Math.max(72, sizePx + 20);
	const winHeight = Math.max(72, sizePx + 20);
	const hasSavedX = Number.isFinite(Number(config.floatingButton.position.x));
	const hasSavedY = Number.isFinite(Number(config.floatingButton.position.y));
	const windowOptions = {
		width: winWidth,
		height: winHeight,
		frame: false,
		resizable: false,
		minimizable: false,
		maximizable: false,
		hasShadow: false,
		transparent: true,
		alwaysOnTop: config.floatingButton.alwaysOnTop,
		skipTaskbar: !isDebugMode,
		type: isDebugMode ? void 0 : "toolbar",
		focusable: isDebugMode ? true : process.platform !== "win32",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			autoplayPolicy: "no-user-gesture-required"
		}
	};
	if (hasSavedX && hasSavedY) {
		windowOptions.x = Math.round(Number(config.floatingButton.position.x));
		windowOptions.y = Math.round(Number(config.floatingButton.position.y));
	}
	const win = new BrowserWindow(windowOptions);
	floatingButtonWindow = win;
	win.setIgnoreMouseEvents(true, { forward: true });
	if (config.floatingButton.alwaysOnTop) win.setAlwaysOnTop(true, "screen-saver");
	if (config.webConfig && config.webConfig.adminTopmostEnabled && typeof win.setVisibleOnAllWorkspaces === "function") win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
	win.setMenuBarVisibility(false);
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(process.env.VITE_DEV_SERVER_URL);
	else {
		if (isDebugMode) win.webContents.openDevTools({ mode: "detach" });
		win.loadFile(path.join(__dirname, "../dist/index.html"));
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
	const win = new BrowserWindow({
		show: false,
		frame: false,
		transparent: true,
		fullscreen: true,
		resizable: false,
		minimizable: false,
		maximizable: false,
		movable: false,
		alwaysOnTop: true,
		skipTaskbar: !isDebugMode,
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			autoplayPolicy: "no-user-gesture-required"
		}
	});
	pickCountWindow = win;
	isPickCountWindowReady = false;
	win.setMenuBarVisibility(false);
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-count`);
	else win.loadURL(`file://${path.join(__dirname, "../dist/index.html")}#/pick-count`);
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
		isFloatingHiddenForPickCount = false;
		fadeInFloatingButtonWindow();
		if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
		return;
	}
	pickResultToken += 1;
	pickResultWindow.webContents.send("pick-result:reset", {
		token: pickResultToken,
		reason: "close"
	});
	pickResultWindow.setOpacity(0);
	if (!pickResultWindow.isVisible()) pickResultWindow.show();
	setTimeout(() => {
		if (!pickResultWindow || pickResultWindow.isDestroyed()) return;
		pickResultWindow.hide();
		pickResultWindow.setOpacity(1);
	}, 60);
	currentPickResults = [];
	isFloatingHiddenForPickCount = false;
	fadeInFloatingButtonWindow();
	if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
}
function createPickResultWindowInstance() {
	if (pickResultWindow && !pickResultWindow.isDestroyed()) return;
	const win = new BrowserWindow({
		show: false,
		frame: false,
		transparent: true,
		fullscreen: true,
		resizable: false,
		minimizable: false,
		maximizable: false,
		movable: false,
		alwaysOnTop: true,
		skipTaskbar: !isDebugMode,
		backgroundColor: "#00000000",
		webPreferences: {
			preload: path.join(__dirname, "preload.js"),
			contextIsolation: true,
			nodeIntegration: false,
			autoplayPolicy: "no-user-gesture-required"
		}
	});
	pickResultWindow = win;
	isPickResultWindowReady = false;
	win.setMenuBarVisibility(false);
	if (process.env.VITE_DEV_SERVER_URL) win.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-result`);
	else win.loadURL(`file://${path.join(__dirname, "../dist/index.html")}#/pick-result`);
	if (isDebugMode) win.webContents.openDevTools({ mode: "detach" });
	win.once("ready-to-show", () => {
		isPickResultWindowReady = true;
	});
	win.on("closed", () => {
		pickResultWindow = null;
		isPickResultWindowReady = false;
		currentPickResults = [];
		if (!isQuitting) {
			isFloatingHiddenForPickCount = false;
			fadeInFloatingButtonWindow();
		}
	});
}
function openPickResultWindow(results) {
	currentPickResults = Array.isArray(results) ? results : [];
	createPickResultWindowInstance();
	if (!pickResultWindow || pickResultWindow.isDestroyed()) return;
	const openResultWindow = () => {
		if (!pickResultWindow || pickResultWindow.isDestroyed()) return;
		pickResultToken += 1;
		pickResultWindow.webContents.send("pick-result:reset", {
			token: pickResultToken,
			reason: "before-open"
		});
		pickResultWindow.webContents.send("pick-result:open", {
			token: pickResultToken,
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
function createTray() {
	const trayIconPath = !!process.env.VITE_DEV_SERVER_URL ? path.join(__dirname, "../public/image/tray.png") : path.join(__dirname, "../dist/image/tray.png");
	appTray = new Tray(nativeImage.createFromPath(trayIconPath));
	appTray.setToolTip("Blue Random Electron");
	const trayMenu = buildTrayContextMenu({
		onOpenConfig: () => {
			openConfigPageInBrowser();
		},
		onQuit: () => {
			app.quit();
		}
	});
	appTray.setContextMenu(trayMenu);
}
ipcMain.handle("floating-button:get-config", () => {
	return refreshConfig().floatingButton;
});
ipcMain.on("floating-button:clicked", () => {
	createPickCountWindow();
});
ipcMain.handle("pick-count:get-config", () => {
	return refreshConfig().pickCountDialog;
});
ipcMain.on("pick-count:cancel", () => {
	closePickCountWindow();
	if (pickCountWindow && !pickCountWindow.isDestroyed()) pickCountWindow.webContents.send("pick-count:stop-bgm");
});
ipcMain.on("pick-count:confirm", (event, payload) => {
	const selectedCount = Math.round(clampNumber(payload && payload.count, 1, 10, 1));
	const playMusic = Boolean(payload && payload.playMusic);
	console.log(`Pick count confirmed. count=${selectedCount}, playMusic=${playMusic}`);
	const pickedStudents = pickStudentsByWeight(selectedCount);
	if (pickedStudents.length > 0) console.log(`Picked students: ${pickedStudents.map((s) => s.name).join(", ")}`);
	closePickCountWindow({ keepFloatingHidden: true });
	openPickResultWindow(pickedStudents);
});
ipcMain.handle("pick-result:get-results", () => {
	return currentPickResults;
});
ipcMain.handle("pick-result:get-config", () => {
	return refreshConfig().pickResultDialog;
});
ipcMain.on("pick-result:close", () => {
	closePickResultWindow();
});
ipcMain.on("floating-button:drag-start", (event, payload) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (!win) return;
	const bounds = win.getBounds();
	dragSessions.set(event.sender.id, {
		startWinX: bounds.x,
		startWinY: bounds.y,
		width: bounds.width,
		height: bounds.height
	});
});
ipcMain.on("floating-button:drag-move", (event, payload) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	const session = dragSessions.get(event.sender.id);
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
});
ipcMain.on("floating-button:drag-end", (event) => {
	dragSessions.delete(event.sender.id);
});
ipcMain.on("floating-button:set-ignore-mouse", (event, ignore) => {
	const win = BrowserWindow.fromWebContents(event.sender);
	if (win && !win.isDestroyed()) win.setIgnoreMouseEvents(ignore, { forward: true });
});
app.whenReady().then(() => {
	const startupConfig = refreshConfig();
	if (startupConfig.webConfig && startupConfig.webConfig.adminTopmostEnabled && IS_WINDOWS && !isProcessElevated()) {
		if (requestAdminRelaunch().ok) {
			isQuitting = true;
			app.exit(0);
			return;
		}
	}
	startConfigServer();
	createTray();
	createFloatingButtonWindow();
	createPickCountWindowInstance();
	createPickResultWindowInstance();
	startFloatingWindowWatchdog();
	app.on("activate", () => {
		if (BrowserWindow.getAllWindows().length === 0) createFloatingButtonWindow();
	});
});
app.on("before-quit", () => {
	if (isQuitting) return;
	isQuitting = true;
	if (floatingWindowWatchdog) {
		clearInterval(floatingWindowWatchdog);
		floatingWindowWatchdog = null;
	}
	persistFloatingButtonPosition();
});
app.on("window-all-closed", () => {});
//#endregion
=======
var e=(e,t)=>()=>(t||e((t={exports:{}}).exports,t),t.exports),t=e(((e,t)=>{function n(e){return e==null}function r(e){return typeof e==`object`&&!!e}function i(e){return Array.isArray(e)?e:n(e)?[]:[e]}function a(e,t){var n,r,i,a;if(t)for(a=Object.keys(t),n=0,r=a.length;n<r;n+=1)i=a[n],e[i]=t[i];return e}function o(e,t){var n=``,r;for(r=0;r<t;r+=1)n+=e;return n}function s(e){return e===0&&1/e==-1/0}t.exports.isNothing=n,t.exports.isObject=r,t.exports.toArray=i,t.exports.repeat=o,t.exports.isNegativeZero=s,t.exports.extend=a})),n=e(((e,t)=>{function n(e,t){var n=``,r=e.reason||`(unknown reason)`;return e.mark?(e.mark.name&&(n+=`in "`+e.mark.name+`" `),n+=`(`+(e.mark.line+1)+`:`+(e.mark.column+1)+`)`,!t&&e.mark.snippet&&(n+=`

`+e.mark.snippet),r+` `+n):r}function r(e,t){Error.call(this),this.name=`YAMLException`,this.reason=e,this.mark=t,this.message=n(this,!1),Error.captureStackTrace?Error.captureStackTrace(this,this.constructor):this.stack=Error().stack||``}r.prototype=Object.create(Error.prototype),r.prototype.constructor=r,r.prototype.toString=function(e){return this.name+`: `+n(this,e)},t.exports=r})),r=e(((e,n)=>{var r=t();function i(e,t,n,r,i){var a=``,o=``,s=Math.floor(i/2)-1;return r-t>s&&(a=` ... `,t=r-s+a.length),n-r>s&&(o=` ...`,n=r+s-o.length),{str:a+e.slice(t,n).replace(/\t/g,`→`)+o,pos:r-t+a.length}}function a(e,t){return r.repeat(` `,t-e.length)+e}function o(e,t){if(t=Object.create(t||null),!e.buffer)return null;t.maxLength||=79,typeof t.indent!=`number`&&(t.indent=1),typeof t.linesBefore!=`number`&&(t.linesBefore=3),typeof t.linesAfter!=`number`&&(t.linesAfter=2);for(var n=/\r?\n|\r|\0/g,o=[0],s=[],c,l=-1;c=n.exec(e.buffer);)s.push(c.index),o.push(c.index+c[0].length),e.position<=c.index&&l<0&&(l=o.length-2);l<0&&(l=o.length-1);var u=``,d,f,p=Math.min(e.line+t.linesAfter,s.length).toString().length,m=t.maxLength-(t.indent+p+3);for(d=1;d<=t.linesBefore&&!(l-d<0);d++)f=i(e.buffer,o[l-d],s[l-d],e.position-(o[l]-o[l-d]),m),u=r.repeat(` `,t.indent)+a((e.line-d+1).toString(),p)+` | `+f.str+`
`+u;for(f=i(e.buffer,o[l],s[l],e.position,m),u+=r.repeat(` `,t.indent)+a((e.line+1).toString(),p)+` | `+f.str+`
`,u+=r.repeat(`-`,t.indent+p+3+f.pos)+`^
`,d=1;d<=t.linesAfter&&!(l+d>=s.length);d++)f=i(e.buffer,o[l+d],s[l+d],e.position-(o[l]-o[l+d]),m),u+=r.repeat(` `,t.indent)+a((e.line+d+1).toString(),p)+` | `+f.str+`
`;return u.replace(/\n$/,``)}n.exports=o})),i=e(((e,t)=>{var r=n(),i=[`kind`,`multi`,`resolve`,`construct`,`instanceOf`,`predicate`,`represent`,`representName`,`defaultStyle`,`styleAliases`],a=[`scalar`,`sequence`,`mapping`];function o(e){var t={};return e!==null&&Object.keys(e).forEach(function(n){e[n].forEach(function(e){t[String(e)]=n})}),t}function s(e,t){if(t||={},Object.keys(t).forEach(function(t){if(i.indexOf(t)===-1)throw new r(`Unknown option "`+t+`" is met in definition of "`+e+`" YAML type.`)}),this.options=t,this.tag=e,this.kind=t.kind||null,this.resolve=t.resolve||function(){return!0},this.construct=t.construct||function(e){return e},this.instanceOf=t.instanceOf||null,this.predicate=t.predicate||null,this.represent=t.represent||null,this.representName=t.representName||null,this.defaultStyle=t.defaultStyle||null,this.multi=t.multi||!1,this.styleAliases=o(t.styleAliases||null),a.indexOf(this.kind)===-1)throw new r(`Unknown kind "`+this.kind+`" is specified for "`+e+`" YAML type.`)}t.exports=s})),a=e(((e,t)=>{var r=n(),a=i();function o(e,t){var n=[];return e[t].forEach(function(e){var t=n.length;n.forEach(function(n,r){n.tag===e.tag&&n.kind===e.kind&&n.multi===e.multi&&(t=r)}),n[t]=e}),n}function s(){var e={scalar:{},sequence:{},mapping:{},fallback:{},multi:{scalar:[],sequence:[],mapping:[],fallback:[]}},t,n;function r(t){t.multi?(e.multi[t.kind].push(t),e.multi.fallback.push(t)):e[t.kind][t.tag]=e.fallback[t.tag]=t}for(t=0,n=arguments.length;t<n;t+=1)arguments[t].forEach(r);return e}function c(e){return this.extend(e)}c.prototype.extend=function(e){var t=[],n=[];if(e instanceof a)n.push(e);else if(Array.isArray(e))n=n.concat(e);else if(e&&(Array.isArray(e.implicit)||Array.isArray(e.explicit)))e.implicit&&(t=t.concat(e.implicit)),e.explicit&&(n=n.concat(e.explicit));else throw new r(`Schema.extend argument should be a Type, [ Type ], or a schema definition ({ implicit: [...], explicit: [...] })`);t.forEach(function(e){if(!(e instanceof a))throw new r(`Specified list of YAML types (or a single Type object) contains a non-Type object.`);if(e.loadKind&&e.loadKind!==`scalar`)throw new r(`There is a non-scalar type in the implicit list of a schema. Implicit resolving of such types is not supported.`);if(e.multi)throw new r(`There is a multi type in the implicit list of a schema. Multi tags can only be listed as explicit.`)}),n.forEach(function(e){if(!(e instanceof a))throw new r(`Specified list of YAML types (or a single Type object) contains a non-Type object.`)});var i=Object.create(c.prototype);return i.implicit=(this.implicit||[]).concat(t),i.explicit=(this.explicit||[]).concat(n),i.compiledImplicit=o(i,`implicit`),i.compiledExplicit=o(i,`explicit`),i.compiledTypeMap=s(i.compiledImplicit,i.compiledExplicit),i},t.exports=c})),o=e(((e,t)=>{t.exports=new(i())(`tag:yaml.org,2002:str`,{kind:`scalar`,construct:function(e){return e===null?``:e}})})),s=e(((e,t)=>{t.exports=new(i())(`tag:yaml.org,2002:seq`,{kind:`sequence`,construct:function(e){return e===null?[]:e}})})),c=e(((e,t)=>{t.exports=new(i())(`tag:yaml.org,2002:map`,{kind:`mapping`,construct:function(e){return e===null?{}:e}})})),l=e(((e,t)=>{t.exports=new(a())({explicit:[o(),s(),c()]})})),u=e(((e,t)=>{var n=i();function r(e){if(e===null)return!0;var t=e.length;return t===1&&e===`~`||t===4&&(e===`null`||e===`Null`||e===`NULL`)}function a(){return null}function o(e){return e===null}t.exports=new n(`tag:yaml.org,2002:null`,{kind:`scalar`,resolve:r,construct:a,predicate:o,represent:{canonical:function(){return`~`},lowercase:function(){return`null`},uppercase:function(){return`NULL`},camelcase:function(){return`Null`},empty:function(){return``}},defaultStyle:`lowercase`})})),d=e(((e,t)=>{var n=i();function r(e){if(e===null)return!1;var t=e.length;return t===4&&(e===`true`||e===`True`||e===`TRUE`)||t===5&&(e===`false`||e===`False`||e===`FALSE`)}function a(e){return e===`true`||e===`True`||e===`TRUE`}function o(e){return Object.prototype.toString.call(e)===`[object Boolean]`}t.exports=new n(`tag:yaml.org,2002:bool`,{kind:`scalar`,resolve:r,construct:a,predicate:o,represent:{lowercase:function(e){return e?`true`:`false`},uppercase:function(e){return e?`TRUE`:`FALSE`},camelcase:function(e){return e?`True`:`False`}},defaultStyle:`lowercase`})})),f=e(((e,n)=>{var r=t(),a=i();function o(e){return 48<=e&&e<=57||65<=e&&e<=70||97<=e&&e<=102}function s(e){return 48<=e&&e<=55}function c(e){return 48<=e&&e<=57}function l(e){if(e===null)return!1;var t=e.length,n=0,r=!1,i;if(!t)return!1;if(i=e[n],(i===`-`||i===`+`)&&(i=e[++n]),i===`0`){if(n+1===t)return!0;if(i=e[++n],i===`b`){for(n++;n<t;n++)if(i=e[n],i!==`_`){if(i!==`0`&&i!==`1`)return!1;r=!0}return r&&i!==`_`}if(i===`x`){for(n++;n<t;n++)if(i=e[n],i!==`_`){if(!o(e.charCodeAt(n)))return!1;r=!0}return r&&i!==`_`}if(i===`o`){for(n++;n<t;n++)if(i=e[n],i!==`_`){if(!s(e.charCodeAt(n)))return!1;r=!0}return r&&i!==`_`}}if(i===`_`)return!1;for(;n<t;n++)if(i=e[n],i!==`_`){if(!c(e.charCodeAt(n)))return!1;r=!0}return!(!r||i===`_`)}function u(e){var t=e,n=1,r;if(t.indexOf(`_`)!==-1&&(t=t.replace(/_/g,``)),r=t[0],(r===`-`||r===`+`)&&(r===`-`&&(n=-1),t=t.slice(1),r=t[0]),t===`0`)return 0;if(r===`0`){if(t[1]===`b`)return n*parseInt(t.slice(2),2);if(t[1]===`x`)return n*parseInt(t.slice(2),16);if(t[1]===`o`)return n*parseInt(t.slice(2),8)}return n*parseInt(t,10)}function d(e){return Object.prototype.toString.call(e)===`[object Number]`&&e%1==0&&!r.isNegativeZero(e)}n.exports=new a(`tag:yaml.org,2002:int`,{kind:`scalar`,resolve:l,construct:u,predicate:d,represent:{binary:function(e){return e>=0?`0b`+e.toString(2):`-0b`+e.toString(2).slice(1)},octal:function(e){return e>=0?`0o`+e.toString(8):`-0o`+e.toString(8).slice(1)},decimal:function(e){return e.toString(10)},hexadecimal:function(e){return e>=0?`0x`+e.toString(16).toUpperCase():`-0x`+e.toString(16).toUpperCase().slice(1)}},defaultStyle:`decimal`,styleAliases:{binary:[2,`bin`],octal:[8,`oct`],decimal:[10,`dec`],hexadecimal:[16,`hex`]}})})),p=e(((e,n)=>{var r=t(),a=i(),o=RegExp(`^(?:[-+]?(?:[0-9][0-9_]*)(?:\\.[0-9_]*)?(?:[eE][-+]?[0-9]+)?|\\.[0-9_]+(?:[eE][-+]?[0-9]+)?|[-+]?\\.(?:inf|Inf|INF)|\\.(?:nan|NaN|NAN))$`);function s(e){return!(e===null||!o.test(e)||e[e.length-1]===`_`)}function c(e){var t=e.replace(/_/g,``).toLowerCase(),n=t[0]===`-`?-1:1;return`+-`.indexOf(t[0])>=0&&(t=t.slice(1)),t===`.inf`?n===1?1/0:-1/0:t===`.nan`?NaN:n*parseFloat(t,10)}var l=/^[-+]?[0-9]+e/;function u(e,t){var n;if(isNaN(e))switch(t){case`lowercase`:return`.nan`;case`uppercase`:return`.NAN`;case`camelcase`:return`.NaN`}else if(e===1/0)switch(t){case`lowercase`:return`.inf`;case`uppercase`:return`.INF`;case`camelcase`:return`.Inf`}else if(e===-1/0)switch(t){case`lowercase`:return`-.inf`;case`uppercase`:return`-.INF`;case`camelcase`:return`-.Inf`}else if(r.isNegativeZero(e))return`-0.0`;return n=e.toString(10),l.test(n)?n.replace(`e`,`.e`):n}function d(e){return Object.prototype.toString.call(e)===`[object Number]`&&(e%1!=0||r.isNegativeZero(e))}n.exports=new a(`tag:yaml.org,2002:float`,{kind:`scalar`,resolve:s,construct:c,predicate:d,represent:u,defaultStyle:`lowercase`})})),m=e(((e,t)=>{t.exports=l().extend({implicit:[u(),d(),f(),p()]})})),h=e(((e,t)=>{t.exports=m()})),g=e(((e,t)=>{var n=i(),r=RegExp(`^([0-9][0-9][0-9][0-9])-([0-9][0-9])-([0-9][0-9])$`),a=RegExp(`^([0-9][0-9][0-9][0-9])-([0-9][0-9]?)-([0-9][0-9]?)(?:[Tt]|[ \\t]+)([0-9][0-9]?):([0-9][0-9]):([0-9][0-9])(?:\\.([0-9]*))?(?:[ \\t]*(Z|([-+])([0-9][0-9]?)(?::([0-9][0-9]))?))?$`);function o(e){return e===null?!1:r.exec(e)!==null||a.exec(e)!==null}function s(e){var t,n,i,o,s,c,l,u=0,d=null,f,p,m;if(t=r.exec(e),t===null&&(t=a.exec(e)),t===null)throw Error(`Date resolve error`);if(n=+t[1],i=t[2]-1,o=+t[3],!t[4])return new Date(Date.UTC(n,i,o));if(s=+t[4],c=+t[5],l=+t[6],t[7]){for(u=t[7].slice(0,3);u.length<3;)u+=`0`;u=+u}return t[9]&&(f=+t[10],p=+(t[11]||0),d=(f*60+p)*6e4,t[9]===`-`&&(d=-d)),m=new Date(Date.UTC(n,i,o,s,c,l,u)),d&&m.setTime(m.getTime()-d),m}function c(e){return e.toISOString()}t.exports=new n(`tag:yaml.org,2002:timestamp`,{kind:`scalar`,resolve:o,construct:s,instanceOf:Date,represent:c})})),_=e(((e,t)=>{var n=i();function r(e){return e===`<<`||e===null}t.exports=new n(`tag:yaml.org,2002:merge`,{kind:`scalar`,resolve:r})})),v=e(((e,t)=>{var n=i(),r=`ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=
\r`;function a(e){if(e===null)return!1;var t,n,i=0,a=e.length,o=r;for(n=0;n<a;n++)if(t=o.indexOf(e.charAt(n)),!(t>64)){if(t<0)return!1;i+=6}return i%8==0}function o(e){var t,n,i=e.replace(/[\r\n=]/g,``),a=i.length,o=r,s=0,c=[];for(t=0;t<a;t++)t%4==0&&t&&(c.push(s>>16&255),c.push(s>>8&255),c.push(s&255)),s=s<<6|o.indexOf(i.charAt(t));return n=a%4*6,n===0?(c.push(s>>16&255),c.push(s>>8&255),c.push(s&255)):n===18?(c.push(s>>10&255),c.push(s>>2&255)):n===12&&c.push(s>>4&255),new Uint8Array(c)}function s(e){var t=``,n=0,i,a,o=e.length,s=r;for(i=0;i<o;i++)i%3==0&&i&&(t+=s[n>>18&63],t+=s[n>>12&63],t+=s[n>>6&63],t+=s[n&63]),n=(n<<8)+e[i];return a=o%3,a===0?(t+=s[n>>18&63],t+=s[n>>12&63],t+=s[n>>6&63],t+=s[n&63]):a===2?(t+=s[n>>10&63],t+=s[n>>4&63],t+=s[n<<2&63],t+=s[64]):a===1&&(t+=s[n>>2&63],t+=s[n<<4&63],t+=s[64],t+=s[64]),t}function c(e){return Object.prototype.toString.call(e)===`[object Uint8Array]`}t.exports=new n(`tag:yaml.org,2002:binary`,{kind:`scalar`,resolve:a,construct:o,predicate:c,represent:s})})),y=e(((e,t)=>{var n=i(),r=Object.prototype.hasOwnProperty,a=Object.prototype.toString;function o(e){if(e===null)return!0;var t=[],n,i,o,s,c,l=e;for(n=0,i=l.length;n<i;n+=1){if(o=l[n],c=!1,a.call(o)!==`[object Object]`)return!1;for(s in o)if(r.call(o,s))if(!c)c=!0;else return!1;if(!c)return!1;if(t.indexOf(s)===-1)t.push(s);else return!1}return!0}function s(e){return e===null?[]:e}t.exports=new n(`tag:yaml.org,2002:omap`,{kind:`sequence`,resolve:o,construct:s})})),b=e(((e,t)=>{var n=i(),r=Object.prototype.toString;function a(e){if(e===null)return!0;var t,n,i,a,o,s=e;for(o=Array(s.length),t=0,n=s.length;t<n;t+=1){if(i=s[t],r.call(i)!==`[object Object]`||(a=Object.keys(i),a.length!==1))return!1;o[t]=[a[0],i[a[0]]]}return!0}function o(e){if(e===null)return[];var t,n,r,i,a,o=e;for(a=Array(o.length),t=0,n=o.length;t<n;t+=1)r=o[t],i=Object.keys(r),a[t]=[i[0],r[i[0]]];return a}t.exports=new n(`tag:yaml.org,2002:pairs`,{kind:`sequence`,resolve:a,construct:o})})),x=e(((e,t)=>{var n=i(),r=Object.prototype.hasOwnProperty;function a(e){if(e===null)return!0;var t,n=e;for(t in n)if(r.call(n,t)&&n[t]!==null)return!1;return!0}function o(e){return e===null?{}:e}t.exports=new n(`tag:yaml.org,2002:set`,{kind:`mapping`,resolve:a,construct:o})})),ee=e(((e,t)=>{t.exports=h().extend({implicit:[g(),_()],explicit:[v(),y(),b(),x()]})})),te=e(((e,i)=>{var a=t(),o=n(),s=r(),c=ee(),l=Object.prototype.hasOwnProperty,u=1,d=2,f=3,p=4,m=1,h=2,g=3,_=/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F-\x84\x86-\x9F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]/,v=/[\x85\u2028\u2029]/,y=/[,\[\]\{\}]/,b=/^(?:!|!!|![a-z\-]+!)$/i,x=/^(?:!|[^,\[\]\{\}])(?:%[0-9a-f]{2}|[0-9a-z\-#;\/\?:@&=\+\$,_\.!~\*'\(\)\[\]])*$/i;function te(e){return Object.prototype.toString.call(e)}function S(e){return e===10||e===13}function C(e){return e===9||e===32}function w(e){return e===9||e===32||e===10||e===13}function T(e){return e===44||e===91||e===93||e===123||e===125}function E(e){var t;return 48<=e&&e<=57?e-48:(t=e|32,97<=t&&t<=102?t-97+10:-1)}function ne(e){return e===120?2:e===117?4:e===85?8:0}function re(e){return 48<=e&&e<=57?e-48:-1}function ie(e){return e===48?`\0`:e===97?`\x07`:e===98?`\b`:e===116||e===9?`	`:e===110?`
`:e===118?`\v`:e===102?`\f`:e===114?`\r`:e===101?`\x1B`:e===32?` `:e===34?`"`:e===47?`/`:e===92?`\\`:e===78?``:e===95?`\xA0`:e===76?`\u2028`:e===80?`\u2029`:``}function ae(e){return e<=65535?String.fromCharCode(e):String.fromCharCode((e-65536>>10)+55296,(e-65536&1023)+56320)}function D(e,t,n){t===`__proto__`?Object.defineProperty(e,t,{configurable:!0,enumerable:!0,writable:!0,value:n}):e[t]=n}for(var oe=Array(256),O=Array(256),k=0;k<256;k++)oe[k]=+!!ie(k),O[k]=ie(k);function A(e,t){this.input=e,this.filename=t.filename||null,this.schema=t.schema||c,this.onWarning=t.onWarning||null,this.legacy=t.legacy||!1,this.json=t.json||!1,this.listener=t.listener||null,this.implicitTypes=this.schema.compiledImplicit,this.typeMap=this.schema.compiledTypeMap,this.length=e.length,this.position=0,this.line=0,this.lineStart=0,this.lineIndent=0,this.firstTabInLine=-1,this.documents=[]}function j(e,t){var n={name:e.filename,buffer:e.input.slice(0,-1),position:e.position,line:e.line,column:e.position-e.lineStart};return n.snippet=s(n),new o(t,n)}function M(e,t){throw j(e,t)}function se(e,t){e.onWarning&&e.onWarning.call(null,j(e,t))}var N={YAML:function(e,t,n){var r,i,a;e.version!==null&&M(e,`duplication of %YAML directive`),n.length!==1&&M(e,`YAML directive accepts exactly one argument`),r=/^([0-9]+)\.([0-9]+)$/.exec(n[0]),r===null&&M(e,`ill-formed argument of the YAML directive`),i=parseInt(r[1],10),a=parseInt(r[2],10),i!==1&&M(e,`unacceptable YAML version of the document`),e.version=n[0],e.checkLineBreaks=a<2,a!==1&&a!==2&&se(e,`unsupported YAML version of the document`)},TAG:function(e,t,n){var r,i;n.length!==2&&M(e,`TAG directive accepts exactly two arguments`),r=n[0],i=n[1],b.test(r)||M(e,`ill-formed tag handle (first argument) of the TAG directive`),l.call(e.tagMap,r)&&M(e,`there is a previously declared suffix for "`+r+`" tag handle`),x.test(i)||M(e,`ill-formed tag prefix (second argument) of the TAG directive`);try{i=decodeURIComponent(i)}catch{M(e,`tag prefix is malformed: `+i)}e.tagMap[r]=i}};function P(e,t,n,r){var i,a,o,s;if(t<n){if(s=e.input.slice(t,n),r)for(i=0,a=s.length;i<a;i+=1)o=s.charCodeAt(i),o===9||32<=o&&o<=1114111||M(e,`expected valid JSON character`);else _.test(s)&&M(e,`the stream contains non-printable characters`);e.result+=s}}function F(e,t,n,r){var i,o,s,c;for(a.isObject(n)||M(e,`cannot merge mappings; the provided source object is unacceptable`),i=Object.keys(n),s=0,c=i.length;s<c;s+=1)o=i[s],l.call(t,o)||(D(t,o,n[o]),r[o]=!0)}function I(e,t,n,r,i,a,o,s,c){var u,d;if(Array.isArray(i))for(i=Array.prototype.slice.call(i),u=0,d=i.length;u<d;u+=1)Array.isArray(i[u])&&M(e,`nested arrays are not supported inside keys`),typeof i==`object`&&te(i[u])===`[object Object]`&&(i[u]=`[object Object]`);if(typeof i==`object`&&te(i)===`[object Object]`&&(i=`[object Object]`),i=String(i),t===null&&(t={}),r===`tag:yaml.org,2002:merge`)if(Array.isArray(a))for(u=0,d=a.length;u<d;u+=1)F(e,t,a[u],n);else F(e,t,a,n);else !e.json&&!l.call(n,i)&&l.call(t,i)&&(e.line=o||e.line,e.lineStart=s||e.lineStart,e.position=c||e.position,M(e,`duplicated mapping key`)),D(t,i,a),delete n[i];return t}function L(e){var t=e.input.charCodeAt(e.position);t===10?e.position++:t===13?(e.position++,e.input.charCodeAt(e.position)===10&&e.position++):M(e,`a line break is expected`),e.line+=1,e.lineStart=e.position,e.firstTabInLine=-1}function R(e,t,n){for(var r=0,i=e.input.charCodeAt(e.position);i!==0;){for(;C(i);)i===9&&e.firstTabInLine===-1&&(e.firstTabInLine=e.position),i=e.input.charCodeAt(++e.position);if(t&&i===35)do i=e.input.charCodeAt(++e.position);while(i!==10&&i!==13&&i!==0);if(S(i))for(L(e),i=e.input.charCodeAt(e.position),r++,e.lineIndent=0;i===32;)e.lineIndent++,i=e.input.charCodeAt(++e.position);else break}return n!==-1&&r!==0&&e.lineIndent<n&&se(e,`deficient indentation`),r}function z(e){var t=e.position,n=e.input.charCodeAt(t);return!!((n===45||n===46)&&n===e.input.charCodeAt(t+1)&&n===e.input.charCodeAt(t+2)&&(t+=3,n=e.input.charCodeAt(t),n===0||w(n)))}function B(e,t){t===1?e.result+=` `:t>1&&(e.result+=a.repeat(`
`,t-1))}function V(e,t,n){var r,i,a,o,s,c,l,u,d=e.kind,f=e.result,p=e.input.charCodeAt(e.position);if(w(p)||T(p)||p===35||p===38||p===42||p===33||p===124||p===62||p===39||p===34||p===37||p===64||p===96||(p===63||p===45)&&(i=e.input.charCodeAt(e.position+1),w(i)||n&&T(i)))return!1;for(e.kind=`scalar`,e.result=``,a=o=e.position,s=!1;p!==0;){if(p===58){if(i=e.input.charCodeAt(e.position+1),w(i)||n&&T(i))break}else if(p===35){if(r=e.input.charCodeAt(e.position-1),w(r))break}else if(e.position===e.lineStart&&z(e)||n&&T(p))break;else if(S(p))if(c=e.line,l=e.lineStart,u=e.lineIndent,R(e,!1,-1),e.lineIndent>=t){s=!0,p=e.input.charCodeAt(e.position);continue}else{e.position=o,e.line=c,e.lineStart=l,e.lineIndent=u;break}s&&=(P(e,a,o,!1),B(e,e.line-c),a=o=e.position,!1),C(p)||(o=e.position+1),p=e.input.charCodeAt(++e.position)}return P(e,a,o,!1),e.result?!0:(e.kind=d,e.result=f,!1)}function ce(e,t){var n=e.input.charCodeAt(e.position),r,i;if(n!==39)return!1;for(e.kind=`scalar`,e.result=``,e.position++,r=i=e.position;(n=e.input.charCodeAt(e.position))!==0;)if(n===39)if(P(e,r,e.position,!0),n=e.input.charCodeAt(++e.position),n===39)r=e.position,e.position++,i=e.position;else return!0;else S(n)?(P(e,r,i,!0),B(e,R(e,!1,t)),r=i=e.position):e.position===e.lineStart&&z(e)?M(e,`unexpected end of the document within a single quoted scalar`):(e.position++,i=e.position);M(e,`unexpected end of the stream within a single quoted scalar`)}function H(e,t){var n,r,i,a,o,s=e.input.charCodeAt(e.position);if(s!==34)return!1;for(e.kind=`scalar`,e.result=``,e.position++,n=r=e.position;(s=e.input.charCodeAt(e.position))!==0;)if(s===34)return P(e,n,e.position,!0),e.position++,!0;else if(s===92){if(P(e,n,e.position,!0),s=e.input.charCodeAt(++e.position),S(s))R(e,!1,t);else if(s<256&&oe[s])e.result+=O[s],e.position++;else if((o=ne(s))>0){for(i=o,a=0;i>0;i--)s=e.input.charCodeAt(++e.position),(o=E(s))>=0?a=(a<<4)+o:M(e,`expected hexadecimal character`);e.result+=ae(a),e.position++}else M(e,`unknown escape sequence`);n=r=e.position}else S(s)?(P(e,n,r,!0),B(e,R(e,!1,t)),n=r=e.position):e.position===e.lineStart&&z(e)?M(e,`unexpected end of the document within a double quoted scalar`):(e.position++,r=e.position);M(e,`unexpected end of the stream within a double quoted scalar`)}function U(e,t){var n=!0,r,i,a,o=e.tag,s,c=e.anchor,l,d,f,p,m,h=Object.create(null),g,_,v,y=e.input.charCodeAt(e.position);if(y===91)d=93,m=!1,s=[];else if(y===123)d=125,m=!0,s={};else return!1;for(e.anchor!==null&&(e.anchorMap[e.anchor]=s),y=e.input.charCodeAt(++e.position);y!==0;){if(R(e,!0,t),y=e.input.charCodeAt(e.position),y===d)return e.position++,e.tag=o,e.anchor=c,e.kind=m?`mapping`:`sequence`,e.result=s,!0;n?y===44&&M(e,`expected the node content, but found ','`):M(e,`missed comma between flow collection entries`),_=g=v=null,f=p=!1,y===63&&(l=e.input.charCodeAt(e.position+1),w(l)&&(f=p=!0,e.position++,R(e,!0,t))),r=e.line,i=e.lineStart,a=e.position,J(e,t,u,!1,!0),_=e.tag,g=e.result,R(e,!0,t),y=e.input.charCodeAt(e.position),(p||e.line===r)&&y===58&&(f=!0,y=e.input.charCodeAt(++e.position),R(e,!0,t),J(e,t,u,!1,!0),v=e.result),m?I(e,s,h,_,g,v,r,i,a):f?s.push(I(e,null,h,_,g,v,r,i,a)):s.push(g),R(e,!0,t),y=e.input.charCodeAt(e.position),y===44?(n=!0,y=e.input.charCodeAt(++e.position)):n=!1}M(e,`unexpected end of the stream within a flow collection`)}function le(e,t){var n,r,i=m,o=!1,s=!1,c=t,l=0,u=!1,d,f=e.input.charCodeAt(e.position);if(f===124)r=!1;else if(f===62)r=!0;else return!1;for(e.kind=`scalar`,e.result=``;f!==0;)if(f=e.input.charCodeAt(++e.position),f===43||f===45)m===i?i=f===43?g:h:M(e,`repeat of a chomping mode identifier`);else if((d=re(f))>=0)d===0?M(e,`bad explicit indentation width of a block scalar; it cannot be less than one`):s?M(e,`repeat of an indentation width identifier`):(c=t+d-1,s=!0);else break;if(C(f)){do f=e.input.charCodeAt(++e.position);while(C(f));if(f===35)do f=e.input.charCodeAt(++e.position);while(!S(f)&&f!==0)}for(;f!==0;){for(L(e),e.lineIndent=0,f=e.input.charCodeAt(e.position);(!s||e.lineIndent<c)&&f===32;)e.lineIndent++,f=e.input.charCodeAt(++e.position);if(!s&&e.lineIndent>c&&(c=e.lineIndent),S(f)){l++;continue}if(e.lineIndent<c){i===g?e.result+=a.repeat(`
`,o?1+l:l):i===m&&o&&(e.result+=`
`);break}for(r?C(f)?(u=!0,e.result+=a.repeat(`
`,o?1+l:l)):u?(u=!1,e.result+=a.repeat(`
`,l+1)):l===0?o&&(e.result+=` `):e.result+=a.repeat(`
`,l):e.result+=a.repeat(`
`,o?1+l:l),o=!0,s=!0,l=0,n=e.position;!S(f)&&f!==0;)f=e.input.charCodeAt(++e.position);P(e,n,e.position,!1)}return!0}function W(e,t){var n,r=e.tag,i=e.anchor,a=[],o,s=!1,c;if(e.firstTabInLine!==-1)return!1;for(e.anchor!==null&&(e.anchorMap[e.anchor]=a),c=e.input.charCodeAt(e.position);c!==0&&(e.firstTabInLine!==-1&&(e.position=e.firstTabInLine,M(e,`tab characters must not be used in indentation`)),!(c!==45||(o=e.input.charCodeAt(e.position+1),!w(o))));){if(s=!0,e.position++,R(e,!0,-1)&&e.lineIndent<=t){a.push(null),c=e.input.charCodeAt(e.position);continue}if(n=e.line,J(e,t,f,!1,!0),a.push(e.result),R(e,!0,-1),c=e.input.charCodeAt(e.position),(e.line===n||e.lineIndent>t)&&c!==0)M(e,`bad indentation of a sequence entry`);else if(e.lineIndent<t)break}return s?(e.tag=r,e.anchor=i,e.kind=`sequence`,e.result=a,!0):!1}function G(e,t,n){var r,i,a,o,s,c,l=e.tag,u=e.anchor,f={},m=Object.create(null),h=null,g=null,_=null,v=!1,y=!1,b;if(e.firstTabInLine!==-1)return!1;for(e.anchor!==null&&(e.anchorMap[e.anchor]=f),b=e.input.charCodeAt(e.position);b!==0;){if(!v&&e.firstTabInLine!==-1&&(e.position=e.firstTabInLine,M(e,`tab characters must not be used in indentation`)),r=e.input.charCodeAt(e.position+1),a=e.line,(b===63||b===58)&&w(r))b===63?(v&&(I(e,f,m,h,g,null,o,s,c),h=g=_=null),y=!0,v=!0,i=!0):v?(v=!1,i=!0):M(e,`incomplete explicit mapping pair; a key node is missed; or followed by a non-tabulated empty line`),e.position+=1,b=r;else{if(o=e.line,s=e.lineStart,c=e.position,!J(e,n,d,!1,!0))break;if(e.line===a){for(b=e.input.charCodeAt(e.position);C(b);)b=e.input.charCodeAt(++e.position);if(b===58)b=e.input.charCodeAt(++e.position),w(b)||M(e,`a whitespace character is expected after the key-value separator within a block mapping`),v&&(I(e,f,m,h,g,null,o,s,c),h=g=_=null),y=!0,v=!1,i=!1,h=e.tag,g=e.result;else if(y)M(e,`can not read an implicit mapping pair; a colon is missed`);else return e.tag=l,e.anchor=u,!0}else if(y)M(e,`can not read a block mapping entry; a multiline key may not be an implicit key`);else return e.tag=l,e.anchor=u,!0}if((e.line===a||e.lineIndent>t)&&(v&&(o=e.line,s=e.lineStart,c=e.position),J(e,t,p,!0,i)&&(v?g=e.result:_=e.result),v||(I(e,f,m,h,g,_,o,s,c),h=g=_=null),R(e,!0,-1),b=e.input.charCodeAt(e.position)),(e.line===a||e.lineIndent>t)&&b!==0)M(e,`bad indentation of a mapping entry`);else if(e.lineIndent<t)break}return v&&I(e,f,m,h,g,null,o,s,c),y&&(e.tag=l,e.anchor=u,e.kind=`mapping`,e.result=f),y}function K(e){var t,n=!1,r=!1,i,a,o=e.input.charCodeAt(e.position);if(o!==33)return!1;if(e.tag!==null&&M(e,`duplication of a tag property`),o=e.input.charCodeAt(++e.position),o===60?(n=!0,o=e.input.charCodeAt(++e.position)):o===33?(r=!0,i=`!!`,o=e.input.charCodeAt(++e.position)):i=`!`,t=e.position,n){do o=e.input.charCodeAt(++e.position);while(o!==0&&o!==62);e.position<e.length?(a=e.input.slice(t,e.position),o=e.input.charCodeAt(++e.position)):M(e,`unexpected end of the stream within a verbatim tag`)}else{for(;o!==0&&!w(o);)o===33&&(r?M(e,`tag suffix cannot contain exclamation marks`):(i=e.input.slice(t-1,e.position+1),b.test(i)||M(e,`named tag handle cannot contain such characters`),r=!0,t=e.position+1)),o=e.input.charCodeAt(++e.position);a=e.input.slice(t,e.position),y.test(a)&&M(e,`tag suffix cannot contain flow indicator characters`)}a&&!x.test(a)&&M(e,`tag name cannot contain such characters: `+a);try{a=decodeURIComponent(a)}catch{M(e,`tag name is malformed: `+a)}return n?e.tag=a:l.call(e.tagMap,i)?e.tag=e.tagMap[i]+a:i===`!`?e.tag=`!`+a:i===`!!`?e.tag=`tag:yaml.org,2002:`+a:M(e,`undeclared tag handle "`+i+`"`),!0}function ue(e){var t,n=e.input.charCodeAt(e.position);if(n!==38)return!1;for(e.anchor!==null&&M(e,`duplication of an anchor property`),n=e.input.charCodeAt(++e.position),t=e.position;n!==0&&!w(n)&&!T(n);)n=e.input.charCodeAt(++e.position);return e.position===t&&M(e,`name of an anchor node must contain at least one character`),e.anchor=e.input.slice(t,e.position),!0}function q(e){var t,n,r=e.input.charCodeAt(e.position);if(r!==42)return!1;for(r=e.input.charCodeAt(++e.position),t=e.position;r!==0&&!w(r)&&!T(r);)r=e.input.charCodeAt(++e.position);return e.position===t&&M(e,`name of an alias node must contain at least one character`),n=e.input.slice(t,e.position),l.call(e.anchorMap,n)||M(e,`unidentified alias "`+n+`"`),e.result=e.anchorMap[n],R(e,!0,-1),!0}function J(e,t,n,r,i){var a,o,s,c=1,m=!1,h=!1,g,_,v,y,b,x;if(e.listener!==null&&e.listener(`open`,e),e.tag=null,e.anchor=null,e.kind=null,e.result=null,a=o=s=p===n||f===n,r&&R(e,!0,-1)&&(m=!0,e.lineIndent>t?c=1:e.lineIndent===t?c=0:e.lineIndent<t&&(c=-1)),c===1)for(;K(e)||ue(e);)R(e,!0,-1)?(m=!0,s=a,e.lineIndent>t?c=1:e.lineIndent===t?c=0:e.lineIndent<t&&(c=-1)):s=!1;if(s&&=m||i,(c===1||p===n)&&(b=u===n||d===n?t:t+1,x=e.position-e.lineStart,c===1?s&&(W(e,x)||G(e,x,b))||U(e,b)?h=!0:(o&&le(e,b)||ce(e,b)||H(e,b)?h=!0:q(e)?(h=!0,(e.tag!==null||e.anchor!==null)&&M(e,`alias node should not have any properties`)):V(e,b,u===n)&&(h=!0,e.tag===null&&(e.tag=`?`)),e.anchor!==null&&(e.anchorMap[e.anchor]=e.result)):c===0&&(h=s&&W(e,x))),e.tag===null)e.anchor!==null&&(e.anchorMap[e.anchor]=e.result);else if(e.tag===`?`){for(e.result!==null&&e.kind!==`scalar`&&M(e,`unacceptable node kind for !<?> tag; it should be "scalar", not "`+e.kind+`"`),g=0,_=e.implicitTypes.length;g<_;g+=1)if(y=e.implicitTypes[g],y.resolve(e.result)){e.result=y.construct(e.result),e.tag=y.tag,e.anchor!==null&&(e.anchorMap[e.anchor]=e.result);break}}else if(e.tag!==`!`){if(l.call(e.typeMap[e.kind||`fallback`],e.tag))y=e.typeMap[e.kind||`fallback`][e.tag];else for(y=null,v=e.typeMap.multi[e.kind||`fallback`],g=0,_=v.length;g<_;g+=1)if(e.tag.slice(0,v[g].tag.length)===v[g].tag){y=v[g];break}y||M(e,`unknown tag !<`+e.tag+`>`),e.result!==null&&y.kind!==e.kind&&M(e,`unacceptable node kind for !<`+e.tag+`> tag; it should be "`+y.kind+`", not "`+e.kind+`"`),y.resolve(e.result,e.tag)?(e.result=y.construct(e.result,e.tag),e.anchor!==null&&(e.anchorMap[e.anchor]=e.result)):M(e,`cannot resolve a node with !<`+e.tag+`> explicit tag`)}return e.listener!==null&&e.listener(`close`,e),e.tag!==null||e.anchor!==null||h}function de(e){var t=e.position,n,r,i,a=!1,o;for(e.version=null,e.checkLineBreaks=e.legacy,e.tagMap=Object.create(null),e.anchorMap=Object.create(null);(o=e.input.charCodeAt(e.position))!==0&&(R(e,!0,-1),o=e.input.charCodeAt(e.position),!(e.lineIndent>0||o!==37));){for(a=!0,o=e.input.charCodeAt(++e.position),n=e.position;o!==0&&!w(o);)o=e.input.charCodeAt(++e.position);for(r=e.input.slice(n,e.position),i=[],r.length<1&&M(e,`directive name must not be less than one character in length`);o!==0;){for(;C(o);)o=e.input.charCodeAt(++e.position);if(o===35){do o=e.input.charCodeAt(++e.position);while(o!==0&&!S(o));break}if(S(o))break;for(n=e.position;o!==0&&!w(o);)o=e.input.charCodeAt(++e.position);i.push(e.input.slice(n,e.position))}o!==0&&L(e),l.call(N,r)?N[r](e,r,i):se(e,`unknown document directive "`+r+`"`)}if(R(e,!0,-1),e.lineIndent===0&&e.input.charCodeAt(e.position)===45&&e.input.charCodeAt(e.position+1)===45&&e.input.charCodeAt(e.position+2)===45?(e.position+=3,R(e,!0,-1)):a&&M(e,`directives end mark is expected`),J(e,e.lineIndent-1,p,!1,!0),R(e,!0,-1),e.checkLineBreaks&&v.test(e.input.slice(t,e.position))&&se(e,`non-ASCII line breaks are interpreted as content`),e.documents.push(e.result),e.position===e.lineStart&&z(e)){e.input.charCodeAt(e.position)===46&&(e.position+=3,R(e,!0,-1));return}if(e.position<e.length-1)M(e,`end of the stream or a document separator is expected`);else return}function Y(e,t){e=String(e),t||={},e.length!==0&&(e.charCodeAt(e.length-1)!==10&&e.charCodeAt(e.length-1)!==13&&(e+=`
`),e.charCodeAt(0)===65279&&(e=e.slice(1)));var n=new A(e,t),r=e.indexOf(`\0`);for(r!==-1&&(n.position=r,M(n,`null byte is not allowed in input`)),n.input+=`\0`;n.input.charCodeAt(n.position)===32;)n.lineIndent+=1,n.position+=1;for(;n.position<n.length-1;)de(n);return n.documents}function fe(e,t,n){typeof t==`object`&&t&&n===void 0&&(n=t,t=null);var r=Y(e,n);if(typeof t!=`function`)return r;for(var i=0,a=r.length;i<a;i+=1)t(r[i])}function pe(e,t){var n=Y(e,t);if(n.length!==0){if(n.length===1)return n[0];throw new o(`expected a single document in the stream, but found more`)}}i.exports.loadAll=fe,i.exports.load=pe})),S=e(((e,r)=>{var i=t(),a=n(),o=ee(),s=Object.prototype.toString,c=Object.prototype.hasOwnProperty,l=65279,u=9,d=10,f=13,p=32,m=33,h=34,g=35,_=37,v=38,y=39,b=42,x=44,te=45,S=58,C=61,w=62,T=63,E=64,ne=91,re=93,ie=96,ae=123,D=124,oe=125,O={};O[0]=`\\0`,O[7]=`\\a`,O[8]=`\\b`,O[9]=`\\t`,O[10]=`\\n`,O[11]=`\\v`,O[12]=`\\f`,O[13]=`\\r`,O[27]=`\\e`,O[34]=`\\"`,O[92]=`\\\\`,O[133]=`\\N`,O[160]=`\\_`,O[8232]=`\\L`,O[8233]=`\\P`;var k=[`y`,`Y`,`yes`,`Yes`,`YES`,`on`,`On`,`ON`,`n`,`N`,`no`,`No`,`NO`,`off`,`Off`,`OFF`],A=/^[-+]?[0-9_]+(?::[0-9_]+)+(?:\.[0-9_]*)?$/;function j(e,t){var n,r,i,a,o,s,l;if(t===null)return{};for(n={},r=Object.keys(t),i=0,a=r.length;i<a;i+=1)o=r[i],s=String(t[o]),o.slice(0,2)===`!!`&&(o=`tag:yaml.org,2002:`+o.slice(2)),l=e.compiledTypeMap.fallback[o],l&&c.call(l.styleAliases,s)&&(s=l.styleAliases[s]),n[o]=s;return n}function M(e){var t=e.toString(16).toUpperCase(),n,r;if(e<=255)n=`x`,r=2;else if(e<=65535)n=`u`,r=4;else if(e<=4294967295)n=`U`,r=8;else throw new a(`code point within a string may not be greater than 0xFFFFFFFF`);return`\\`+n+i.repeat(`0`,r-t.length)+t}var se=1,N=2;function P(e){this.schema=e.schema||o,this.indent=Math.max(1,e.indent||2),this.noArrayIndent=e.noArrayIndent||!1,this.skipInvalid=e.skipInvalid||!1,this.flowLevel=i.isNothing(e.flowLevel)?-1:e.flowLevel,this.styleMap=j(this.schema,e.styles||null),this.sortKeys=e.sortKeys||!1,this.lineWidth=e.lineWidth||80,this.noRefs=e.noRefs||!1,this.noCompatMode=e.noCompatMode||!1,this.condenseFlow=e.condenseFlow||!1,this.quotingType=e.quotingType===`"`?N:se,this.forceQuotes=e.forceQuotes||!1,this.replacer=typeof e.replacer==`function`?e.replacer:null,this.implicitTypes=this.schema.compiledImplicit,this.explicitTypes=this.schema.compiledExplicit,this.tag=null,this.result=``,this.duplicates=[],this.usedDuplicates=null}function F(e,t){for(var n=i.repeat(` `,t),r=0,a=-1,o=``,s,c=e.length;r<c;)a=e.indexOf(`
`,r),a===-1?(s=e.slice(r),r=c):(s=e.slice(r,a+1),r=a+1),s.length&&s!==`
`&&(o+=n),o+=s;return o}function I(e,t){return`
`+i.repeat(` `,e.indent*t)}function L(e,t){var n,r,i;for(n=0,r=e.implicitTypes.length;n<r;n+=1)if(i=e.implicitTypes[n],i.resolve(t))return!0;return!1}function R(e){return e===p||e===u}function z(e){return 32<=e&&e<=126||161<=e&&e<=55295&&e!==8232&&e!==8233||57344<=e&&e<=65533&&e!==l||65536<=e&&e<=1114111}function B(e){return z(e)&&e!==l&&e!==f&&e!==d}function V(e,t,n){var r=B(e),i=r&&!R(e);return(n?r:r&&e!==x&&e!==ne&&e!==re&&e!==ae&&e!==oe)&&e!==g&&!(t===S&&!i)||B(t)&&!R(t)&&e===g||t===S&&i}function ce(e){return z(e)&&e!==l&&!R(e)&&e!==te&&e!==T&&e!==S&&e!==x&&e!==ne&&e!==re&&e!==ae&&e!==oe&&e!==g&&e!==v&&e!==b&&e!==m&&e!==D&&e!==C&&e!==w&&e!==y&&e!==h&&e!==_&&e!==E&&e!==ie}function H(e){return!R(e)&&e!==S}function U(e,t){var n=e.charCodeAt(t),r;return n>=55296&&n<=56319&&t+1<e.length&&(r=e.charCodeAt(t+1),r>=56320&&r<=57343)?(n-55296)*1024+r-56320+65536:n}function le(e){return/^\n* /.test(e)}var W=1,G=2,K=3,ue=4,q=5;function J(e,t,n,r,i,a,o,s){var c,l=0,u=null,f=!1,p=!1,m=r!==-1,h=-1,g=ce(U(e,0))&&H(U(e,e.length-1));if(t||o)for(c=0;c<e.length;l>=65536?c+=2:c++){if(l=U(e,c),!z(l))return q;g&&=V(l,u,s),u=l}else{for(c=0;c<e.length;l>=65536?c+=2:c++){if(l=U(e,c),l===d)f=!0,m&&(p||=c-h-1>r&&e[h+1]!==` `,h=c);else if(!z(l))return q;g&&=V(l,u,s),u=l}p||=m&&c-h-1>r&&e[h+1]!==` `}return!f&&!p?g&&!o&&!i(e)?W:a===N?q:G:n>9&&le(e)?q:o?a===N?q:G:p?ue:K}function de(e,t,n,r,i){e.dump=function(){if(t.length===0)return e.quotingType===N?`""`:`''`;if(!e.noCompatMode&&(k.indexOf(t)!==-1||A.test(t)))return e.quotingType===N?`"`+t+`"`:`'`+t+`'`;var o=e.indent*Math.max(1,n),s=e.lineWidth===-1?-1:Math.max(Math.min(e.lineWidth,40),e.lineWidth-o),c=r||e.flowLevel>-1&&n>=e.flowLevel;function l(t){return L(e,t)}switch(J(t,c,e.indent,s,l,e.quotingType,e.forceQuotes&&!r,i)){case W:return t;case G:return`'`+t.replace(/'/g,`''`)+`'`;case K:return`|`+Y(t,e.indent)+fe(F(t,o));case ue:return`>`+Y(t,e.indent)+fe(F(pe(t,s),o));case q:return`"`+X(t,s)+`"`;default:throw new a(`impossible error: invalid scalar style`)}}()}function Y(e,t){var n=le(e)?String(t):``,r=e[e.length-1]===`
`;return n+(r&&(e[e.length-2]===`
`||e===`
`)?`+`:r?``:`-`)+`
`}function fe(e){return e[e.length-1]===`
`?e.slice(0,-1):e}function pe(e,t){for(var n=/(\n+)([^\n]*)/g,r=function(){var r=e.indexOf(`
`);return r=r===-1?e.length:r,n.lastIndex=r,me(e.slice(0,r),t)}(),i=e[0]===`
`||e[0]===` `,a,o;o=n.exec(e);){var s=o[1],c=o[2];a=c[0]===` `,r+=s+(!i&&!a&&c!==``?`
`:``)+me(c,t),i=a}return r}function me(e,t){if(e===``||e[0]===` `)return e;for(var n=/ [^ ]/g,r,i=0,a,o=0,s=0,c=``;r=n.exec(e);)s=r.index,s-i>t&&(a=o>i?o:s,c+=`
`+e.slice(i,a),i=a+1),o=s;return c+=`
`,e.length-i>t&&o>i?c+=e.slice(i,o)+`
`+e.slice(o+1):c+=e.slice(i),c.slice(1)}function X(e){for(var t=``,n=0,r,i=0;i<e.length;n>=65536?i+=2:i++)n=U(e,i),r=O[n],!r&&z(n)?(t+=e[i],n>=65536&&(t+=e[i+1])):t+=r||M(n);return t}function he(e,t,n){var r=``,i=e.tag,a,o,s;for(a=0,o=n.length;a<o;a+=1)s=n[a],e.replacer&&(s=e.replacer.call(n,String(a),s)),(Z(e,t,s,!1,!1)||s===void 0&&Z(e,t,null,!1,!1))&&(r!==``&&(r+=`,`+(e.condenseFlow?``:` `)),r+=e.dump);e.tag=i,e.dump=`[`+r+`]`}function ge(e,t,n,r){var i=``,a=e.tag,o,s,c;for(o=0,s=n.length;o<s;o+=1)c=n[o],e.replacer&&(c=e.replacer.call(n,String(o),c)),(Z(e,t+1,c,!0,!0,!1,!0)||c===void 0&&Z(e,t+1,null,!0,!0,!1,!0))&&((!r||i!==``)&&(i+=I(e,t)),e.dump&&d===e.dump.charCodeAt(0)?i+=`-`:i+=`- `,i+=e.dump);e.tag=a,e.dump=i||`[]`}function _e(e,t,n){var r=``,i=e.tag,a=Object.keys(n),o,s,c,l,u;for(o=0,s=a.length;o<s;o+=1)u=``,r!==``&&(u+=`, `),e.condenseFlow&&(u+=`"`),c=a[o],l=n[c],e.replacer&&(l=e.replacer.call(n,c,l)),Z(e,t,c,!1,!1)&&(e.dump.length>1024&&(u+=`? `),u+=e.dump+(e.condenseFlow?`"`:``)+`:`+(e.condenseFlow?``:` `),Z(e,t,l,!1,!1)&&(u+=e.dump,r+=u));e.tag=i,e.dump=`{`+r+`}`}function ve(e,t,n,r){var i=``,o=e.tag,s=Object.keys(n),c,l,u,f,p,m;if(e.sortKeys===!0)s.sort();else if(typeof e.sortKeys==`function`)s.sort(e.sortKeys);else if(e.sortKeys)throw new a(`sortKeys must be a boolean or a function`);for(c=0,l=s.length;c<l;c+=1)m=``,(!r||i!==``)&&(m+=I(e,t)),u=s[c],f=n[u],e.replacer&&(f=e.replacer.call(n,u,f)),Z(e,t+1,u,!0,!0,!0)&&(p=e.tag!==null&&e.tag!==`?`||e.dump&&e.dump.length>1024,p&&(e.dump&&d===e.dump.charCodeAt(0)?m+=`?`:m+=`? `),m+=e.dump,p&&(m+=I(e,t)),Z(e,t+1,f,!0,p)&&(e.dump&&d===e.dump.charCodeAt(0)?m+=`:`:m+=`: `,m+=e.dump,i+=m));e.tag=o,e.dump=i||`{}`}function ye(e,t,n){var r,i=n?e.explicitTypes:e.implicitTypes,o,l,u,d;for(o=0,l=i.length;o<l;o+=1)if(u=i[o],(u.instanceOf||u.predicate)&&(!u.instanceOf||typeof t==`object`&&t instanceof u.instanceOf)&&(!u.predicate||u.predicate(t))){if(n?u.multi&&u.representName?e.tag=u.representName(t):e.tag=u.tag:e.tag=`?`,u.represent){if(d=e.styleMap[u.tag]||u.defaultStyle,s.call(u.represent)===`[object Function]`)r=u.represent(t,d);else if(c.call(u.represent,d))r=u.represent[d](t,d);else throw new a(`!<`+u.tag+`> tag resolver accepts not "`+d+`" style`);e.dump=r}return!0}return!1}function Z(e,t,n,r,i,o,c){e.tag=null,e.dump=n,ye(e,n,!1)||ye(e,n,!0);var l=s.call(e.dump),u=r,d;r&&=e.flowLevel<0||e.flowLevel>t;var f=l===`[object Object]`||l===`[object Array]`,p,m;if(f&&(p=e.duplicates.indexOf(n),m=p!==-1),(e.tag!==null&&e.tag!==`?`||m||e.indent!==2&&t>0)&&(i=!1),m&&e.usedDuplicates[p])e.dump=`*ref_`+p;else{if(f&&m&&!e.usedDuplicates[p]&&(e.usedDuplicates[p]=!0),l===`[object Object]`)r&&Object.keys(e.dump).length!==0?(ve(e,t,e.dump,i),m&&(e.dump=`&ref_`+p+e.dump)):(_e(e,t,e.dump),m&&(e.dump=`&ref_`+p+` `+e.dump));else if(l===`[object Array]`)r&&e.dump.length!==0?(e.noArrayIndent&&!c&&t>0?ge(e,t-1,e.dump,i):ge(e,t,e.dump,i),m&&(e.dump=`&ref_`+p+e.dump)):(he(e,t,e.dump),m&&(e.dump=`&ref_`+p+` `+e.dump));else if(l===`[object String]`)e.tag!==`?`&&de(e,e.dump,t,o,u);else if(l===`[object Undefined]`)return!1;else{if(e.skipInvalid)return!1;throw new a(`unacceptable kind of an object to dump `+l)}e.tag!==null&&e.tag!==`?`&&(d=encodeURI(e.tag[0]===`!`?e.tag.slice(1):e.tag).replace(/!/g,`%21`),d=e.tag[0]===`!`?`!`+d:d.slice(0,18)===`tag:yaml.org,2002:`?`!!`+d.slice(18):`!<`+d+`>`,e.dump=d+` `+e.dump)}return!0}function be(e,t){var n=[],r=[],i,a;for(xe(e,n,r),i=0,a=r.length;i<a;i+=1)t.duplicates.push(n[r[i]]);t.usedDuplicates=Array(a)}function xe(e,t,n){var r,i,a;if(typeof e==`object`&&e)if(i=t.indexOf(e),i!==-1)n.indexOf(i)===-1&&n.push(i);else if(t.push(e),Array.isArray(e))for(i=0,a=e.length;i<a;i+=1)xe(e[i],t,n);else for(r=Object.keys(e),i=0,a=r.length;i<a;i+=1)xe(e[r[i]],t,n)}function Se(e,t){t||={};var n=new P(t);n.noRefs||be(e,n);var r=e;return n.replacer&&(r=n.replacer.call({"":r},``,r)),Z(n,0,r,!0,!0)?n.dump+`
`:``}r.exports.dump=Se})),C=e(((e,t)=>{var r=te(),C=S();function w(e,t){return function(){throw Error(`Function yaml.`+e+` is removed in js-yaml 4. Use yaml.`+t+` instead, which is now safe by default.`)}}t.exports.Type=i(),t.exports.Schema=a(),t.exports.FAILSAFE_SCHEMA=l(),t.exports.JSON_SCHEMA=m(),t.exports.CORE_SCHEMA=h(),t.exports.DEFAULT_SCHEMA=ee(),t.exports.load=r.load,t.exports.loadAll=r.loadAll,t.exports.dump=C.dump,t.exports.YAMLException=n(),t.exports.types={binary:v(),float:p(),map:c(),null:u(),pairs:b(),set:x(),timestamp:g(),bool:d(),int:f(),merge:_(),omap:y(),seq:s(),str:o()},t.exports.safeLoad=w(`safeLoad`,`load`),t.exports.safeLoadAll=w(`safeLoadAll`,`loadAll`),t.exports.safeDump=w(`safeDump`,`dump`)})),w=e(((e,t)=>{var{Menu:n}=require(`electron`);function r({onOpenConfig:e,onQuit:t}){return n.buildFromTemplate([{label:`配置`,click:()=>{typeof e==`function`&&e()}},{label:`退出`,click:()=>{typeof t==`function`&&t()}}])}t.exports={buildTrayContextMenu:r}})),{app:T,BrowserWindow:E,Tray:ne,nativeImage:re,shell:ie,dialog:ae,ipcMain:D,net:oe}=require(`electron`),O=require(`http`),{execFileSync:k}=require(`child_process`),A=require(`fs`),j=require(`path`),M=C(),{buildTrayContextMenu:se}=w(),N=!!process.env.VITE_DEV_SERVER_URL||process.argv.includes(`-debug`)||process.argv.includes(`--debug`);T.commandLine.appendSwitch(`autoplay-policy`,`no-user-gesture-required`);var P={studentList:[],allowRepeatDraw:!0,floatingButton:{sizePercent:100,transparencyPercent:20,alwaysOnTop:!0,position:{x:null,y:null}},pickCountDialog:{defaultPlayMusic:!1,backgroundDarknessPercent:50,defaultCount:1},pickResultDialog:{defaultPlayGachaSound:!0,gachaSoundVolume:.6},webConfig:{port:21219,adminTopmostEnabled:!1,adminAutoStartEnabled:!1,adminAutoStartPath:``,adminAutoStartTaskName:`Blue Random (Admin)`}},F=process.platform===`win32`,I=`Blue Random (Admin)`,L=P,R=new Map,z=null,B=null,V=null,ce=!1,H=!1,U=null,le=!1,W=[],G=0,K=null,ue=null,q=!1,J=null,de=400,Y=[],fe=new Set,pe=600;function me(e,t){let n=new Date().toISOString(),r={id:`${Date.now()}-${Math.random().toString(16).slice(2)}`,level:e,text:String(t),time:n};Y.push(r),Y.length>pe&&Y.splice(0,Y.length-pe);let i=`data: ${JSON.stringify(r)}\n\n`;for(let e of fe)e.write(i)}[`log`,`info`,`warn`,`error`].forEach(e=>{let t=console[e].bind(console);console[e]=(...n)=>{let r=n.map(e=>{if(typeof e==`string`)return e;try{return JSON.stringify(e)}catch{return String(e)}}).join(` `);me(e===`log`?`info`:e,r),t(...n)}}),process.on(`uncaughtException`,e=>{console.error(`Uncaught exception:`,e)}),process.on(`unhandledRejection`,e=>{console.error(`Unhandled rejection:`,e)}),D.on(`renderer:log`,(e,t)=>{!t||typeof t.text!=`string`||me(typeof t.level==`string`?t.level:`info`,t.text)});function X(e,t,n,r){let i=Number(e);return Number.isNaN(i)?r:Math.min(n,Math.max(t,i))}function he(e){return String(e).replace(/'/g,`''`)}function ge(){if(!F)return!1;try{let e=k(`powershell`,[`-NoProfile`,`-Command`,`([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)`],{encoding:`utf8`});return String(e).trim().toLowerCase()===`true`}catch{return!1}}function _e(){if(!F)return{ok:!1,message:`当前系统不支持管理员提升。`};let e=process.execPath,t=process.argv.slice(1).map(e=>`"${e.replace(/"/g,`\\"`)}"`).join(` `),n=`Start-Process -FilePath '${he(e)}' -ArgumentList '${he(t)}' -Verb RunAs`;try{return k(`powershell`,[`-NoProfile`,`-Command`,n],{stdio:`ignore`}),{ok:!0,message:`已请求管理员权限，即将重新启动。`}}catch(e){return{ok:!1,message:`管理员权限请求失败或被取消。`,detail:String(e)}}}function ve(){return T.getPath(`exe`)}function ye({taskName:e,exePath:t,runAsUser:n}){if(!F)return{ok:!1,message:`仅支持 Windows 计划任务。`};if(!t||!A.existsSync(t))return{ok:!1,message:`可执行文件路径无效或不存在。`};let r=e||I,i=n||process.env.USERNAME||``,a=[`/Create`,`/F`,`/RL`,`HIGHEST`,`/SC`,`ONLOGON`,`/TN`,r,`/TR`,`"${t}"`];i&&a.push(`/RU`,i);try{return ge()?k(`schtasks`,a,{stdio:`ignore`}):k(`powershell`,[`-NoProfile`,`-Command`,`Start-Process -FilePath 'schtasks.exe' -ArgumentList '${he(a.map(e=>`"${e.replace(/"/g,`\\"`)}"`).join(` `))}' -Verb RunAs -Wait`],{stdio:`ignore`}),{ok:!0,message:`计划任务已创建或更新。`}}catch(e){return{ok:!1,message:`计划任务创建失败或被取消。`,detail:String(e)}}}function Z(e){let t=e&&typeof e==`object`?e:{},n=(Array.isArray(t.studentList)?t.studentList:[]).map(e=>typeof e==`string`?{name:e.trim(),weight:1}:e&&typeof e==`object`?{name:String(e.name||``).trim(),weight:Number.isFinite(Number(e.weight))?Number(e.weight):1}:null).filter(e=>e&&e.name),r=t.floatingButton&&typeof t.floatingButton==`object`?t.floatingButton:{},i=typeof t.allowRepeatDraw==`boolean`?t.allowRepeatDraw:P.allowRepeatDraw,a=r.position&&typeof r.position==`object`?r.position:{},o=t.pickCountDialog&&typeof t.pickCountDialog==`object`?t.pickCountDialog:{},s=t.pickResultDialog&&typeof t.pickResultDialog==`object`?t.pickResultDialog:{},c=t.webConfig&&typeof t.webConfig==`object`?t.webConfig:{},l=typeof r.alwaysOnTop==`boolean`?r.alwaysOnTop:P.floatingButton.alwaysOnTop;return{studentList:n,allowRepeatDraw:i,floatingButton:{sizePercent:X(r.sizePercent,0,1e3,P.floatingButton.sizePercent),transparencyPercent:X(r.transparencyPercent,0,100,P.floatingButton.transparencyPercent),alwaysOnTop:l,position:{x:Number.isFinite(Number(a.x))?Math.round(Number(a.x)):null,y:Number.isFinite(Number(a.y))?Math.round(Number(a.y)):null}},pickCountDialog:{defaultPlayMusic:typeof o.defaultPlayMusic==`boolean`?o.defaultPlayMusic:P.pickCountDialog.defaultPlayMusic,backgroundDarknessPercent:X(o.backgroundDarknessPercent,0,100,P.pickCountDialog.backgroundDarknessPercent),defaultCount:Math.round(X(o.defaultCount,1,10,P.pickCountDialog.defaultCount))},pickResultDialog:{defaultPlayGachaSound:typeof s.defaultPlayGachaSound==`boolean`?s.defaultPlayGachaSound:P.pickResultDialog.defaultPlayGachaSound,gachaSoundVolume:X(s.gachaSoundVolume,0,1,P.pickResultDialog.gachaSoundVolume)},webConfig:{port:Math.round(X(c.port,1,65535,P.webConfig.port)),adminTopmostEnabled:typeof c.adminTopmostEnabled==`boolean`?c.adminTopmostEnabled:P.webConfig.adminTopmostEnabled,adminAutoStartEnabled:typeof c.adminAutoStartEnabled==`boolean`?c.adminAutoStartEnabled:P.webConfig.adminAutoStartEnabled,adminAutoStartPath:typeof c.adminAutoStartPath==`string`?c.adminAutoStartPath:P.webConfig.adminAutoStartPath,adminAutoStartTaskName:typeof c.adminAutoStartTaskName==`string`&&c.adminAutoStartTaskName.trim()?c.adminAutoStartTaskName.trim():P.webConfig.adminAutoStartTaskName}}}function be(){return j.join(process.cwd(),`config.yml`)}function xe(){return j.join(T.getPath(`userData`),`config.yml`)}function Se(e){let t=e.floatingButton,n=e.pickCountDialog,r=e.pickResultDialog,i=e.webConfig,a=Number.isFinite(Number(t.position.x))?String(Math.round(Number(t.position.x))):`null`,o=Number.isFinite(Number(t.position.y))?String(Math.round(Number(t.position.y))):`null`;return[`# 抽取名单列表`,`studentList:${Array.isArray(e.studentList)&&e.studentList.length>0?`
`+e.studentList.map(e=>`  - name: "${e.name}"\n    weight: ${e.weight}`).join(`
`):` []`}`,`allowRepeatDraw: ${e.allowRepeatDraw?`true`:`false`}`,``,`# 悬浮按钮配置`,`floatingButton:`,`  # 按钮大小百分比（基准 50px*50px），范围 0-1000，默认 100`,`  sizePercent: ${t.sizePercent}`,`  # 透明度百分比，范围 0-100（0=完全不透明，100=完全透明），默认 20`,`  transparencyPercent: ${t.transparencyPercent}`,`  # 是否置顶（true/false），默认 true`,`  alwaysOnTop: ${t.alwaysOnTop?`true`:`false`}`,`  # 悬浮按钮窗口位置（左上角屏幕坐标），退出时自动保存；null 表示使用系统默认位置`,`  position:`,`    x: ${a}`,`    y: ${o}`,``,`# 人数选择窗口配置`,`pickCountDialog:`,`  # 是否默认播放喜庆点名音乐（true/false），默认 false`,`  defaultPlayMusic: ${n.defaultPlayMusic?`true`:`false`}`,`  # 背景变暗程度，范围 0-100（100 接近全黑），默认 50`,`  backgroundDarknessPercent: ${n.backgroundDarknessPercent}`,`  # 人数默认值，范围 1-10 的整数，默认 1`,`  defaultCount: ${n.defaultCount}`,``,`# 抽奖结果动画音效配置`,`pickResultDialog:`,`  # 是否默认播放抽奖音效（true/false），默认 true`,`  defaultPlayGachaSound: ${r.defaultPlayGachaSound?`true`:`false`}`,`  # 抽奖音效音量（0.0-1.0），默认 0.6`,`  gachaSoundVolume: ${r.gachaSoundVolume}`,``,`# 网页配置服务`,`webConfig:`,`  # 配置网页端口（默认 21219）`,`  port: ${i.port}`,`  # 启用管理员置顶增强（Windows 下会尝试管理员权限）`,`  adminTopmostEnabled: ${i.adminTopmostEnabled?`true`:`false`}`,`  # 是否创建开机计划任务（管理员权限运行）`,`  adminAutoStartEnabled: ${i.adminAutoStartEnabled?`true`:`false`}`,`  # 计划任务运行的可执行文件路径`,`  adminAutoStartPath: "${String(i.adminAutoStartPath||``)}"`,`  # 计划任务名称`,`  adminAutoStartTaskName: "${String(i.adminAutoStartTaskName||I)}"`,``].join(`
`)}function Ce(e){let t=be(),n=Se(e);A.mkdirSync(j.dirname(t),{recursive:!0}),A.writeFileSync(t,n,`utf8`)}function we(e){if(A.existsSync(e))return;let t=xe();if(t!==e&&A.existsSync(t)){A.mkdirSync(j.dirname(e),{recursive:!0}),A.copyFileSync(t,e);return}Ce(P)}function Te(){let e=be();we(e);try{let t=A.readFileSync(e,`utf8`),n=Z(M.load(t));return Ce(n),n}catch(e){console.error(`Failed to load config.yml, using defaults.`,e);let t=Z(P);return Ce(t),t}}function Q(){return L=Te(),L}var Ee=1.5;function De(e){let t=Q(),n=(Array.isArray(t.studentList)?t.studentList:[]).map(e=>({name:String(e.name||``).trim(),weight:Math.max(0,Number(e.weight)||0)})).filter(e=>e.name);if(n.length===0||e<=0)return[];let r=Math.max(0,e),i=[],a=!!t.allowRepeatDraw;if(n.length===0)return i;if(a){let e=n.map(e=>({name:e.name,weight:e.weight**+Ee})),t=e.reduce((e,t)=>e+t.weight,0);for(let n=0;n<r;n++){let n=-1;if(t>0){let r=Math.random()*t;for(let t=0;t<e.length;t++)if(r-=e[t].weight,r<=0){n=t;break}}n<0&&(n=Math.floor(Math.random()*e.length)),i.push({name:e[n].name})}return i}let o=n.filter(e=>e.weight>0),s=n.filter(e=>e.weight<=0);if(o.length>0){let e=o.map(e=>({name:e.name,key:-Math.log(Math.random())/e.weight}));e.sort((e,t)=>e.key-t.key);let t=Math.min(r,e.length);for(let n=0;n<t;n++)i.push({name:e[n].name})}if(i.length<r&&s.length>0){let e=s.slice();for(let t=e.length-1;t>0;t--){let n=Math.floor(Math.random()*(t+1));[e[t],e[n]]=[e[n],e[t]]}let t=Math.min(r-i.length,e.length);for(let n=0;n<t;n++)i.push({name:e[n].name})}return i}function Oe(e){return e.endsWith(`.html`)?`text/html; charset=utf-8`:e.endsWith(`.js`)?`application/javascript; charset=utf-8`:e.endsWith(`.css`)?`text/css; charset=utf-8`:e.endsWith(`.json`)?`application/json; charset=utf-8`:`text/plain; charset=utf-8`}function $(e,t,n){e.writeHead(t,{"Content-Type":`application/json; charset=utf-8`}),e.end(JSON.stringify(n))}function ke(e){return new Promise((t,n)=>{let r=``;e.on(`data`,e=>{r+=e,r.length>1024*1024&&n(Error(`Payload too large`))}),e.on(`end`,()=>{if(!r.trim()){t({});return}try{t(JSON.parse(r))}catch(e){n(e)}}),e.on(`error`,n)})}function Ae(e){let t=String(e||``).split(/\r?\n/),n={};return t.forEach(e=>{let t=e.match(/^\s*([a-zA-Z0-9_-]+)\s*:\s*"?([^\"]*)"?\s*$/);t&&(n[t[1]]=t[2])}),n}function je(e){return String(e||``).trim().replace(/^v/i,``)}function Me(e,t){let n=je(e).split(`.`).map(e=>parseInt(e,10)).filter(e=>Number.isFinite(e)),r=je(t).split(`.`).map(e=>parseInt(e,10)).filter(e=>Number.isFinite(e)),i=Math.max(n.length,r.length);for(let e=0;e<i;e+=1){let t=n[e]||0,i=r[e]||0;if(t>i)return 1;if(t<i)return-1}return 0}function Ne(e,t={}){return new Promise((n,r)=>{let i=oe.request({method:`GET`,url:e,headers:{"User-Agent":`Blue-Random`,Accept:`application/vnd.github+json`,...t.headers||{}}}),a=[];i.on(`response`,e=>{e.on(`data`,e=>a.push(Buffer.from(e))),e.on(`end`,()=>{let t=Buffer.concat(a);n({statusCode:e.statusCode||0,headers:e.headers||{},body:t})})}),i.on(`error`,r),i.end()})}async function Pe(){let e=`Yun-Hydrogen`,t=`ba_random_electron`,n=[],r=T.getVersion(),i=`https://api.github.com/repos/${e}/${t}/releases/latest`;n.push(`GET ${i}`);let a=await Ne(i);if(a.statusCode<200||a.statusCode>=300)return{ok:!1,status:`error`,title:`检查更新失败`,detail:`Release 请求失败 (${a.statusCode})`,localVersion:r,debug:n};let o=JSON.parse(a.body.toString(`utf8`)),s=Array.isArray(o.assets)?o.assets:[];n.push(`assets=${s.length}`);let c=s.find(e=>e.name===`version.yml`)||s.find(e=>String(e.name||``).toLowerCase().endsWith(`version.yml`));if(!c||!c.browser_download_url)return{ok:!1,status:`error`,title:`未找到版本描述文件`,detail:`发布中缺少 version.yml，请稍后再试。`,releaseUrl:o.html_url||`https://github.com/${e}/${t}/releases/latest`,localVersion:r,debug:n};n.push(`GET ${c.browser_download_url}`);let l=await Ne(c.browser_download_url,{headers:{Accept:`text/plain`}});if(l.statusCode<200||l.statusCode>=300)return{ok:!1,status:`error`,title:`检查更新失败`,detail:`version.yml 下载失败 (${l.statusCode})`,releaseUrl:o.html_url||`https://github.com/${e}/${t}/releases/latest`,localVersion:r,debug:n};let u=Ae(l.body.toString(`utf8`)),d=u.version||`0.0.0`,f=u.commit||``;n.push(`remoteVersion=${d}`);let p=``,m=``;if(f){m=`https://github.com/${e}/${t}/commit/${f}`;let r=`https://api.github.com/repos/${e}/${t}/commits/${f}`;n.push(`GET ${r}`);let i=await Ne(r);if(i.statusCode>=200&&i.statusCode<300){let e=JSON.parse(i.body.toString(`utf8`));e&&e.commit&&e.commit.message&&(p=String(e.commit.message).trim())}}let h=Me(r,d);return h<0?{ok:!0,status:`update`,title:`发现新版本：${d}`,detail:p?`更新内容：\n${p}`:`有新版本可用。`,commitUrl:m,releaseUrl:o.html_url||`https://github.com/${e}/${t}/releases/latest`,localVersion:r,remoteVersion:d,debug:n}:h===0?{ok:!0,status:`ok`,title:`已是最新版本：${r}`,detail:p?`当前提交：\n${p}`:`无需更新。`,commitUrl:m,releaseUrl:o.html_url||`https://github.com/${e}/${t}/releases/latest`,localVersion:r,remoteVersion:d,debug:n}:{ok:!0,status:`easter`,title:`这是为什么呢？${r}`,detail:`为什么你的版本比最新发布的版本还要新呢？`,commitUrl:m,releaseUrl:o.html_url||`https://github.com/${e}/${t}/releases/latest`,localVersion:r,remoteVersion:d,debug:n}}function Fe(){let e=`http://localhost:${Q().webConfig.port}/#/config`;ie.openExternal(e)}function Ie(){return async(e,t)=>{let n=e.url||`/`;if(j.join(__dirname,`../renderer`,`web-config`),e.method===`GET`&&n===`/api/config`)return $(t,200,Q());if(e.method===`GET`&&n===`/api/app-info`)return $(t,200,{version:T.getVersion(),isDebugMode:N,isAdmin:ge(),exePath:ve()});if(e.method===`GET`&&n===`/api/check-update`)try{return $(t,200,await Pe())}catch(e){return console.error(`Update check failed:`,e),$(t,500,{ok:!1,status:`error`,title:`检查更新失败`,detail:`请检查网络或稍后再试。`})}if(e.method===`GET`&&n===`/api/logs`){t.writeHead(200,{"Content-Type":`text/event-stream; charset=utf-8`,"Cache-Control":`no-cache`,Connection:`keep-alive`,"X-Accel-Buffering":`no`}),t.write(`
`),fe.add(t),Y.forEach(e=>{t.write(`data: ${JSON.stringify(e)}\n\n`)}),e.on(`close`,()=>{fe.delete(t)});return}if(e.method===`POST`&&n===`/api/config`)try{let n=Z(await ke(e));return L=n,Ce(n),Le(),B&&!B.isDestroyed()&&B.close(),$(t,200,{ok:!0,message:`配置保存成功，悬浮窗已自动刷新配置`,restartRequired:!1})}catch{return $(t,400,{ok:!1,message:`配置保存失败，请检查输入格式`})}if(e.method===`POST`&&n===`/api/restart`){$(t,200,{ok:!0}),setTimeout(()=>{q=!0,T.relaunch(),T.exit(0)},80);return}if(e.method===`POST`&&n===`/api/admin/elevate`){if(!F)return $(t,400,{ok:!1,message:`当前系统不支持管理员提升。`});if(ge())return $(t,200,{ok:!0,message:`已在管理员权限下运行。`});let e=_e();if(!e.ok)return $(t,400,e);$(t,200,e),setTimeout(()=>{q=!0,T.exit(0)},150);return}if(e.method===`POST`&&n===`/api/task/create-admin-startup`)try{let n=await ke(e),r=n&&typeof n.exePath==`string`?n.exePath.trim():``,i=n&&typeof n.taskName==`string`?n.taskName.trim():I,a=ye({taskName:i,exePath:r});if(!a.ok)return $(t,400,a);let o=Q();return L=Z({...o,webConfig:{...o.webConfig,adminAutoStartEnabled:!0,adminAutoStartPath:r,adminAutoStartTaskName:i}}),Ce(L),$(t,200,a)}catch{return $(t,400,{ok:!1,message:`创建计划任务失败。`})}let r=n.split(`?`)[0].split(`#`)[0];if(!r.startsWith(`/api`)){if(process.env.VITE_DEV_SERVER_URL){t.writeHead(302,{Location:process.env.VITE_DEV_SERVER_URL+`#/config`}),t.end();return}let e=j.join(__dirname,`../dist`),n=j.join(e,r===`/`?`index.html`:r);if(!n.startsWith(e))return $(t,403,{ok:!1,message:`Forbidden`});if(A.existsSync(n)&&A.statSync(n).isFile()){let e=A.readFileSync(n);t.writeHead(200,{"Content-Type":Oe(n)}),t.end(e);return}}$(t,404,{ok:!1,message:`Not Found`})}}function Le(){let e=Q().webConfig.port;if(K&&ue===e)return;K&&(K.close(),K=null,ue=null);let t=O.createServer(Ie());t.listen(e,`127.0.0.1`,()=>{ue=e,console.log(`Config web server running at http://localhost:${e}`)}),t.on(`error`,e=>{console.error(`Failed to start config web server:`,e)}),K=t}function Re(){if(!B||B.isDestroyed())return;let e=Q(),t=B.getBounds();L=Z({...e,floatingButton:{...e.floatingButton,position:{x:t.x,y:t.y}}}),Ce(L)}function ze(e,t,n,r){return new Promise(i=>{if(!e||e.isDestroyed()){i();return}let a=Date.now(),o=n-t;e.setOpacity(t);let s=setInterval(()=>{if(!e||e.isDestroyed()){clearInterval(s),i();return}let n=Date.now()-a,c=Math.min(1,n/r);e.setOpacity(t+o*c),c>=1&&(clearInterval(s),i())},16)})}async function Be(){if(!B||B.isDestroyed()||!B.isVisible())return;let e=B.getOpacity();await ze(B,Number.isFinite(e)?e:1,0,de),B&&!B.isDestroyed()&&(B.hide(),B.setOpacity(1))}async function Ve(){!B||B.isDestroyed()||(B.setOpacity(0),B.show(),B.focus(),await ze(B,0,1,de))}function He(){if(B&&!B.isDestroyed())return B;L=Q();let e=L,t=Math.round(50*(e.floatingButton.sizePercent/100)),n=Math.max(72,t+20),r=Math.max(72,t+20),i=Number.isFinite(Number(e.floatingButton.position.x)),a=Number.isFinite(Number(e.floatingButton.position.y)),o={width:n,height:r,frame:!1,resizable:!1,minimizable:!1,maximizable:!1,hasShadow:!1,transparent:!0,alwaysOnTop:e.floatingButton.alwaysOnTop,skipTaskbar:!N,type:N?void 0:`toolbar`,focusable:N?!0:process.platform!==`win32`,webPreferences:{preload:j.join(__dirname,`preload.js`),contextIsolation:!0,nodeIntegration:!1,autoplayPolicy:`no-user-gesture-required`}};i&&a&&(o.x=Math.round(Number(e.floatingButton.position.x)),o.y=Math.round(Number(e.floatingButton.position.y)));let s=new E(o);return B=s,s.setIgnoreMouseEvents(!0,{forward:!0}),e.floatingButton.alwaysOnTop&&s.setAlwaysOnTop(!0,`screen-saver`),e.webConfig&&e.webConfig.adminTopmostEnabled&&typeof s.setVisibleOnAllWorkspaces==`function`&&s.setVisibleOnAllWorkspaces(!0,{visibleOnFullScreen:!0}),s.setMenuBarVisibility(!1),process.env.VITE_DEV_SERVER_URL?s.loadURL(process.env.VITE_DEV_SERVER_URL):(N&&s.webContents.openDevTools({mode:`detach`}),s.loadFile(j.join(__dirname,`../dist/index.html`))),s.webContents.on(`context-menu`,e=>{e.preventDefault()}),s.on(`hide`,()=>{q||H||setTimeout(()=>{!B||B.isDestroyed()||q||H||B.isVisible()||(B.setOpacity(1),B.show())},0)}),s.on(`closed`,()=>{B=null,!q&&!H&&setTimeout(()=>{!q&&!H&&He()},60)}),s}function Ue(){J&&=(clearInterval(J),null),J=setInterval(()=>{if(!(q||H)){if(!B||B.isDestroyed()){He();return}B.isVisible()||(B.setOpacity(1),B.show())}},450)}function We(e={}){let t=!!e.keepFloatingHidden;if(!V||V.isDestroyed()){t||(H=!1,Ve());return}if(V.isVisible()&&V.hide(),t){H=!0;return}H=!1,Ve()}function Ge(){if(V&&!V.isDestroyed())return;let e=new E({show:!1,frame:!1,transparent:!0,fullscreen:!0,resizable:!1,minimizable:!1,maximizable:!1,movable:!1,alwaysOnTop:!0,skipTaskbar:!N,webPreferences:{preload:j.join(__dirname,`preload.js`),contextIsolation:!0,nodeIntegration:!1,autoplayPolicy:`no-user-gesture-required`}});V=e,ce=!1,e.setMenuBarVisibility(!1),process.env.VITE_DEV_SERVER_URL?e.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-count`):e.loadURL(`file://${j.join(__dirname,`../dist/index.html`)}#/pick-count`),N&&e.webContents.openDevTools({mode:`detach`}),e.once(`ready-to-show`,()=>{ce=!0}),e.on(`closed`,()=>{V=null,ce=!1,q||Ve()})}function Ke(){if(Ge(),!V||V.isDestroyed())return;let e=()=>{!V||V.isDestroyed()||(V.webContents.send(`pick-count:open`),V.show(),V.focus())};ce?e():V.once(`ready-to-show`,e),H=!0,Be()}function qe(){if(!U||U.isDestroyed()){W=[],H=!1,Ve(),V&&!V.isDestroyed()&&V.webContents.send(`pick-count:stop-bgm`);return}G+=1,U.webContents.send(`pick-result:reset`,{token:G,reason:`close`}),U.setOpacity(0),U.isVisible()||U.show(),setTimeout(()=>{!U||U.isDestroyed()||(U.hide(),U.setOpacity(1))},60),W=[],H=!1,Ve(),V&&!V.isDestroyed()&&V.webContents.send(`pick-count:stop-bgm`)}function Je(){if(U&&!U.isDestroyed())return;let e=new E({show:!1,frame:!1,transparent:!0,fullscreen:!0,resizable:!1,minimizable:!1,maximizable:!1,movable:!1,alwaysOnTop:!0,skipTaskbar:!N,backgroundColor:`#00000000`,webPreferences:{preload:j.join(__dirname,`preload.js`),contextIsolation:!0,nodeIntegration:!1,autoplayPolicy:`no-user-gesture-required`}});U=e,le=!1,e.setMenuBarVisibility(!1),process.env.VITE_DEV_SERVER_URL?e.loadURL(`${process.env.VITE_DEV_SERVER_URL}#/pick-result`):e.loadURL(`file://${j.join(__dirname,`../dist/index.html`)}#/pick-result`),N&&e.webContents.openDevTools({mode:`detach`}),e.once(`ready-to-show`,()=>{le=!0}),e.on(`closed`,()=>{U=null,le=!1,W=[],q||(H=!1,Ve())})}function Ye(e){if(W=Array.isArray(e)?e:[],Je(),!U||U.isDestroyed())return;let t=()=>{!U||U.isDestroyed()||(G+=1,U.webContents.send(`pick-result:reset`,{token:G,reason:`before-open`}),U.webContents.send(`pick-result:open`,{token:G,results:W}),U.show(),U.focus())};le?t():U.once(`ready-to-show`,t),H=!0,Be()}function Xe(){let e=process.env.VITE_DEV_SERVER_URL?j.join(__dirname,`../public/image/tray.png`):j.join(__dirname,`../dist/image/tray.png`);z=new ne(re.createFromPath(e)),z.setToolTip(`Blue Random Electron`);let t=se({onOpenConfig:()=>{Fe()},onQuit:()=>{T.quit()}});z.setContextMenu(t)}D.handle(`floating-button:get-config`,()=>Q().floatingButton),D.on(`floating-button:clicked`,()=>{Ke()}),D.handle(`pick-count:get-config`,()=>Q().pickCountDialog),D.on(`pick-count:cancel`,()=>{We(),V&&!V.isDestroyed()&&V.webContents.send(`pick-count:stop-bgm`)}),D.on(`pick-count:confirm`,(e,t)=>{let n=Math.round(X(t&&t.count,1,10,1)),r=!!(t&&t.playMusic);console.log(`Pick count confirmed. count=${n}, playMusic=${r}`);let i=De(n);i.length>0&&console.log(`Picked students: ${i.map(e=>e.name).join(`, `)}`),We({keepFloatingHidden:!0}),Ye(i)}),D.handle(`pick-result:get-results`,()=>W),D.handle(`pick-result:get-config`,()=>Q().pickResultDialog),D.on(`pick-result:close`,()=>{qe()}),D.on(`floating-button:drag-start`,(e,t)=>{let n=E.fromWebContents(e.sender);if(!n)return;let r=n.getBounds();R.set(e.sender.id,{startWinX:r.x,startWinY:r.y,width:r.width,height:r.height})}),D.on(`floating-button:drag-move`,(e,t)=>{let n=E.fromWebContents(e.sender),r=R.get(e.sender.id);if(!n||!r||!t)return;let i=Number(t.dx),a=Number(t.dy);Number.isNaN(i)||Number.isNaN(a)||n.setBounds({x:Math.round(r.startWinX+i),y:Math.round(r.startWinY+a),width:r.width,height:r.height})}),D.on(`floating-button:drag-end`,e=>{R.delete(e.sender.id)}),D.on(`floating-button:set-ignore-mouse`,(e,t)=>{let n=E.fromWebContents(e.sender);n&&!n.isDestroyed()&&n.setIgnoreMouseEvents(t,{forward:!0})}),T.whenReady().then(()=>{let e=Q();if(e.webConfig&&e.webConfig.adminTopmostEnabled&&F&&!ge()&&_e().ok){q=!0,T.exit(0);return}Le(),Xe(),He(),Ge(),Je(),Ue(),T.on(`activate`,()=>{E.getAllWindows().length===0&&He()})}),T.on(`before-quit`,()=>{q||(q=!0,J&&=(clearInterval(J),null),Re())}),T.on(`window-all-closed`,()=>{});
>>>>>>> 9fe589d8ef9fef6504d3577334b031147794cf03
