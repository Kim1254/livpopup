FOLD = require('fold');
window.addEventListener('resize', resizeEvent);

var canvas;

var painting = false;

var renderer;
var camera;
var controls;

var repaint = false;

var cam_control = false;

var iScene = 0;
var flTime = 0.0;

var parser;

const FADE = {
	VISIBLE: (1 << 0),
	POSITION: (1 << 1),
	ROTATION: (1 << 2),
	SCALE: (1 << 3)
};

const EXCLUDE = {
	MODEL: (1 << 0),
	TEXT: (1 << 1)
};

window.onload = function init()
{
	canvas = document.getElementById("gl-canvas");
	
	var load = new LPP.ConfigParser("./tales/book1/config.json");
	load.open(oncomplete);
	
	document.getElementById("btn01").onclick = function(event)
	{
		console.log("test", camera.position, camera.rotation);
	}
	document.getElementById("btn02").onclick = function(event)
	{
		console.log(parser._status);
		if (parser == undefined || parser._status != 2)
			return;
		
		if (parser._scenario.length > iScene)
		{
			flTime = 0.0;
			iScene += 1;
		}
	};

	resizeEvent();
}

function resizeEvent() {
	var width = window.innerWidth;
	var height = window.innerHeight;
	
	if (repaint || canvas.width != width || canvas.height != height)
	{
		canvas.width = width;
		canvas.height = height;
		
		if (!painting)
			return;
		
		if (renderer == undefined)
			renderer = new THREE.WebGLRenderer({canvas});
		renderer.setSize(width, height);

		if (camera == undefined)
			camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
		else
			camera.aspect = width / height;
		
		if (controls == undefined)
			controls = new THREE.OrbitControls(camera, renderer.domElement);
		
		controlUpdate(cam_control);
		
		repaint = false;
	}
}

