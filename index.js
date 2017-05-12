import connect from 'can-connect';
import param from 'can-param';
import cookies from 'js-cookie';

/* A stripped down version from can-util/dom/ajax is here, with support for tastypie and csrftoken
 */

// from https://gist.github.com/mythz/1334560
var xhrs = [
		function () { return new XMLHttpRequest(); },
		function () { return new ActiveXObject("Microsoft.XMLHTTP"); },
		function () { return new ActiveXObject("MSXML2.XMLHTTP.3.0"); },
		function () { return new ActiveXObject("MSXML2.XMLHTTP"); }
	],
	_xhrf = null;

var makeXhr = function () {
	if (_xhrf != null) {
		return _xhrf();
	}
	for (var i = 0, l = xhrs.length; i < l; i++) {
		try {
			var f = xhrs[i], req = f();
			if (req != null) {
				_xhrf = f;
				return req;
			}
		} catch (e) {
			continue;
		}
	}
	return function () { };
};

var _xhrResp = function (xhr, options) {
	switch (options.dataType || xhr.getResponseHeader("Content-Type").split(";")[0]) {
		case "text/xml":
		case "xml":
			return xhr.responseXML;
		case "text/json":
		case "application/json":
		case "text/javascript":
		case "application/javascript":
		case "application/x-javascript":
		case "json":
			return JSON.parse(xhr.responseText);
		default:
			return xhr.responseText;
	}
};

// used to check for sameOrigin requests
function _sameOrigin(url) {
	var loc = window.location,
		a = document.createElement('a');
	a.href = url;

	return a.hostname == loc.hostname &&
		a.port == loc.port &&
		a.protocol == loc.protocol;
}

var ajax = function (o) {
	var xhr = makeXhr();
	var deferred = {};
	var sameOrigin = _sameOrigin(o.url);
	var promise = new Promise(function(resolve,reject){
		deferred.resolve = resolve;
		deferred.reject = reject;
	});

	xhr.onreadystatechange = function () {
		try {
			if (xhr.readyState === 4) {
				if (xhr.status >= 200 && xhr.status < 300) {
					deferred.resolve( _xhrResp(xhr, o) );
				} else {
					deferred.reject( xhr );
				}
			}
		} catch(e) {
			deferred.reject(e);
		}
	};

	var url = o.url, data = null, type = o.type.toUpperCase();
	var isPost = type === "POST" || type === "PUT" || type === "PATCH";
	if (!isPost && o.data) {
		url += "?" + param(o.data);
	}
	xhr.open(type, url);

	if (isPost) {
		data = sameOrigin ?
			(typeof o.data === "object" ? JSON.stringify(o.data) : o.data):
			param(o.data);

		// CORS simple: `Content-Type` has to be `application/x-www-form-urlencoded`:
		xhr.setRequestHeader("Content-Type", sameOrigin ? "application/json" : "application/x-www-form-urlencoded");
		if (sameOrigin) {
			xhr.setRequestHeader("X-CSRFToken", cookies.get('csrftoken'));
		}
	}

	// CORS simple: no custom headers, so we don't add `X-Requested-With` header:
	if (sameOrigin){
		xhr.setRequestHeader("X-Requested-With", "XMLHttpRequest");
	}

	xhr.send(data);
	return promise;
};

export default connect.behavior('data/tastypie', function(baseConnection) {
	var behavior = {
		_instance_uri: function(instance) {
			return instance[this.resource_uri_field || 'resource_uri'];
		},
		_parse_listdata: function(result) {
			return result[this.listdata_field || 'objects'];
		},
		getListData: function(params) {
			var self = this;
			return ajax({
				type: 'GET',
				url: this.endpoint,
				data: params
			}).then(function(result) {
				return self._parse_listdata(result);
			});
		},
		getData: function(params) {
			return ajax({
				type: 'GET',
				url: this.endpoint + this.id(params) + '/'
			});
		},
		createData: function(params) {
			return ajax({
				type: 'POST',
				url: this.endpoint,
				data: params
			});
		},
		updateData: function(params) {
			return ajax({
				type: 'PUT',
				url: this._instance_uri(params),
				data: params
			});
		},
		destroyData: function(instance) {
			return ajax({
				type: 'DELETE',
				url: this._instance_uri(params)
			});
		}
	};

	return behavior;
});
