var LPP = (function () {
	'use strict';
	
	var _utils = {};
	
	// public
	
	_utils.Parser = class ConfigParser {
		constructor(filepath)
		{
			this._path = filepath;
			this._status = 0;
			
			this._model = [];
		}
		
		open(callback = undefined)
		{
			if (xhr != undefined)
			{
				xhr.open('get', this._path, true);
				xhr.onreadystatechange = function()
				{
					if (xhr.readyState != 4)
						return;
					
					if (xhr.status != 200)
					{
						console.log("Error:", xhr.readyState, xhr.status);
						this._status = 3;
						
						if (callback != undefined)
							callback(undefined);
					}
					
					var data = xhr.responseText;
					var json = JSON.parse(data);
					
					this._data = json;
					this._status = 2;
					
					this._bg = parseInt(json['background'], 16);
					
					this._light = [];
					
					var light = json['light'];
					if (light != undefined)
					{
						var keys = Object.keys(light);
						for (var i = 0; i < keys.length; i++)
						{
							var light_elem = light[keys[i]];
							var elem = {
								type: light_elem['type'],
								color: parseInt(light_elem['color'], 16),
								position: light_elem['position'],
								additive: light_elem['additive']
							};
							this._light.push(elem);
						}
					}
					
					this._model = [];
					
					var model = json['model'];
					if (model != undefined)
					{
						var keys = Object.keys(model);
						for (var i = 0; i < keys.length; i++)
						{
							var model_elem = model[keys[i]];
							var elem = {
								path: model_elem['path'],
								scale: model_elem['scale'],
								position: model_elem['position'],
								animation: model_elem['animation']
							};
							this._model.push(elem);
						}
					}
					
					if (callback != undefined)
						callback(this);
				}
				
				xhr.send(null);
				this._status = 1;
			}
		}
		
		get getData()
		{
			return this._data;
		}
	}
	
	return init();
	
	// protected
	
	function init()
	{
		// Reference: https://cross-milestone.tistory.com/148
		if (window.ActiveObject)
			xhr = new ActiveXObject("Msxml2.XMLHTTP");
		else if (window.XMLHttpRequest)
			xhr = new XMLHttpRequest();
		
		return _utils;
	}
	
	// private
	var xhr = undefined;
	
})();