function oncomplete(result)
{
	if (result == undefined) // fail
	{
		return;
	}
	
	parser = result;
	
	iScene = 0;
	flTime = 0.0;

	painting = repaint = true;
	resizeEvent();
	
	const scene = new THREE.Scene();
	scene.background = new THREE.Color(parser._bg);
	
	for (var i = 0; i < parser._light.length; i++)
	{
		var data = parser._light[i];
		
		var light;
		if (data.type == 0)
			light = new THREE.AmbientLight(data.color, data.additive);
		else if (data.type == 1)
			light = new THREE.PointLight(data.color, data.additive);
		
		if (data.position != undefined)
			light.position.set(data.position[0], data.position[1], data.position[2]);
		
		scene.add(light);
	}
	
	const clock = new THREE.Clock();
	const loader = new THREE.GLTFLoader();
	const ftloader = new THREE.FontLoader();
	
	var gltf_list = {};
	var font_list = {};
	var text_list = {};
	
	// TODO: do async load with call by value (data). To avoid value changes.
	function load_glft(data)
	{
		loader.load(data.path, function(gltf)
		{
			var model = gltf.scene.children[0];
			model.position.set(0, 0, 0);
			model.scale.set(1, 1, 1);
			
			// Alpha blending
			// https://github.com/mrdoob/three.js/issues/22598
			// 
			// Only supports mesh with material, No material list:
			if (model.material != undefined)
			{
				model.material.format = THREE.RGBAFormat;
				model.material.opacity = 1.0;
				model.material.transparent = true;
			}
			model.visible = false;
			
			// extra data for events
			gltf.userData = {};
			
			gltf.mixer = new THREE.AnimationMixer(gltf.scene);
			gltf_list[data.name] = gltf;
			
			scene.add(gltf.scene);
		},
		undefined,
		function (error)
		{
			console.error(error);
		});
	}
	
	function load_font(name)
	{
		if (font_list[name] != undefined)
		{
			return new Promise(function(resolve, reject) { resolve(font_list[name]); } );
		}
		
		return new Promise(function(resolve, reject)
		{
			var path = undefined;
			for (var i = 0; i < parser._font.length; i++)
			{
				if (name == parser._font[i].name)
				{
					path = parser._font[i].path;
					break;
				}
			}
			
			if (path == undefined)
				return reject("undefined font");
			
			ftloader.load(path, function(font)
			{
				font_list[name] = font;
				resolve(font);
			},
			undefined,
			function(error) { reject(error) }
			);
		});
	}
	
	function load_text(data)
	{
		try {
			load_font(data.font).then(function(font)
			{
				var geometry = new THREE.TextGeometry(
					data.text,
					{
						font: font,
						size: data.size,
						height: data.height,
						curveSegments: 12
					}
				);
				
				geometry.translate(0, 0, 0);
				var material = new THREE.MeshBasicMaterial({ color: data.color });
				
				var mesh = new THREE.Mesh(geometry, material);
				
				mesh.visible = false;
				
				mesh.material.format = THREE.RGBAFormat;
				mesh.material.opacity = 1.0;
				mesh.material.transparent = true;
				
				scene.add(mesh);
				
				text_list[data.name] = mesh;
			});
		} catch (error) {
			console.log(error);
		}
	}
	
	for (var i = 0; i < parser._model.length; i++)
		load_glft(parser._model[i]);
	
	for (var i = 0; i < parser._font.length; i++)
		load_font(parser._font[i].name);
	
	for (var i = 0; i < parser._text.length; i++)
		load_text(parser._text[i]);
	
	function uploadEvent(gltf, model, ev)
	{
		// remove previous event data
		gltf.userData = {};
		
		if (ev.position != undefined && model.position != undefined)
		{
			gltf.userData.srcpos = {};
			Object.assign(gltf.userData.srcpos, model.position);
			gltf.userData.destpos = to_coord(ev.position);
		}
		
		if (ev.rotation != undefined && model.rotation != undefined)
		{
			gltf.userData.srcangle = {
				x: model.rotation.x,
				y: model.rotation.y,
				z: model.rotation.z
			};
			
			var rotate_ary = ev.rotation.slice();
			for (var i = 0; i < 3; i++)
				rotate_ary[i] = rotate_ary[i] / 180.0 * Math.PI;
			
			gltf.userData.destangle = to_coord(rotate_ary);
		}
		
		if (ev.scale != undefined)
		{
			gltf.userData.srcscale = {};
			Object.assign(gltf.userData.srcscale, model.scale);
			gltf.userData.destscale = to_coord(ev.scale);
		}
		
		gltf.userData.duration = 0.0;
		gltf.userData.fade = 0;
		gltf.userData.animloop = 0;
		gltf.userData.loop = false;
		gltf.userData.finish_restore = false;
		gltf.userData.framerate = 1.0;
		
		if (ev.fade != undefined)
			gltf.userData.fade = array_to_bit(ev.fade);
		
		// iterative inputs (saves only a single key)
		var keys = ["visible", "duration", "animation",
				"animloop", "loop", "finish_restore",
				"framerate"];
		
		for (var i = 0; i < keys.length; i++)
			if (ev[keys[i]] != undefined)
				gltf.userData[keys[i]] = ev[keys[i]];
		
		if (gltf.userData.fade & FADE.VISIBLE)
		{
			if (model.material == undefined)
			{
				console.log(`Warning: ${ev.target} has no material, fade effect ignored.`);
				gltf.userData.fade &= ~FADE.VISIBLE;
			}
		}
		
		gltf.userData.evtime = flTime;
	}
	
	function uploadEffect(data, ev)
	{
		var exclude = 0;
		if (ev.exclude != undefined)
			exclude = array_to_bit(ev.exclude);
		
		// iterative inputs (saves only a single key)
		var keys = ["noise_position", "noise_rotation", "noise_scale"];
		for (var i = 0; i < keys.length; i++)
		{
			if (ev[keys[i]] != undefined)
			{
				data[keys[i]] = {};
				var ef = data[keys[i]];
				
				ef.exclude = exclude;
				ef.range = ev[keys[i]];
				ef.duration = ev.duration;
				ef.loop = ev.loop;
				ef.evtime = flTime;
			}
		}
	}
	
	function updateGltf(gltf, model)
	{
		var data = gltf.userData;
		
		if (data.evtime == undefined)
			return;
		
		var proceed = 1.0;
		
		if (data.duration > 0.001)
		{
			proceed = data.evtime + data.duration - flTime;
			proceed = Math.max(0.0, proceed / data.duration);
			proceed = 1.0 - proceed;
		}
		
		if (data.srcpos != undefined)
		{
			var position = data.destpos;
			
			if (data.fade & FADE.POSITION)
				position = projection(data.srcpos, data.destpos, proceed);
			
			Object.assign(model.position, position);
		}
		
		if (data.srcangle != undefined)
		{
			var rotation = data.destangle;
			
			if (data.fade & FADE.ROTATION)
				rotation = projection(data.srcangle, data.destangle, proceed);
			
			Object.assign(model.rotation, rotation);
		}
		
		if (data.srcscale != undefined)
		{
			var scale = data.destscale;
			
			if (data.fade & FADE.SCALE)
				scale = projection(data.srcscale, data.destscale, proceed);
			
			Object.assign(model.scale, scale);
		}
		
		if (data.visible != undefined)
		{
			var visible = data.visible;
			
			if (data.fade & FADE.VISIBLE)
			{
				visible = true;
				model.material.opacity = proceed;
				
				if (!data.visible)
					model.material.opacity = 1.0 - model.material.opacity;
				
				if (model.material.opacity == 0.0)
					visible = false;
			}
			
			model.visible = visible;
		}
		
		if (data.animation != undefined)
		{
			const clip = THREE.AnimationClip.findByName(gltf.animations, data.animation);
			const act = gltf.mixer.clipAction(clip);
			if (data.animtime == undefined)
			{
				if (data.animloop == -1)
					act.setLoop(1);
				else
					act.setLoop(0, data.animloop);
				
				act.clampWhenFinished = !data.finish_restore;
				act.timeScale = data.framerate;
				
				act.play();
				
				data.animtime = flTime + act._clip.duration / act.timeScale;
			}
		}
		
		if (proceed == 1.0)
		{
			if (data.loop)
				data.evtime = flTime;
			else
				gltf.userData = {};
		}
	}
	
	function updateCamera(cam)
	{
		var data = cam.userData;
		
		if (data.evtime == undefined)
			return;
		
		var proceed = 1.0;
		
		if (data.duration != undefined && data.duration > 0.001)
		{
			proceed = data.evtime + data.duration - flTime;
			proceed = Math.max(0.0, proceed / data.duration);
			proceed = 1.0 - proceed;
		}
		
		if (data.srcpos != undefined)
		{
			var position = data.destpos;
			
			if (data.fade & FADE.POSITION)
				position = projection(data.srcpos, data.destpos, proceed);
			
			Object.assign(camera.position, position);
		}
		
		if (data.srcangle != undefined)
		{
			var rotation = data.destangle;
			
			if (data.fade & FADE.ROTATION)
				rotation = projection(data.srcangle, data.destangle, proceed);
			
			Object.assign(camera.rotation, rotation);
		}
		
		if (proceed == 1.0)
		{
			if (data.loop)
				data.evtime = flTime;
			else if (iScene == 0)
				cam.userData = {};
		}
	}
	
	function applyEffect(key, data, model)
	{
		var ef = data[key];
		
		switch (key)
		{
			case "noise_position":
			{
				model.position.x += rand(ef.range[0], ef.range[1]);
				model.position.y += rand(ef.range[0], ef.range[1]);
				model.position.z += rand(ef.range[0], ef.range[1]);
				break;
			}
			case "noise_rotation":
			{
				model.rotation.x += rand(ef.range[0], ef.range[1]);
				model.rotation.y += rand(ef.range[0], ef.range[1]);
				model.rotation.z += rand(ef.range[0], ef.range[1]);
				break;
			}
			case "noise_scale":
			{
				model.scale.x += rand(ef.range[0], ef.range[1]);
				model.scale.y += rand(ef.range[0], ef.range[1]);
				model.scale.z += rand(ef.range[0], ef.range[1]);
				break;
			}
		}
		
		if (ef.evtime + ef.duration <= flTime)
		{
			if (ef.loop)
				ef.evtime = flTime;
			else
				delete data[key];
		}
	}
	
	var cam_data = {userData: {}, effect: {}};
	
	function copyto(src, dst)
	{
		Object.assign(dst.position, src.position);
		Object.assign(dst.rotation, src.rotation);
		Object.assign(dst.scale, src.scale);
	}
	
	var gltf_backup = {};
	var text_backup = {};
	
	function animate()
	{
		delta = clock.getDelta();
		flTime += delta;
		
		if (iScene < parser._scenario.length) // valid scene number;
		{
			keys = Object.keys(parser._scenario);
			var events = parser._scenario[keys[iScene]];
			
			keys = Object.keys(events);
			for (var i = 0; i < keys.length; i++)
			{
				var ev = events[keys[i]];
				
				if (ev[0]) // already proceed event
					continue;
				
				if (ev[1].time != undefined)
					if (flTime <= ev[1].time)
						continue;
				
				if (ev[1].target == undefined)
					continue;
				
				switch (ev[1].target)
				{
					case "camera":
					{
						ev[0] = true;
						uploadEvent(cam_data, camera, ev[1]);
						
						if (ev[1].fix != undefined)
							controlUpdate(!ev[1].fix);
						
						break;
					}
					case "effect":
					{
						ev[0] = true;
						uploadEffect(cam_data.effect, ev[1]);
						break;
					}
					default:
					{
						var gltf = gltf_list[ev[1].target];
						
						if (gltf == undefined)
						{
							gltf = text_list[ev[1].target];
							if (gltf == undefined)
								continue;
						
							ev[0] = true;
							uploadEvent(gltf, gltf, ev[1]);
							continue;
						}
						
						ev[0] = true;
						uploadEvent(gltf, gltf.scene.children[0], ev[1]);
					}
				}
			}
		}
		
		keys = Object.keys(gltf_list);
		for (var i = 0; i < keys.length; i++)
		{
			var gltf = gltf_list[keys[i]];
			model = gltf.scene.children[0];
			
			updateGltf(gltf, model);
			gltf.mixer.update(delta);
			
			gltf_backup[keys[i]] = {position: {}, rotation: {}, scale: {}};
			copyto(model, gltf_backup[keys[i]]);
			
			ekeys = Object.keys(cam_data.effect);
			for (var j = 0; j < ekeys.length; j++)
			{
				if (cam_data.effect[ekeys[j]].exclude & EXCLUDE.MODEL)
					continue;
				
				applyEffect(ekeys[j], cam_data.effect, model);
			}
		}
		
		keys = Object.keys(text_list);
		for (var i = 0; i < keys.length; i++)
		{
			var mesh = text_list[keys[i]];
			
			updateGltf(mesh, mesh);
			
			text_backup[keys[i]] = {position: {}, rotation: {}, scale: {}};
			copyto(mesh, text_backup[keys[i]]);
			
			ekeys = Object.keys(cam_data.effect);
			for (var j = 0; j < ekeys.length; j++)
			{
				if (cam_data.effect[ekeys[j]].exclude & EXCLUDE.TEXT)
					continue;
				
				applyEffect(ekeys[j], cam_data.effect, mesh);
			}
		}
		
		updateCamera(cam_data);
		
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
		
		controls.update();
		
		keys = Object.keys(gltf_list);
		for (var i = 0; i < keys.length; i++)
		{
			var gltf = gltf_list[keys[i]];
			model = gltf.scene.children[0];
			copyto(gltf_backup[keys[i]], model);
			delete gltf_backup[keys[i]];
		}
		
		keys = Object.keys(text_list);
		for (var i = 0; i < keys.length; i++)
		{
			var mesh = text_list[keys[i]];
			copyto(text_backup[keys[i]], mesh);
			delete text_backup[keys[i]];
		}
	}
	
	animate();
}
	
function controlUpdate(value)
{
	cam_control = value;
	if (controls != undefined)
		controls.enabled = value;
}

function array_to_bit(array)
{
	var result = 0;
	for (var i = 0; i < array.length; i++)
		if (array[i] == true)
			result |= (1 << i);
	
	return result;
}

function projection(a, b, scale)
{
	return {
		x: a.x + (b.x - a.x) * scale,
		y: a.y + (b.y - a.y) * scale,
		z: a.z + (b.z - a.z) * scale
	};
}

function to_coord(array)
{
	return {x: array[0], y: array[1], z: array[2]};
}

function to_array(obj)
{
	return [obj.x, obj.y, obj.z];
}

function rand(min, max)
{
	return min + max * Math.random();
}
