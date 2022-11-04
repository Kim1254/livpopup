FOLD = require('fold');
window.addEventListener('resize', resizeEvent);

var canvas;

var painting = false;

var renderer;
var camera;
var controls;

var repaint = false;

window.onload = function init()
{
	canvas = document.getElementById("gl-canvas");
	
	var parser = new LPP.Parser("./tales/book1/config.json");
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

function oncomplete(parser) {
	if (parser == undefined) // fail
	{
		return;
	}

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
	
	var mixer_list = [];
	
	for (var i = 0; i < parser._model.length; i++)
	{
		loader.load(parser._model[i].path, function(gltf) {
			var data;
			for (var j = 0; j < parser._model.length; j++)
			{
				data = parser._model[j];
				if (data.path.includes(gltf.parser.options.path))
					break;
				
				if (j == parser._model.length - 1)
					return;
			}
			
			model = gltf.scene.children[0];
			model.scale.set(data.scale, data.scale, data.scale);
			
			if (data.position != undefined)
				model.position.set(data.position[0], data.position[1], data.position[2]);
			
			var mixer = new THREE.AnimationMixer(gltf.scene);
			
			const clip = THREE.AnimationClip.findByName(gltf.animations, data.animation[0]);
			const act = mixer.clipAction(clip);
			
			var ran = 25 + parseInt(Math.random() * 10);
			act.setLoop(0, ran);
			act.play();
			
			mixer_list.push(mixer);
			
			scene.add(gltf.scene);
		}, undefined, function (error) {
			console.error(error);
		});
	}
	
	console.log(scene.children);
	
	function animate() {
		delta = clock.getDelta();
		for (var i = 0; i < mixer_list.length; i++)
		{
			mixer_list[i].update(delta);
		}
		renderer.render(scene, camera);
		requestAnimationFrame(animate);
		
		controls.update();
	}
	
	animate();
}
