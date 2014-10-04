/*
This module defines errors and status/error codes to be sent back to the application.

*/

exports.STATUS_CODE_OK = 0;
exports.STATUS_TYPE_AUTH = "auth";


exports.statusCode = function (code, type, text) {

    var status = {
        type: type,
        code: code,
    }

    if (text) {
        status.text = text;
    }

    return status;
}

// General success function.
exports.success = function (type, text) {

    return exports.statusCode(type, exports.STATUS_CODE_OK, text);
}
