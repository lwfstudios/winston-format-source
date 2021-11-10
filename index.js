'use strict';

// LogForm
const { format } = require('logform');

// Path Support
const path = require('path');

/*
 * function filterCallSite (callSite)
 * Returns false if callSite should be filtered out (as it is part of Winston internal libraries), or true otherwise
 */
function filterCallSite(callSite) {
	let typeName = callSite.getTypeName();
	let methodName = callSite.getMethodName();
	let fileName = callSite.getFileName() || '<Unknown File>';
	return !(
		(typeName == 'Format' && methodName == 'transform') ||
		(typeName == 'DerivedLogger') ||
		(fileName.includes('/node_modules/readable-stream/')) ||
		(fileName.includes('/node_modules/winston/')) ||
		(fileName.includes('/node_modules/winston-transport/')) ||
		(fileName.includes('/node_modules/logform/'))
	);
}

/*
 * function prepareStackTraceAsStructured (error, structuredStackTrace)
 * Returns just the structured stack trace.  This is used to capture the structured stack trace rather than the text version
 */
function prepareStackTraceAsStructured(error, structuredStackTrace) {
	return structuredStackTrace;
}

/*
 * function format (info)
 * Returns a new instance of the FileAndFunctionFormat Format which prepends the message with the file and function
 * in the info.
 *
 */
module.exports = format((info, opts = {}) => {
	// Generate Stack Trace
	let error = {};
	let stackTrace = undefined;
	let originalLimit = Error.stackTraceLimit;
	let originalPrepareStackTrace = Error.prepareStackTrace;
	try {
		Error.stackTraceLimit = 50;
		Error.prepareStackTrace = prepareStackTraceAsStructured;
		Error.captureStackTrace(error);
		stackTrace = error.stack;
	}
	catch (err) {
		console.error('FileAndFunctionFormat.format: Failed to capture stack trace: ' + err);
	}
	Error.stackTraceLimit = originalLimit;
	Error.prepareStackTrace = originalPrepareStackTrace;
	let callee = undefined;
	try {
		callee = stackTrace.filter(filterCallSite)[0];
	}
	catch (err) {
		console.error('FileAndFunctionFormat.format: Failed to filter stack trace: ' + err);
	}

	try {
		if (callee) {	
			if (opts.prepend) {
				let source = undefined;
				let typeName = callee.getTypeName();
				let methodName = callee.getMethodName();
				let functionName = callee.getFunctionName();
				let fileName = callee.getFileName();
				if (opts.removeExtension) {
					fileName = path.basename(fileName, path.extname(fileName));
				}
				else {
					fileName = path.basename(fileName);
				}
				let lineNumber = callee.getLineNumber();
				if (typeName === 'Object' && functionName && functionName.includes('.')) {
					source = functionName;
				}
				else if (typeName && methodName) {
					source = typeName + '.' + methodName;
				}
				else if (functionName) {
					source = fileName + '.' + functionName;
				}
				else {
					source = fileName + ':' + lineNumber;
				}
				info.message = source + ': ' + info.message;
			}
			else {
				info.typeName = callee.getTypeName();
				info.functionName = callee.getFunctionName();
				info.methodName = callee.getMethodName();
				info.fileName = callee.getFileName();
				info.lineNumber = callee.getLineNumber();
			}
		}
		else {
			console.error('FileAndFunctionFormat.format: Unable to find callee');
		}
	}
	catch (err) {
		console.error('FileAndFunctionFormat.format: Failed to add details to info object: ' + err);
		console.error(err.stack);
	}

	// Ensure prepareStackTrace Was Restored
	if (Error.prepareStackTrace == prepareStackTraceAsStructured) {
		console.error('FileAndFunctionFormat.format: Something went wrong as Error.prepareStackTrace was not restored');
	}

	return info;
});
