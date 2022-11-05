FOLD = require('fold');
window.addEventListener('resize', resizeEvent);

var canvas;

var painting = false;

var renderer;
var camera;
var controls;

var repaint = false;

var iScene = 0;
var flTime = 0.0;

const FADE = {
	VISIBLE: (1 << 0),
	POSITION: (1 << 1),
	ROTATION: (1 << 2),
	SCALE: (1 << 3)
};

window.onload = function init()
{
	canvas = document.getElementById("gl-canvas");
	
	var parser = new LPP.ConfigParser("./tales/book1/config.json");
	parser.open(oncomplete);

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
		
		renderer = new THREE.WebGLRenderer({canvas});
		renderer.setSize(width, height);

		camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 1000);
		camera.rotation.y = 0.25 * Math.PI;
		camera.position.x = 0;
		camera.position.y = 50;
		camera.position.z = 0;

		controls = new THREE.OrbitControls(camera, renderer.domElement);
		
		repaint = false;
	}
}

function oncomplete(parser)
{
	if (parser == undefined) // fail
	{
		return;
	}
	
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
	
	var gltf_list = {};
	
	// TODO: do async load with call by value (data). To avoid value changes.
	function load_glft(data)
	{
		loader.load(data.path, function(gltf)
		{
			var model = gltf.scene.children[0];
			Object.assign(model.position, to_coord(data.position));
			Object.assign(model.scale, to_coord(data.scale));
			
			// Alpha blending
			// https://github.com/mrdoob/three.js/issues/22598
			// 
			// Only supports mesh with material, No material list:
			// render.js:94 Warning: ./gltf/MomPig/scene.gltf has no material, alpha blending ignored.
			// render.js:94 Warning: ./gltf/Pig3/scene.gltf has no material, alpha blending ignored.
			// render.js:94 Warning: ./gltf/Pig2/scene.gltf has no material, alpha blending ignored.
			// render.js:94 Warning: ./gltf/book/scene.gltf has no material, alpha blending ignored.
			// render.js:94 Warning: ./gltf/BrickHouse/scene.gltf has no material, alpha blending ignored.
			// 
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
	
	for (var i = 0; i < parser._model.length; i++)
		load_glft(parser._model[i]);
	
	function uploadEvent(gltf, model, ev)
	{
		// remove previous event data
		gltf.userData = {};
		
		if (ev.position != undefined)
		{
			gltf.userData.srcpos = {};
			Object.assign(gltf.userData.srcpos, model.position);
			gltf.userData.destpos = to_coord(ev.position);
		}
		
		if (ev.rotation != undefined)
		{
			gltf.userData.srcangle = {
				x: model.rotation.x,
				y: model.rotation.y,
				z: model.rotation.z
			};
			
			var rotate_ary = ev.rotation;
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
				
				act.clampWhenFinished = data.finish_restore;
				act.timeScale = data.framerate;
				console.log(act);
				
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
	
	var testt = false;
	
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
					if (flTime > ev[1].time)
						continue;
				
				if (ev[1].target == undefined)
					continue;
				
				var gltf = gltf_list[ev[1].target];
				
				if (gltf == undefined)
					continue;
				
				ev[0] = true;
				uploadEvent(gltf, gltf.scene.children[0], ev[1]);
			}
		}
		
		keys = Object.keys(gltf_list);
		
		for (var i = 0; i < keys.length; i++)
		{
			var gltf = gltf_list[keys[i]];
			model = gltf.scene.children[0];
			
			updateGltf(gltf, model);
			gltf.mixer.update(delta);
		}
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
		
		controls.update();
		testt = true;
	}
	
	animate();
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
